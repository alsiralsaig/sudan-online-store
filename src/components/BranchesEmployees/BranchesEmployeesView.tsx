import React, { useState } from 'react';
import {
  Building,
  Users,
  Plus,
  Shield,
  Phone,
  MapPin,
  CheckCircle,
  X,
  Lock,
} from 'lucide-react';
import type { Branch, Employee } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface BranchesEmployeesViewProps {
  branches: Branch[];
  employees: Employee[];
  onRefresh: () => void;
}

export const BranchesEmployeesView: React.FC<BranchesEmployeesViewProps> = ({
  branches,
  employees,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'employees'>('branches');

  // Add Branch Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCity, setBranchCity] = useState('الخرطوم');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // Add Employee Modal
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<Employee['role']>('cashier');
  const [empPin, setEmpPin] = useState('1111');
  const [empBranchId, setEmpBranchId] = useState(branches[0]?.id || '');
  const [empMaxDiscount, setEmpMaxDiscount] = useState('10');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Submit Branch
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

  // Submit Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.createEmployee({
        name: empName,
        email: empEmail,
        phone: empPhone,
        role: empRole,
        pin: empPin,
        branchId: empBranchId,
        maxDiscountPct: Number(empMaxDiscount),
      });

      if (res.success) {
        setIsEmployeeModalOpen(false);
        setEmpName('');
        setEmpEmail('');
        setEmpPhone('');
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إضافة الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return 'المالك والمشرف العام';
      case 'branch_manager':
        return 'مدير فرع';
      case 'cashier':
        return 'كاشير نقاط بيع';
      case 'inventory_officer':
        return 'مسؤول مستودع ومخزون';
      case 'accountant':
        return 'محاسب مالي';
      case 'auditor':
        return 'مدقق قراءة فقط';
      default:
        return role;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة الفروع والموظفين والصلاحيات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تخصيص الفروع المستقلة وتحديد صلاحيات الوصول ونسب الخصم المسموحة لكل دور وظيفي
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'branches' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              فروع المنشأة ({branches.length})
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'employees' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              طاقم الموظفين ({employees.length})
            </button>
          </div>

          {activeTab === 'branches' ? (
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فرع جديد</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEmployeeModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موظف جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'branches' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between ${
                b.isMain ? 'border-emerald-300 ring-1 ring-emerald-500/20' : 'border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{b.name}</span>
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
                  <span>نشط ومفعل</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Employees List */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">المسمى الوظيفي والدور</th>
                  <th className="py-3 px-4">الفرع التابع له</th>
                  <th className="py-3 px-4">الهاتف والبريد</th>
                  <th className="py-3 px-4">الحد الأقصى للخصم المسموح</th>
                  <th className="py-3 px-4">رمز الدخول السريع (PIN)</th>
                  <th className="py-3 px-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((emp) => {
                  const branch = branches.find((b) => b.id === emp.branchId);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{emp.name}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{getRoleBadge(emp.role)}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{branch?.name || 'كافة الفروع'}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        <div>{emp.phone || '-'}</div>
                        <div className="text-[10px] text-slate-400">{emp.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {emp.maxDiscountPct}%
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        •••• ({emp.pin})
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-700 font-semibold">مفعل</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD BRANCH MODAL
          ========================================================================= */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBranch}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">إضافة فرع جديد</h3>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 text-rose-800 px-6 py-2.5 text-xs border-b border-rose-200">
                {errorMsg}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم الفرع:</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="مثال: فرع بحري - المزاد"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رمز الفرع (الكود):</label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    placeholder="مثال: BHR-03"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المدينة:</label>
                  <input
                    type="text"
                    required
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">العنوان التفصيلي:</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="الشارع، المعلم البارز..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">هاتف الفرع:</label>
                <input
                  type="text"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="0912000000"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ الفرع
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          ADD EMPLOYEE MODAL
          ========================================================================= */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEmployee}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">إضافة موظف جديد وتحديد الصلاحيات</h3>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 text-rose-800 px-6 py-2.5 text-xs border-b border-rose-200">
                {errorMsg}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم الموظف الرباعي:</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="مثال: عمار حسن الفاضل"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الدور الوظيفي:</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="cashier">كاشير نقاط بيع</option>
                    <option value="branch_manager">مدير فرع</option>
                    <option value="inventory_officer">مسؤول مخزون</option>
                    <option value="accountant">محاسب مالي</option>
                    <option value="auditor">مدقق ومراجع</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الفرع المخصص:</label>
                  <select
                    value={empBranchId}
                    onChange={(e) => setEmpBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="0912000000"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">البريد الإلكتروني:</label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="emp@domain.sd"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رمز PIN للدخول السريع:</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={empPin}
                    onChange={(e) => setEmpPin(e.target.value)}
                    placeholder="4 أرقام"
                    className="w-full px-3 py-2 font-mono text-center tracking-widest border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">أقصى خصم مسموح (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={empMaxDiscount}
                    onChange={(e) => setEmpMaxDiscount(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                إضافة الموظف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
