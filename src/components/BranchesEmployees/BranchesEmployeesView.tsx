import React, { useEffect, useState } from 'react';
import {
  Building,
  Users,
  Plus,
  Phone,
  MapPin,
  CheckCircle,
  X,
  Lock,
  Edit2,
  Trash2,
  Clock,
  Shield,
} from 'lucide-react';
import type { AuditLog, Branch, Employee, EmployeeRole } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import {
  PERM_DEFS,
  defaultPermissions,
  hasPerm,
  roleBadgeClass,
  roleLabel,
  type PermKey,
} from '../../lib/staffPermissions.ts';

interface BranchesEmployeesViewProps {
  branches: Branch[];
  employees: Employee[];
  onRefresh: () => void;
}

type StaffTab = 'branches' | 'employees' | 'audit';

const emptyPerms = (): Record<PermKey, boolean> =>
  PERM_DEFS.reduce((acc, p) => {
    acc[p.key] = false;
    return acc;
  }, {} as Record<PermKey, boolean>);

export const BranchesEmployeesView: React.FC<BranchesEmployeesViewProps> = ({
  branches,
  employees,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<StaffTab>('employees');

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCity, setBranchCity] = useState('الخرطوم');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<EmployeeRole>('cashier');
  const [empPin, setEmpPin] = useState('');
  const [empBranchId, setEmpBranchId] = useState(branches[0]?.id || '');
  const [empMaxDiscount, setEmpMaxDiscount] = useState('10');
  const [empPerms, setEmpPerms] = useState<Record<PermKey, boolean>>(emptyPerms());

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    api
      .getAuditLogs()
      .then((r) => setAuditLogs(r.logs || []))
      .catch(() => setAuditLogs([]));
  }, [activeTab]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.createBranch({
        name: branchName,
        code: branchCode,
        city: branchCity,
        address: branchAddress,
        phone: branchPhone,
      });
      if (res.success) {
        setIsBranchModalOpen(false);
        setBranchName('');
        setBranchCode('');
        setBranchAddress('');
        setBranchPhone('');
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إضافة الفرع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setEmpName('');
    setEmpEmail('');
    setEmpPhone('');
    setEmpRole('cashier');
    setEmpPin('');
    setEmpBranchId(branches[0]?.id || '');
    setEmpMaxDiscount('10');
    const next = emptyPerms();
    for (const k of defaultPermissions('cashier')) {
      if (k in next) next[k as PermKey] = true;
    }
    setEmpPerms(next);
    setErrorMsg(null);
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpEmail(emp.email || '');
    setEmpPhone(emp.phone || '');
    setEmpRole(emp.role);
    setEmpPin('');
    setEmpBranchId(emp.branchId || branches[0]?.id || '');
    setEmpMaxDiscount(String(emp.maxDiscountPct ?? 10));
    const next = emptyPerms();
    for (const p of PERM_DEFS) next[p.key] = hasPerm(emp, p.key);
    setEmpPerms(next);
    setErrorMsg(null);
    setIsEmployeeModalOpen(true);
  };

  const applyRoleDefaults = (role: EmployeeRole) => {
    setEmpRole(role);
    const next = emptyPerms();
    for (const k of defaultPermissions(role)) {
      if (k in next) next[k as PermKey] = true;
    }
    setEmpPerms(next);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    const permissions = Object.entries(empPerms)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (empRole === 'owner') permissions.push('all');
    const pin = empPin.replace(/\D/g, '').slice(0, 6);
    try {
      if (editingEmployee) {
        const res = await api.updateEmployee(editingEmployee.id, {
          name: empName,
          email: empEmail,
          phone: empPhone,
          role: empRole,
          branchId: empBranchId,
          maxDiscountPct: Number(empMaxDiscount),
          permissions,
          ...(pin.length >= 4 ? { pin } : {}),
        });
        if (res.success) {
          setIsEmployeeModalOpen(false);
          onRefresh();
        }
      } else {
        if (pin.length < 4) {
          setErrorMsg('رمز الدخول 4 أرقام على الأقل.');
          setIsSubmitting(false);
          return;
        }
        const res = await api.createEmployee({
          name: empName,
          email: empEmail,
          phone: empPhone,
          role: empRole,
          pin,
          branchId: empBranchId,
          maxDiscountPct: Number(empMaxDiscount),
          permissions,
        });
        if (res.success) {
          setIsEmployeeModalOpen(false);
          onRefresh();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(`تشيل ${emp.name} من الموظفين نهائياً؟`)) return;
    try {
      await api.deleteEmployee(emp.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'ما قدرنا نحذف الموظف');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">فريق العمل والصلاحيات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            بطاقات الموظفين بأسلوب حساباتي — صلاحيات دقيقة، رمز PIN، وسجل تدقيق
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl text-xs font-bold">
            {(
              [
                ['employees', `فريق العمل (${employees.length})`],
                ['branches', `الفروع (${branches.length})`],
                ['audit', `سجل التدقيق (${auditLogs.length || '…'})`],
              ] as [StaffTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === id
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {id === 'employees' && <Users className="w-3.5 h-3.5" />}
                {id === 'branches' && <Building className="w-3.5 h-3.5" />}
                {id === 'audit' && <Clock className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'branches' ? (
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة فرع
            </button>
          ) : activeTab === 'employees' ? (
            <button
              onClick={openAddEmployee}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة موظف
            </button>
          ) : null}
        </div>
      </div>

      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${
                b.isMain ? 'border-emerald-300 ring-1 ring-emerald-500/20' : 'border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm">{b.name}</span>
                  {b.isMain && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      الفرع الرئيسي
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {b.city} - {b.address || 'وسط المدينة'}
                    </span>
                  </div>
                  {b.phone && (
                    <div className="flex items-center gap-2 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">كود: {b.code}</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  نشط ومفعل
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const branch = branches.find((b) => b.id === emp.branchId);
            return (
              <div
                key={emp.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg text-slate-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-white text-sm truncate">{emp.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">{emp.phone || 'بدون هاتف'}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{branch?.name || 'كافة الفروع'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 ${roleBadgeClass(emp.role)}`}>
                    {roleLabel(emp.role)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">الصلاحيات المفعلة:</span>
                  {PERM_DEFS.slice(0, 5).map((p) => {
                    const allowed = hasPerm(emp, p.key);
                    return (
                      <div key={p.key} className="flex items-center justify-between text-slate-300">
                        <span>{p.label}:</span>
                        {allowed ? (
                          <span className="text-emerald-400 font-bold">مسموح</span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-0.5">
                            <Lock className="w-3 h-3" /> محجوب
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>أقصى خصم:</span>
                    <span className="font-mono font-bold text-white">{emp.maxDiscountPct ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>رمز الدخول:</span>
                    <span className="font-mono tracking-widest">{emp.pin ? '••••' : 'بدون'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => openEditEmployee(emp)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    تعديل البيانات
                  </button>
                  {emp.role !== 'owner' && (
                    <button
                      onClick={() => handleDeleteEmployee(emp)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            سجل التدقيق — غير قابل للتعديل
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">المستخدم</th>
                  <th className="p-3">نوع العملية</th>
                  <th className="p-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      ما في عمليات مسجّلة بعد
                    </td>
                  </tr>
                )}
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('ar-SD')}
                    </td>
                    <td className="p-3 font-semibold text-white">{log.actorName}</td>
                    <td className="p-3">
                      <span className="bg-slate-950 border border-slate-800 text-emerald-400 px-2 py-0.5 rounded font-bold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 leading-relaxed">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBranch}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">إضافة فرع جديد</h3>
              <button type="button" onClick={() => setIsBranchModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {errorMsg && <div className="bg-rose-50 text-rose-800 px-6 py-2.5 text-xs border-b border-rose-200">{errorMsg}</div>}
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم الفرع:</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رمز الفرع:</label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المدينة:</label>
                  <input
                    type="text"
                    required
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">العنوان:</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">هاتف الفرع:</label>
                <input
                  type="text"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setIsBranchModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl"
              >
                حفظ الفرع
              </button>
            </div>
          </form>
        </div>
      )}

      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEmployee}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto text-slate-100 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h3>
              <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && <div className="bg-rose-950/60 text-rose-200 px-3 py-2 rounded-xl border border-rose-800">{errorMsg}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">اسم الموظف:</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">البريد:</label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">الرمز السري (4-6 أرقام 🔒):</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={empPin}
                  onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={editingEmployee ? 'اتركه فاضي = بدون تغيير' : '4 أرقام على الأقل'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none font-mono tracking-widest"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">الدور الوظيفي:</label>
                <select
                  value={empRole}
                  onChange={(e) => applyRoleDefaults(e.target.value as EmployeeRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none"
                >
                  <option value="cashier">كاشير مبيعات (حجب الأرباح)</option>
                  <option value="inventory_officer">أمين مخزن</option>
                  <option value="branch_manager">مدير فرع</option>
                  <option value="accountant">محاسب مالي</option>
                  <option value="auditor">مدقق قراءة فقط</option>
                  <option value="owner">المالك / المدير</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">الفرع:</label>
                <select
                  value={empBranchId}
                  onChange={(e) => setEmpBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">أقصى خصم مسموح (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={empMaxDiscount}
                  onChange={(e) => setEmpMaxDiscount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <span className="font-bold text-white block mb-1">تخصيص الصلاحيات المستقلة:</span>
              {PERM_DEFS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empPerms[p.key]}
                    onChange={(e) => setEmpPerms({ ...empPerms, [p.key]: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black"
              >
                حفظ الموظف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
