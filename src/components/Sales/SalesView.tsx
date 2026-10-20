import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RotateCcw,
  Printer,
  CheckCircle,
  AlertCircle,
  Eye,
  Calendar,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  Barcode,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  Phone,
  Tag,
  Clock,
} from 'lucide-react';
import type { Sale, Branch, ReturnRecord } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { generateZatcaTlvBase64, generateQrSvg } from '../../lib/zatcaQr.ts';
import { getThermalReceiptSettings } from '../../lib/printerSettings.ts';

interface SalesViewProps {
  sales: Sale[];
  branches: Branch[];
  currentBranch: Branch | null;
  onRefresh: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  branches,
  currentBranch,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'credit_notes'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  // Returns list
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);

  // Selected Sale for viewing/printing
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  // Selected Credit Note for viewing/printing
  const [viewingCreditNote, setViewingCreditNote] = useState<ReturnRecord | null>(null);

  // Quick Retrieve by Invoice Number Modal
  const [isRetrieveModalOpen, setIsRetrieveModalOpen] = useState(false);
  const [retrieveQuery, setRetrieveQuery] = useState('');
  const [lookupError, setLookupError] = useState('');

  // Itemized Refund Modal State
  const [refundingSale, setRefundingSale] = useState<Sale | null>(null);
  const [returnItemQtys, setReturnItemQtys] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState('طلب الزبون استرجاع الصنف');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');

  // Thermal settings
  const receiptSettings = getThermalReceiptSettings();

  // Load returns list
  const loadReturns = async () => {
    setIsLoadingReturns(true);
    try {
      const res = await api.getReturns(selectedBranchId || undefined);
      setReturnsList(res.returns || []);
    } catch (err) {
      console.warn('Could not load returns:', err);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [selectedBranchId]);

  // Filter sales
  const filteredSales = sales.filter((s) => {
    const matchesSearch =
      s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.paymentReference && s.paymentReference.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBranch = !selectedBranchId || s.branchId === selectedBranchId;
    const matchesPayment = !selectedPaymentMethod || s.paymentMethod === selectedPaymentMethod;
    return matchesSearch && matchesBranch && matchesPayment;
  });

  // Filter returns
  const filteredReturns = returnsList.filter((r) => {
    const matchesSearch =
      (r.creditNoteNumber && r.creditNoteNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cashierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = !selectedBranchId || r.branchId === selectedBranchId;
    return matchesSearch && matchesBranch;
  });

  // Open Refund modal for a sale and initialize return quantities
  const openRefundModal = (sale: Sale) => {
    setRefundingSale(sale);
    setRefundError('');
    setRefundReason('طلب الزبون استرجاع الصنف ومطابقة الجرد');

    // Calculate previously returned quantities for this sale
    const previouslyReturnedMap: Record<string, number> = {};
    const relatedReturns = returnsList.filter((r) => r.saleId === sale.id);
    for (const ret of relatedReturns) {
      for (const it of ret.items) {
        previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
      }
    }

    // Default to return all remaining quantities
    const initialQtys: Record<string, number> = {};
    for (const item of sale.items) {
      const alreadyReturned = previouslyReturnedMap[item.productId] || 0;
      const available = Math.max(0, item.quantity - alreadyReturned);
      initialQtys[item.productId] = available;
    }
    setReturnItemQtys(initialQtys);
  };

  // Quick Retrieve by invoice number
  const handleRetrieveInvoice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError('');
    const cleanNum = retrieveQuery.trim().toLowerCase();
    if (!cleanNum) {
      setLookupError('يرجى إدخال رقم الفاتورة للبحث');
      return;
    }

    const found = sales.find(
      (s) =>
        s.invoiceNumber.toLowerCase() === cleanNum ||
        s.invoiceNumber.toLowerCase().includes(cleanNum) ||
        s.id.toLowerCase() === cleanNum
    );

    if (!found) {
      setLookupError(`لم يتم العثور على فاتورة تطابق الرقم: "${retrieveQuery}"`);
      return;
    }

    if (found.status === 'refunded') {
      setLookupError(`هذه الفاتورة (${found.invoiceNumber}) تم استرجاعها بالكامل مسبقاً.`);
      return;
    }

    setIsRetrieveModalOpen(false);
    setRetrieveQuery('');
    openRefundModal(found);
  };

  // Adjust item return quantity
  const handleQtyChange = (productId: string, maxAvailable: number, delta: number) => {
    setReturnItemQtys((prev) => {
      const current = prev[productId] || 0;
      const next = Math.min(Math.max(0, current + delta), maxAvailable);
      return { ...prev, [productId]: next };
    });
  };

  const handleSetAllQtys = (mode: 'all' | 'zero') => {
    if (!refundingSale) return;
    const previouslyReturnedMap: Record<string, number> = {};
    const relatedReturns = returnsList.filter((r) => r.saleId === refundingSale.id);
    for (const ret of relatedReturns) {
      for (const it of ret.items) {
        previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
      }
    }

    const updated: Record<string, number> = {};
    for (const item of refundingSale.items) {
      const alreadyReturned = previouslyReturnedMap[item.productId] || 0;
      const maxAvailable = Math.max(0, item.quantity - alreadyReturned);
      updated[item.productId] = mode === 'all' ? maxAvailable : 0;
    }
    setReturnItemQtys(updated);
  };

  // Calculate total refund amount
  const calculateTotalRefund = () => {
    if (!refundingSale) return 0;
    let total = 0;
    for (const item of refundingSale.items) {
      const qty = returnItemQtys[item.productId] || 0;
      if (qty > 0) {
        const unitEffectivePrice = item.quantity > 0 ? item.totalSdg / item.quantity : item.unitPriceSdg;
        total += Math.round(unitEffectivePrice * qty);
      }
    }
    return total;
  };

  // Confirm Refund with Credit Note Issuance
  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingSale) return;
    setRefundError('');

    const returnItemsPayload = refundingSale.items
      .filter((i) => (returnItemQtys[i.productId] || 0) > 0)
      .map((i) => ({
        productId: i.productId,
        quantity: returnItemQtys[i.productId],
      }));

    if (returnItemsPayload.length === 0) {
      setRefundError('يرجى تحديد كمية صنف واحد على الأقل للإرجاع (أكبر من 0)');
      return;
    }

    setIsRefunding(true);

    try {
      const res = await api.refundSale(refundingSale.id, {
        reason: refundReason,
        returnItems: returnItemsPayload,
      });

      if (res.success) {
        setRefundingSale(null);
        await onRefresh();
        await loadReturns();

        // Show issued Credit Note immediately for printing
        if (res.returnRecord) {
          setViewingCreditNote(res.returnRecord);
        }
      } else {
        setRefundError('فشل تسجيل الإرجاع');
      }
    } catch (err: any) {
      setRefundError(err.message || 'فشل إتمام الإرجاع وإصدار الإشعار الدائن');
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">سجل المبيعات والإشعارات الدائنة</h2>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              مزامنة فورية مع المخزون
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            استعراض الفواتير، استرجاع الأصناف مع تعديل الكميات وإصدار إشعارات دائنة ضريبية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Return by Invoice button */}
          <button
            onClick={() => {
              setRetrieveQuery('');
              setLookupError('');
              setIsRetrieveModalOpen(true);
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إرجاع فاتورة (إشعار دائن)</span>
          </button>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'sales'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الفواتير والمبيعات ({sales.length})
            </button>
            <button
              onClick={() => setActiveTab('credit_notes')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'credit_notes'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الإشعارات الدائنة ({returnsList.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Branch Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">الفرع:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">كافة الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter (for sales) */}
          {activeTab === 'sales' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">طريقة الدفع:</span>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">كافة الطرق</option>
                <option value="cash">نقداً (Cash)</option>
                <option value="bankak">بنكك (Bankak)</option>
                <option value="fawry">فوري / بطاقة</option>
                <option value="split">دفع مجزأ</option>
              </select>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'sales'
                ? 'بحث برقم الفاتورة أو العميل أو المرجع...'
                : 'بحث برقم الإشعار الدائن أو الفاتورة...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* =========================================================================
          TAB 1: SALES & INVOICES TABLE
          ========================================================================= */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">الفرع والكاشير</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">الأصناف</th>
                  <th className="py-3 px-4">طريقة الدفع</th>
                  <th className="py-3 px-4">المبلغ الإجمالي</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      لا توجد فواتير مبيعات مطابقة لمعايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(sale.createdAt).toLocaleString('ar-SD')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{sale.branchName}</div>
                        <div className="text-[11px] text-slate-500">{sale.cashierName}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {sale.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {sale.items.length} أصناف
                      </td>
                      <td className="py-3 px-4">
                        {sale.paymentMethod === 'cash' && (
                          <span className="text-slate-700 flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                            <span>نقداً</span>
                          </span>
                        )}
                        {sale.paymentMethod === 'bankak' && (
                          <span className="text-red-700 font-medium flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-red-600" />
                            <span>بنكك</span>
                          </span>
                        )}
                        {sale.paymentMethod === 'fawry' && (
                          <span className="text-blue-700 font-medium flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                            <span>فوري / بطاقة</span>
                          </span>
                        )}
                        {sale.paymentMethod === 'split' && (
                          <span className="text-purple-700 font-medium flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>مجزأ</span>
                          </span>
                        )}
                        {sale.multiCurrency && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] bg-amber-50 text-amber-800 rounded border border-amber-200">
                            {sale.multiCurrency.currencyCode}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div>{sale.grandTotalSdg.toLocaleString()} ج.س</div>
                        {sale.refundedAmountSdg ? (
                          <div className="text-[10px] text-rose-600 font-medium">
                            مرتجع: {sale.refundedAmountSdg.toLocaleString()} ج.س
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        {sale.status === 'completed' && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1 w-max">
                            <CheckCircle className="w-3 h-3" />
                            <span>مكتملة ومقبوضة</span>
                          </span>
                        )}
                        {sale.status === 'partially_refunded' && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200 flex items-center gap-1 w-max">
                            <RotateCcw className="w-3 h-3" />
                            <span>مرتجع جزئي</span>
                          </span>
                        )}
                        {sale.status === 'refunded' && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 rounded-full border border-rose-200 flex items-center gap-1 w-max">
                            <RotateCcw className="w-3 h-3" />
                            <span>مسترجعة بالكامل</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingSale(sale)}
                            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
                            title="معاينة وطباعة الفاتورة"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة</span>
                          </button>

                          {sale.status !== 'refunded' && (
                            <button
                              onClick={() => openRefundModal(sale)}
                              className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold flex items-center gap-1 border border-rose-200"
                              title="إرجاع وتعديل كميات الأصناف وإصدار إشعار دائن"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>إرجاع</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CREDIT NOTES & RETURNS TABLE
          ========================================================================= */}
      {activeTab === 'credit_notes' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم الإشعار الدائن</th>
                  <th className="py-3 px-4">رقم الفاتورة الأصلية</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">الكاشير</th>
                  <th className="py-3 px-4">الأصناف المسترجعة</th>
                  <th className="py-3 px-4">مبلغ الإشعار الدائن</th>
                  <th className="py-3 px-4">سبب الإرجاع</th>
                  <th className="py-3 px-4 text-center">معاينة الإشعار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      لا توجد إشعارات دائنة أو مرتجعات مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">
                        {ret.creditNoteNumber || `CN-${ret.id.slice(-6)}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {ret.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(ret.createdAt).toLocaleString('ar-SD')}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {ret.cashierName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-700">
                              • {it.productName} ({it.quantity} قطعة)
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">
                        {ret.totalRefundSdg.toLocaleString()} ج.س
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={ret.reason}>
                        {ret.reason}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setViewingCreditNote(ret)}
                          className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold flex items-center gap-1 border border-rose-200 mx-auto"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>عرض وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          RETRIEVE BY INVOICE NUMBER MODAL
          ========================================================================= */}
      {isRetrieveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">استرجاع الفاتورة عبر رقمها</h3>
                  <p className="text-[11px] text-slate-400">أدخل رقم الفاتورة للبدء في إجراء الإرجاع وتعديل الكميات</p>
                </div>
              </div>
              <button
                onClick={() => setIsRetrieveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRetrieveInvoice} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  رقم الفاتورة (أو الباركود):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: INV-1001 أو الأرقام فقط"
                    value={retrieveQuery}
                    onChange={(e) => {
                      setRetrieveQuery(e.target.value);
                      setLookupError('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {lookupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {/* Quick suggestions from recent sales */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-2">فواتير حديثة مقترحة:</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {sales.slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setRetrieveQuery(s.invoiceNumber);
                        setLookupError('');
                      }}
                      className="w-full p-2 bg-slate-50 hover:bg-rose-50 rounded-lg border border-slate-200 text-right flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-mono font-bold text-slate-800">{s.invoiceNumber}</span>
                      <span className="text-slate-500">{s.customerName} · {s.grandTotalSdg.toLocaleString()} ج.س</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRetrieveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث واسترجاع الفاتورة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ITEMIZED RETURN & CREDIT NOTE MODAL
          ========================================================================= */}
      {refundingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRefund}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-rose-700 to-rose-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">إرجاع فاتورة وإصدار إشعار دائن</h3>
                    <span className="px-2 py-0.5 text-[10px] bg-white/20 rounded-md font-mono">
                      {refundingSale.invoiceNumber}
                    </span>
                  </div>
                  <p className="text-xs text-white/80">
                    العميل: {refundingSale.customerName} · الفرع: {refundingSale.branchName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRefundingSale(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Info banner */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="block text-xs font-bold text-rose-950 mb-0.5">
                    مزامنة المخزون التلقائية وإصدار الإشعار الدائن:
                  </strong>
                  يمكنك تعديل كميات الأصناف المراد إرجاعها بدقة أدناه. سيتم إعادة الكميات المحددة فوراً إلى مخزون الفرع،
                  وإصدار إشعار دائن (Credit Note) رسمي معتمد، وتحديث رصيد الصندوق المالي.
                </div>
              </div>

              {/* Items Table with Quantity Controls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-xs">أصناف الفاتورة والكميات المسترجعة:</h4>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllQtys('all')}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors"
                    >
                      إرجاع كافة الأصناف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllQtys('zero')}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors"
                    >
                      تصفير التحديد
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">الصنف</th>
                        <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                        <th className="py-2.5 px-3 text-center">الكمية المرجعة</th>
                        <th className="py-2.5 px-3">سعر الوحدة</th>
                        <th className="py-2.5 px-3">قيمة الإرجاع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {refundingSale.items.map((item) => {
                        const returnQty = returnItemQtys[item.productId] || 0;
                        const unitEffective =
                          item.quantity > 0 ? item.totalSdg / item.quantity : item.unitPriceSdg;
                        const itemRefundTotal = Math.round(unitEffective * returnQty);

                        return (
                          <tr
                            key={item.productId}
                            className={`transition-colors ${
                              returnQty > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{item.productName}</div>
                              {item.notes && (
                                <div className="text-[10px] text-amber-700">ملاحظة: {item.notes}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(item.productId, item.quantity, -1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
                                  disabled={returnQty <= 0}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.quantity}
                                  value={returnQty}
                                  onChange={(e) => {
                                    const val = Math.min(
                                      Math.max(0, parseInt(e.target.value, 10) || 0),
                                      item.quantity
                                    );
                                    setReturnItemQtys((prev) => ({
                                      ...prev,
                                      [item.productId]: val,
                                    }));
                                  }}
                                  className="w-12 text-center font-mono font-bold text-xs focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(item.productId, item.quantity, 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
                                  disabled={returnQty >= item.quantity}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {Math.round(unitEffective).toLocaleString()} ج.س
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                              {itemRefundTotal.toLocaleString()} ج.س
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Refund Summary */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">إجمالي مبلغ الإشعار الدائن المسترد:</div>
                  <div className="text-xl font-bold font-mono text-rose-400">
                    {calculateTotalRefund().toLocaleString()} ج.س
                  </div>
                </div>
                <div className="text-left text-[11px] text-slate-400">
                  <div>الفاتورة الأصلية: {refundingSale.grandTotalSdg.toLocaleString()} ج.س</div>
                  <div className="text-emerald-400">سيتم مزامنة الأصناف المرجعة مع الجرد فوراً</div>
                </div>
              </div>

              {/* Reason & Preset tags */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  سبب الإرجاع وملاحظات الإشعار الدائن:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'طلب الزبون استرجاع الصنف',
                    'صنف غير مطابق للمواصفات',
                    'عيب مصنعي أو تلف بالعبوة',
                    'خطأ في إدخال الفاتورة بالكاشير',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setRefundReason(tag)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
                        refundReason === tag
                          ? 'bg-rose-100 border-rose-300 text-rose-800 font-semibold'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  required
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="اكتب سبب الاسترجاع..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {refundError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setRefundingSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isRefunding || calculateTotalRefund() <= 0}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
              >
                {isRefunding ? (
                  <span>جاري إصدار الإشعار وتحديث المخزون...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>تأكيد الإرجاع وإصدار الإشعار الدائن ({calculateTotalRefund().toLocaleString()} ج.س)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          PRINTABLE CREDIT NOTE MODAL
          ========================================================================= */}
      {viewingCreditNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-400" />
                <span>إشعار دائن ضريبي معتمد</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الإشعار</span>
                </button>
                <button
                  onClick={() => setViewingCreditNote(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Credit Note Receipt Voucher */}
            <div id="printable-credit-note" className="p-4 bg-white text-slate-900 text-xs space-y-2 select-text">
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <h2 className="text-sm font-bold tracking-tight">{receiptSettings.storeName}</h2>
                <p className="text-[11px] text-slate-600">{receiptSettings.storeSubtitle}</p>
                <div className="inline-block mt-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-bold rounded">
                  إشعار دائن ضريبي / مرتجع مبيعات
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  الرقم الضريبي: {receiptSettings.taxNumber}
                </p>
              </div>

              <div className="text-[10px] text-slate-600 space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>رقم الإشعار الدائن:</span>
                  <span className="font-mono font-bold text-rose-700">
                    {viewingCreditNote.creditNoteNumber || `CN-${viewingCreditNote.id.slice(-6)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مرجع الفاتورة الأصلية:</span>
                  <span className="font-mono font-bold text-slate-900">{viewingCreditNote.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span className="font-mono">{new Date(viewingCreditNote.createdAt).toLocaleString('ar-SD')}</span>
                </div>
                <div className="flex justify-between">
                  <span>الكاشير المسؤول:</span>
                  <span>{viewingCreditNote.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>سبب الإرجاع:</span>
                  <span className="font-semibold text-slate-800">{viewingCreditNote.reason}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-slate-300 pb-2">
                <table className="w-full text-right text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-[10px] text-slate-500">
                      <th className="py-1">الصنف المسترجع</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">المبلغ المسترد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingCreditNote.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1 font-semibold">{it.productName}</td>
                        <td className="py-1 text-center font-mono">{it.quantity}</td>
                        <td className="py-1 text-left font-mono font-bold text-rose-700">
                          {it.refundAmountSdg.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Refund Amount */}
              <div className="space-y-1 text-[11px] font-mono border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-xs font-bold text-rose-700">
                  <span>إجمالي المبلغ المسترد:</span>
                  <span>{viewingCreditNote.totalRefundSdg.toLocaleString()} ج.س</span>
                </div>
              </div>

              {/* Stock restored confirmation badge */}
              <div className="p-2 bg-slate-50 rounded text-center text-[10px] text-slate-600 border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline ml-1" />
                <span>تمت مزامنة وإعادة الكميات المسترجعة لمخزون الفرع آلياً</span>
              </div>

              {/* QR Code */}
              <div className="text-center pt-1 flex flex-col items-center">
                <div
                  className="w-24 h-24 bg-white p-1 border border-slate-200 rounded"
                  dangerouslySetInnerHTML={{
                    __html: generateQrSvg(
                      generateZatcaTlvBase64({
                        sellerName: receiptSettings.storeName,
                        taxNumber: receiptSettings.taxNumber,
                        timestamp: viewingCreditNote.createdAt,
                        totalWithVat: viewingCreditNote.totalRefundSdg.toString(),
                        vatTotal: '0',
                      }),
                      88
                    ),
                  }}
                />
                <span className="text-[9px] text-slate-400 mt-1 font-mono">
                  إشعار دائن ضريبي إلكتروني معتمد
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setViewingCreditNote(null)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW & REPRINT INVOICE MODAL
          ========================================================================= */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">معاينة الفاتورة</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الفاتورة</span>
                </button>
                <button onClick={() => setViewingSale(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Receipt container */}
            <div id="printable-receipt" className="p-4 bg-white text-slate-900 text-xs space-y-2 select-text">
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <h2 className="text-sm font-bold tracking-tight">{receiptSettings.storeName}</h2>
                <p className="text-[11px] text-slate-600">{viewingSale.branchName}</p>
                <p className="text-[10px] text-slate-500">الرقم الضريبي: {receiptSettings.taxNumber}</p>
              </div>

              <div className="text-[10px] text-slate-600 space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-900">{viewingSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span className="font-mono">{new Date(viewingSale.createdAt).toLocaleString('ar-SD')}</span>
                </div>
                <div className="flex justify-between">
                  <span>الكاشير:</span>
                  <span>{viewingSale.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{viewingSale.customerName}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 pb-2">
                <table className="w-full text-right text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-[10px] text-slate-500">
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingSale.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1 font-semibold">
                          <div>{it.productName}</div>
                          {it.notes && (
                            <div className="text-[9px] text-amber-700">ملاحظة: {it.notes}</div>
                          )}
                        </td>
                        <td className="py-1 text-center font-mono">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-1 text-left font-mono">{it.totalSdg.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-[11px] font-mono border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{viewingSale.subtotalSdg.toLocaleString()} ج.س</span>
                </div>
                {viewingSale.discountTotalSdg > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم:</span>
                    <span>-{viewingSale.discountTotalSdg.toLocaleString()} ج.س</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-900">
                  <span>الإجمالي النهائي:</span>
                  <span>{viewingSale.grandTotalSdg.toLocaleString()} ج.س</span>
                </div>

                {viewingSale.multiCurrency && (
                  <div className="pt-1 mt-1 border-t border-slate-200 text-slate-700 text-[10px]">
                    <div className="flex justify-between font-semibold">
                      <span>العملة الأجنبية:</span>
                      <span>
                        {viewingSale.multiCurrency.currencyCode} (سعر الصرف:{' '}
                        {viewingSale.multiCurrency.exchangeRate.toLocaleString()} ج.س)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>الإجمالي بالعملة:</span>
                      <span className="font-bold">
                        {viewingSale.multiCurrency.totalForeign.toFixed(2)}{' '}
                        {viewingSale.multiCurrency.currencySymbol}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {viewingSale.refundedAmountSdg ? (
                <div className="p-2 bg-rose-50 text-rose-800 rounded text-center text-[10px] font-bold border border-rose-200">
                  تم إرجاع أصناف من هذه الفاتورة بقيمة {viewingSale.refundedAmountSdg.toLocaleString()} ج.س
                </div>
              ) : null}

              {/* QR Code */}
              <div className="text-center pt-2 flex flex-col items-center">
                <div
                  className="w-24 h-24 bg-white p-1 border border-slate-200 rounded"
                  dangerouslySetInnerHTML={{
                    __html: generateQrSvg(
                      generateZatcaTlvBase64({
                        sellerName: receiptSettings.storeName,
                        taxNumber: receiptSettings.taxNumber,
                        timestamp: viewingSale.createdAt,
                        totalWithVat: viewingSale.grandTotalSdg.toString(),
                        vatTotal: '0',
                      }),
                      96
                    ),
                  }}
                />
                <span className="text-[9px] text-slate-400 mt-1 font-mono">رمز الفاتورة الإلكترونية</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setViewingSale(null)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
