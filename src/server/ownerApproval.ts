/**
 * موافقة المالك على إضافة موظف
 * -----------------------------
 * إضافة موظف ليست عملية عادية: من يقدر يضيف موظفاً بدور «المالك» أو بصلاحية
 * «إدارة الموظفين» يستطيع ببساطة أن يرفع صلاحياته. لهذا نحتاج تصريحاً صريحاً
 * من مالك المتجر لا مجرد ضغطة زر من مستخدم آخر.
 *
 * الطريقة (بلا إيميل ولا رسوم SMS):
 *  1. التطبيق ينشئ طلب تصريح بمعرّف عشوائي ويعرضه على الشخص الذي يضيف
 *     الموظف في شاشة «تصريح المالك».
 *  2. المالك (وهو مسجّل في متصفح أو جوال آخر) يفتح تبويب الموظفين، يجد الطلب
 *     ظاهراً بالاسم والصلاحيات المطلوبة، ثم يُدخل **الرمز السري الخاص به**
 *     (PIN المالك) — وهذا هو التصريح.
 *  3. بعدها يكمل حفظ الموظف من أي جهاز، لأن الطلب صار مصرَّحاً به.
 *
 * الطلب محفوظ على الخادم (في قاعدة البيانات) لا في المتصفح، فيعمل بين
 * الأجهزة، ولأن رمز المالك يُتحقق منه على الخادم لا يمكن لأحد تجاوزه.
 */
import crypto from 'node:crypto';
import { db } from './db.ts';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'used';

export interface OwnerApprovalRecord {
  id: string;
  tenantId: string;
  requestedBy: string;
  requestedById: string;
  employeeName: string;
  employeeRole: string;
  permissions: string[];
  /** لماذا هذا الطلب يحتاج تصريحاً — يُعرض للمالك. */
  reason: string;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  approvedAt?: string;
  approvedBy?: string;
  usedAt?: string;
}

const TTL_MS = 2 * 60 * 60 * 1000; // ساعتان

/** صلاحيات خطيرة لا تُمنح إلا بموافقة المالك. */
export const SENSITIVE_PERMISSIONS = ['manage_staff', 'edit_prices', 'view_profits', 'view_cogs'] as const;

export function requiresOwnerApproval(role: string, permissions: string[]): { required: boolean; reason: string } {
  if (role === 'owner' || role === 'super_admin') {
    return { required: true, reason: 'الموظف الجديد بدور «المالك / المدير» — صلاحيات كاملة على المتجر.' };
  }
  const sensitive = permissions.filter((p) => (SENSITIVE_PERMISSIONS as readonly string[]).includes(p));
  if (sensitive.length > 0) {
    const labels: Record<string, string> = {
      manage_staff: 'إدارة الموظفين',
      edit_prices: 'تعديل الأسعار',
      view_profits: 'صافي الأرباح',
      view_cogs: 'تكلفة الشراء',
    };
    return {
      required: true,
      reason: `الطلب يمنح صلاحيات حساسة: ${sensitive.map((p) => labels[p] || p).join(' · ')}`,
    };
  }
  return { required: false, reason: '' };
}

/** Store (multi-instance safe: everything goes through the shared DB row). */
function readAll(): OwnerApprovalRecord[] {
  const bag = db.getSchema() as any;
  if (!Array.isArray(bag.ownerApprovals)) bag.ownerApprovals = [];
  return bag.ownerApprovals as OwnerApprovalRecord[];
}

function writeAll(rows: OwnerApprovalRecord[]): void {
  (db.getSchema() as any).ownerApprovals = rows.slice(0, 500);
  db.commit();
}

