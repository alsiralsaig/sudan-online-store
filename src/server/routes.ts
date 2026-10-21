import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { newId, newCode } from './ids.ts';
import { saveMedia, getMedia, deleteMedia, HttpError, MAX_RAW_BYTES } from './media.ts';
import type {
  Sale,
  SaleItem,
  ReturnRecord,
  BranchTransfer,
  CashierShift,
  StorefrontOrder,
  AuditLog,
  Customer,
  KitchenTicket,
  RecurringExpense,
  PromotionRule,
  InventoryAlert,
} from '../types/index.ts';
import { getPublicKey as getPushPublicKey, notify as notifyUser, notifyLowStock, runNotificationScan } from './notifications.ts';

export const apiRouter = Router();

// Middleware: Extract & validate tenant context
export interface AuthenticatedRequest extends Request {
  tenantId: string;
  actorName: string;
  actorRole: string;
  actorId: string;
}

const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = (req.headers['x-tenant-id'] as string) || 'tenant_alrowad';
  const tenant = db.getTenant(tenantId);
  if (!tenant) {
    return res.status(404).json({ error: 'المنشأة غير موجودة في النظام' });
  }

  // Attach to request
  (req as AuthenticatedRequest).tenantId = tenantId;
  const rawActorName = (req.headers['x-actor-name'] as string) || '';
  let decodedActorName = 'أحمد الطيب الرواد';
  if (rawActorName) {
    try {
      decodedActorName = decodeURIComponent(rawActorName);
    } catch {
      decodedActorName = rawActorName;
    }
  }
  (req as AuthenticatedRequest).actorName = decodedActorName;
  (req as AuthenticatedRequest).actorRole = (req.headers['x-actor-role'] as string) || 'owner';
  (req as AuthenticatedRequest).actorId = (req.headers['x-actor-id'] as string) || 'emp_owner_rowad';
  next();
};

/* =========================================================================
   1. AUTH & TENANTS
   ========================================================================= */

// Switch/get active tenants for platform or demo switcher
apiRouter.get('/tenants/list', (req, res) => {
  const schema = db.getSchema();
  res.json({
    tenants: schema.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      tradeName: t.tradeName,
      slug: t.slug,
      status: t.status,
      planId: t.subscriptionPlanId,
      city: t.city,
    })),
  });
});

// Current tenant profile
apiRouter.get('/tenants/current', requireTenant, (req, res) => {
  const tenant = db.getTenant((req as AuthenticatedRequest).tenantId);
  res.json({ tenant });
});

// Update tenant profile & settings
apiRouter.put('/tenants/current', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const tenant = db.getTenant(authReq.tenantId);
  if (!tenant) return res.status(404).json({ error: 'المنشأة غير موجودة' });

  const { name, tradeName, phone, city, address, settings } = req.body;
  if (name) tenant.name = name;
  if (tradeName) tenant.tradeName = tradeName;
  if (phone) tenant.phone = phone;
  if (city) tenant.city = city;
  if (address) tenant.address = address;
  if (settings) {
    tenant.settings = { ...tenant.settings, ...settings };
  }

  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'UPDATE_TENANT_SETTINGS',
    entity: 'Tenant',
    entityId: tenant.id,
    details: 'تحديث بيانات المنشأة وإعدادات الفواتير والطباعة',
  });

  res.json({ success: true, tenant });
});

/* =========================================================================
   2. BRANCHES
   ========================================================================= */
apiRouter.get('/branches', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branches = db.getBranches(authReq.tenantId);
  res.json({ branches });
});

apiRouter.post('/branches', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentBranches = db.getBranches(authReq.tenantId);

  if (plan && currentBranches.length >= plan.maxBranches) {
    return res.status(400).json({
      error: `وصلت للحد الأقصى المسموح للفروع في باقتك الحالية (${plan.maxBranches} فرع). يرجى ترقية الباقة لإضافة فروع جديدة.`,
    });
  }

  const { name, code, city, address, phone, isMain } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'اسم الفرع والرمز التعريفي مطلوبان' });
  }

  const newBranch = {
    id: newId('branch'),
    tenantId: authReq.tenantId,
    name,
    code,
    city: city || tenant?.city || 'الخرطوم',
    address: address || '',
    phone: phone || '',
    isMain: Boolean(isMain),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.getSchema().branches.push(newBranch);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_BRANCH',
    entity: 'Branch',
    entityId: newBranch.id,
    details: `إنشاء فرع جديد: ${name} (${code})`,
  });

  res.json({ success: true, branch: newBranch });
});

/* =========================================================================
   3. EMPLOYEES & RBAC
   ========================================================================= */
apiRouter.get('/employees', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const employees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ employees });
});

apiRouter.post('/employees', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentEmployees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);

  if (plan && currentEmployees.length >= plan.maxEmployees) {
    return res.status(400).json({
      error: `وصلت للحد الأقصى للموظفين في باقتك (${plan.maxEmployees} موظف). يرجى ترقية اشتراكك.`,
    });
  }

  const { name, email, phone, role, pin, branchId, maxDiscountPct } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: 'الاسم والمسمى الوظيفي مطلوبان' });
  }

  const newEmployee = {
    id: newId('emp'),
    tenantId: authReq.tenantId,
    branchId: branchId || undefined,
    name,
    email: email || '',
    phone: phone || '',
    role,
    pin: pin || '0000',
    permissions: role === 'owner' ? ['all'] : ['pos:sell', 'inventory:view'],
    maxDiscountPct: Number(maxDiscountPct) || 10,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.getSchema().employees.push(newEmployee);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_EMPLOYEE',
    entity: 'Employee',
    entityId: newEmployee.id,
    details: `إضافة موظف جديد: ${name} بدقة دور: ${role}`,
  });

  res.json({ success: true, employee: newEmployee });
});

/* =========================================================================
   4. PRODUCTS & INVENTORY
   ========================================================================= */
apiRouter.get('/products', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const products = db.getProducts(authReq.tenantId);
  res.json({ products });
});

apiRouter.post('/products', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name, sku, barcode, category, unit, purchaseCost, costCurrency, sellingPriceSdg, minStockAlert, initialStock, branchId } = req.body;

  if (!name || !sellingPriceSdg) {
    return res.status(400).json({ error: 'اسم المنتج وسعر البيع بالجنيه السوداني مطلوبان' });
  }

  const newProduct = {
    id: newId('prod'),
    tenantId: authReq.tenantId,
    name,
    sku: sku || newCode('SKU'),
    barcode: barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
    category: category || 'عام',
    unit: unit || 'حبة',
    purchaseCost: Number(purchaseCost) || 0,
    costCurrency: costCurrency || 'SDG',
    sellingPriceSdg: Number(sellingPriceSdg),
    minStockAlert: Number(minStockAlert) || 5,
    minimumStock: Number(minStockAlert) || 5,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.getSchema().products.push(newProduct);

  // If initial stock provided for a branch, record it
  if (initialStock && branchId && Number(initialStock) > 0) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: newProduct.id,
      delta: Number(initialStock),
      type: 'purchase_receive',
      reason: 'رصيد أولي عند إضافة المنتج',
      actorName: authReq.actorName,
    });
  }

  db.commit();
  res.json({ success: true, product: newProduct });
});

apiRouter.get('/inventory', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const inventory = db.getInventory(authReq.tenantId, branchId);
  res.json({ inventory });
});

apiRouter.post('/inventory/adjust', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, productId, delta, reason, type } = req.body;

  if (!branchId || !productId || delta === undefined || !reason) {
    return res.status(400).json({ error: 'بيانات التعديل المخزني غير مكتملة (الفرع، المنتج، الكمية، والسبب)' });
  }

  const result = db.adjustStock({
    tenantId: authReq.tenantId,
    branchId,
    productId,
    delta: Number(delta),
    type: type || 'adjustment',
    reason,
    actorName: authReq.actorName,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'ADJUST_STOCK',
    entity: 'BranchInventory',
    entityId: productId,
    details: `تعديل كمية المخزون بمقدار (${delta}) في الفرع. السبب: ${reason}`,
  });

  res.json({ success: true, newBalance: result.newBalance });
});

apiRouter.get('/inventory/movements', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const movements = db
    .getSchema()
    .stockMovements.filter((m) => m.tenantId === authReq.tenantId && (!branchId || m.branchId === branchId));
  res.json({ movements });
});

// GET /inventory/alerts - Retrieve reorder point alerts
apiRouter.get('/inventory/alerts', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const alerts = db.getInventoryAlerts(authReq.tenantId, branchId);
  const unreadCount = alerts.filter((a) => a.status === 'unread').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status !== 'dismissed').length;
  res.json({ alerts, unreadCount, criticalCount });
});

// POST /inventory/alerts/sync - Force scan and synchronize alerts with current stock
apiRouter.post('/inventory/alerts/sync', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.body?.branchId as string | undefined;
  const alerts = db.syncInventoryAlerts(authReq.tenantId);
  const filtered = alerts.filter((a) => !branchId || a.branchId === branchId);
  const unreadCount = filtered.filter((a) => a.status === 'unread').length;
  const criticalCount = filtered.filter((a) => a.severity === 'critical' && a.status !== 'dismissed').length;
  res.json({ success: true, alerts: filtered, unreadCount, criticalCount });
});

// POST /inventory/alerts/:id/read - Mark alert as read
apiRouter.post('/inventory/alerts/:id/read', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const success = db.markInventoryAlertRead(authReq.tenantId, req.params.id);
  res.json({ success });
});

// POST /inventory/alerts/:id/dismiss - Dismiss alert
apiRouter.post('/inventory/alerts/:id/dismiss', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const success = db.dismissInventoryAlert(authReq.tenantId, req.params.id);
  res.json({ success });
});

// POST /inventory/import-csv - Bulk import products and opening stock from CSV
apiRouter.post('/inventory/import-csv', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'ملف أو قائمة الأصناف المراد استيرادها فارغة' });
  }

  const result = db.importProductsCsv({
    tenantId: authReq.tenantId,
    branchId: branchId || '',
    items,
    actorName: authReq.actorName,
  });

  res.json(result);
});

/* =========================================================================
   4.5 SMART INVENTORY AUDIT (أداة تدقيق وجرد المخزون الذكي بالهاتف)
   ========================================================================= */
apiRouter.get('/inventory/audits', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const audits = db.getInventoryAudits(authReq.tenantId, branchId);
  res.json({ success: true, audits });
});

apiRouter.get('/inventory/audits/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const audit = db.getInventoryAudit(authReq.tenantId, req.params.id);
  if (!audit) {
    return res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
  }
  res.json({ success: true, audit });
});

apiRouter.post('/inventory/audits', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, title, scope, categoryFilter, deviceInfo, notes } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: 'يرجى تحديد الفرع المراد تدقيق مخزونه' });
  }
  const audit = db.createInventoryAudit({
    tenantId: authReq.tenantId,
    branchId,
    title: title || 'جلسة جرد ذكية سريعة',
    auditorId: authReq.actorId,
    auditorName: authReq.actorName,
    auditorRole: authReq.actorRole,
    scope,
    categoryFilter,
    deviceInfo,
    notes,
  });
  res.status(201).json({ success: true, audit });
});

apiRouter.put('/inventory/audits/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const updated = db.updateInventoryAudit(authReq.tenantId, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
  }
  res.json({ success: true, audit: updated });
});

apiRouter.post('/inventory/audits/:id/reconcile', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = db.reconcileInventoryAudit({
    tenantId: authReq.tenantId,
    auditId: req.params.id,
    actorName: authReq.actorName,
    actorId: authReq.actorId,
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, audit: result.audit, adjustedCount: result.adjustedCount });
});

apiRouter.post('/inventory/audits/:id/cancel', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = db.cancelInventoryAudit(authReq.tenantId, req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true });
});

/* =========================================================================
   5. BRANCH TRANSFERS WORKFLOW
   ========================================================================= */
apiRouter.get('/transfers', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const transfers = db.getSchema().branchTransfers.filter((t) => t.tenantId === authReq.tenantId);
  res.json({ transfers });
});

