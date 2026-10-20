import React, { useState } from 'react';
import {
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  MapPin,
  Clock,
  Tag,
  Share2,
  Phone,
  Eye,
  Crown,
  Layers,
  ArrowLeft,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import type { ClientMarketAd, ClientPurchaseRequest } from '../types.ts';

interface ClientMarketHomeViewProps {
  onOpenSections: () => void;
  onOpenSearch: () => void;
  onOpenAssistant: () => void;
  onSelectAd: (ad: ClientMarketAd) => void;
  onOpenCatalog: () => void;
  ads: ClientMarketAd[];
  purchaseRequests: ClientPurchaseRequest[];
  onOpenCreateModal: () => void;
}

export const ClientMarketHomeView: React.FC<ClientMarketHomeViewProps> = ({
  onOpenSections,
  onOpenSearch,
  onOpenAssistant,
  onSelectAd,
  onOpenCatalog,
  ads,
  purchaseRequests,
  onOpenCreateModal,
}) => {
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const banners = [
    {
      id: 1,
      title: 'أعلن عن معرض سياراتك هنا',
      subtitle: 'كن من أوائل المعلنين في البندر وسند',
      badge: '★★★★★',
      image: '/assets/images/albander_hyundai_car_1792184093653.jpg',
    },
    {
      id: 2,
      title: 'عروض الأجهزة الكهربائية والمكيفات',
      subtitle: 'أفضل أسعار المكيفات المائية ومولدات الكهرباء',
      badge: 'ضمان معتمد',
      image: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
    },
    {
      id: 3,
      title: 'تسوق من المتاجر الكبرى المعتمدة',
      subtitle: 'مواد تموينية وغذائية بالجملة والتجزئة مع الدفع ببنكك',
      badge: 'توصيل سريع',
      image: '/assets/images/sanad_pos_hero_1792173270140.jpg',
    },
  ];

  // VIP Featured Ad
  const vipAd: ClientMarketAd = ads.find((a) => a.isVip) || {
    id: 'vip_cooler',
    title: 'مكيفات آيس فخامه وجوده',
    category: 'الإلكترونيات',
    location: 'الخرطوم',
    priceSdg: 1350000,
    timeAgo: 'قبل ساعة',
    imageUrl: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
    isVip: true,
    tag: 'VIP',
    phone: '0912345678',
    whatsapp: '0912345678',
    description: 'مكيفات كرتين أصلية وموفرة للطاقة مع كفالة سنتين وتركيب فوري.',
    publisherName: 'معرض الأجهزة المعتمد',
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Top Bar matching Screenshot 2 */}
      <div className="bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shadow-2xs">
        {/* Left: Dark Green Sections Pill Button */}
        <button
          onClick={onOpenSections}
          className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
        >
          <span>الأقسام</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Right Action Icons: Sparkles (AI), Search, Bell */}
        <div className="flex items-center gap-2">
          {/* AI Assistant Button */}
          <button
            onClick={onOpenAssistant}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-800 flex items-center justify-center transition-colors shadow-2xs"
            title="المساعد الذكي سند باللهجة السودانية"
          >
            <Sparkles className="w-4 h-4 text-emerald-700" />
          </button>

          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
            title="بحث في السوق"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <button
            className="w-9 h-9 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs relative"
            title="الإشعارات"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-600 rounded-full" />
          </button>
        </div>
      </div>

      <div className="max-w-md md:max-w-4xl mx-auto px-4 space-y-5">
        {/* Promotional Carousel Banner (Matching Car Showroom banner in Screenshot 2) */}
        <div className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200 bg-gradient-to-r from-red-950 via-slate-900 to-black text-white h-44 sm:h-52">
          <div className="absolute inset-0 flex items-center justify-between p-6">
            <div className="space-y-1.5 z-10 max-w-[60%]">
              <span className="text-[10px] text-red-400 font-mono tracking-widest block">
                {banners[currentBannerIndex].badge}
              </span>
              <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                {banners[currentBannerIndex].title}
              </h3>
              <p className="text-xs text-slate-300 line-clamp-2">
                {banners[currentBannerIndex].subtitle}
              </p>
              <div className="pt-2">
                <button
                  onClick={onOpenCreateModal}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-xs"
                >
                  أضف إعلانك الآن (+)
                </button>
              </div>
            </div>

            <div className="absolute left-3 bottom-2 top-2 w-[45%] flex items-center justify-center">
              <img
                src={banners[currentBannerIndex].image}
                alt="Banner visual"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Carousel Dots */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBannerIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  currentBannerIndex === idx ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* VIP Featured Showcase Card (Matching Screenshot 2 Air Coolers) */}
        <div
          onClick={() => onSelectAd(vipAd)}
          className="relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-white group cursor-pointer transition-transform hover:-translate-y-0.5"
        >
          <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full overflow-hidden bg-slate-100">
            <img
              src={vipAd.imageUrl}
              alt={vipAd.title}
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* VIP Crown Badge (Top Right) */}
            <div className="absolute top-4 right-4 px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 fill-current text-slate-950" />
              <span>VIP</span>
            </div>

            {/* Overlay Info Pills (Matching Screenshot 2) */}
            <div className="absolute bottom-6 inset-x-4 space-y-2 text-right">
              {/* Category & Location Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] text-white">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{vipAd.category}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-red-400" />
                  <span>{vipAd.location}</span>
                </span>
              </div>

              {/* Title Pill */}
              <div>
                <span className="inline-block px-4 py-1.5 bg-black/75 backdrop-blur-md rounded-2xl text-white font-extrabold text-sm sm:text-base">
                  {vipAd.title}
                </span>
              </div>

              {/* Price Pill */}
              <div>
                <span className="inline-block px-4 py-1.5 bg-emerald-950/80 backdrop-blur-md rounded-2xl text-amber-300 font-extrabold text-sm sm:text-base font-mono">
                  {vipAd.priceSdg.toLocaleString()} جنيه سوداني
                </span>
              </div>
            </div>

            {/* Pagination Dots indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <span className="w-4 h-1 bg-amber-400 rounded-full" />
              <span className="w-1.5 h-1 bg-white/50 rounded-full" />
              <span className="w-1.5 h-1 bg-white/50 rounded-full" />
            </div>
          </div>
        </div>

        {/* Section: آخر الإعلانات 🕒 (Matching Screenshot 2) */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">آخر الإعلانات</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                آخر {Math.min(ads.length, 10)}
              </span>

              <button
                onClick={onOpenCatalog}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
              >
                <span>كتالوج المنتجات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {ads.slice(0, 8).map((ad) => (
              <div
                key={ad.id}
                onClick={() => onSelectAd(ad)}
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                  <img
                    src={ad.imageUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badge tag like 'service' in Screenshot 2 */}
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-xs text-slate-900 shadow-xs">
                    {ad.tag || 'service'}
                  </span>
                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between text-right">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-emerald-800">
                      {ad.title}
                    </h4>

                    {/* Category & Location */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-0.5">
                      <Layers className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{ad.category}</span>
                      <span>•</span>
                      <span>{ad.location}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                      {ad.timeAgo}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="font-mono font-black text-xs sm:text-sm text-slate-950 truncate">
                      {ad.priceSdg > 0 ? `${ad.priceSdg.toLocaleString()} ج.س` : '0 جنيه سوداني'}
                    </div>

                    {/* Circular dark-green back-arrow button matching Screenshot 2 */}
                    <button
                      type="button"
                      className="w-6 h-6 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 group-hover:bg-emerald-700 transition-colors"
                      title="عرض التفاصيل"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Buying Requests from Shoppers (RFQ) Preview */}
        {purchaseRequests.length > 0 && (
          <div className="p-4 rounded-3xl bg-teal-50/70 border border-teal-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-teal-700" />
                <h4 className="text-xs font-black text-teal-950">طلبات الشراء النشطة من الزبائن</h4>
              </div>
              <button
                onClick={onOpenCreateModal}
                className="text-[11px] font-bold text-teal-700 hover:underline"
              >
                أضف طلبك (+)
              </button>
            </div>

            <div className="space-y-2">
              {purchaseRequests.slice(0, 3).map((rfq) => (
                <div
                  key={rfq.id}
                  className="p-2.5 rounded-2xl bg-white border border-teal-100 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <strong className="font-bold text-slate-900 block">{rfq.itemName}</strong>
                    <span className="text-[10px] text-slate-500">
                      الكمية: {rfq.quantity} • {rfq.city} • {rfq.urgency === 'urgent' ? 'عاجل اليوم ⚡' : 'هذا الأسبوع'}
                    </span>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-[11px] font-bold text-emerald-800 block">
                      {rfq.budgetSdg ? `${rfq.budgetSdg.toLocaleString()} ج.س` : 'حسب العرض'}
                    </span>
                    <span className="text-[10px] text-slate-400">مطلوب من المتاجر</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
