import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Star,
  Receipt,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronLeft,
  FileText,
  Building,
  UserPlus,
  History,
  TrendingUp,
} from 'lucide-react';
import type { Customer, Sale } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface PosCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomerId?: string | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export const PosCustomerModal: React.FC<PosCustomerModalProps> = ({
  isOpen,
  onClose,
  selectedCustomerId,
  onSelectCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'history'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New customer form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('الخرطوم');
  const [address, setAddress] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer history view state
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load customers
  const loadCustomers = async (query?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getCustomers(query);
      setCustomers(res.customers || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تحميل بيانات العملاء');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomers(searchQuery);
    }
  }, [isOpen]);

  // Handle search with debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadCustomers(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load customer purchase history
  const handleViewHistory = async (cust: Customer) => {
    setViewingCustomer(cust);
    setActiveTab('history');
    setIsLoadingHistory(true);
    try {
      const res = await api.getCustomerHistory(cust.id);
      setCustomerSales(res.sales || []);
      setCustomerSummary(res.summary || null);
    } catch (err: any) {
      console.warn('Failed loading customer history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Submit new customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.customer) {
        // Automatically select newly registered customer for current sale
        onSelectCustomer(res.customer);
        // Reset form
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setTaxNumber('');
        setNotes('');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تسجيل بيانات العميل');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">
                إدارة بيانات العملاء وبرنامج نقاط الولاء (CRM)
              </h3>
              <p className="text-[11px] text-slate-400">
                تسجيل ومطابقة بيانات الزبائن، ربط الفواتير المباشرة، وتتبع رصيد نقاط الولاء التراكمية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span>دليل العملاء ({customers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'add'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>+ تسجيل عميل جديد</span>
            </button>

            {viewingCustomer && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4 text-emerald-600" />
                <span>سجل مشتريات: {viewingCustomer.name}</span>
              </button>
            )}
          </div>

          {/* Quick Cash Customer Button */}
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              onClose();
            }}
            className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 rounded-lg transition-colors"
          >
            تحديد كـ "عميل نقدي عام" (إلغاء الربط)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* =========================================================================
              TAB 1: CUSTOMERS LIST & SELECTION
              ========================================================================= */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، رقم الهاتف (مثال: 0912...)، أو الرقم الضريبي..."
                  className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs font-sans"
                />
              </div>

              {/* Customers Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {customers.map((c) => {
                  const isSelected = selectedCustomerId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border transition-all bg-white flex flex-col justify-between gap-3 shadow-2xs ${
                        isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{c.name}</span>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full font-bold">
                                العميل الحالي
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{c.phone}</span>
                            </span>
                            {c.city && (
                              <span className="flex items-center gap-1 text-slate-500 font-sans">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{c.city}</span>
                              </span>
                            )}
                          </div>
                          {c.taxNumber && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>الرقم الضريبي: {c.taxNumber}</span>
                            </div>
                          )}
                        </div>

                        {/* Loyalty Points Badge */}
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col items-center shrink-0">
                          <div className="flex items-center gap-1 text-xs font-black text-amber-700">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span className="font-mono text-sm">{c.loyaltyPoints || 0}</span>
                          </div>
                          <span className="text-[9px] text-amber-800 font-semibold">نقاط ولاء</span>
                        </div>
                      </div>

                      {/* Financial KPI stats */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[10px]">إجمالي المشتريات:</span>
                          <span className="font-bold font-mono text-slate-900">
                            {(c.totalPurchasesSdg || 0).toLocaleString()} ج.س
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">عدد الفواتير السابقة:</span>
                          <span className="font-bold font-mono text-slate-900">
                            {c.invoicesCount || 0} فواتير
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleViewHistory(c)}
                          className="px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>سجل المشتريات والولاء</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectCustomer(c);
                            onClose();
                          }}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'تم الاختيار' : 'اختيار للفاتورة'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {customers.length === 0 && !isLoading && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    لم يتم العثور على أي عميل يطابق البحث.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setName(searchQuery.replace(/^[0-9]+$/, ''));
                      setPhone(searchQuery.match(/^[0-9]+$/) ? searchQuery : '');
                      setActiveTab('add');
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    + تسجيل هذا العميل الآن
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 2: REGISTER NEW CUSTOMER
              ========================================================================= */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreateCustomer} className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>تسجيل بيانات عميل جديد في نقاط البيع</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  أدخل بيانات العميل ليتم ربط الفاتورة الحالية به وإضافة نقاط الولاء تلقائياً إلى حسابه
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    اسم العميل الكامل: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: م. عبد العظيم الفاتح"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    رقم الهاتف: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 0912345678"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">البريد الإلكتروني (اختياري):</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@mail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المدينة / الفرع المفضل:</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="الخرطوم">الخرطوم</option>
                    <option value="بورتسودان">بورتسودان</option>
                    <option value="ود مدني">ود مدني</option>
                    <option value="عطبرة">عطبرة</option>
                    <option value="كسلا">كسلا</option>
                    <option value="القضارف">القضارف</option>
                    <option value="شندي">شندي</option>
                    <option value="كوستي">كوستي</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">العنوان بالتفصيل:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="الحي، اسم الشارع، رقم المنزل أو المعلم البارز"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    الرقم الضريبي للعميل (للشركات والمؤسسات - يظهر في الفاتورة الضريبية):
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="الرقم الضريبي التجاري المكون من 10 أو 15 رقماً"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">ملاحظات إضافية:</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="تفضيلات التوصيل، نوع العميل، شروط دفع خاصة..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ واختيار العميل للفاتورة'}
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              TAB 3: CUSTOMER HISTORY & LOYALTY STATEMENT
              ========================================================================= */}
          {activeTab === 'history' && viewingCustomer && (
            <div className="space-y-4">
              {/* Customer Profile Banner */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">{viewingCustomer.name}</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                      عميل مسجل
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{viewingCustomer.phone}</span>
                    </span>
                    {viewingCustomer.city && (
                      <span className="flex items-center gap-1 font-sans text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{viewingCustomer.city} {viewingCustomer.address && `· ${viewingCustomer.address}`}</span>
                      </span>
                    )}
                    {viewingCustomer.taxNumber && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>الرقم الضريبي: {viewingCustomer.taxNumber}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCustomer(viewingCustomer);
                      onClose();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اختيار هذا العميل للفاتورة</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {customerSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-amber-500/10 border border-amber-300/60 p-4 rounded-xl">
                    <span className="text-[11px] text-amber-800 font-semibold block mb-0.5 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>نقاط الولاء التراكمية</span>
                    </span>
                    <span className="text-2xl font-black font-mono text-amber-900">
                      {customerSummary.loyaltyPoints.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-amber-700 block mt-0.5">نقطة رصيد متاحة</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-500 block mb-0.5">إجمالي المشتريات المكتملة</span>
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {customerSummary.totalSpentSdg.toLocaleString()} ج.س
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      {customerSummary.totalInvoices} فواتير مسجلة
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-500 block mb-0.5">متوسط سلة المشتريات</span>
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {customerSummary.averageInvoiceSdg.toLocaleString()} ج.س
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">لكل فاتورة</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-500 block mb-0.5">آخر عملية شراء</span>
                    <span className="text-xs font-bold text-slate-800 font-mono block">
                      {customerSummary.lastPurchaseAt
                        ? new Date(customerSummary.lastPurchaseAt).toLocaleDateString('ar-SD')
                        : 'لا يوجد'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {customerSummary.lastPurchaseAt
                        ? new Date(customerSummary.lastPurchaseAt).toLocaleTimeString('ar-SD', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Invoices History Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>سجل الفواتير والمشتريات السابقة ({customerSales.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    معدل اكتساب النقاط: 1 نقطة لكل 1,000 ج.س
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">رقم الفاتورة</th>
                        <th className="py-2.5 px-4">التاريخ والوقت</th>
                        <th className="py-2.5 px-4">الفرع</th>
                        <th className="py-2.5 px-4">ملخص الأصناف</th>
                        <th className="py-2.5 px-4">طريقة الدفع</th>
                        <th className="py-2.5 px-4">الإجمالي (ج.س)</th>
                        <th className="py-2.5 px-4">النقاط المكتسبة</th>
                        <th className="py-2.5 px-4">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerSales.map((s) => {
                        const earnedPts = Math.max(1, Math.floor(s.grandTotalSdg / 1000));
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                              {s.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-600 text-[11px]">
                              {new Date(s.createdAt).toLocaleString('ar-SD')}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700">{s.branchName}</td>
                            <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={s.items.map((i) => `${i.productName} ×${i.quantity}`).join('، ')}>
                              {s.items.map((i) => `${i.productName} ×${i.quantity}`).join('، ')}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                                {s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'bankak' ? 'بنكك' : s.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                              {s.grandTotalSdg.toLocaleString()} ج.س
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-amber-700">
                              +{earnedPts} ⭐
                            </td>
                            <td className="py-2.5 px-4">
                              {s.status === 'completed' && (
                                <span className="text-emerald-700 text-[11px] font-bold">مكتمل</span>
                              )}
                              {s.status === 'refunded' && (
                                <span className="text-rose-700 text-[11px] font-bold">مرتجع كامل</span>
                              )}
                              {s.status === 'partially_refunded' && (
                                <span className="text-amber-700 text-[11px] font-bold">مرتجع جزئي</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {customerSales.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            لا توجد فواتير مسجلة لهذا العميل حتى الآن. ستظهر الفواتير هنا فور إتمام المبيعات.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