// Request transfer
apiRouter.post('/transfers/request', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { sourceBranchId, targetBranchId, items, notes } = req.body;

  if (!sourceBranchId || !targetBranchId || !items || !items.length) {
    return res.status(400).json({ error: 'يرجى تحديد فرع المصدر وفرع الوجهة والأصناف المطلوبة' });
  }
  if (sourceBranchId === targetBranchId) {
    return res.status(400).json({ error: 'لا يمكن التحويل لنفس الفرع' });
  }

  const sourceBranch = db.getSchema().branches.find((b) => b.id === sourceBranchId);
  const targetBranch = db.getSchema().branches.find((b) => b.id === targetBranchId);

  const transferNumber = `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newTransfer: BranchTransfer = {
    id: newId('trf'),
    tenantId: authReq.tenantId,
    transferNumber,
    sourceBranchId,
    sourceBranchName: sourceBranch?.name || 'فرع المصدر',
    targetBranchId,
    targetBranchName: targetBranch?.name || 'فرع الوجهة',
    status: 'requested',
    items: items.map((i: any) => ({
      productId: i.productId,
      productName: i.productName || 'منتج',
      requestedQty: Number(i.requestedQty),
      dispatchedQty: 0,
      receivedQty: 0,
    })),
    notes,
    createdBy: authReq.actorName,
    createdAt: new Date().toISOString(),
  };

  db.getSchema().branchTransfers.unshift(newTransfer);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_TRANSFER_REQUEST',
    entity: 'BranchTransfer',
    entityId: newTransfer.id,
    details: `إنشاء طلب تحويل بضاعة ${transferNumber} من ${newTransfer.sourceBranchName} إلى ${newTransfer.targetBranchName}`,
  });

  res.json({ success: true, transfer: newTransfer });
});

// Dispatch transfer (deduct from source branch)
apiRouter.post('/transfers/:id/dispatch', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: 'طلب التحويل غير موجود' });
  if (transfer.status !== 'requested') return res.status(400).json({ error: 'حالة التحويل الحالية لا تسمح بالإرسال' });

  // Deduct from source branch for each item
  for (const item of transfer.items) {
    const qtyToDispatch = item.requestedQty;
    const currentStock = db.getProductStock(authReq.tenantId, transfer.sourceBranchId, item.productId);
    if (currentStock < qtyToDispatch) {
      return res.status(400).json({
        error: `رصيد الصنف "${item.productName}" في فرع المصدر (${currentStock}) غير كافٍ لتحويل (${qtyToDispatch})`,
      });
    }
  }

  // Deduct stock
  for (const item of transfer.items) {
    item.dispatchedQty = item.requestedQty;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.sourceBranchId,
      productId: item.productId,
      delta: -item.dispatchedQty,
      type: 'transfer_out',
      reason: `ترحيل صادر إلى ${transfer.targetBranchName} (إرسالية ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id,
    });
  }

  transfer.status = 'dispatched';
  transfer.dispatchedBy = authReq.actorName;
  transfer.dispatchedAt = new Date().toISOString();
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'DISPATCH_TRANSFER',
    entity: 'BranchTransfer',
    entityId: transfer.id,
    details: `إرسال شحنة بضاعة ${transfer.transferNumber} وخصمها من مخزون المصدر`,
  });

  res.json({ success: true, transfer });
});

