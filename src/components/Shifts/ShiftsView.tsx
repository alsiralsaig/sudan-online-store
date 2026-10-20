import React, { useState } from 'react';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  PlusCircle,
  Lock,
  UserCheck,
  Calendar,
  DollarSign,
  FileText,
  X,
} from 'lucide-react';
import type { CashierShift, Branch } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface ShiftsViewProps {
  shifts: CashierShift[];
  currentBranch: Branch | null;
  activeShift: CashierShift | null;
  onRefresh: () => void;
  actor: { name: string; role: string };
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
  shifts,
  currentBranch,
  activeShift,
  onRefresh,
  actor,
}) => {
  // Open Shift State
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState<string>('50000');

  // Close Shift State
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState('');

  // Review Modal State
  const [reviewingShift, setReviewingShift] = useState<CashierShift | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.openShift({
        branchId: currentBranch.id,
        openingCashSdg: Number(openingCash) || 0,
      });
      if (res.success) {
        setIsOpenShiftModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل فتح الوردية');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Close Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.closeShift({
        shiftId: activeShift.id,
        actualCashSdg: Number(actualCash) || 0,
        closeNotes,
      });
      if (res.success) {
        setIsCloseShiftModalOpen(false);
        setActualCash('');
        setCloseNotes('');
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إغلاق الوردية');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Supervisor Review
  const handleReviewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingShift) return;
    setIsSubmitting(true);

    try {
      const res = await api.reviewShift(reviewingShift.id, { reviewNotes });
      if (res.success) {
        setReviewingShift(null);
        setReviewNotes('');
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل اعتماد الوردية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة الورديات ومطابقة الخزينة</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة حركة النقدية، تدقيق العجز والفائض، ومطابقة الصندوق في نهاية كل وردية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!activeShift ? (
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>افتتاح وردية جديدة</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setActualCash(activeShift.expectedCashSdg.toString());
                setIsCloseShiftModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>إغلاق الوردية الحالية وجرد الخزينة</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Card if exists */}
      {activeShift && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-slate-900">الوردية الحالية المفتوحة</span>
              <span className="text-xs text-slate-500 font-mono">
                بدأت: {new Date(activeShift.openedAt).toLocaleTimeString('ar-SD')}
              </span>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              الكاشير: <span className="font-semibold text-slate-900">{activeShift.cashierName}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block">رصيد البداية (العهدة):</span>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {activeShift.openingCashSdg.toLocaleString()} ج.س
              </span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
              <span className="text-xs text-emerald-700 block">مبيعات الكاش النقدية:</span>
              <span className="text-base font-bold text-emerald-800 font-mono tabular-nums">
                {activeShift.totalCashSalesSdg.toLocaleString()} ج.س
              </span>
            </div>

            <div className="p-3 rounded-lg bg-red-50/50 border border-red-100">
              <span className="text-xs text-red-700 block">مبيعات بنكك (Bankak):</span>
              <span className="text-base font-bold text-red-800 font-mono tabular-nums">
                {activeShift.totalBankakSalesSdg.toLocaleString()} ج.س
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-white">
              <span className="text-xs text-slate-300 block">النقد المتوقع بالدرج الآن:</span>
              <span className="text-base font-bold text-white font-mono tabular-nums">
                {activeShift.expectedCashSdg.toLocaleString()} ج.س
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">سجل الورديات ومحاضر التسليم</span>
          <span className="text-xs text-slate-500 font-mono">{shifts.length} وردية مسجلة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">رقم الوردية</th>
                <th className="py-3 px-4">الكاشير / الفرع</th>
                <th className="py-3 px-4">وقت الافتتاح</th>
                <th className="py-3 px-4">وقت الإغلاق</th>
                <th className="py-3 px-4">المبيعات الإجمالية</th>
                <th className="py-3 px-4">المتوقع نقداً</th>
                <th className="py-3 px-4">الفعلي بالخزينة</th>
                <th className="py-3 px-4">الفارق (عجز / فائض)</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    {s.id.slice(-8)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{s.cashierName}</div>
                    <div className="text-[11px] text-slate-500">{s.branchName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {new Date(s.openedAt).toLocaleString('ar-SD')}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {s.closedAt ? new Date(s.closedAt).toLocaleString('ar-SD') : 'لا تزال مفتوحة'}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {s.totalSalesSdg.toLocaleString()} ج.س
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {s.expectedCashSdg.toLocaleString()} ج.س
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {s.actualCashSdg !== undefined ? `${s.actualCashSdg.toLocaleString()} ج.س` : '-'}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {s.differenceSdg !== undefined ? (
                      s.differenceSdg === 0 ? (
                        <span className="text-emerald-700 font-semibold">مطابق تماماً</span>
                      ) : s.differenceSdg < 0 ? (
                        <span className="text-rose-700 font-bold">
                          عجز: {Math.abs(s.differenceSdg).toLocaleString()} ج.س
                        </span>
                      ) : (
                        <span className="text-blue-700 font-bold">
                          فائض: +{s.differenceSdg.toLocaleString()} ج.س
                        </span>
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {s.status === 'open' && (
                      <span className="text-emerald-700 font-medium">مفتوحة حالياً</span>
                    )}
                    {s.status === 'closed' && (
                      <span className="text-amber-700 font-medium">بانتظار تدقيق المشرف</span>
                    )}
                    {s.status === 'reviewed' && (
                      <span className="text-slate-600 flex items-center gap-1 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>معتمدة</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {s.status === 'closed' && (
                      <button
                        onClick={() => {
                          setReviewingShift(s);
                          setReviewNotes(s.closeNotes || 'مطابقة سليمة');
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 font-medium whitespace-nowrap"
                      >
                        تدقيق المشرف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          OPEN SHIFT MODAL
          ========================================================================= */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenShift}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">افتتاح وردية كاشير جديدة</h3>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
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

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الفرع الحالي:</label>
                <input
                  type="text"
                  disabled
                  value={currentBranch?.name || 'الفرع الرئيسي'}
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رصيد البداية في درج الكاشير (العهدة الافتتاحية):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-full pr-3 pl-12 py-2 text-sm font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="مثال: 50000"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                    ج.س
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {isSubmitting ? 'جاري الفتح...' : 'تأكيد افتتاح الوردية'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          CLOSE SHIFT MODAL
          ========================================================================= */}
      {isCloseShiftModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseShift}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">إغلاق الوردية وجرد النقدية</h3>
                <p className="text-[11px] text-slate-400">مطابقة المبيعات النقدية مع محتويات الصندوق</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
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

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">العهدة الافتتاحية:</span>
                  <span className="font-mono font-bold">{activeShift.openingCashSdg.toLocaleString()} ج.س</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">المبيعات النقدية (الكاش):</span>
                  <span className="font-mono font-bold text-emerald-700">
                    +{activeShift.totalCashSalesSdg.toLocaleString()} ج.س
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                  <span>المبلغ النقدي المحسوب بالدرج:</span>
                  <span className="font-mono text-sm">{activeShift.expectedCashSdg.toLocaleString()} ج.س</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المبلغ النقدي الفعلي المعدود بالدرج:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full pr-3 pl-12 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="أدخل المبلغ بعد العد"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                    ج.س
                  </span>
                </div>
              </div>

              {actualCash && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                    Number(actualCash) === activeShift.expectedCashSdg
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : Number(actualCash) < activeShift.expectedCashSdg
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <span>الفارق الناتج:</span>
                  <span className="font-mono font-bold text-sm">
                    {Number(actualCash) === activeShift.expectedCashSdg
                      ? 'مطابق تماماً'
                      : Number(actualCash) < activeShift.expectedCashSdg
                      ? `عجز: ${(Number(actualCash) - activeShift.expectedCashSdg).toLocaleString()} ج.س`
                      : `فائض: +${(Number(actualCash) - activeShift.expectedCashSdg).toLocaleString()} ج.س`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ملاحظات أو مبررات عند الإغلاق:
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="في حال وجود أي فارق أو فكة أو ملحوظة للكاشير..."
                  rows={2}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {isSubmitting ? 'جاري الإغلاق...' : 'تأكيد إغلاق الوردية'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          SUPERVISOR REVIEW MODAL
          ========================================================================= */}
      {reviewingShift && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReviewShift}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">تدقيق واعتماد الوردية (المشرف)</h3>
              <button
                type="button"
                onClick={() => setReviewingShift(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">الكاشير المسؤول:</span>
                  <span className="font-semibold">{reviewingShift.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">النقد المتوقع:</span>
                  <span className="font-mono">{reviewingShift.expectedCashSdg.toLocaleString()} ج.س</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الفعلي المستلم:</span>
                  <span className="font-mono font-bold">{reviewingShift.actualCashSdg?.toLocaleString()} ج.س</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>الفارق المسجل:</span>
                  <span className="font-mono">
                    {reviewingShift.differenceSdg !== undefined ? `${reviewingShift.differenceSdg.toLocaleString()} ج.س` : '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  قرار وملاحظات المشرف المعتمد:
                </label>
                <textarea
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="اكتب نتيجة المراجعة (مثال: تم التأكد من الفارق وتسويته كفكة ترحيل...)"
                  rows={3}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewingShift(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                اعتماد الوردية رسمياً
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
