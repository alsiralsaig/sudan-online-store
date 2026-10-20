import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Layers,
  Users,
  Building,
  Upload,
  Calendar,
  X,
  FileCheck,
} from 'lucide-react';
import type { SubscriptionPlan, SubscriptionPayment, Tenant } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface SubscriptionViewProps {
  tenant: Tenant | null;
  onRefresh: () => void;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ tenant, onRefresh }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);

  // Upgrade / Renew Modal
  const [selectedPlanToPay, setSelectedPlanToPay] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bankak' | 'syberpay'>('bankak');
  const [bankakRef, setBankakRef] = useState('');
  const [slipUrl, setSlipUrl] = useState('/assets/images/sanad_pos_hero_1792173270140.jpg');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const plansRes = await api.getSubscriptionPlans();
      setPlans(plansRes.plans);

      const curRes = await api.getCurrentSubscription();
      setCurrentPlan(curRes.currentPlan);
      setPayments(curRes.payments);
    } catch (err) {
      console.warn('Failed loading subscriptions:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanToPay) return;
    setIsSubmitting(true);

    try {
      const res = await api.submitSubscriptionPayment({
        planId: selectedPlanToPay.id,
        amountSdg: selectedPlanToPay.monthlyPriceSdg,
        paymentMethod,
        paymentRef: bankakRef,
        bankTransferSlipUrl: slipUrl,
      });

      if (res.success) {
        setSelectedPlanToPay(null);
        setBankakRef('');
        setSuccessMsg(
          'تم إرسال إشعار السداد بنجاح! سيتم التحقق من الإيداع البنكي من قبل الإدارة المركزية وتجديد باقتك فوراً.'
        );
        loadData();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إرسال إشعار السداد');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expiration calculation
  const expiresAt = tenant ? new Date(tenant.subscriptionExpiresAt) : new Date();
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة الاشتراكات الشهرية والباقات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في خطة الاشتراك، حدود الفروع والموظفين، وتوثيق سداد الرسوم عبر بنكك
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-500 hover:text-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current Subscription Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">الباقة النشطة الحالية:</span>
            <span className="text-base font-bold text-emerald-800">{currentPlan?.name}</span>
          </div>
          <p className="text-xs text-slate-600">{currentPlan?.description}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-mono">
            <span>تاريخ انتهاء الصلاحية: {expiresAt.toLocaleDateString('ar-SD')}</span>
            <span className="text-emerald-700 font-bold font-sans">
              (متبقي {daysRemaining} يوم)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-xs text-slate-500 block">حد الفروع</span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              {currentPlan?.maxBranches} فروع
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs text-slate-500 block">حد الموظفين</span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              {currentPlan?.maxEmployees} موظف
            </span>
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">باقات الاشتراك الشهرية المتاحة:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === tenant?.subscriptionPlanId;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                  plan.isPopular
                    ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                    : 'border-slate-200 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-base text-slate-900">{plan.name}</h4>
                    {plan.isPopular && (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        الأكثر طلباً
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>

                  <div className="mb-4">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {plan.monthlyPriceSdg.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 mr-1">ج.س / شهرياً</span>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {isCurrent ? (
                    <button
                      onClick={() => setSelectedPlanToPay(plan)}
                      className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                    >
                      تجديد الباقة الحالية (تمديد 30 يوماً)
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedPlanToPay(plan)}
                      className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                      ترقية / تغيير إلى هذه الباقة
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Payments History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">سجل عمليات وسندات سداد الاشتراك</span>
          <span className="text-xs text-slate-500 font-mono">{payments.length} عمليات مسجلة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">تاريخ الإرسال</th>
                <th className="py-3 px-4">الباقة المطلوبة</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">طريقة السداد</th>
                <th className="py-3 px-4">رقم إشعار التحويل</th>
                <th className="py-3 px-4">حالة التدقيق والاعتماد</th>
                <th className="py-3 px-4">ملاحظات الإدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((p) => {
                const planObj = plans.find((pl) => pl.id === p.planId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(p.submittedAt).toLocaleDateString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{planObj?.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.amountSdg.toLocaleString()} ج.س
                    </td>
                    <td className="py-3 px-4">
                      {p.paymentMethod === 'bankak' ? 'تحويل بنكك (Bankak)' : p.paymentMethod}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{p.paymentRef}</td>
                    <td className="py-3 px-4 font-semibold">
                      {p.status === 'approved' && (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>معتمد ومُفعل</span>
                        </span>
                      )}
                      {p.status === 'pending_review' && (
                        <span className="text-amber-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>قيد مراجعة الإدارة</span>
                        </span>
                      )}
                      {p.status === 'rejected' && (
                        <span className="text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>مرفوض</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.reviewNote || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SUBMIT PAYMENT MODAL
          ========================================================================= */}
      {selectedPlanToPay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPayment}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">سداد اشتراك {selectedPlanToPay.name}</h3>
                <p className="text-[11px] text-slate-400">
                  المبلغ المطلوب: {selectedPlanToPay.monthlyPriceSdg.toLocaleString()} ج.س
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanToPay(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Bankak Instruction Box */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-2">
                <span className="font-bold text-red-900 block">
                  بيانات حساب سداد الاشتراك المعتمد لمنصة سند (بنكك):
                </span>
                <div className="space-y-1 font-mono text-red-800 text-xs">
                  <div>
                    رقم الحساب: <strong>9918234</strong> (بنك الخرطوم)
                  </div>
                  <div>الاسم: شركة سند لتقنية المعاملات المالية المحدودة</div>
                  <div>هاتف التحويل: 0912000099</div>
                </div>
                <p className="text-[10px] text-slate-600 pt-1 border-t border-red-100">
                  يرجى إجراء التحويل من تطبيق بنكك وإدخال الرقم المرجعي لإشعار التحويل أدناه لتأكيد تجديد باقتك.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  رقم العملية / مرجع إشعار بنكك (Transaction Reference):
                </label>
                <input
                  type="text"
                  required
                  value={bankakRef}
                  onChange={(e) => setBankakRef(e.target.value)}
                  placeholder="مثال: BNK-TXN-9021884"
                  className="w-full px-3 py-2 font-mono font-bold text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  صورة إشعار التحويل / الإيصال:
                </label>
                <input
                  type="text"
                  value={slipUrl}
                  onChange={(e) => setSlipUrl(e.target.value)}
                  placeholder="رابط صورة الإشعار"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanToPay(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {isSubmitting ? 'جاري الإرسال...' : 'تأكيد وإرسال الإشعار'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