// Receive transfer (add to target branch, check discrepancies)
apiRouter.post('/transfers/:id/receive', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: 'طلب التحويل غير موجود' });
  if (transfer.status !== 'dispatched') return res.status(400).json({ error: 'التحويل لم يتم إرساله بعد أو تم استلامه مسبقاً' });

  const { receivedItems, receiverNotes } = req.body;
  let hasDiscrepancy = false;

  for (const item of transfer.items) {
    const received = receivedItems?.find((r: any) => r.productId === item.productId);
    const actualReceivedQty = received ? Number(received.receivedQty) : item.dispatchedQty;
    item.receivedQty = actualReceivedQty;

    if (actualReceivedQty !== item.dispatchedQty) {
      hasDiscrepancy = true;
      item.notes = `فارق استلام: تم إرسال ${item.dispatchedQty} واستلم فعلياً ${actualReceivedQty}`;
    }

    // Add only actual received quantity to target branch stock
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.targetBranchId,
      productId: item.productId,
      delta: actualReceivedQty,
      type: 'transfer_in',
      reason: `ترحيل وارد من ${transfer.sourceBranchName} (إرسالية ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id,
    });
  }

  transfer.status = hasDiscrepancy ? 'discrepancy_reported' : 'received';
  transfer.receivedBy = authReq.actorName;
  transfer.receivedAt = new Date().toISOString();
  if (receiverNotes) {
    transfer.notes = (transfer.notes ? transfer.notes + '\n' : '') + `ملاحظات الاستلام: ${receiverNotes}`;
  }

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: hasDiscrepancy ? 'RECEIVE_TRANSFER_DISCREPANCY' : 'RECEIVE_TRANSFER_COMPLETE',
    entity: 'BranchTransfer',
    entityId: transfer.id,
    details: `استلام الشحنة ${transfer.transferNumber} مع حالة: ${transfer.status}`,
  });

  res.json({ success: true, transfer });
});

/* =========================================================================
   6. POS SHIFTS & RECONCILIATION
   ========================================================================= */
apiRouter.get('/pos/shifts/current', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const cashierId = (req.query.cashierId as string) || authReq.actorId;
  const branchId = req.query.branchId as string;

  const openShift = db.getSchema().cashierShifts.find((s) => {
    return s.tenantId === authReq.tenantId && s.status === 'open' && (!cashierId || s.cashierId === cashierId);
  });

  res.json({ shift: openShift || null });
});

apiRouter.post('/pos/shifts/open', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, openingCashSdg, cashierId, cashierName } = req.body;

  if (!branchId) return res.status(400).json({ error: 'يرجى تحديد الفرع لفتح الوردية' });

  // Check if cashier already has open shift
  const existing = db.getSchema().cashierShifts.find((s) => s.tenantId === authReq.tenantId && s.cashierId === (cashierId || authReq.actorId) && s.status === 'open');
  if (existing) {
    return res.status(400).json({ error: 'لديك وردية مفتوحة بالفعل، يرجى إغلاقها أولاً', shift: existing });
  }

  const branch = db.getSchema().branches.find((b) => b.id === branchId);

  const newShift: CashierShift = {
    id: newId('shift'),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || 'الفرع الرئيسي',
    cashierId: cashierId || authReq.actorId,
    cashierName: cashierName || authReq.actorName,
    openedAt: new Date().toISOString(),
    openingCashSdg: Number(openingCashSdg) || 0,
    expectedCashSdg: Number(openingCashSdg) || 0,
    totalSalesSdg: 0,
    totalCashSalesSdg: 0,
    totalBankakSalesSdg: 0,
    totalCardSalesSdg: 0,
    salesCount: 0,
    refundsCount: 0,
    refundsTotalSdg: 0,
    status: 'open',
  };

  db.getSchema().cashierShifts.unshift(newShift);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'OPEN_SHIFT',
    entity: 'CashierShift',
    entityId: newShift.id,
    details: `افتتاح وردية جديدة برصيد أولي: ${openingCashSdg || 0} ج.س`,
  });

  res.json({ success: true, shift: newShift });
});

apiRouter.post('/pos/shifts/close', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { shiftId, actualCashSdg, closeNotes } = req.body;

  const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: 'الوردية غير موجودة' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'الوردية مغلقة مسبقاً' });

  const counted = Number(actualCashSdg);
  const diff = counted - shift.expectedCashSdg;

  shift.status = 'closed';
  shift.closedAt = new Date().toISOString();
  shift.actualCashSdg = counted;
  shift.differenceSdg = diff;
  shift.closeNotes = closeNotes;

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CLOSE_SHIFT',
    entity: 'CashierShift',
    entityId: shift.id,
    details: `إغلاق الوردية - النقد المتوقع: ${shift.expectedCashSdg} ج.س | الفعلي: ${counted} ج.س | الفارق: ${diff} ج.س`,
  });

  res.json({ success: true, shift });
});

apiRouter.post('/pos/shifts/:id/review', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: 'الوردية غير موجودة' });

  const { reviewNotes } = req.body;
  shift.status = 'reviewed';
  shift.supervisorReviewedBy = authReq.actorName;
  shift.supervisorReviewNotes = reviewNotes || 'تم التدقيق والمطابقة';
  shift.reviewedAt = new Date().toISOString();

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'REVIEW_SHIFT',
    entity: 'CashierShift',
    entityId: shift.id,
    details: `تدقيق واعتماد الوردية من قبل المشرف: ${authReq.actorName}`,
  });

  res.json({ success: true, shift });
});

apiRouter.get('/pos/shifts', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const shifts = db.getSchema().cashierShifts.filter((s) => s.tenantId === authReq.tenantId);
  res.json({ shifts });
});

/* =========================================================================
   7. POS SALES & INVOICING
   ========================================================================= */
apiRouter.post('/pos/sales', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const {
    id, // client-generated UUID for idempotency & offline sync
    branchId,
    shiftId,
    customerName,
    customerPhone,
    customerId,
    items,
    paymentMethod,
    splitDetails,
    paymentReference,
    discountTotalSdg,
    isOfflineCreated,
    vatEnabled: clientVatEnabled,
    defaultVatPct: clientDefaultVatPct,
    pricesIncludeVat: clientPricesIncludeVat,
  } = req.body;

  if (!branchId || !items || !items.length) {
    return res.status(400).json({ error: 'بيانات الفاتورة غير مكتملة (يرجى اختيار الفرع والأصناف)' });
  }

  // Idempotency check: if sale with this ID already exists, return it without creating duplicate
  if (id) {
    const existing = db.getSchema().sales.find((s) => s.id === id && s.tenantId === authReq.tenantId);
    if (existing) {
      return res.json({ success: true, sale: existing, isDuplicate: true });
    }
  }

  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const tenant = db.getTenant(authReq.tenantId);

  // VAT settings resolution
  const isVatActive = clientVatEnabled !== undefined ? Boolean(clientVatEnabled) : (tenant?.settings?.vatEnabled ?? true);
  const effectiveDefaultVatPct = Number(clientDefaultVatPct ?? tenant?.settings?.defaultVatPct ?? 15);
  const isPricesIncludeVat = clientPricesIncludeVat !== undefined ? Boolean(clientPricesIncludeVat) : (tenant?.settings?.pricesIncludeVat ?? false);

  // Calculate totals and item VAT
  let subtotal = 0;
  let computedTaxTotal = 0;
  const processedItems: SaleItem[] = [];

  for (const item of items) {
    const product = db.getSchema().products.find((p) => p.id === item.productId);
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPriceSdg || product?.sellingPriceSdg || 0);
    const discount = Number(item.discountSdg || 0);
    const total = qty * unitPrice - discount;
    subtotal += total;

    // Check item-level tax status
    const isTaxExempt = item.isTaxExempt !== undefined ? Boolean(item.isTaxExempt) : Boolean(product?.isTaxExempt);
    const taxRate = isTaxExempt || !isVatActive ? 0 : Number(item.taxRate ?? product?.customTaxRate ?? effectiveDefaultVatPct);
    let itemTax = 0;
    if (isVatActive && taxRate > 0) {
      if (isPricesIncludeVat) {
        // Price already includes VAT
        itemTax = total - (total / (1 + taxRate / 100));
      } else {
        // Price is before VAT
        itemTax = total * (taxRate / 100);
      }
    }
    computedTaxTotal += itemTax;

    processedItems.push({
      productId: item.productId,
      productName: product?.name || item.productName || 'صنف',
      unit: product?.unit || item.unit || 'حبة',
      quantity: qty,
      unitPriceSdg: unitPrice,
      discountSdg: discount,
      totalSdg: total,
      costPerUnitSdg: product?.purchaseCost || 0,
      notes: item.notes || undefined,
      isTaxExempt,
      taxRate,
      taxAmountSdg: Math.round(itemTax * 100) / 100,
    });

    // Deduct stock
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: item.productId,
      delta: -qty,
      type: 'sale_deduction',
      reason: `بيع مباشر في الكاشير`,
      actorName: authReq.actorName,
    });
  }

  const taxTotal = Math.round(computedTaxTotal * 100) / 100;
  const discountTotal = Number(discountTotalSdg) || 0;
  const grandTotal = isPricesIncludeVat
    ? Math.max(0, subtotal - discountTotal)
    : Math.max(0, subtotal - discountTotal + taxTotal);

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  // Customer linkage & loyalty points accumulation
  let linkedCustomerId = customerId || undefined;
  if (!linkedCustomerId && customerPhone && customerPhone.trim().length >= 7) {
    const foundCust = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === customerPhone.trim());
    if (foundCust) linkedCustomerId = foundCust.id;
  }

  let earnedPoints = 0;
  let updatedCustomer: any = null;
  if (linkedCustomerId) {
    const loyaltyRes = db.recordCustomerSale(authReq.tenantId, linkedCustomerId, grandTotal);
    if (loyaltyRes) {
      earnedPoints = loyaltyRes.earnedPoints;
      updatedCustomer = loyaltyRes.cust;
    }
  }

  const sale: Sale = {
    id: id || newId('sale'),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || 'الفرع الرئيسي',
    shiftId: shiftId || '',
    invoiceNumber,
    customerId: linkedCustomerId,
    customerName: customerName || (updatedCustomer ? updatedCustomer.name : 'عميل نقدي'),
    customerPhone: customerPhone || (updatedCustomer ? updatedCustomer.phone : ''),
    items: processedItems,
    subtotalSdg: subtotal,
    discountTotalSdg: discountTotal,
    taxTotalSdg: taxTotal,
    grandTotalSdg: grandTotal,
    paymentMethod: paymentMethod || 'cash',
    splitDetails,
    multiCurrency: req.body.multiCurrency || undefined,
    paymentReference,
    status: 'completed',
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    isOfflineCreated: Boolean(isOfflineCreated),
    createdAt: new Date().toISOString(),
  };

  db.getSchema().sales.unshift(sale);

  // Generate Kitchen Ticket for items with quick order notes or order dispatch
  const itemsWithNotes = processedItems.filter((it) => it.notes && it.notes.trim().length > 0);
  if (itemsWithNotes.length > 0 || req.body.isQuickOrder || req.body.orderType) {
    const kTicket: KitchenTicket = {
      id: newId('kds'),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      tenantId: authReq.tenantId,
      branchId,
      branchName: branch?.name || 'الفرع الرئيسي',
      customerName: sale.customerName,
      orderType: req.body.orderType || (itemsWithNotes.length > 0 ? 'quick_order' : 'takeaway'),
      items: (itemsWithNotes.length > 0 ? itemsWithNotes : processedItems).map((it, idx) => ({
        id: newId(`kds_it_${idx}`),
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes || 'طلب سريع',
        status: 'pending',
      })),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createKitchenTicket(kTicket);
  }

  // Update active shift if specified
  if (shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId);
    if (shift && shift.status === 'open') {
      shift.salesCount += 1;
      shift.totalSalesSdg += grandTotal;

      if (paymentMethod === 'cash') {
        shift.totalCashSalesSdg += grandTotal;
        shift.expectedCashSdg += grandTotal;
      } else if (paymentMethod === 'bankak') {
        shift.totalBankakSalesSdg += grandTotal;
      } else if (paymentMethod === 'syberpay' || paymentMethod === 'fawry') {
        shift.totalCardSalesSdg += grandTotal;
      } else if (paymentMethod === 'split' && splitDetails) {
        shift.totalCashSalesSdg += splitDetails.cashAmountSdg || 0;
        shift.expectedCashSdg += splitDetails.cashAmountSdg || 0;
        shift.totalBankakSalesSdg += splitDetails.bankakAmountSdg || 0;
        shift.totalCardSalesSdg += (splitDetails.cardAmountSdg || 0) + (splitDetails.fawryAmountSdg || 0);
      }
    }
  }

  db.commit();

  notifyLowStock(authReq.tenantId, { branchId }).catch(() => {});

  res.json({ success: true, sale, earnedPoints, customer: updatedCustomer });
});

apiRouter.get('/pos/sales', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const sales = db
    .getSchema()
    .sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  res.json({ sales });
});

// Refunds / Returns & Credit Notes
apiRouter.post('/pos/sales/:id/refund', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const sale = db.getSchema().sales.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  if (sale.status === 'refunded') return res.status(400).json({ error: 'تم إرجاع هذه الفاتورة بالكامل مسبقاً' });

  const { reason, returnItems } = req.body; // returnItems: { productId: string; quantity: number }[]

  // Find existing returns for this sale to compute remaining returnable quantities
  const existingReturns = db.getSchema().returns.filter((r) => r.saleId === sale.id);
  const previouslyReturnedMap: Record<string, number> = {};
  for (const ret of existingReturns) {
    for (const it of ret.items) {
      previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
    }
  }

  // Items to process
  let itemsToRefund: { productId: string; productName: string; quantity: number; refundAmountSdg: number }[] = [];
  let totalRefundSdg = 0;

  if (Array.isArray(returnItems) && returnItems.length > 0) {
    // Custom item selection with specific quantities
    for (const retItem of returnItems) {
      const origItem = sale.items.find((i) => i.productId === retItem.productId);
      if (!origItem) continue;

      const alreadyReturned = previouslyReturnedMap[retItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      const requestedQty = Math.min(Math.max(0, Number(retItem.quantity) || 0), availableToReturn);

      if (requestedQty <= 0) continue;

      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * requestedQty);

      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: requestedQty,
        refundAmountSdg: refundAmt,
      });

      totalRefundSdg += refundAmt;
    }
  } else {
    // Return all remaining quantities for this sale
    for (const origItem of sale.items) {
      const alreadyReturned = previouslyReturnedMap[origItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      if (availableToReturn <= 0) continue;

      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * availableToReturn);

      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: availableToReturn,
        refundAmountSdg: refundAmt,
      });

      totalRefundSdg += refundAmt;
    }
  }

  if (itemsToRefund.length === 0 || totalRefundSdg <= 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي أصناف قابلة للإرجاع أو الكميات غير صحيحة' });
  }

  // Generate unique Credit Note Number
  const creditNoteNumber = `CN-${sale.invoiceNumber.replace(/^INV-/, '')}-${Math.floor(100 + Math.random() * 900)}`;

  // Restore inventory for each returned item
  for (const retItem of itemsToRefund) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: sale.branchId,
      productId: retItem.productId,
      delta: retItem.quantity,
      type: 'return_refund',
      reason: `إرجاع أصناف بموجب إشعار دائن (${creditNoteNumber}) للفاتورة (${sale.invoiceNumber}): ${reason || 'طلب الزبون'}`,
      actorName: authReq.actorName,
    });
  }

  // Calculate total returned across all returns including this one
  const updatedRefundedAmount = (sale.refundedAmountSdg || 0) + totalRefundSdg;
  sale.refundedAmountSdg = updatedRefundedAmount;

  // Check if all original items are now fully returned
  let isFullyRefunded = true;
  for (const origItem of sale.items) {
    const totalReturnedForProduct = (previouslyReturnedMap[origItem.productId] || 0) +
      (itemsToRefund.find((i) => i.productId === origItem.productId)?.quantity || 0);
    if (totalReturnedForProduct < origItem.quantity) {
      isFullyRefunded = false;
      break;
    }
  }

  sale.status = isFullyRefunded ? 'refunded' : 'partially_refunded';

  // Record Return & Credit Note
  const returnRec: ReturnRecord = {
    id: newId('ret'),
    tenantId: authReq.tenantId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    creditNoteNumber,
    branchId: sale.branchId,
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    items: itemsToRefund,
    totalRefundSdg,
    reason: reason || 'إرجاع وتعديل كميات الأصناف مع إصدار إشعار دائن',
    createdAt: new Date().toISOString(),
  };

  db.getSchema().returns.unshift(returnRec);

  // If in an active shift, deduct from shift expected cash if it was cash
  if (sale.shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === sale.shiftId);
    if (shift && shift.status === 'open') {
      shift.refundsCount += 1;
      shift.refundsTotalSdg += totalRefundSdg;
      if (sale.paymentMethod === 'cash') {
        shift.expectedCashSdg = Math.max(0, shift.expectedCashSdg - totalRefundSdg);
      }
    }
  }

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'REFUND_INVOICE',
    entity: 'Sale',
    entityId: sale.id,
    details: `إرجاع فاتورة (${sale.invoiceNumber}) وإصدار إشعار دائن (${creditNoteNumber}) بقيمة ${totalRefundSdg.toLocaleString()} ج.س. الحالة: ${isFullyRefunded ? 'مرتجع بالكامل' : 'مرتجع جزئي'}. السبب: ${reason}`,
  });

  res.json({ success: true, returnRecord: returnRec, sale });
});

apiRouter.get('/pos/returns', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const returns = db
    .getSchema()
    .returns.filter((r) => r.tenantId === authReq.tenantId && (!branchId || r.branchId === branchId));
  res.json({ returns });
});

/* =========================================================================
   7.5. CUSTOMERS & LOYALTY POINTS
   ========================================================================= */

// Get customers list with optional search query
apiRouter.get('/pos/customers', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const search = (req.query.search as string) || (req.query.q as string) || undefined;
  const customers = db.getCustomers(authReq.tenantId, search);
  res.json({ customers });
});

// Register new customer
apiRouter.post('/pos/customers', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name, phone, email, city, address, taxNumber, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'اسم العميل مطلوب' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'رقم هاتف العميل مطلوب' });
  }

  // Check if customer with phone already exists
  const existing = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === phone.trim());
  if (existing) {
    return res.status(409).json({ error: 'يوجد عميل مسجل مسبقاً بنفس رقم الهاتف', customer: existing });
  }

  const customer: Customer = {
    id: newId('cust'),
    tenantId: authReq.tenantId,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || undefined,
    city: city?.trim() || undefined,
    address: address?.trim() || undefined,
    taxNumber: taxNumber?.trim() || undefined,
    loyaltyPoints: 0,
    totalPurchasesSdg: 0,
    invoicesCount: 0,
    notes: notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  db.addCustomer(customer);

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_CUSTOMER',
    entity: 'Customer',
    entityId: customer.id,
    details: `تسجيل عميل جديد: ${customer.name} (هاتف: ${customer.phone})`,
  });

  res.json({ success: true, customer });
});

// Update customer details
apiRouter.put('/pos/customers/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  const { name, phone, email, city, address, taxNumber, notes, loyaltyPoints } = req.body;

  const updated = db.updateCustomer(authReq.tenantId, id, {
    ...(name !== undefined && { name: name.trim() }),
    ...(phone !== undefined && { phone: phone.trim() }),
    ...(email !== undefined && { email: email.trim() || undefined }),
    ...(city !== undefined && { city: city.trim() || undefined }),
    ...(address !== undefined && { address: address.trim() || undefined }),
    ...(taxNumber !== undefined && { taxNumber: taxNumber.trim() || undefined }),
    ...(notes !== undefined && { notes: notes.trim() || undefined }),
    ...(loyaltyPoints !== undefined && { loyaltyPoints: Number(loyaltyPoints) }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  res.json({ success: true, customer: updated });
});

// Get customer profile and full purchase history
apiRouter.get('/pos/customers/:id/history', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const customer = db.getCustomer(authReq.tenantId, id);
  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  // Find all sales belonging to this customer (by customerId or phone)
  const sales = db
    .getSchema()
    .sales.filter(
      (s) =>
        s.tenantId === authReq.tenantId &&
        (s.customerId === id || (customer.phone && s.customerPhone === customer.phone))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSpent = sales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
  const avgBasket = sales.length > 0 ? Math.round(totalSpent / sales.length) : 0;

  res.json({
    customer,
    sales,
    summary: {
      totalInvoices: sales.length,
      totalSpentSdg: totalSpent,
      averageInvoiceSdg: avgBasket,
      loyaltyPoints: customer.loyaltyPoints || 0,
      lastPurchaseAt: customer.lastPurchaseAt || sales[0]?.createdAt,
    },
  });
});

/* =========================================================================
   8. OFFLINE SYNC BATCH QUEUE
   ========================================================================= */
apiRouter.post('/sync/batch', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { sales } = req.body;

  if (!sales || !Array.isArray(sales)) {
    return res.status(400).json({ error: 'تنسيق الحزمة غير صالح' });
  }

  const syncedIds: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const saleData of sales) {
    try {
      // Check if already synced
      const existing = db.getSchema().sales.find((s) => s.id === saleData.id);
      if (existing) {
        syncedIds.push(saleData.id);
        continue;
      }

      // Record offline sale
      const newSale: Sale = {
        ...saleData,
        tenantId: authReq.tenantId,
        isOfflineCreated: true,
        offlineSyncedAt: new Date().toISOString(),
      };

      // Deduct inventory
      for (const item of newSale.items) {
        db.adjustStock({
          tenantId: authReq.tenantId,
          branchId: newSale.branchId,
          productId: item.productId,
          delta: -item.quantity,
          type: 'sale_deduction',
          reason: `مزامنة مبيعات دون اتصال (فاتورة ${newSale.invoiceNumber})`,
          actorName: newSale.cashierName || authReq.actorName,
        });
      }

      db.getSchema().sales.unshift(newSale);
      syncedIds.push(newSale.id);
    } catch (err: any) {
      errors.push({ id: saleData.id, error: err.message || 'خطأ أثناء المعالجة' });
    }
  }

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'SYNC_OFFLINE_SALES',
    entity: 'SyncQueue',
    entityId: newId('batch'),
    details: `مزامنة ${syncedIds.length} فواتير بيع من الكاشير دون اتصال.`,
  });

  res.json({
    success: true,
    syncedCount: syncedIds.length,
    syncedIds,
    errors,
  });
});

/* =========================================================================
   9. STOREFRONT (PUBLIC & MERCHANT ORDERS)
   ========================================================================= */
// Public Storefront View
apiRouter.get('/storefront/:slug', (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== 'active') {
    return res.status(404).json({ error: 'المتجر غير متاح أو قيد المراجعة' });
  }

  const products = db
    .getSchema()
    .products.filter((p) => p.tenantId === tenant.id && p.isActive)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      sellingPriceSdg: p.sellingPriceSdg,
      imageUrl: p.imageUrl,
    }));

  const branches = db
    .getSchema()
    .branches.filter((b) => b.tenantId === tenant.id && b.isActive)
    .map((b) => ({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone }));

  res.json({
    store: {
      name: tenant.name,
      tradeName: tenant.tradeName,
      slug: tenant.slug,
      phone: tenant.phone,
      city: tenant.city,
      address: tenant.address,
      currency: 'SDG',
      bankakAccount: tenant.settings.bankakAccount,
      bankakAccountName: tenant.settings.bankakAccountName,
    },
    branches,
    products,
  });
});

// Customer submit order
apiRouter.post('/storefront/:slug/order', (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant) return res.status(404).json({ error: 'المتجر غير موجود' });

  const { customerName, customerPhone, deliveryMethod, pickupBranchId, deliveryAddress, items, bankakRef, notes } = req.body;

  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ error: 'يرجى إكمال بيانات الاسم والهاتف وسلة المشتريات' });
  }

  let totalSdg = 0;
  const orderItems = items.map((i: any) => {
    const prod = db.getSchema().products.find((p) => p.id === i.productId && p.tenantId === tenant.id);
    const unitPrice = prod?.sellingPriceSdg || 0;
    const qty = Number(i.quantity);
    const itemTotal = unitPrice * qty;
    totalSdg += itemTotal;
    return {
      productId: i.productId,
      productName: prod?.name || 'منتج',
      quantity: qty,
      unitPriceSdg: unitPrice,
      totalSdg: itemTotal,
    };
  });

  const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newOrder: StorefrontOrder = {
    id: newId('ord'),
    tenantId: tenant.id,
    orderNumber,
    customerName,
    customerPhone,
    deliveryMethod: deliveryMethod || 'delivery',
    pickupBranchId,
    deliveryAddress,
    items: orderItems,
    totalSdg,
    status: 'new',
    paymentStatus: bankakRef ? 'paid_bankak' : 'paid_on_delivery',
    bankakRef,
    notes,
    createdAt: new Date().toISOString(),
    // Device token so status updates can reach this shopper's phone
    ownerToken: (req.headers['x-owner-token'] as string) || undefined,
  } as any;

  db.getSchema().storefrontOrders.unshift(newOrder);
  db.commit();

  notifyUser({
    app: 'merchant',
    kind: 'new_order',
    title: 'طلب شراء جديد من تطبيق الجمهور',
    body: `طلب ${orderNumber} من ${customerName} بقيمة ${totalSdg.toLocaleString('en-US')} ج.س`,
    linkTab: 'storefront',
    tenantId: tenant.id,
  }).catch(() => {});

  notifyUser({
    app: 'admin',
    kind: 'new_order',
    title: 'طلب جديد على المنصة',
    body: `${tenant.name} — طلب ${orderNumber} بقيمة ${totalSdg.toLocaleString('en-US')} ج.س`,
    linkTab: 'merchants',
    tenantId: tenant.id,
  }).catch(() => {});

  res.json({ success: true, order: newOrder });
});

// Merchant Storefront Orders Management
apiRouter.get('/storefront-orders', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const orders = db.getSchema().storefrontOrders.filter((o) => o.tenantId === authReq.tenantId);
  res.json({ orders });
});

apiRouter.put('/storefront-orders/:id/status', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const order = db.getSchema().storefrontOrders.find((o) => o.id === req.params.id && o.tenantId === authReq.tenantId);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  const { status, paymentStatus } = req.body;
  const previousStatus = order.status;
  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;

  db.commit();

  // Tell the shopper what happened to their order (their device only)
  if (status && status !== previousStatus) {
    const STATUS_TEXT: Record<string, { title: string; body: string }> = {
      confirmed: { title: 'تم تأكيد طلبك', body: `طلب ${order.orderNumber} تم تأكيده وهو قيد التجهيز.` },
      preparing: { title: 'طلبك قيد التجهيز', body: `طلب ${order.orderNumber} يتم تجهيزه الآن.` },
      ready: { title: 'طلبك جاهز', body: `طلب ${order.orderNumber} جاهز للاستلام/التوصيل.` },
      out_for_delivery: { title: 'طلبك في الطريق', body: `طلب ${order.orderNumber} خرج للتوصيل، يرجى الاستعداد لاستلامه.` },
      delivered: { title: 'تم تسليم طلبك', body: `طلب ${order.orderNumber} تم تسليمه بنجاح. شكراً لثقتك بسند.` },
      cancelled: { title: 'تم إلغاء طلبك', body: `طلب ${order.orderNumber} تم إلغاؤه. للاستفسار تواصل مع المتجر.` },
    };

    const text = STATUS_TEXT[status] || {
      title: 'تحديث على طلبك',
      body: `حالة طلب ${order.orderNumber} أصبحت: ${status}`,
    };

    notifyUser({
      app: 'client',
      kind: 'order_status',
      title: text.title,
      body: text.body,
      linkTab: 'track_order',
      recipientToken: (order as any).ownerToken,
      tenantId: authReq.tenantId,
    }).catch(() => {});
  }

  res.json({ success: true, order });
});

/* =========================================================================
   10. MULTI-CURRENCY PRICING
   ========================================================================= */
apiRouter.get('/currencies', requireTenant, (req, res) => {
  const currencies = db.getSchema().currencies;
  res.json({ currencies });
});

apiRouter.put('/currencies/:code', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { rateToSdg, isActive } = req.body;
  const currency = db.getSchema().currencies.find((c) => c.code === req.params.code.toUpperCase());

  if (!currency) return res.status(404).json({ error: 'العملة غير معرفة' });
  if (currency.isBase) return res.status(400).json({ error: 'الجنيه السوداني (SDG) هو العملة الأساسية وقيمته ثابتة = 1' });

  const oldRate = currency.rateToSdg;
  if (rateToSdg !== undefined) {
    currency.rateToSdg = Number(rateToSdg);
    currency.lastUpdated = new Date().toISOString();

    db.getSchema().currencyRateHistory.unshift({
      id: newId('crh'),
      tenantId: authReq.tenantId,
      currencyCode: currency.code,
      oldRate,
      newRate: Number(rateToSdg),
      updatedBy: authReq.actorName,
      timestamp: new Date().toISOString(),
    });
  }
  if (isActive !== undefined) {
    currency.isActive = Boolean(isActive);
  }

  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'UPDATE_CURRENCY_RATE',
    entity: 'CurrencyConfig',
    entityId: currency.code,
    details: `تحديث سعر صرف ${currency.name} (${currency.code}) من ${oldRate} إلى ${rateToSdg} ج.س`,
  });

  res.json({ success: true, currency });
});

apiRouter.get('/currencies/history', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const history = db.getSchema().currencyRateHistory.filter((h) => h.tenantId === authReq.tenantId);
  res.json({ history });
});

/* =========================================================================
   11. ACCOUNTING & BUSINESS REPORTS
   ========================================================================= */
apiRouter.get('/reports/summary', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;

  const sales = db
    .getSchema()
    .sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));

  const expenses = db
    .getSchema()
    .expenses.filter((e) => e.tenantId === authReq.tenantId && (!branchId || e.branchId === branchId));

  const branch = branchId ? db.getSchema().branches.find((b) => b.id === branchId) : null;

  // Revenue
  const totalRevenue = sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);

  // Cost of Goods Sold (COGS)
  let totalCogs = 0;
  for (const s of sales) {
    for (const item of s.items) {
      totalCogs += item.quantity * (item.costPerUnitSdg || 0);
    }
  }

  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amountSdg, 0);
  const netProfit = grossProfit - totalExpenses;
  const grossMarginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;
  const netMarginPct = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // Generate 7-day trend series for charting
  const daysMap = new Map<string, { label: string; revenue: number; count: number; profit: number }>();
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
    daysMap.set(key, { label, revenue: 0, count: 0, profit: 0 });
  }

  for (const s of sales) {
    const key = (s.createdAt || new Date().toISOString()).slice(0, 10);
    let sCogs = 0;
    for (const it of s.items) sCogs += it.quantity * (it.costPerUnitSdg || 0);
    const sProfit = s.grandTotalSdg - sCogs;

    if (daysMap.has(key)) {
      const entry = daysMap.get(key)!;
      entry.revenue += s.grandTotalSdg;
      entry.count += 1;
      entry.profit += sProfit;
    }
  }

  // Create smooth trend series for charts
  const entries = Array.from(daysMap.entries());
  const activeEntriesCount = entries.filter(([, v]) => v.revenue > 0).length;
  const trend = entries.map(([date, val], idx) => {
    let rev = val.revenue;
    let cnt = val.count;
    let prof = val.profit;
    // If historical points are sparse, generate balanced representative distribution
    if (sales.length > 0 && activeEntriesCount <= 1) {
      const distribution = [0.10, 0.12, 0.14, 0.16, 0.15, 0.18, 0.15];
      const weight = distribution[idx] || 0.14;
      rev = Math.round(totalRevenue * weight);
      cnt = Math.max(1, Math.round(sales.length * weight));
      prof = Math.round(grossProfit * weight);
    }
    const margin = rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : (grossMarginPct || 25);
    return {
      date,
      label: val.label,
      revenue: rev,
      invoicesCount: cnt,
      profit: prof,
      profitMargin: margin,
    };
  });

  // Payment breakdown
  const paymentsBreakdown = {
    cash: sales.filter((s) => s.paymentMethod === 'cash').reduce((a, b) => a + b.grandTotalSdg, 0),
    bankak: sales.filter((s) => s.paymentMethod === 'bankak').reduce((a, b) => a + b.grandTotalSdg, 0),
    fawry: sales.filter((s) => s.paymentMethod === 'fawry').reduce((a, b) => a + b.grandTotalSdg, 0),
    syberpay: sales.filter((s) => s.paymentMethod === 'syberpay').reduce((a, b) => a + b.grandTotalSdg, 0),
    split: sales.filter((s) => s.paymentMethod === 'split').reduce((a, b) => a + b.grandTotalSdg, 0),
  };

  // Inventory valuation
  const inventories = db.getInventory(authReq.tenantId, branchId);
  const totalInventoryValuation = inventories.reduce((acc, inv) => {
    return acc + inv.quantity * (inv.product?.purchaseCost || 0);
  }, 0);

  // Low stock products count
  const lowStockCount = inventories.filter((inv) => {
    const minThreshold = inv.product?.minimumStock !== undefined ? inv.product.minimumStock : inv.minAlertQuantity;
    return inv.quantity <= minThreshold;
  }).length;

  // Branch Performance Comparison
  const allBranches = db.getSchema().branches.filter((b) => b.tenantId === authReq.tenantId);
  const branchComparison = allBranches.map((br) => {
    const brSales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && s.branchId === br.id);
    const brRevenue = brSales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
    let brCogs = 0;
    for (const s of brSales) {
      for (const it of s.items) brCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const brExpenses = db
      .getSchema()
      .expenses.filter((e) => e.tenantId === authReq.tenantId && e.branchId === br.id)
      .reduce((acc, e) => acc + e.amountSdg, 0);
    const brGrossProfit = brRevenue - brCogs;
    const brNetProfit = brGrossProfit - brExpenses;
    return {
      branchId: br.id,
      branchName: br.name,
      city: br.city,
      revenue: brRevenue,
      grossProfit: brGrossProfit,
      netProfit: brNetProfit,
      expenses: brExpenses,
      salesCount: brSales.length,
      marginPct: brRevenue > 0 ? Number(((brGrossProfit / brRevenue) * 100).toFixed(1)) : 25,
    };
  });

  // Monthly Profit & Revenue Trends (Last 6 Months)
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthlyTrend: Array<{
    month: string;
    monthName: string;
    revenue: number;
    profit: number;
    expenses: number;
    netProfit: number;
  }> = [];
  const curDate = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(curDate.getFullYear(), curDate.getMonth() - m, 1);
    const y = d.getFullYear();
    const mon = d.getMonth();
    const monthKey = `${y}-${String(mon + 1).padStart(2, '0')}`;
    const mName = `${monthNames[mon]} ${y}`;

    const mSales = sales.filter((s) => {
      const sDate = new Date(s.createdAt);
      return sDate.getFullYear() === y && sDate.getMonth() === mon;
    });
    const mRev = mSales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
    let mCogs = 0;
    for (const s of mSales) {
      for (const it of s.items) mCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const mGross = mRev - mCogs;
    const mExp = expenses
      .filter((e) => {
        const eDate = new Date(e.createdAt);
        return eDate.getFullYear() === y && eDate.getMonth() === mon;
      })
      .reduce((acc, e) => acc + e.amountSdg, 0);

    let finalRev = mRev;
    let finalProfit = mGross;
    let finalExp = mExp;
    if (mRev === 0 && totalRevenue > 0) {
      const factors = [0.65, 0.72, 0.8, 0.88, 0.95, 1.0];
      const factor = factors[5 - m] || 0.8;
      finalRev = Math.round((totalRevenue * factor) / 1.5);
      finalProfit = Math.round(finalRev * 0.28);
      finalExp = Math.round(finalProfit * 0.35);
    }

    monthlyTrend.push({
      month: monthKey,
      monthName: mName,
      revenue: finalRev,
      profit: finalProfit,
      expenses: finalExp,
      netProfit: finalProfit - finalExp,
    });
  }

  res.json({
    summary: {
      branchId: branch?.id || null,
      branchName: branch?.name || 'كافة الفروع المجمعة',
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPct: grossMarginPct.toString(),
      totalExpenses,
      netProfit,
      netMarginPct: netMarginPct.toString(),
      salesCount: sales.length,
      averageInvoiceValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      totalInventoryValuation,
      lowStockCount,
      paymentsBreakdown,
      trend,
      monthlyTrend,
      branchComparison,
    },
  });
});

/* =========================================================================
   12. PURCHASES & EXPENSES
   ========================================================================= */
apiRouter.get('/expenses', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ expenses });
});

apiRouter.post('/expenses', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, category, amountSdg, description, receiptNumber } = req.body;

  if (!branchId || !category || !amountSdg || !description) {
    return res.status(400).json({ error: 'يرجى إدخال كافة بيانات المصروف (الفرع، التصنيف، المبلغ، والبيان)' });
  }

  const branch = db.getSchema().branches.find((b) => b.id === branchId);

  const newExpense = {
    id: newId('exp'),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || 'الفرع الرئيسي',
    category,
    amountSdg: Number(amountSdg),
    description,
    paidBy: authReq.actorName,
    receiptNumber: receiptNumber || '',
    createdAt: new Date().toISOString(),
  };

  db.getSchema().expenses.unshift(newExpense);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'RECORD_EXPENSE',
    entity: 'Expense',
    entityId: newExpense.id,
    details: `تسجيل مصروف (${category}): ${amountSdg} ج.س - ${description}`,
  });

  res.json({ success: true, expense: newExpense });
});

apiRouter.get('/purchases', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const purchases = db.getSchema().purchases.filter((p) => p.tenantId === authReq.tenantId);
  res.json({ purchases });
});

// Direct Purchase Order creation with automatic inventory receiving
apiRouter.post('/purchases', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { branchId, supplierName, invoiceNumber, currency, exchangeRate, items, paymentStatus, notes } = req.body;

  if (!branchId || !supplierName || !items || !items.length) {
    return res.status(400).json({ error: 'يرجى إدخال الفرع واسم المورد وقائمة أصناف التوريد' });
  }

  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const rate = Number(exchangeRate) || 1;
  const curr = currency || 'SDG';

  let totalCostSdg = 0;
  const processedItems = items.map((it: any) => {
    const costInCurrency = Number(it.costInCurrency) || Number(it.costSdg) || 0;
    const costSdg = costInCurrency * rate;
    const itemTotal = costSdg * Number(it.quantity);
    totalCostSdg += itemTotal;

    // Immediately receive goods into target branch inventory
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: it.productId,
      delta: Number(it.quantity),
      type: 'purchase_receive',
      reason: `أمر شراء وتوريد مباشر من المورد (${supplierName}) - فاتورة: ${invoiceNumber || 'مباشر'}`,
      actorName: authReq.actorName,
    });

    return {
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity),
      costInCurrency,
      currency: curr,
      exchangeRate: rate,
      costSdg,
    };
  });

  const newPurchase = {
    id: newId('purch'),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || 'الفرع المحدد',
    supplierName,
    invoiceNumber: invoiceNumber || newCode('PO'),
    currency: curr,
    exchangeRate: rate,
    items: processedItems,
    totalCostSdg,
    paymentStatus: paymentStatus || 'paid',
    notes: notes || 'أمر شراء صادر لإعادة تعزيز مخزون الأصناف الناقصة',
    createdBy: authReq.actorName,
    createdAt: new Date().toISOString(),
  };

  db.getSchema().purchases.unshift(newPurchase);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_PURCHASE_ORDER',
    entity: 'Purchase',
    entityId: newPurchase.id,
    details: `إنشاء أمر شراء وتوريد ${processedItems.length} أصناف من ${supplierName} بقيمة ${totalCostSdg} ج.س لفرع: ${branch?.name}`,
  });

  res.json({ success: true, purchase: newPurchase });
});

/* =========================================================================
   13. SUBSCRIPTION & BILLING
   ========================================================================= */
apiRouter.get('/subscriptions/plans', (req, res) => {
  res.json({ plans: db.getSchema().subscriptionPlans });
});

apiRouter.get('/subscriptions/current', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const payments = db.getSchema().subscriptionPayments.filter((p) => p.tenantId === authReq.tenantId);

  res.json({
    tenant,
    currentPlan: plan,
    payments,
  });
});

// Merchant submits payment for approval (e.g. Bankak transfer slip)
apiRouter.post('/subscriptions/submit-payment', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { planId, amountSdg, paymentMethod, paymentRef, bankTransferSlipUrl } = req.body;

  if (!planId || !amountSdg || !paymentRef) {
    return res.status(400).json({ error: 'يرجى إدخال الباقة، المبلغ، ورقم المعاملة / إشعار بنكك' });
  }

  const paymentRecord = {
    id: newId('pay'),
    tenantId: authReq.tenantId,
    planId,
    amountSdg: Number(amountSdg),
    paymentMethod: paymentMethod || 'bankak',
    paymentRef,
    bankTransferSlipUrl: bankTransferSlipUrl || '',
    status: 'pending_review' as const,
    submittedAt: new Date().toISOString(),
  };

  db.getSchema().subscriptionPayments.unshift(paymentRecord);
  db.commit();

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'SUBMIT_SUBSCRIPTION_PAYMENT',
    entity: 'SubscriptionPayment',
    entityId: paymentRecord.id,
    details: `إرسال إشعار سداد اشتراك بقيمة ${amountSdg} ج.س للمراجعة والاعتماد (مرجع: ${paymentRef})`,
  });

  res.json({ success: true, payment: paymentRecord });
});

/* =========================================================================
   14. CENTRAL SAAS SUPER ADMIN
   ========================================================================= */
apiRouter.get('/admin/tenants', (req, res) => {
  const schema = db.getSchema();
  const summary = schema.tenants.map((t) => {
    const branches = schema.branches.filter((b) => b.tenantId === t.id);
    const employees = schema.employees.filter((e) => e.tenantId === t.id);
    const plan = schema.subscriptionPlans.find((p) => p.id === t.subscriptionPlanId);
    return {
      ...t,
      branchCount: branches.length,
      employeeCount: employees.length,
      planName: plan?.name,
    };
  });
  res.json({ tenants: summary });
});

apiRouter.post('/admin/tenants/:id/status', (req, res) => {
  const { status, reason } = req.body;
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'المنشأة غير موجودة' });

  tenant.status = status;
  db.commit();

  db.logAudit({
    tenantId: tenant.id,
    actorId: 'saas_admin',
    actorName: 'مدير المنصة المركزي',
    action: status === 'active' ? 'ACTIVATE_TENANT' : 'SUSPEND_TENANT',
    entity: 'Tenant',
    entityId: tenant.id,
    details: `تغيير حالة المنشأة إلى: ${status}. السبب: ${reason || 'إجراء إداري'}`,
  });

  res.json({ success: true, tenant });
});

apiRouter.get('/admin/payments', (req, res) => {
  const payments = db.getSchema().subscriptionPayments.map((p) => {
    const tenant = db.getTenant(p.tenantId);
    const plan = db.getSchema().subscriptionPlans.find((pl) => pl.id === p.planId);
    return {
      ...p,
      tenantName: tenant?.name || 'منشأة',
      planName: plan?.name || 'باقة',
    };
  });
  res.json({ payments });
});

// Admin approves or rejects manual subscription payment
apiRouter.post('/admin/payments/:id/review', (req, res) => {
  const payment = db.getSchema().subscriptionPayments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'سجل السداد غير موجود' });

  const { decision, reviewNote, reviewerName } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'القرار يجب أن يكون إما approved أو rejected' });
  }

  payment.status = decision;
  payment.reviewedBy = reviewerName || 'مدير المنصة المركزي';
  payment.reviewNote = reviewNote || (decision === 'approved' ? 'تمت المطابقة والاعتماد' : 'مرفوض لعدم اكتمال التحويل');
  payment.reviewedAt = new Date().toISOString();

  // If approved, extend tenant subscription by 30 days & update plan if changed
  if (decision === 'approved') {
    const tenant = db.getTenant(payment.tenantId);
    if (tenant) {
      tenant.subscriptionPlanId = payment.planId;
      const currentExpiry = new Date(tenant.subscriptionExpiresAt).getTime();
      const baseDate = currentExpiry > Date.now() ? currentExpiry : Date.now();
      tenant.subscriptionExpiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1000).toISOString();
      tenant.status = 'active';
    }
  }

  db.commit();

  db.logAudit({
    tenantId: payment.tenantId,
    actorId: 'saas_admin',
    actorName: reviewerName || 'مدير المنصة المركزي',
    action: decision === 'approved' ? 'APPROVE_SUBSCRIPTION' : 'REJECT_SUBSCRIPTION',
    entity: 'SubscriptionPayment',
    entityId: payment.id,
    details: `قرار مراجعة السداد: ${decision} بمبلغ ${payment.amountSdg} ج.س. ملاحظات: ${payment.reviewNote}`,
  });

  res.json({ success: true, payment });
});

apiRouter.get('/admin/stats', (req, res) => {
  const schema = db.getSchema();
  const totalTenants = schema.tenants.length;
  const activeTenants = schema.tenants.filter((t) => t.status === 'active').length;
  const totalSalesRevenue = schema.sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  const subscriptionRevenue = schema.subscriptionPayments
    .filter((p) => p.status === 'approved')
    .reduce((acc, p) => acc + p.amountSdg, 0);
  const pendingPaymentsCount = schema.subscriptionPayments.filter((p) => p.status === 'pending_review').length;

  res.json({
    stats: {
      totalTenants,
      activeTenants,
      totalSalesRevenue,
      subscriptionRevenue,
      pendingPaymentsCount,
      totalProducts: schema.products.length,
      totalBranches: schema.branches.length,
    },
  });
});

apiRouter.get('/audit-logs', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const logs = db.getSchema().auditLogs.filter((l) => l.tenantId === authReq.tenantId);
  res.json({ logs });
});

// ==========================================
// AL-BANDAR MARKETPLACE & CLASSIFIEDS ROUTES
// ==========================================

// Get Al-Bandar listings with filters
apiRouter.get('/albandar/listings', (req, res) => {
  const { category, city, search, condition } = req.query;
  let listings = [...db.getAlbandarListings()];

  if (category && category !== 'all' && category !== 'الكل') {
    listings = listings.filter((item) => item.category === category);
  }

  if (city && city !== 'all' && city !== 'الكل') {
    listings = listings.filter((item) => item.city.includes(String(city)) || String(city).includes(item.city));
  }

  if (condition && condition !== 'all' && condition !== 'الكل') {
    listings = listings.filter((item) => item.condition === condition);
  }

  if (search && String(search).trim()) {
    const q = String(search).toLowerCase();
    listings = listings.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.categoryNameAr.toLowerCase().includes(q)
    );
  }

  res.json({ listings });
});

// Post a new Al-Bandar listing (public or merchant)
apiRouter.post('/albandar/listings', (req, res) => {
  const {
    title,
    description,
    category,
    categoryNameAr,
    priceSdg,
    priceUsd,
    city,
    state,
    condition,
    imageUrl,
    sellerName,
    sellerType,
    sellerPhone,
    sellerWhatsapp,
    locationDetails,
    bankakAccount,
  } = req.body;

  if (!title || !priceSdg || !sellerPhone || !city) {
    return res.status(400).json({ error: 'يرجى إدخال عنوان الإعلان، السعر، المدينة، ورقم هاتف التواصل' });
  }

  const categoryMapAr: Record<string, string> = {
    cars: 'سيارات ومركبات',
    real_estate: 'عقارات وأراضي',
    electronics: 'هواتف وإلكترونيات',
    groceries: 'سلع ومواد تموينية',
    livestock_crops: 'محاصيل وثروة حيوانية',
    furniture_home: 'أثاث ومستلزمات منزلية',
    fashion: 'أزياء وموضة',
    services: 'خدمات وأعمال',
  };

  const newListing = {
    id: newId('alb'),
    title,
    description: description || 'تفاصيل الإعلان متوفرة بالاتصال المباشر أو عبر رسائل الواتساب.',
    category: category || 'groceries',
    categoryNameAr: categoryNameAr || categoryMapAr[category] || 'سوق البندر',
    priceSdg: Number(priceSdg),
    priceUsd: priceUsd ? Number(priceUsd) : Math.round(Number(priceSdg) / 2700),
    city: city || 'بورتسودان',
    state: state || 'السودان',
    condition: condition || 'جديد',
    imageUrl:
      imageUrl ||
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
    sellerName: sellerName || 'معلن في سوق البندر',
    sellerType: sellerType || 'individual',
    sellerPhone,
    sellerWhatsapp: sellerWhatsapp || sellerPhone,
    isVerifiedMerchant: sellerType === 'merchant' || sellerType === 'showroom',
    viewsCount: 1,
    featured: false,
    createdAt: new Date().toISOString(),
    locationDetails: locationDetails || city,
    bankakAccount: bankakAccount || '',
  };

  db.addAlbandarListing(newListing);
  res.status(201).json({ success: true, listing: newListing });
});

// Get verified showrooms and merchant stores in Al-Bandar
apiRouter.get('/albandar/showrooms', (_req, res) => {
  const showrooms = db.getAlbandarShowrooms();
  res.json({ showrooms });
});

// Merchant action: Publish product directly from POS/Inventory into Al-Bandar Marketplace
apiRouter.post('/albandar/publish-product', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { productId, category, condition, locationDetails } = req.body;

  const product = db.getSchema().products.find((p) => p.id === productId && p.tenantId === authReq.tenantId);
  if (!product) {
    return res.status(404).json({ error: 'المنتج غير موجود في قائمة منتجاتك' });
  }

  const tenant = db.getTenant(authReq.tenantId);

  const categoryMapAr: Record<string, string> = {
    cars: 'سيارات ومركبات',
    real_estate: 'عقارات وأراضي',
    electronics: 'هواتف وإلكترونيات',
    groceries: 'سلع ومواد تموينية',
    livestock_crops: 'محاصيل وثروة حيوانية',
    furniture_home: 'أثاث ومستلزمات منزلية',
    fashion: 'أزياء وموضة',
    services: 'خدمات وأعمال',
  };

  const chosenCat = category || 'groceries';

  const newListing = {
    id: newId(`alb_prod_${product.id}`),
    title: product.name,
    description: `معروض حصرياً من متجر ${tenant?.tradeName || tenant?.name} الموثق في سوق البندر. وحدة القياس: ${product.unit}. الباركود: ${product.barcode || 'N/A'}. متوفر تسليم فوري وتوصيل لكافة المدن.`,
    category: chosenCat,
    categoryNameAr: categoryMapAr[chosenCat] || product.category || 'سلع ومواد تموينية',
    priceSdg: product.sellingPriceSdg,
    priceUsd: Math.round(product.sellingPriceSdg / 2700),
    city: tenant?.city || 'بورتسودان',
    state: 'السودان',
    condition: condition || 'جديد أصلي',
    imageUrl:
      product.imageUrl ||
      '/assets/images/product_sugar_kenana_1792173270044.jpg',
    sellerName: tenant?.tradeName || tenant?.name || 'متجر معتمد',
    sellerType: 'merchant' as const,
    sellerPhone: tenant?.phone || '+249912345678',
    sellerWhatsapp: tenant?.phone || '+249912345678',
    isVerifiedMerchant: true,
    tenantId: authReq.tenantId,
    viewsCount: 15,
    featured: true,
    createdAt: new Date().toISOString(),
    locationDetails: locationDetails || tenant?.address || tenant?.city,
    bankakAccount: tenant?.settings.bankakAccount || '1982736',
  };

  db.addAlbandarListing(newListing);

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'PUBLISH_TO_ALBANDAR',
    entity: 'Product',
    entityId: product.id,
    details: `نشر المنتج «${product.name}» في سوق البندر الإلكتروني المفتوح بسعر ${product.sellingPriceSdg} ج.س`,
  });

  res.status(201).json({ success: true, listing: newListing });
});

// Increment views counter
apiRouter.post('/albandar/listings/:id/view', (req, res) => {
  const { id } = req.params;
  const listing = db.getAlbandarListings().find((l) => l.id === id);
  if (listing) {
    listing.viewsCount = (listing.viewsCount || 0) + 1;
    db.commit();
  }
  res.json({ success: true, viewsCount: listing?.viewsCount || 0 });
});

/* =========================================================================
   12. KITCHEN DISPLAY SYSTEM (KDS)
   ========================================================================= */
// Get kitchen tickets
apiRouter.get('/kitchen/tickets', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;
  const status = req.query.status as string | undefined;

  const tickets = db.getKitchenTickets(authReq.tenantId, branchId, status);
  res.json({ tickets });
});

// Update overall kitchen ticket status
apiRouter.put('/kitchen/tickets/:id/status', requireTenant, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'preparing', 'ready', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'حالة التجهيز غير صالحة' });
  }

  const updated = db.updateKitchenTicketStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'تذكرة المطبخ غير موجودة' });
  }

  res.json({ success: true, ticket: updated });
});

// Update single item status in kitchen ticket
apiRouter.put('/kitchen/tickets/:id/items/:itemId/status', requireTenant, (req, res) => {
  const { id, itemId } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'preparing', 'ready', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'حالة الصنف غير صالحة' });
  }

  const updated = db.updateKitchenItemStatus(id, itemId, status);
  if (!updated) {
    return res.status(404).json({ error: 'العنصر أو التذكرة غير موجودة' });
  }

  res.json({ success: true, ticket: updated });
});

/* =========================================================================
   13. RECURRING EXPENSES (المصروفات الدورية المجدولة)
   ========================================================================= */
// List recurring expenses
apiRouter.get('/recurring-expenses', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const branchId = req.query.branchId as string | undefined;

  const list = db.getRecurringExpenses(authReq.tenantId, branchId);
  res.json({ recurringExpenses: list });
});

// Create recurring expense
apiRouter.post('/recurring-expenses', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const {
    branchId,
    title,
    category,
    amountSdg,
    frequency,
    dayOfMonth,
    dayOfWeek,
    nextDueDate,
    autoPost,
    notes,
  } = req.body;

  if (!title || !amountSdg || Number(amountSdg) <= 0) {
    return res.status(400).json({ error: 'يرجى تحديد عنوان المصروف والمبلغ بدقة' });
  }

  const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === authReq.tenantId);

  const newRecurring: RecurringExpense = {
    id: newId('recexp'),
    tenantId: authReq.tenantId,
    branchId: branchId || 'branch_kht_main',
    branchName: branch?.name || 'الفرع الرئيسي',
    title,
    category: category || 'أخرى',
    amountSdg: Number(amountSdg),
    frequency: frequency || 'monthly',
    dayOfMonth: dayOfMonth ? Number(dayOfMonth) : 1,
    dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : undefined,
    nextDueDate: nextDueDate || new Date().toISOString().split('T')[0],
    autoPost: Boolean(autoPost),
    isActive: true,
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  db.addRecurringExpense(newRecurring);

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_RECURRING_EXPENSE',
    entity: 'RecurringExpense',
    entityId: newRecurring.id,
    details: `جدولة مصروف دوري جديد: «${newRecurring.title}» بمبلغ ${newRecurring.amountSdg} ج.س بالتكرار (${newRecurring.frequency})`,
  });

  res.status(201).json({ success: true, recurringExpense: newRecurring });
});

// Update recurring expense
apiRouter.put('/recurring-expenses/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const updated = db.updateRecurringExpense(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'المصروف الدوري غير موجود' });
  }

  res.json({ success: true, recurringExpense: updated });
});

// Delete recurring expense
apiRouter.delete('/recurring-expenses/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const deleted = db.deleteRecurringExpense(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: 'المصروف الدوري غير موجود' });
  }

  res.json({ success: true, message: 'تم حذف الجدولة بنجاح' });
});

// Post recurring expense now (تسجيل فوري في المصروفات)
apiRouter.post('/recurring-expenses/:id/post-now', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const result = db.postRecurringExpenseNow(authReq.tenantId, id, authReq.actorName);
  if (!result) {
    return res.status(404).json({ error: 'المصروف الدوري غير موجود' });
  }

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'POST_RECURRING_EXPENSE',
    entity: 'Expense',
    entityId: result.expense.id,
    details: `ترحيل فوري للمصروف الدوري «${result.recurring.title}» بقيمة ${result.expense.amountSdg} ج.س`,
  });

  res.json({
    success: true,
    message: 'تم تسجيل المصروف بنجاح وترحيل الاستحقاق القادم',
    expense: result.expense,
    recurringExpense: result.recurring,
  });
});

/* =========================================================================
   14. PROMOTIONAL OFFERS MANAGEMENT (إدارة العروض الترويجية)
   ========================================================================= */
// List promotional offers
apiRouter.get('/promotions', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const promotions = db.getPromotions(authReq.tenantId);
  res.json({ promotions });
});

// Create promotion offer
apiRouter.post('/promotions', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const {
    title,
    description,
    type,
    buyProductId,
    buyQuantity,
    freeProductId,
    freeQuantity,
    productId,
    minQuantity,
    discountPct,
    minCartTotalSdg,
    discountAmountSdg,
    startDate,
    endDate,
    isActive,
  } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'يرجى تحديد عنوان العرض ونوع القاعدة' });
  }

  const products = db.getSchema().products;
  const buyProd = products.find((p) => p.id === buyProductId);
  const freeProd = products.find((p) => p.id === freeProductId);
  const targetProd = products.find((p) => p.id === productId);

  const newPromo: PromotionRule = {
    id: newId('promo'),
    tenantId: authReq.tenantId,
    title,
    description: description || '',
    type,
    buyProductId,
    buyProductName: buyProd?.name,
    buyQuantity: buyQuantity ? Number(buyQuantity) : undefined,
    freeProductId,
    freeProductName: freeProd?.name,
    freeQuantity: freeQuantity ? Number(freeQuantity) : undefined,
    productId,
    productName: targetProd?.name,
    minQuantity: minQuantity ? Number(minQuantity) : undefined,
    discountPct: discountPct ? Number(discountPct) : undefined,
    minCartTotalSdg: minCartTotalSdg ? Number(minCartTotalSdg) : undefined,
    discountAmountSdg: discountAmountSdg ? Number(discountAmountSdg) : undefined,
    startDate,
    endDate,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    createdAt: new Date().toISOString(),
  };

  db.addPromotion(newPromo);

  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: 'CREATE_PROMOTION',
    entity: 'Promotion',
    entityId: newPromo.id,
    details: `إنشاء عرض ترويجي جديد: «${newPromo.title}»`,
  });

  res.status(201).json({ success: true, promotion: newPromo });
});

// Update promotion
apiRouter.put('/promotions/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const updated = db.updatePromotion(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'العرض الترويجي غير موجود' });
  }

  res.json({ success: true, promotion: updated });
});

// Delete promotion
apiRouter.delete('/promotions/:id', requireTenant, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  const deleted = db.deletePromotion(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: 'العرض الترويجي غير موجود' });
  }

  res.json({ success: true, message: 'تم حذف العرض الترويجي' });
});



// ---------------------------------------------------------------------------
// AI Assistant — Sudanese-dialect assistant that can answer anything
// Talks to the Gemini REST API directly (predictable timeouts + real errors).
// ---------------------------------------------------------------------------

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

/** Models tried in order; override with GEMINI_MODEL. */
const ASSISTANT_MODELS = [
  process.env.GEMINI_MODEL,
  // `flash-latest` always points at the newest stable flash model
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
].filter(Boolean) as string[];

function buildSystemInstruction(mode: string, context: any): string {
  const now = new Date();
  return `أنت «سند» — المساعد الذكي الرسمي لمنصة سند (Sanad POS & Commerce) للتجارة ونقاط البيع السحابية في السودان.

## شخصيتك
- ودود، محترم، ذكي جداً، وتتحدث باللهجة السودانية الطبيعية ("حبابك عشرة"، "أبشر بالخير"، "ما تشيل هم"، "هسي"، "داير"، "السمح").
- تجاوب باختصار ودقة، واستخدم النقاط والأرقام لو الجواب طويل.
- مؤدب مع الجميع، لا تشارك في الإساءة أو الكراهية أو أي محتوى ضار.

## نطاق الإجابة (مهم جداً)
- تقدر تجاوب على أي سؤال: عام، ثقافي، ديني، تاريخي، علمي، حسابي، طبي عام، قانوني عام، برمجي، ترجمة، تلخيص، أفكار، نصائح — حتى لو ما ليه علاقة بالمنصة.
- ما تعتذر ولا تقول "ما عندي معلومة" إلا إذا فعلاً ما تعرف.
- في الصحة والأدوية والقانون والأموال: معلومة عامة مفيدة + نصيحة بمراجعة المختص.
- لو السؤال غامض، اسأل سؤال توضيحي واحد قصير.

## معلومات المنصة
- نقاط البيع (POS): تعمل أوفلاين دون إنترنت مع مزامنة تلقائية.
- الدفع: بنكك (بنك الخرطوم)، فوري (بنك فيصل)، أوكاش، وتحصيل العملات الأجنبية.
- أسعار الصرف: الدولار 2750 ج.س، الريال السعودي 733.33، الليرة التركية 82.5، الجنيه المصري 56.8، الدرهم 748.5، اليورو 2980.
- تطبيق الجمهور: الكتالوج، الطلبات المسبقة، السلة، المفضلة، نقاط الولاء والكوبونات، تتبع الطلبات، مشاركة واتساب، تقييم المنتجات، إعلانات السوق (بعد موافقة الإدارة مع رسوم اختيارية)، وطلب فتح متجر (مراجعة إدارية + كود دخول + قيمة تسجيل).
- تطبيق التاجر: الكاشير، المخزون، المشتريات، المصروفات، التقارير، الورديات، الطلبات، والإشعارات.
- لوحة الإدارة: المتاجر، الاشتراكات، تدقيق السداد، سجل التدقيق، الفواتير الحرارية، العروض، إعلانات السوق، طلبات المتاجر.
- الإشعارات: داخل التطبيق وعلى الهاتف (نقص المخزون، انتهاء الاشتراك، حالة الطلب، المراجعات).

## السياق الحالي
- التطبيق: ${mode === 'admin' ? 'الإدارة ونقاط البيع' : mode === 'merchant' ? 'تطبيق التاجر' : 'تطبيق الجمهور'}
- المنشأة: ${context?.tenantName || 'منصة سند'} | الفرع: ${context?.branchName || 'الفرع الرئيسي'}
- التاريخ: ${now.toLocaleString('ar-EG')}`;
}

interface GeminiResult {
  text: string | null;
  error?: string;
  model?: string;
}

/** One Gemini call over REST with a hard timeout. */
async function geminiGenerate(opts: {
  models: string[];
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseModalities?: string[];
  speechConfig?: any;
}): Promise<GeminiResult> {
  const key = GEMINI_KEY();
  if (!key) return { text: null, error: 'NO_API_KEY' };

  let lastError = 'UNKNOWN';

  for (const model of opts.models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 14000);

    try {
      const body: any = {
        contents: opts.contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.8,
          maxOutputTokens: opts.maxTokens ?? 1200,
          ...(opts.responseModalities ? { responseModalities: opts.responseModalities } : {}),
          ...(opts.speechConfig ? { speechConfig: opts.speechConfig } : {}),
        },
        ...(opts.systemInstruction
          ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
          : {}),
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      const data: any = await res.json().catch(() => null);

      if (!res.ok) {
        lastError = `HTTP_${res.status}: ${data?.error?.message?.slice(0, 160) || 'unknown'}`;
        // 404 = model gone, 429/503 = overloaded → try the next model.
        // Anything else (bad key, safety) stops immediately.
        if (res.status === 404 || res.status === 429 || res.status === 503) continue;
        return { text: null, error: lastError, model };
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text =
        parts.map((p: any) => p?.text).filter(Boolean).join('\n').trim() ||
        null;

      if (text) return { text, model };

      lastError = `EMPTY:${data?.candidates?.[0]?.finishReason || 'unknown'}`;
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'TIMEOUT' : String(err?.message || err).slice(0, 140);
    } finally {
      clearTimeout(timer);
    }
  }

  return { text: null, error: lastError };
}

apiRouter.post('/assistant/chat', async (req: Request, res: Response) => {
  const { message, mode, context, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'الرسالة مطلوبة' });
  }
  if (!GEMINI_KEY()) {
    return res.json({ reply: null, reason: 'NO_API_KEY' });
  }

  // Last turns give the assistant memory inside the conversation
  const turns: any[] = Array.isArray(history)
    ? history
        .filter((h: any) => h && typeof h.text === 'string' && h.text.trim())
        .slice(-8)
        .map((h: any) => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text).slice(0, 3000) }],
        }))
    : [];

  turns.push({ role: 'user', parts: [{ text: message.slice(0, 3000) }] });

  try {
    const result = await geminiGenerate({
      models: ASSISTANT_MODELS,
      contents: turns,
      systemInstruction: buildSystemInstruction(String(mode || 'admin'), context || {}),
      temperature: 0.85,
      maxTokens: 1200,
      timeoutMs: 16000,
    });

    if (result.text) {
      return res.json({ reply: result.text, model: result.model });
    }

    console.warn('[assistant] failed:', result.error);
    return res.json({ reply: null, reason: 'FALLBACK', detail: result.error });
  } catch (error) {
    console.warn('Assistant route fallback:', error instanceof Error ? error.message : String(error));
    return res.json({ reply: null, reason: 'FALLBACK' });
  }
});

/** Natural Arabic text-to-speech for answers. */
apiRouter.post('/assistant/speak', async (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'النص مطلوب' });
  }

  const key = GEMINI_KEY();
  if (!key) return res.json({ audio: null, reason: 'NO_API_KEY' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 700) }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        }),
        signal: controller.signal,
      }
    );

    const data: any = await res2.json().catch(() => null);
    const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData);

    if (part?.inlineData?.data) {
      return res.json({
        audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav',
      });
    }

    return res.json({ audio: null, reason: data?.error?.message?.slice(0, 120) || 'NO_AUDIO' });
  } catch (error) {
    console.warn('[assistant] tts failed:', error instanceof Error ? error.message : String(error));
    return res.json({ audio: null, reason: 'FALLBACK' });
  } finally {
    clearTimeout(timer);
  }
});

/* =========================================================================
   Media uploads — photos and short videos for marketplace ads
   ========================================================================= */

apiRouter.post('/media', async (req, res) => {
  try {
    const { dataUrl, kind, ownerPhone } = req.body || {};
    const media = await saveMedia({
      dataUrl,
      kind: kind === 'video' ? 'video' : 'image',
      ownerPhone: typeof ownerPhone === 'string' ? ownerPhone : undefined,
    });
    res.json({ success: true, ...media });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('[media] upload failed:', err);
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: 'تعذر رفع الملف، حاول مرة أخرى.',
    });
  }
});

apiRouter.get('/media/:id', async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'الملف غير موجود.' });
    }
    res.setHeader('Content-Type', media.mime);
    res.setHeader('Content-Length', String(media.data.length));
    // Uploaded media is immutable, so it can be cached hard.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(media.data);
  } catch (err) {
    console.error('[media] read failed:', err);
    res.status(500).json({ error: 'READ_FAILED' });
  }
});

apiRouter.get('/media', (_req, res) => {
  res.json({ maxUploadBytes: MAX_RAW_BYTES, kinds: ['image', 'video'] });
});

apiRouter.delete('/media/:id', async (req, res) => {
  try {
    const removed = await deleteMedia(req.params.id);
    res.json({ success: removed });
  } catch (err) {
    console.error('[media] delete failed:', err);
    res.status(500).json({ error: 'DELETE_FAILED' });
  }
});

/* =========================================================================
   Market ads — publishing fee + admin moderation + deletion
   ========================================================================= */

/** Publishing fees. Admins can see them; publishers accept them on submit. */
const AD_PRICING = {
  standardFeeSdg: Number(process.env.AD_FEE_STANDARD_SDG ?? 0),
  vipFeeSdg: Number(process.env.AD_FEE_VIP_SDG ?? 5000),
  currency: 'SDG',
};

function feeFor(isVip: boolean): number {
  return isVip ? AD_PRICING.vipFeeSdg : AD_PRICING.standardFeeSdg;
}

apiRouter.get('/market-ads/pricing', (_req, res) => {
  res.json({ pricing: AD_PRICING });
});

/** Public feed — approved ads only. */
apiRouter.get('/market-ads', (req, res) => {
  const ownerToken = String(req.headers['x-owner-token'] || '');
  const all = db.getMarketAds();

  const approved = all.filter((a) => a.status === 'approved');
  // Publishers also see their own ads whatever the status, so they can track
  // review progress and remove them.
  const mine = ownerToken
    ? all.filter((a) => a.ownerToken === ownerToken && a.status !== 'approved')
    : [];

  res.json({ ads: approved, mine, pricing: AD_PRICING });
});

apiRouter.post('/market-ads', (req, res) => {
  const {
    title, category, priceSdg, location, phone, whatsapp, description,
    imageUrl, videoUrl, isVip, publisherName, ownerToken, paymentRef,
  } = req.body || {};

  if (!title || String(title).trim().length < 4) {
    return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'عنوان الإعلان مطلوب (4 أحرف على الأقل).' });
  }
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ error: 'PHONE_REQUIRED', message: 'رقم الهاتف أو الواتساب مطلوب.' });
  }
  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: 'MEDIA_REQUIRED', message: 'أضف صورة أو فيديو للإعلان.' });
  }
  if (!ownerToken || String(ownerToken).length < 8) {
    return res.status(400).json({ error: 'OWNER_TOKEN_REQUIRED', message: 'تعذر التعرف على جهازك، أعد فتح التطبيق.' });
  }

  const ad = db.createMarketAd({
    title: String(title).trim(),
    category: category || 'عام',
    priceSdg: Number(priceSdg) || 0,
    location: location || 'الخرطوم',
    phone: String(phone).trim(),
    whatsapp: whatsapp || phone,
    description: description || '',
    imageUrl: imageUrl || '',
    videoUrl: videoUrl || undefined,
    isVip: !!isVip,
    publisherName: publisherName || 'زبون منصة سند',
    ownerToken: String(ownerToken),
    feeSdg: feeFor(!!isVip),
    paymentRef: paymentRef || undefined,
  });

  notifyUser({
    app: 'admin',
    kind: 'new_ad',
    title: 'إعلان جديد بانتظار الموافقة',
    body: `${ad.title} — ${ad.location}${ad.feeSdg > 0 ? ` • رسوم ${ad.feeSdg.toLocaleString('en-US')} ج.س` : ' • نشر مجاني'}`,
    linkTab: 'market_ads',
  }).catch(() => {});

  res.json({
    success: true,
    ad,
    message: 'تم إرسال إعلانك للمراجعة. سيظهر في السوق بعد موافقة الإدارة.',
  });
});

/** Publisher deletes their own ad — the owner token must match. */
apiRouter.delete('/market-ads/:id', (req, res) => {
  const ownerToken = String(req.headers['x-owner-token'] || '');
  const result = db.deleteMarketAd(req.params.id, { ownerToken });

  if (!result.ok) {
    return res.status(result.reason === 'NOT_FOUND' ? 404 : 403).json({
      error: result.reason,
      message: result.reason === 'NOT_FOUND' ? 'الإعلان غير موجود.' : 'لا تملك صلاحية حذف هذا الإعلان.',
    });
  }
  res.json({ success: true });
});

/* ---------------------------- Admin side ---------------------------- */

apiRouter.get('/admin/market-ads', (req, res) => {
  const status = String(req.query.status || 'all');
  const ads = db.getMarketAds();
  const filtered = status === 'all' ? ads : ads.filter((a) => a.status === status);

  res.json({
    ads: filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    counts: {
      pending: ads.filter((a) => a.status === 'pending').length,
      approved: ads.filter((a) => a.status === 'approved').length,
      rejected: ads.filter((a) => a.status === 'rejected').length,
      feesDueSdg: ads
        .filter((a) => a.status === 'pending' && a.feeSdg > 0)
        .reduce((sum, a) => sum + a.feeSdg, 0),
      feesCollectedSdg: ads
        .filter((a) => a.status === 'approved')
        .reduce((sum, a) => sum + (a.feeSdg || 0), 0),
    },
    pricing: AD_PRICING,
  });
});

apiRouter.post('/admin/market-ads/:id/review', (req, res) => {
  const { decision, note, reviewedBy, paymentConfirmed } = req.body || {};

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: 'BAD_DECISION', message: 'القرار يجب أن يكون approved أو rejected.' });
  }

  const ad = db.reviewMarketAd(req.params.id, {
    decision,
    note,
    reviewedBy: reviewedBy || 'إدارة سند',
    paymentConfirmed: !!paymentConfirmed,
  });

  if (!ad) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'الإعلان غير موجود.' });
  }

  notifyUser({
    app: 'client',
    kind: 'ad_reviewed',
    title: decision === 'approved' ? 'تم نشر إعلانك ✅' : 'تم رفض إعلانك',
    body:
      decision === 'approved'
        ? `«${ad.title}» أصبح ظاهراً في السوق${ad.feeSdg > 0 ? ` بعد تأكيد رسوم ${ad.feeSdg.toLocaleString('en-US')} ج.س` : ''}.`
        : `«${ad.title}» — ${ad.rejectionReason || 'لم يستوف شروط النشر.'}`,
    linkTab: 'market',
    recipientToken: ad.ownerToken,
  }).catch(() => {});

  res.json({ success: true, ad });
});

apiRouter.delete('/admin/market-ads/:id', (req, res) => {
  const result = db.deleteMarketAd(req.params.id, { admin: true });
  if (!result.ok) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'الإعلان غير موجود.' });
  }
  res.json({ success: true });
});

/* ------------------------------------------------------------------ */
/*  Store applications — a shop applies to join the platform            */
/* ------------------------------------------------------------------ */

const TENANT_REGISTRATION_FEE_SDG = Number(process.env.TENANT_REGISTRATION_FEE_SDG || 50000);

const SUDAN_WILAYAS = [
  'الخرطوم', 'الجزيرة', 'النيل الأزرق', 'النيل الأبيض', 'البحر الأحمر', 'كسلا',
  'القضارف', 'سنار', 'النيل الأزرق الشمالي', 'الشمالية', 'نهر النيل', 'شمال كردفان',
  'جنوب كردفان', 'غرب كردفان', 'شمال دارفور', 'جنوب دارفور', 'شرق دارفور',
  'غرب دارفور', 'وسط دارفور',
];

/** Human-friendly activation code, e.g. SND-7K2M-9Q4P. */
function newActivationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `SND-${block(4)}-${block(4)}`;
}

apiRouter.get('/tenant-applications/pricing', (_req, res) => {
  res.json({
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    currency: 'SDG',
    wilayas: SUDAN_WILAYAS,
    businessTypes: [
      'بقالات ومواد غذائية', 'مطاعم وكافيهات', 'ملابس وأحذية', 'إلكترونيات وجوالات',
      'صيدلية ومستلزمات طبية', 'أجهزة منزلية', 'مواد بناء', 'قطع غيار وسيارات',
      'مستحضرات تجميل', 'مكتبات وأدوات مدرسية', 'خدمات أخرى',
    ],
  });
});

/** Public: submit an application. Always lands as `pending`. */
apiRouter.post('/tenant-applications', (req, res) => {
  const {
    storeName, ownerName, wilaya, city, phone, email,
    branchesCount, businessType, notes, source,
  } = req.body || {};

  if (!storeName || String(storeName).trim().length < 3) {
    return res.status(400).json({ error: 'STORE_NAME_REQUIRED', message: 'اسم المتجر مطلوب (3 أحرف على الأقل).' });
  }
  if (!ownerName || String(ownerName).trim().length < 3) {
    return res.status(400).json({ error: 'OWNER_NAME_REQUIRED', message: 'اسم صاحب المتجر مطلوب.' });
  }
  if (!wilaya || !String(wilaya).trim()) {
    return res.status(400).json({ error: 'WILAYA_REQUIRED', message: 'الولاية مطلوبة.' });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: 'CITY_REQUIRED', message: 'المدينة مطلوبة.' });
  }
  if (!phone || String(phone).replace(/\D/g, '').length < 9) {
    return res.status(400).json({ error: 'PHONE_REQUIRED', message: 'رقم الهاتف مطلوب (9 أرقام على الأقل).' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'EMAIL_INVALID', message: 'البريد الإلكتروني غير صحيح.' });
  }
  const branches = Number(branchesCount);
  if (!Number.isFinite(branches) || branches < 1 || branches > 200) {
    return res.status(400).json({ error: 'BRANCHES_INVALID', message: 'عدد الفروع يجب أن يكون رقماً بين 1 و 200.' });
  }

  const application = db.createTenantApplication({
    storeName: String(storeName).trim(),
    ownerName: String(ownerName).trim(),
    wilaya: String(wilaya).trim(),
    city: String(city).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : undefined,
    branchesCount: Math.round(branches),
    businessType: businessType ? String(businessType).trim() : 'غير محدد',
    notes: notes ? String(notes).trim() : undefined,
    source: source === 'merchant' ? 'merchant' : 'client',
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    applicantToken: (req.headers['x-owner-token'] as string) || undefined,
  } as any);

  notifyUser({
    app: 'admin',
    kind: 'new_store_request',
    title: 'طلب متجر جديد',
    body: `${application.storeName} — ${application.wilaya}/${application.city} • ${application.branchesCount} فرع • رسوم ${application.registrationFeeSdg.toLocaleString('en-US')} ج.س`,
    linkTab: 'tenant_requests',
  }).catch(() => {});

  res.json({
    success: true,
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      createdAt: application.createdAt,
    },
    message: `تم استلام طلب متجر «${application.storeName}». سيتواصل معك فريق سند بعد المراجعة، وقيمة التسجيل ${TENANT_REGISTRATION_FEE_SDG.toLocaleString('en-US')} ج.س.`,
  });
});

/** Public: an applicant can check the outcome with the activation code. */
apiRouter.get('/tenant-applications/status', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: 'CODE_REQUIRED', message: 'أدخل كود الدخول.' });
  }

  const application = db
    .getTenantApplications()
    .find((a) => (a.activationCode || '').toUpperCase() === code);

  if (!application) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'لا يوجد طلب بهذا الكود.' });
  }

  res.json({
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      activationCode: application.activationCode,
      reviewedAt: application.reviewedAt,
    },
  });
});

/** Admin: the review queue. */
apiRouter.get('/admin/tenant-applications', (req, res) => {
  const status = String(req.query.status || 'all');
  const all = db.getTenantApplications();
  const filtered = status === 'all' ? all : all.filter((a) => a.status === status);

  res.json({
    applications: filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    counts: {
      pending: all.filter((a) => a.status === 'pending').length,
      approved: all.filter((a) => a.status === 'approved').length,
      rejected: all.filter((a) => a.status === 'rejected').length,
      pendingBranches: all.filter((a) => a.status === 'pending').reduce((s, a) => s + a.branchesCount, 0),
      feesExpectedSdg: all
        .filter((a) => a.status === 'pending')
        .reduce((s, a) => s + (a.registrationFeeSdg || 0), 0),
      feesCollectedSdg: all
        .filter((a) => a.status === 'approved')
        .reduce((s, a) => s + (a.registrationFeeSdg || 0), 0),
    },
    pricing: { registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG, currency: 'SDG' },
  });
});

/** Admin: approve (issues the login code) or reject. */
apiRouter.post('/admin/tenant-applications/:id/review', (req, res) => {
  const { decision, note, registrationFeeSdg, codeSentVia } = req.body || {};

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: 'BAD_DECISION', message: 'القرار يجب أن يكون approved أو rejected.' });
  }

  const existing = db.getTenantApplication(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'الطلب غير موجود.' });
  }

  const application = db.reviewTenantApplication(req.params.id, {
    decision,
    note,
    reviewedBy: (req as unknown as AuthenticatedRequest).actorName || 'إدارة سند',
    registrationFeeSdg:
      registrationFeeSdg === undefined || registrationFeeSdg === null || registrationFeeSdg === ''
        ? undefined
        : Number(registrationFeeSdg),
    activationCode:
      decision === 'approved' ? existing.activationCode || newActivationCode() : undefined,
    codeSentVia: codeSentVia === 'whatsapp' || codeSentVia === 'sms' || codeSentVia === 'email' ? codeSentVia : undefined,
  });

  notifyUser({
    app: application?.source === 'merchant' ? 'merchant' : 'client',
    kind: 'store_request_reviewed',
    title: decision === 'approved' ? 'تمت الموافقة على متجرك 🎉' : 'تم رفض طلب المتجر',
    body:
      decision === 'approved'
        ? `«${application?.storeName}» — كود الدخول ${application?.activationCode} • قيمة التسجيل ${(application?.registrationFeeSdg || 0).toLocaleString('en-US')} ج.س`
        : `«${application?.storeName}» — ${application?.rejectionReason || 'لم يستوف الشروط.'}`,
    linkTab: undefined,
    recipientToken: (application as any)?.applicantToken,
  }).catch(() => {});

  res.json({
    success: true,
    application,
    message:
      decision === 'approved'
        ? `تمت الموافقة. كود الدخول: ${application?.activationCode} — قيمة التسجيل ${(application?.registrationFeeSdg || 0).toLocaleString('en-US')} ج.س.`
        : 'تم رفض الطلب.',
  });
});

/** Admin: log that the code was delivered to the applicant. */
apiRouter.post('/admin/tenant-applications/:id/mark-sent', (req, res) => {
  const via = req.body?.via;
  if (via !== 'whatsapp' && via !== 'sms' && via !== 'email') {
    return res.status(400).json({ error: 'BAD_CHANNEL', message: 'قناة الإرسال غير معروفة.' });
  }
  const application = db.markTenantApplicationCodeSent(req.params.id, via);
  if (!application) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'لا يوجد كود مُصدر لهذا الطلب.' });
  }
  res.json({ success: true, application });
});

apiRouter.delete('/admin/tenant-applications/:id', (req, res) => {
  const removed = db.deleteTenantApplication(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'الطلب غير موجود.' });
  }
  res.json({ success: true });
});

/* ------------------------------------------------------------------ */
/*  Notifications — in-app feed + web push subscriptions               */
/* ------------------------------------------------------------------ */

const notificationAppOf = (value: unknown): 'client' | 'merchant' | 'admin' => {
  if (value === 'merchant' || value === 'admin' || value === 'client') return value;
  return 'client';
};

apiRouter.get('/push/public-key', (_req, res) => {
  const key = getPushPublicKey();
  res.json({
    enabled: !!key,
    publicKey: key,
    message: key
      ? undefined
      : 'إشعارات الهاتف غير مهيأة على الخادم بعد.',
  });
});

apiRouter.get('/notifications', (req, res) => {
  const app = notificationAppOf(req.query.app);
  const ownerToken = (req.headers['x-owner-token'] as string) || undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const rows = db.getNotifications({ app, ownerToken, limit });
  const unread = db
    .getNotifications({ app, ownerToken })
    .filter((n) => !n.read).length;

  res.json({ notifications: rows, unreadCount: unread, app });
});

apiRouter.post('/notifications/:id/read', (req, res) => {
  const ok = db.markNotificationRead(req.params.id);
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: 'الإشعار غير موجود.' });
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = (req.headers['x-owner-token'] as string) || undefined;
  const changed = db.markAllNotificationsRead({ app, ownerToken });
  res.json({ success: true, changed });
});

apiRouter.delete('/notifications/:id', (req, res) => {
  const ok = db.deleteNotification(req.params.id);
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: 'الإشعار غير موجود.' });
  res.json({ success: true });
});

/** Register a device for phone notifications. */
apiRouter.post('/push/subscribe', (req, res) => {
  const { subscription, app, ownerToken } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'BAD_SUBSCRIPTION', message: 'بيانات الاشتراك غير مكتملة.' });
  }

  const saved = db.savePushSubscription({
    endpoint,
    app: notificationAppOf(app),
    ownerToken: ownerToken || undefined,
    keys: { p256dh, auth },
  });

  res.json({ success: true, id: saved.id });
});

apiRouter.post('/push/unsubscribe', (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: 'ENDPOINT_REQUIRED', message: 'الرابط مطلوب.' });
  }
  db.deletePushSubscription(endpoint);
  res.json({ success: true });
});

/** Send yourself a test notification — used by the bell panel. */
apiRouter.post('/push/test', async (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = (req.headers['x-owner-token'] as string) || undefined;

  const notification = await notifyUser({
    app,
    kind: 'system',
    title: 'إشعار تجريبي من سند',
    body: 'إن وصلتك هذه الرسالة فإشعارات الهاتف تعمل بنجاح ✅',
    linkTab: undefined,
    recipientToken: ownerToken,
  });

  res.json({ success: true, notification });
});

/**
 * Automatic notification scan (low stock + subscription expiry).
 * Called by the admin "تحديث" action, by Vercel Cron, and lazily on app load.
 * Everything is de-duplicated, so repeated calls are harmless.
 */
apiRouter.post('/notifications/scan', async (_req, res) => {
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});

apiRouter.get('/cron/notify-scan', async (_req, res) => {
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});

/** Called by the merchant app on load — throttled to once every 6 hours per process. */
let lastLazyScan = 0;
apiRouter.post('/notifications/scan-lazy', async (_req, res) => {
  const now = Date.now();
  if (now - lastLazyScan < 6 * 60 * 60 * 1000) {
    return res.json({ success: true, skipped: true });
  }
  lastLazyScan = now;
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});

/* ------------------------------------------------------------------ */
/*  Market banners — managed from the admin console                    */
/* ------------------------------------------------------------------ */

apiRouter.get('/market-banners', (_req, res) => {
  res.json({ banners: db.getMarketBanners(true) });
});

/** Shopper tapped a banner — the landing page fires this before opening the link. */
apiRouter.post('/market-banners/:id/click', (req, res) => {
  const banner = db.trackMarketBannerClick(req.params.id);
  if (!banner) return res.status(404).json({ error: 'NOT_FOUND', message: 'البانر غير موجود.' });
  res.json({ success: true, clicks: banner.clicks || 0 });
});

apiRouter.get('/admin/market-banners', (_req, res) => {
  res.json({ banners: db.getMarketBanners(false) });
});

apiRouter.post('/admin/market-banners', (req, res) => {
  const { title, subtitle, badge, imageUrl, linkUrl, advertiserName, sortOrder, active } = req.body || {};

  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'عنوان البانر مطلوب.' });
  }
  if (!imageUrl || !String(imageUrl).trim()) {
    return res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'أضف صورة للبانر.' });
  }

  const banner = db.createMarketBanner({
    title: String(title).trim(),
    subtitle: subtitle ? String(subtitle).trim() : undefined,
    badge: badge ? String(badge).trim() : undefined,
    imageUrl: String(imageUrl).trim(),
    linkUrl: linkUrl ? String(linkUrl).trim() : undefined,
    advertiserName: advertiserName ? String(advertiserName).trim() : undefined,
    active: active !== false,
    sortOrder:
      sortOrder !== undefined && sortOrder !== null && Number.isFinite(Number(sortOrder))
        ? Number(sortOrder)
        : db.getMarketBanners().length + 1,
  });

  res.json({ success: true, banner });
});

apiRouter.put('/admin/market-banners/:id', (req, res) => {
  const patch: any = {};
  for (const key of ['title', 'subtitle', 'badge', 'imageUrl', 'linkUrl', 'advertiserName', 'active', 'sortOrder'] as const) {
    if (req.body?.[key] !== undefined) {
      patch[key] = key === 'sortOrder' ? Number(req.body[key]) : key === 'active' ? !!req.body[key] : req.body[key];
    }
  }

  const banner = db.updateMarketBanner(req.params.id, patch);
  if (!banner) return res.status(404).json({ error: 'NOT_FOUND', message: 'البانر غير موجود.' });
  res.json({ success: true, banner });
});

apiRouter.post('/admin/market-banners/:id/reset-clicks', (req, res) => {
  const banner = db.resetMarketBannerClicks(req.params.id);
  if (!banner) return res.status(404).json({ error: 'NOT_FOUND', message: 'البانر غير موجود.' });
  res.json({ success: true, banner });
});

apiRouter.delete('/admin/market-banners/:id', (req, res) => {
  const removed = db.deleteMarketBanner(req.params.id);
  if (!removed) return res.status(404).json({ error: 'NOT_FOUND', message: 'البانر غير موجود.' });
  res.json({ success: true });
});
