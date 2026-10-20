import React, { useState } from 'react';
import {
  Gift,
  Award,
  Sparkles,
  CheckCircle,
  Copy,
  Clock,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Truck,
  ShieldCheck,
  Star,
  Zap,
  ShoppingBag,
  Coins,
  ChevronRight,
} from 'lucide-react';
import type { LoyaltyAccount, LoyaltyVoucher } from '../types.ts';

interface ClientLoyaltyDashboardProps {
  loyaltyAccount: LoyaltyAccount;
  onRedeemVoucher: (voucher: LoyaltyVoucher) => void;
  onApplyVoucherToCart: (voucher: LoyaltyVoucher) => void;
  activeAppliedVoucherId?: string | null;
  onExploreProducts: () => void;
  currency?: string;
}

export const ClientLoyaltyDashboard: React.FC<ClientLoyaltyDashboardProps> = ({
  loyaltyAccount,
  onRedeemVoucher,
  onApplyVoucherToCart,
  activeAppliedVoucherId,
  onExploreProducts,
  currency = 'SDG',
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [redeemSuccessMessage, setRedeemSuccessMessage] = useState<string | null>(null);

  // Available vouchers to redeem with points
  const availableVouchers: Omit<LoyaltyVoucher, 'id' | 'isRedeemed' | 'expiresAt'>[] = [
    {
      code: 'SANAD-LOYALTY-3K',
      title: 'قسيمة خصم 3,000 جنيه',
      description: 'خصم مباشر 3,000 SDG على أي طلب تتجاوز قيمته 20,000 SDG',
      pointsCost: 300,
      discountType: 'fixed_amount',
      discountValue: 3000,
      minOrderValueSdg: 20000,
    },
    {
      code: 'SANAD-LOYALTY-6K',
      title: 'قسيمة خصم 6,000 جنيه',
      description: 'خصم مباشر 6,000 SDG على طلبات الجملة والتجزئة فوق 40,000 SDG',
      pointsCost: 600,
      discountType: 'fixed_amount',
      discountValue: 6000,
      minOrderValueSdg: 40000,
    },
    {
      code: 'SANAD-FREE-SHIP',
      title: 'قسيمة توصيل مجاني',
      description: 'توصيل مجاني بالكامل لباب المنزل أو المتجر لأي طلب داخل الولاية',
      pointsCost: 250,
      discountType: 'free_shipping',
      discountValue: 2500,
      minOrderValueSdg: 10000,
    },
    {
      code: 'SANAD-LOYALTY-12K',
      title: 'قسيمة كبار العملاء 12,000 جنيه',
      description: 'خصم استثنائي 12,000 SDG على المشتريات والطلبات المسبقة الكبيرة',
      pointsCost: 1100,
      discountType: 'fixed_amount',
      discountValue: 12000,
      minOrderValueSdg: 80000,
    },
    {
      code: 'SANAD-PREORDER-VIP',
      title: 'قسيمة حجز مسبق VIP بدون عربون',
      description: 'حجز فوري للسلع الشحيحة مع تأجيل الدفع حتى موعد الاستلام الفعلي',
      pointsCost: 450,
      discountType: 'fixed_amount',
      discountValue: 4000,
      minOrderValueSdg: 25000,
    },
  ];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRedeem = (template: typeof availableVouchers[0]) => {
    if (loyaltyAccount.currentPoints < template.pointsCost) return;

    const newVoucher: LoyaltyVoucher = {
      id: `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      code: `${template.code}-${Math.floor(100 + Math.random() * 900)}`,
      title: template.title,
      description: template.description,
      pointsCost: template.pointsCost,
      discountType: template.discountType,
      discountValue: template.discountValue,
      minOrderValueSdg: template.minOrderValueSdg,
      isRedeemed: true,
      redeemedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    onRedeemVoucher(newVoucher);
    setRedeemSuccessMessage(`تهانينا! تم استبدال ${template.pointsCost} نقطة بنجاح وتفعيل ${template.title}.`);
    setTimeout(() => setRedeemSuccessMessage(null), 4000);
  };

  // Tier info
  const getTierDetails = (tier: LoyaltyAccount['tier']) => {
    switch (tier) {
      case 'diamond':
        return {
          name: 'الفئة الماسية (Diamond VIP)',
          badgeColor: 'bg-indigo-600 text-white',
          nextTier: 'أعلى فئة تم تحقيقها!',
          pointsNeeded: 0,
          progressPercent: 100,
          perk: 'خصم 10% تلقائي + شحن مجاني دائم + نقاط مضاعفة 2x',
        };
      case 'gold':
        return {
          name: 'الفئة الذهبية (Gold VIP)',
          badgeColor: 'bg-amber-500 text-slate-950',
          nextTier: 'الفئة الماسية',
          pointsNeeded: 5000 - loyaltyAccount.currentPoints,
          progressPercent: Math.min(100, (loyaltyAccount.currentPoints / 5000) * 100),
          perk: 'خصم 7% إضافي + أولوية قصوى بالطلبات المسبقة',
        };
      case 'silver':
        return {
          name: 'الفئة الفضية (Silver)',
          badgeColor: 'bg-slate-700 text-white',
          nextTier: 'الفئة الذهبية (2,500 نقطة)',
          pointsNeeded: Math.max(0, 2500 - loyaltyAccount.currentPoints),
          progressPercent: Math.min(100, (loyaltyAccount.currentPoints / 2500) * 100),
          perk: 'خصم 5% على كافة السلع + استبدال فوري للنقاط',
        };
      default:
        return {
          name: 'الفئة البرونزية (Bronze)',
          badgeColor: 'bg-amber-800 text-white',
          nextTier: 'الفئة الفضية (1,000 نقطة)',
          pointsNeeded: Math.max(0, 1000 - loyaltyAccount.currentPoints),
          progressPercent: Math.min(100, (loyaltyAccount.currentPoints / 1000) * 100),
          perk: 'تجميع 10 نقاط لكل 1,000 SDG مشتريات',
        };
    }
  };

  const tierDetails = getTierDetails(loyaltyAccount.tier);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Customer Points Card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-6 sm:p-8 border border-emerald-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${tierDetails.badgeColor} shadow-sm`}>
                ⭐ {tierDetails.name}
              </span>
              <span className="text-xs text-slate-400">عضو مميز منذ 2026</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                مرحباً، {loyaltyAccount.customerName}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                رقم الحساب: <span className="font-mono text-emerald-400">{loyaltyAccount.customerPhone}</span> · رصيدك الحالي من نقاط مكافآت سند
              </p>
            </div>

            {/* Tier progress bar */}
            <div className="max-w-md space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>التقدم نحو: <strong>{tierDetails.nextTier}</strong></span>
                <span className="font-mono font-bold text-amber-400">
                  {tierDetails.pointsNeeded > 0 ? `متبقي ${tierDetails.pointsNeeded} نقطة` : 'مكتمل'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${tierDetails.progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block">{tierDetails.perk}</span>
            </div>
          </div>

          {/* Points Counter Box */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/15 text-center shrink-0 min-w-[240px] space-y-3 shadow-lg">
            <div className="text-xs text-slate-300 font-medium">رصيد النقاط المتاح</div>
            <div className="text-4xl sm:text-5xl font-black text-amber-400 font-mono tracking-tight flex items-center justify-center gap-1">
              <span>{loyaltyAccount.currentPoints.toLocaleString()}</span>
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div className="text-[11px] text-emerald-300 font-mono border-t border-white/10 pt-2">
              إجمالي النقاط المكتسبة: {loyaltyAccount.lifetimePoints.toLocaleString()} نقطة
            </div>
            <button
              onClick={onExploreProducts}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              تسوق واكسب المزيد من النقاط
            </button>
          </div>
        </div>
      </div>

      {/* Success alert on voucher redemption */}
      {redeemSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{redeemSuccessMessage}</span>
        </div>
      )}

      {/* Active Redeemed Vouchers Section */}
      {loyaltyAccount.activeVouchers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-600" />
              <span>قسائمي النشطة الجاهزة للاستخدام ({loyaltyAccount.activeVouchers.length})</span>
            </h3>
            <span className="text-xs text-slate-500">صالحة لمدة 30 يوماً من الاستبدال</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loyaltyAccount.activeVouchers.map((voucher) => {
              const isApplied = activeAppliedVoucherId === voucher.id;

              return (
                <div
                  key={voucher.id}
                  className={`relative rounded-2xl p-4 border transition-all overflow-hidden ${
                    isApplied
                      ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-black text-sm text-slate-900">{voucher.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      نشطة
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    {voucher.description}
                  </p>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between mb-3">
                    <span className="font-mono font-black text-xs text-slate-900">{voucher.code}</span>
                    <button
                      onClick={() => handleCopy(voucher.code)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                    >
                      {copiedCode === voucher.code ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الكود</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApplyVoucherToCart(voucher)}
                      disabled={isApplied}
                      className={`w-full py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                        isApplied
                          ? 'bg-emerald-700 text-white cursor-default'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{isApplied ? 'مطبقة حالياً في السلة ✓' : 'تطبيق القسيمة في السلة'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vouchers Marketplace */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>متجر استبدال النقاط وقسائم التخفيض</span>
          </h3>
          <p className="text-xs text-slate-500">
            اختر القسيمة التي تناسبك واستبدل نقاطك فورياً بخصومات حقيقية على مشترياتك القادمة.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableVouchers.map((voucher, idx) => {
            const canAfford = loyaltyAccount.currentPoints >= voucher.pointsCost;

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                      <Gift className="w-4 h-4" />
                    </span>
                    <span className="font-mono font-black text-sm text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {voucher.pointsCost} نقطة
                    </span>
                  </div>

                  <h4 className="font-black text-slate-900 text-base">{voucher.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{voucher.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    {canAfford ? (
                      <span className="text-emerald-700 font-bold">رصيدك كافٍ للاستبدال ✓</span>
                    ) : (
                      <span className="text-slate-400 font-medium">
                        ينقصك {voucher.pointsCost - loyaltyAccount.currentPoints} نقطة
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleRedeem(voucher)}
                    disabled={!canAfford}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs ${
                      canAfford
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-98'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    استبدال النقاط
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Points History Feed & How to Earn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points History */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>سجل حركات ومعاملات النقاط</span>
            </h4>
            <span className="text-[11px] text-slate-400">آخر العمليات</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {loyaltyAccount.history.map((h) => (
              <div key={h.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">{h.description}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(h.date).toLocaleDateString('ar-SD')}
                  </span>
                </div>

                <div
                  className={`font-mono font-black text-xs px-2 py-0.5 rounded-full ${
                    h.type === 'earned' || h.type === 'bonus'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {h.points > 0 ? `+${h.points}` : h.points} نقطة
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to Earn Points Guide */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>كيف تجمع المزيد من النقاط بسرعة؟</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>الشراء من المتجر</span>
              </div>
              <p className="text-[11px] text-slate-500">
                اكسب 10 نقاط تلقائياً لكل 1,000 SDG مشتريات من أي فرع.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                <span>الدفع عبر بنكك</span>
              </div>
              <p className="text-[11px] text-slate-500">
                مكافأة 100 نقطة إضافية عند السداد الرقمي عبر تطبيق بنكك.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>الطلبات المسبقة</span>
              </div>
              <p className="text-[11px] text-slate-500">
                نقاط مضاعفة 1.5x على كافة حجوزات البضائع والشحنات المسبقة.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>الاستلام من الفرع</span>
              </div>
              <p className="text-[11px] text-slate-500">
                50 نقطة إضافية عند اختيار الاستلام الشخصي من الفرع المباشر.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
