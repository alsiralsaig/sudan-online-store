import type { Employee, EmployeeRole } from '../types/index.ts';

/** صلاحيات دقيقة منقولة من شاشة موظفي «حساباتي السودان» */
export const PERM_DEFS = [
  { key: 'view_profits', label: 'الاطلاع على صافي الأرباح' },
  { key: 'view_cogs', label: 'تكلفة الشراء (COGS)' },
  { key: 'edit_prices', label: 'تعديل أسعار المنتجات' },
  { key: 'process_returns', label: 'إرجاع الفواتير' },
  { key: 'override_stock', label: 'تجاوز المخزون بالسالب' },
  { key: 'manage_staff', label: 'إدارة الموظفين' },
  { key: 'view_audit', label: 'سجل التدقيق' },
] as const;

export type PermKey = (typeof PERM_DEFS)[number]['key'];

export function defaultPermissions(role: EmployeeRole): string[] {
  switch (role) {
    case 'owner':
    case 'super_admin':
      return ['all', ...PERM_DEFS.map((p) => p.key), 'pos:sell', 'inventory:view'];
    case 'branch_manager':
      return ['pos:sell', 'inventory:view', 'edit_prices', 'process_returns', 'manage_staff', 'view_audit'];
    case 'cashier':
      return ['pos:sell', 'inventory:view', 'process_returns'];
    case 'inventory_officer':
      return ['inventory:view', 'view_cogs', 'override_stock'];
    case 'accountant':
      return ['view_profits', 'view_cogs', 'view_audit'];
    case 'auditor':
      return ['view_audit', 'inventory:view'];
    default:
      return ['pos:sell', 'inventory:view'];
  }
}

export function hasPerm(employee: Pick<Employee, 'permissions' | 'role'>, key: string): boolean {
  const perms = employee.permissions || [];
  if (perms.includes('all') || employee.role === 'owner' || employee.role === 'super_admin') return true;
  return perms.includes(key);
}

export interface ActorPerms {
  viewCogs: boolean;
  viewProfits: boolean;
  editPrices: boolean;
  processReturns: boolean;
  overrideStock: boolean;
  manageStaff: boolean;
  viewAudit: boolean;
}

/** صلاحيات الدور الحالي: من بطاقة الموظف إن وُجدت، وإلا من قالب الدور */
export function resolveActorPerms(role: string, employee?: Employee | null): ActorPerms {
  const source: Pick<Employee, 'permissions' | 'role'> = employee
    ? employee
    : {
        role: (role as EmployeeRole) || 'cashier',
        permissions: defaultPermissions(((role as EmployeeRole) || 'cashier') as EmployeeRole),
      };
  return {
    viewCogs: hasPerm(source, 'view_cogs'),
    viewProfits: hasPerm(source, 'view_profits'),
    editPrices: hasPerm(source, 'edit_prices'),
    processReturns: hasPerm(source, 'process_returns'),
    overrideStock: hasPerm(source, 'override_stock'),
    manageStaff: hasPerm(source, 'manage_staff'),
    viewAudit: hasPerm(source, 'view_audit'),
  };
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'owner':
    case 'super_admin':
      return 'المالك / المدير';
    case 'branch_manager':
      return 'مدير فرع';
    case 'cashier':
      return 'كاشير مبيعات';
    case 'inventory_officer':
      return 'أمين مخزن';
    case 'accountant':
      return 'محاسب مالي';
    case 'auditor':
      return 'مدقق قراءة فقط';
    default:
      return role;
  }
}

export function roleBadgeClass(role: string): string {
  switch (role) {
    case 'owner':
    case 'super_admin':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'cashier':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'inventory_officer':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'branch_manager':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'accountant':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}