/** ينشئ الطلب أو يعيد استخدام طلب معلّق مطابق (لنفس المستخدم/الاسم/الدور). */
export function createApprovalRequest(input: {
  tenantId: string;
  requestedBy: string;
  requestedById: string;
  employeeName: string;
  employeeRole: string;
  permissions: string[];
  reason: string;
}): OwnerApprovalRecord {
  const rows = readAll();
  const dup = rows.find(
    (r) =>
      r.tenantId === input.tenantId &&
      r.status === 'pending' &&
      r.requestedById === input.requestedById &&
      r.employeeName === input.employeeName &&
      r.employeeRole === input.employeeRole
  );
  if (dup && new Date(dup.expiresAt).getTime() > Date.now()) return dup;

  const now = Date.now();
  const record: OwnerApprovalRecord = {
    id: `apr_${crypto.randomBytes(6).toString('hex')}`,
    tenantId: input.tenantId,
    requestedBy: input.requestedBy,
    requestedById: input.requestedById,
    employeeName: input.employeeName,
    employeeRole: input.employeeRole,
    permissions: input.permissions.slice(0, 30),
    reason: input.reason,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  writeAll([record, ...rows]);
  db.logAudit({
    tenantId: input.tenantId,
    actorId: input.requestedById,
    actorName: input.requestedBy,
    action: 'REQUEST_EMPLOYEE_APPROVAL',
    entity: 'Employee',
    entityId: record.id,
    details: `طلب تصريح مالك لإضافة «${input.employeeName}» — ${input.reason}`,
  });
  return record;
}

export function getApproval(tenantId: string, id: string): OwnerApprovalRecord | null {
  return readAll().find((r) => r.tenantId === tenantId && r.id === id) || null;
}

export function listPending(tenantId: string): OwnerApprovalRecord[] {
  return readAll().filter((r) => r.tenantId === tenantId && r.status === 'pending');
}

export function approve(tenantId: string, id: string, approvedBy: string): OwnerApprovalRecord | null {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec || rec.status !== 'pending') return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  rec.status = 'approved';
  rec.approvedAt = new Date().toISOString();
  rec.approvedBy = approvedBy;
  writeAll(rows);
  db.logAudit({
    tenantId,
    actorId: 'owner',
    actorName: approvedBy,
    action: 'APPROVE_EMPLOYEE',
    entity: 'Employee',
    entityId: rec.id,
    details: `صادق المالك على إضافة «${rec.employeeName}»`,
  });
  return rec;
}

export function reject(tenantId: string, id: string, rejectedBy: string): OwnerApprovalRecord | null {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec || rec.status !== 'pending') return null;
  rec.status = 'rejected';
  rec.approvedAt = new Date().toISOString();
  rec.approvedBy = rejectedBy;
  writeAll(rows);
  db.logAudit({
    tenantId,
    actorId: 'owner',
    actorName: rejectedBy,
    action: 'REJECT_EMPLOYEE',
    entity: 'Employee',
    entityId: rec.id,
    details: `رفض المالك إضافة «${rec.employeeName}»`,
  });
  return rec;
}

/** يتحقق أن الطلب مصرَّح به وغير مستخدم وغير منتهٍ. */
export function consumeApproval(tenantId: string, id: string): { ok: boolean; error?: string; record?: OwnerApprovalRecord } {
  const rows = readAll();
  const rec = rows.find((r) => r.tenantId === tenantId && r.id === id);
  if (!rec) return { ok: false, error: 'طلب التصريح غير موجود.' };
  if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: 'انتهت صلاحية طلب التصريح — اطلب تصريحاً جديداً من المالك.' };
  if (rec.status === 'pending') return { ok: false, error: 'لم يوافق المالك على هذا الطلب بعد.' };
  if (rec.status === 'rejected') return { ok: false, error: 'رفض المالك هذا الطلب.' };
  if (rec.status === 'used') return { ok: false, error: 'هذا التصريح استُخدم من قبل — اطلب تصريحاً جديداً.' };
  rec.status = 'used';
  rec.usedAt = new Date().toISOString();
  writeAll(rows);
  return { ok: true, record: rec };
}
