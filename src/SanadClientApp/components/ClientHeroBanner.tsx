import React from 'react';
import {
  Sparkles,
  ShoppingBag,
  Clock,
  Truck,
  ShieldCheck,
  CreditCard,
  MapPin,
  ArrowDown,
  Gift,
} from 'lucide-react';

interface ClientHeroBannerProps {
  storeName: string;
  onExploreProducts: () => void;
  onExplorePreOrders: () => void;
  onTrackOrder: () => void;
}

export const ClientHeroBanner: React.FC<ClientHeroBannerProps> = ({
  storeName,
  onExploreProducts,
  onExplorePreOrders,
  onTrackOrder,
}) => {
  const heroImage = '/assets/images/sanad_pos_hero_1792173270140.jpg';

  return (
    <div className="relative rounded-3xl overflow-hidden bg-slate-950 text-white shadow-xl border border-slate-800 my-4">
      {/* Background Hero Image with Dark Gradient Wash */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="سند للتسوق الإلكتروني"
          className="w-full h-full object-cover object-center opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14 max-w-4xl space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>منصة سند للتسوق الذكي · الطلبات المسبقة والتوصيل الفوري</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
          تسوق كل ما تحتاجه من <span className="text-emerald-400">{storeName}</span> بأفضل الأسعار وأسرع خدمة
        </h1>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
          تصفح قائمة السلع التموينية، الإلكترونيات، والمعدات مع إمكانية الشراء الفوري أو الحجز المسبق للكميات الكبيرة مع السداد المباشر عبر تطبيق بنكك أو الدفع عند الاستلام.
        </p>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 text-xs text-slate-200">
            <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>توصيل سريع للولايات</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 text-xs text-slate-200">
            <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
            <span>دفع ببنكك وكريبتو وكاش</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 text-xs text-slate-200">
            <Clock className="w-4 h-4 text-teal-400 shrink-0" />
            <span>حجز مسبق (Pre-orders)</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 text-xs text-slate-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>منتجات أصلية ومضمونة</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            onClick={onExploreProducts}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>تصفح المنتجات الآن</span>
            <ArrowDown className="w-4 h-4" />
          </button>

          <button
            onClick={onExplorePreOrders}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>عروض الحجز المسبق</span>
          </button>

          <button
            onClick={onTrackOrder}
            className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-white/10 transition-all"
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>تتبع طلب سابق</span>
          </button>
        </div>
      </div>
    </div>
  );
};
