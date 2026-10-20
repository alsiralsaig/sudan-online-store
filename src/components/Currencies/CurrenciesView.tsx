import React, { useState, useEffect } from 'react';
import {
  Coins,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  History,
  TrendingUp,
  X,
  Edit2,
} from 'lucide-react';
import type { CurrencyConfig, CurrencyRateHistory } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface CurrenciesViewProps {
  currencies: CurrencyConfig[];
  onRefresh: () => void;
}

export const CurrenciesView: React.FC<CurrenciesViewProps> = ({ currencies, onRefresh }) => {
  const [history, setHistory] = useState<CurrencyRateHistory[]>([]);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyConfig | null>(null);
  const [newRate, setNewRate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Currency Converter calculator
  const [calcAmount, setCalcAmount] = useState<string>('100');
  const [fromCode, setFromCode] = useState<string>('USD');

  const loadHistory = async () => {
    try {
      const res = await api.getCurrencyHistory();
      setHistory(res.history);
    } catch (err) {
      console.warn('Failed loading currency history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurrency) return;
    setIsSubmitting(true);

    try {
      const res = await api.updateCurrencyRate(editingCurrency.code, Number(newRate));
      if (res.success) {
        setEditingCurrency(null);
        onRefresh();
        loadHistory();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث سعر الصرف');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert calculation
  const fromCurrency = currencies.find((c) => c.code === fromCode);
  const calculatedSdg = (Number(calcAmount) || 0) * (fromCurrency?.rateToSdg || 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة العملات وأسعار الصرف (6 عملات)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            الجنيه السوداني (SDG) هو العملة الأساسية لكافة فواتير الزبائن؛ تُستخدم العملات الأخرى لاحتساب تكلفة الاستيراد والمشتريات
          </p>
        </div>
      </div>

      {/* Grid: Currencies cards & Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Currencies Cards (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currencies.map((curr) => (
              <div
                key={curr.code}
                className={`bg-white p-4 rounded-xl border transition-all ${
                  curr.isBase
                    ? 'border-emerald-500 bg-emerald-50/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-slate-900">{curr.code}</span>
                    <span className="text-xs text-slate-500 font-semibold">({curr.symbol})</span>
                  </div>
                  {curr.isBase ? (
                    <span className="text-[11px] text-emerald-700 font-bold">العملة الأساسية</span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingCurrency(curr);
                        setNewRate(curr.rateToSdg.toString());
                      }}
                      className="text-slate-400 hover:text-slate-900 p-1"
                      title="تعديل سعر الصرف"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-600 block">{curr.name}</span>
                  <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                    {curr.isBase ? (
                      '1.00 ج.س'
                    ) : (
                      <>
                        {curr.rateToSdg.toLocaleString()} <span className="text-xs font-sans text-slate-500">ج.س</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    آخر تحديث: {new Date(curr.lastUpdated).toLocaleDateString('ar-SD')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Rate History */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">سجل التغييرات التاريخية لأسعار الصرف</span>
              <span className="text-[11px] text-slate-500 font-mono">{history.length} سجلات تاريخية</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">التاريخ والوقت</th>
                    <th className="py-2.5 px-4">رمز العملة</th>
                    <th className="py-2.5 px-4">السعر السابق</th>
                    <th className="py-2.5 px-4">السعر الجديد</th>
                    <th className="py-2.5 px-4">المسؤول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {new Date(h.timestamp).toLocaleString('ar-SD')}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{h.currencyCode}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{h.oldRate.toLocaleString()} ج.س</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">
                        {h.newRate.toLocaleString()} ج.س
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{h.updatedBy}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        لم يتم تسجيل أي تعديلات يدوية على أسعار الصرف بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Converter Calculator */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900">حاسبة تحويل العملات الفورية</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">المبلغ بالعملة الأجنبية:</label>
              <input
                type="number"
                min="1"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-semibold">اختر العملة:</label>
              <select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                {currencies
                  .filter((c) => !c.isBase)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code}) - سعر الصرف: {c.rateToSdg.toLocaleString()} ج.س
                    </option>
                  ))}
              </select>
            </div>

            {/* Calculated Result */}
            <div className="p-4 rounded-xl bg-slate-900 text-white mt-4 space-y-1">
              <span className="text-[11px] text-slate-400 block">المعادل بالجنيه السوداني (SDG):</span>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                {calculatedSdg.toLocaleString()} ج.س
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                1 {fromCode} = {fromCurrency?.rateToSdg.toLocaleString()} ج.س
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Currency Modal */}
      {editingCurrency && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateRate}
            className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">تعديل سعر صرف {editingCurrency.name}</h3>
              <button
                type="button"
                onClick={() => setEditingCurrency(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  سعر الصرف الجديد (كم جنيه سوداني يعادل 1 {editingCurrency.code}):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full pr-3 pl-12 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                onClick={() => setEditingCurrency(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ السعر الجديد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
