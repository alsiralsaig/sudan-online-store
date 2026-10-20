import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Receipt,
  Building,
  CreditCard,
  DollarSign,
  TrendingDown,
  X,
  CheckCircle,
  Calendar,
  Clock,
  Repeat,
  CalendarClock,
  PlayCircle,
  Trash2,
  AlertCircle,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import type { Purchase, Expense, RecurringExpense, Branch, CurrencyConfig } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface PurchasesExpensesViewProps {
  branches: Branch[];
  currentBranch: Branch | null;
  currencies: CurrencyConfig[];
  onRefresh: () => void;
}

export const PurchasesExpensesView: React.FC<PurchasesExpensesViewProps> = ({
  branches,
  currentBranch,
  currencies,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'purchases' | 'recurring'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Add Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('كهرباء ومياه');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseReceiptNo, setExpenseReceiptNo] = useState('');
  const [expenseBranchId, setExpenseBranchId] = useState(currentBranch?.id || branches[0]?.id || '');

  // Add Recurring Expense Modal
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recCategory, setRecCategory] = useState<RecurringExpense['category']>('إيجار');
  const [recAmount, setRecAmount] = useState('');
  const [recFrequency, setRecFrequency] = useState<RecurringExpense['frequency']>('monthly');
  const [recDayOfMonth, setRecDayOfMonth] = useState('1');
  const [recNextDueDate, setRecNextDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [recAutoPost, setRecAutoPost] = useState(true);
  const [recNotes, setRecNotes] = useState('');
  const [recBranchId, setRecBranchId] = useState(currentBranch?.id || branches[0]?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadData = async () => {
    try {
      const expRes = await api.getExpenses();
      setExpenses(expRes.expenses);

      const purchRes = await api.getPurchases();
      setPurchases(purchRes.purchases);

      const recRes = await api.getRecurringExpenses();
      setRecurringExpenses(recRes.recurringExpenses);
    } catch (err) {
      console.warn('Failed to load financial records:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered lists
  const filteredExpenses = expenses.filter((e) => !selectedBranchId || e.branchId === selectedBranchId);
  const filteredPurchases = purchases.filter((p) => !selectedBranchId || p.branchId === selectedBranchId);
  const filteredRecurring = recurringExpenses.filter((r) => !selectedBranchId || r.branchId === selectedBranchId);

  // Total Expenses
  const totalExpensesSdg = filteredExpenses.reduce((acc, e) => acc + e.amountSdg, 0);
  const totalPurchasesSdg = filteredPurchases.reduce((acc, p) => acc + p.totalCostSdg, 0);
  const totalMonthlyRecurringSdg = filteredRecurring
    .filter((r) => r.isActive)
    .reduce((acc, r) => {
      if (r.frequency === 'weekly') return acc + r.amountSdg * 4;
      if (r.frequency === 'yearly') return acc + Math.round(r.amountSdg / 12);
      return acc + r.amountSdg;
    }, 0);

  // Submit Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.createExpense({
        branchId: expenseBranchId,
        category: expenseCategory,
        amountSdg: Number(expenseAmount),
        description: expenseDescription,
        receiptNumber: expenseReceiptNo,
      });

      if (res.success) {
        setIsExpenseModalOpen(false);
        setExpenseAmount('');
        setExpenseDescription('');
        setExpenseReceiptNo('');
        showToast('تم تسجيل سند الصرف بنجاح');
        loadData();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تسجيل المصروف');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Recurring Expense
  const handleAddRecurringExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.createRecurringExpense({
        branchId: recBranchId,
        title: recTitle,
        category: recCategory,
        amountSdg: Number(recAmount),
        frequency: recFrequency,
        dayOfMonth: Number(recDayOfMonth),
        nextDueDate: recNextDueDate,
        autoPost: recAutoPost,
        notes: recNotes,
      });

      if (res.success) {
        setIsRecurringModalOpen(false);
        setRecTitle('');
        setRecAmount('');
        setRecNotes('');
        showToast('تمت جدولة المصروف الدوري بنجاح');
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل جدولة المصروف الدوري');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Post recurring expense now
  const handlePostNow = async (id: string, title: string) => {
    try {
      const res = await api.postRecurringExpenseNow(id);
      if (res.success) {
        showToast(`تم تسجيل مصروف «${title}» في القيود وترحيل تاريخ الاستحقاق القادم`);
        loadData();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل ترحيل المصروف');
    }
  };

  // Toggle active recurring
  const handleToggleRecurringActive = async (rec: RecurringExpense) => {
    try {
      await api.updateRecurringExpense(rec.id, { isActive: !rec.isActive });
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث الحالة');
    }
  };

  // Delete recurring
  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المصروف الدوري المجدول؟')) return;
    try {
      await api.deleteRecurringExpense(id);
      showToast('تم حذف الجدولة بنجاح');
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الجدولة');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">المشتريات والمصروفات التشغيلية</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            توثيق فواتير المشتريات متعددة العملات والمصروفات التشغيلية لحساب صافي الأرباح بدقة
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'expenses' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              المصروفات التشغيلية
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'purchases' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              فواتير المشتريات والتوريد
            </button>
            <button
              onClick={() => setActiveTab('recurring')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'recurring' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-600" />
              <span>المصروفات الدورية المجدولة</span>
            </button>
          </div>

          {activeTab === 'expenses' && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل سند صرف</span>
            </button>
          )}

          {activeTab === 'recurring' && (
            <button
              onClick={() => setIsRecurringModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <CalendarClock className="w-4 h-4" />
              <span>جدولة مصروف دوري جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">إجمالي المصروفات المنفذة:</span>
            <span className="text-xl font-bold text-rose-700 font-mono tabular-nums">
              {totalExpensesSdg.toLocaleString()} ج.س
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">إجمالي المشتريات والتوريدات:</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {totalPurchasesSdg.toLocaleString()} ج.س
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">الالتزام الشهري للمصروفات الدورية:</span>
            <span className="text-xl font-bold text-indigo-700 font-mono tabular-nums">
              {totalMonthlyRecurringSdg.toLocaleString()} ج.س
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {filteredRecurring.filter((r) => r.isActive).length} بنود مجدولة (إيجار، رواتب، إنترنت)
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Branch */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">تصفية حسب الفرع:</span>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">كافة الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content Table */}
      {activeTab === 'expenses' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الفرع</th>
                  <th className="py-3 px-4">تصنيف المصروف</th>
                  <th className="py-3 px-4">البيان / الوصف</th>
                  <th className="py-3 px-4">رقم السند / الإيصال</th>
                  <th className="py-3 px-4">المسؤول عن الصرف</th>
                  <th className="py-3 px-4">المبلغ بالجنيه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(exp.createdAt).toLocaleDateString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{exp.branchName}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-700">{exp.category}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{exp.description}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{exp.receiptNumber || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{exp.paidBy}</td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-700">
                      {exp.amountSdg.toLocaleString()} ج.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'purchases' ? (
        /* Purchases Table */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">المورد</th>
                  <th className="py-3 px-4">الفرع</th>
                  <th className="py-3 px-4">عملة الفاتورة</th>
                  <th className="py-3 px-4">سعر الصرف المعتمد</th>
                  <th className="py-3 px-4">التكلفة الإجمالية (ج.س)</th>
                  <th className="py-3 px-4">حالة السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPurchases.map((purch) => (
                  <tr key={purch.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(purch.createdAt).toLocaleDateString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{purch.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{purch.supplierName}</td>
                    <td className="py-3 px-4 text-slate-700">{purch.branchName}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{purch.currency}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {purch.exchangeRate === 1 ? 'أساسي (1)' : `1 ${purch.currency} = ${purch.exchangeRate} ج.س`}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {purch.totalCostSdg.toLocaleString()} ج.س
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 font-semibold">مدفوع ومستلم</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Recurring Expenses Table (جدول المصروفات الدورية المجدولة) */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-indigo-600" />
                <span>جدول المصروفات والالتزامات الدورية (إيجار، رواتب، إنترنت، كهرباء)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تُرحل هذه المصروفات تلقائياً إلى قيود المصروفات عند حلول التاريخ المحدد أو يدوياً بنقرة زر
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">عنوان المصروف</th>
                  <th className="py-3 px-4">الفرع</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4">المبلغ المجدول</th>
                  <th className="py-3 px-4">دورية التكرار</th>
                  <th className="py-3 px-4">الاستحقاق القادم</th>
                  <th className="py-3 px-4">التسجيل الآلي</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">إجراءات الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecurring.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      لا توجد مصروفات دورية مجدولة حالياً لهذا الفرع
                    </td>
                  </tr>
                ) : (
                  filteredRecurring.map((rec) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isDueToday = rec.nextDueDate <= todayStr;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rec.title}</div>
                          {rec.notes && <div className="text-[11px] text-slate-500">{rec.notes}</div>}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{rec.branchName}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {rec.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700 text-sm">
                          {rec.amountSdg.toLocaleString()} ج.س
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {rec.frequency === 'weekly'
                            ? 'أسبوعي'
                            : rec.frequency === 'yearly'
                            ? 'سنوي'
                            : `شهري (يوم ${rec.dayOfMonth})`}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              isDueToday
                                ? 'bg-rose-100 text-rose-800 font-bold animate-pulse'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {rec.nextDueDate} {isDueToday ? '(مستحق الآن)' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              rec.autoPost
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {rec.autoPost ? 'آلي مفعل' : 'يدوي فقط'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleRecurringActive(rec)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                              rec.isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {rec.isActive ? 'نشط ومفعل' : 'متوقف مؤقتاً'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePostNow(rec.id, rec.title)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                              title="تسجيل هذا المصروف الآن وترحيل الاستحقاق القادم"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>تسجيل الآن</span>
                            </button>
                            <button
                              onClick={() => handleDeleteRecurring(rec.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="حذف الجدولة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD EXPENSE MODAL
          ========================================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddExpense}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">تسجيل سند صرف ومصروف تشغيلي</h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">الفرع المحمّل عليه المصروف:</label>
                <select
                  value={expenseBranchId}
                  onChange={(e) => setExpenseBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">تصنيف المصروف:</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="كهرباء ومياه">كهرباء ومياه وخدمات</option>
                  <option value="نقل وتفريغ">نقل وتفريغ وعتالة</option>
                  <option value="رواتب">رواتب ومكافآت عمال</option>
                  <option value="إيجار">إيجار المحل أو المستودع</option>
                  <option value="صيانة">صيانة وإصلاحات</option>
                  <option value="إعاشة وضيافة">إعاشة وضيافة ونثريات</option>
                  <option value="أخرى">مصروفات أخرى</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">المبلغ (بالجنيه السوداني):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="أدخل المبلغ"
                    className="w-full pr-3 pl-12 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                    ج.س
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">بيان الصرف والشرح:</label>
                <textarea
                  required
                  rows={2}
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="مثال: شراء كروت كهرباء 3 فاز للمبردات والإنارة..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">رقم الفاتورة أو الإيصال الخارجي (اختياري):</label>
                <input
                  type="text"
                  value={expenseReceiptNo}
                  onChange={(e) => setExpenseReceiptNo(e.target.value)}
                  placeholder="مثال: ELEC-99120"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ السند
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          ADD RECURRING EXPENSE MODAL (جدولة المصروفات الدورية)
          ========================================================================= */}
      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddRecurringExpense}
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-sm">جدولة مصروف دوري جديد (إيجار، رواتب، إنترنت)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecurringModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  عنوان المصروف الدوري: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="مثال: إيجار المقر التجاري، رواتب الموظفين، فاتورة فايبر إنترنت"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الفرع المحمّل عليه:</label>
                  <select
                    value={recBranchId}
                    onChange={(e) => setRecBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تصنيف المصروف:</label>
                  <select
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="إيجار">إيجار عقار أو مستودع</option>
                    <option value="رواتب">رواتب وأجور موظفين</option>
                    <option value="إنترنت واتصالات">إنترنت واتصالات وسيرفرات</option>
                    <option value="كهرباء ومياه">كهرباء ومياه وخدمات</option>
                    <option value="صيانة">صيانة دورية وتبريد</option>
                    <option value="نقل وتفريغ">خدمات لوجستية دورية</option>
                    <option value="أخرى">مصروفات دورية أخرى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    المبلغ (بالجنيه السوداني): <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      required
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      placeholder="350000"
                      className="w-full pr-3 pl-12 py-2 font-bold font-mono border border-slate-300 rounded-lg"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                      ج.س
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">دورية التكرار:</label>
                  <select
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="monthly">شهرياً (الأكثر شيوعاً)</option>
                    <option value="weekly">أسبوعياً</option>
                    <option value="yearly">سنوياً</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {recFrequency === 'monthly' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">يوم الاستحقاق الشهري:</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recDayOfMonth}
                      onChange={(e) => setRecDayOfMonth(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاريخ الاستحقاق الأول:</label>
                  <input
                    type="date"
                    required
                    value={recNextDueDate}
                    onChange={(e) => setRecNextDueDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Auto-post toggle */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-indigo-900 block">التسجيل الآلي التلقائي:</span>
                  <span className="text-[11px] text-indigo-700">
                    تسجيل المصروف تلقائياً في تاريخ الاستحقاق دون الحاجة للتدخل اليدوي
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={recAutoPost}
                  onChange={(e) => setRecAutoPost(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات وطريقة السداد (اختياري):</label>
                <textarea
                  rows={2}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder="مثال: يتم التحويل للمالك عبر تطبيق بنكك رقم الحساب 2891823"
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecurringModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ الجدولة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
