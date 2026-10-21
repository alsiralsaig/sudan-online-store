import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  ChevronDown,
  ArrowLeft,
  MapPin,
  Clock,
  Layers,
  Crown,
  ShoppingBag,
  Store,
  Building2,
  Gavel,
  Presentation,
  Smartphone,
  Home,
  Car,
  Shirt,
  Wheat,
  Wrench,
  Package,
  Stethoscope,
} from 'lucide-react';
import { NotificationBell } from '../../components/Common/NotificationBell.tsx';
import { api } from '../../lib/api.ts';
import { useImpressionTracker } from '../../lib/useImpressionTracker.ts';
import { SanadContactSection } from '../../components/Common/SanadContactSection.tsx';
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
  ownerToken?: string;
  onNavigateTab?: (tab: string) => void;
}

/**
 * Shoppers' landing page.
 *
 * Layout mirrors the Albandar market landing page: sections pill + icons on
 * top, a rotating banner, a VIP showcase, "آخر الإعلانات" in a cream card with
 * two-up ad cards, the four big shortcut buttons, then the category tiles.
 */
export const ClientMarketHomeView: React.FC<ClientMarketHomeViewProps> = ({
  onOpenSections,
  onOpenSearch,
  onOpenAssistant,
  onSelectAd,
  onOpenCatalog,
  ads,
  purchaseRequests,
  ownerToken,
  onNavigateTab,
  onOpenCreateModal,
}) => {
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [rotationTick, setRotationTick] = useState(0);

  /** Defaults shown until the admin-managed banners load (or if none are set). */
  const defaultBanners = [
    {
      id: 1,
      badge: '★★★★★',
      title: 'أعلن عن معرض سياراتك هنا',
      subtitle: 'كن من أوائل المعلنين في سوق سند',
      image: '/assets/images/albander_hyundai_car_1792184093653.jpg',
      theme: 'from-red-950 via-slate-900 to-black',
    },
    {
      id: 2,
      badge: 'ضمان معتمد',
      title: 'عروض الأجهزة الكهربائية والمكيفات',
      subtitle: 'أفضل أسعار المكيفات والمولدات مع تركيب فوري',
      image: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
      theme: 'from-sky-950 via-slate-900 to-black',
    },
    {
      id: 3,
      badge: 'توصيل سريع',
      title: 'تسوق من المتاجر الكبرى المعتمدة',
      subtitle: 'مواد تموينية وغذائية بالجملة والدفع ببنكك',
      image: '/assets/images/sanad_pos_hero_1792173270140.jpg',
      theme: 'from-emerald-950 via-slate-900 to-black',
    },
  ];

  const [banners, setBanners] = useState(defaultBanners);

  // Banners are managed from the admin console (صورة + عنوان + ترتيب)
  useEffect(() => {
    let cancelled = false;
    api
      .getMarketBanners()
      .then((res) => {
        if (cancelled) return;
        const live = (res.banners || []).map((b: any) => ({
          id: b.id,
          badge: b.badge || '',
          title: b.title,
          subtitle: b.subtitle || '',
          image: b.imageUrl,
          theme: 'from-slate-950 via-slate-900 to-black',
          linkUrl: b.linkUrl,
        }));
        if (live.length > 0) {
          setBanners(live);
          setCurrentBannerIndex(0);
        }
      })
      .catch(() => {
        /* keep the defaults when offline */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Count a banner as "seen" only when it is really on screen for a moment (CTR needs honest numbers)
  const heroRef = useRef<HTMLDivElement | null>(null);
  const shownBannerId: string | undefined = (banners[currentBannerIndex] as any)?.id;
  useImpressionTracker(heroRef, shownBannerId, { key: `${shownBannerId}:${rotationTick}` });

  // Rotate the banner like the reference landing page
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((i) => (i + 1) % banners.length);
      setRotationTick((t) => t + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const vipAd: ClientMarketAd =
    ads.find((a) => a.isVip) ||
    ({
      id: 'vip_placeholder',
      title: 'مكيفات أيس فخامة وجودة',
      category: 'الإلكترونيات',
      location: 'الخرطوم',
      priceSdg: 1350000,
      timeAgo: 'قبل ساعة',
      imageUrl: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
      isVip: true,
      tag: 'VIP',
      phone: '0912345678',
      whatsapp: '0912345678',
      description: 'مكيفات أصلية موفرة للطاقة مع كفالة سنتين وتركيب فوري.',
      publisherName: 'معرض الأجهزة المعتمد',
      createdAt: new Date().toISOString(),
    } as ClientMarketAd);

  const latestAds = ads.slice(0, 10);

  /** The four big shortcuts from the reference page, mapped onto real screens. */
  const shortcuts = [
    {
      label: 'متاجر المشاهير',
      icon: Crown,
      onClick: () => onNavigateTab?.('catalog'),
    },
    {
      label: 'الدليل التجاري',
      icon: Building2,
      onClick: onOpenSections,
    },
    {
      label: 'المزادات',
      icon: Gavel,
      onClick: () => onNavigateTab?.('auctions'),
    },
    {
      label: 'المعارض والمحلات',
      icon: Presentation,
      onClick: onOpenCatalog,
    },
  ];

  const categories = [
    { id: 'electronics', name: 'هواتف', icon: Smartphone },
    { id: 'real_estate', name: 'عقارات', icon: Home },
    { id: 'vehicles', name: 'سيارات', icon: Car },
    { id: 'clothes', name: 'ملابس', icon: Shirt },
    { id: 'food', name: 'مواد غذائية', icon: Wheat },
    { id: 'services', name: 'خدمات', icon: Wrench },
    { id: 'home', name: 'أجهزة منزلية', icon: Package },
    { id: 'health', name: 'صحة', icon: Stethoscope },
  ];

  return (
    <div className="pb-24 bg-slate-50" dir="rtl">
      {/* ---------------- Top bar: sections pill (right) + icons (left) ---- */}
      <div className="bg-white sticky top-0 z-30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <button
          onClick={onOpenSections}
          className="px-6 py-2.5 bg-emerald-900 hover:bg-emerald-800 active:scale-95 text-white rounded-2xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <span>الأقسام</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAssistant}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-800 flex items-center justify-center transition-colors"
            title="المساعد الذكي سند"
          >
            <Sparkles className="w-4 h-4 text-emerald-700" />
          </button>
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors"
            title="بحث في السوق"
          >
            <Search className="w-4 h-4" />
          </button>
          <NotificationBell app="client" ownerToken={ownerToken} onNavigate={onNavigateTab} />
        </div>
      </div>

      <div className="max-w-md md:max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        {/* ---------------- Banner (photo-led, like the reference) -------- */}
        <div
          ref={heroRef}
          className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 aspect-[3.4/1] sm:aspect-[3.9/1] bg-slate-900 cursor-pointer"
          onClick={() => {
            const shown: any = banners[currentBannerIndex];
            if (shown?.id) {
              // Count the tap so the advertiser sees real numbers (never blocks the open)
              api.trackMarketBannerClick(shown.id).catch(() => {});
            }
            if (shown?.linkUrl) window.open(shown.linkUrl, '_blank');
          }}
        >
          {/* Photo stays the hero: the scrim only darkens the side that carries the text */}
          <img
            src={banners[currentBannerIndex].image}
            alt={banners[currentBannerIndex].title}
            loading={currentBannerIndex === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={(e) => {
              // never leave a broken-image icon over the headline
              (e.currentTarget as HTMLImageElement).style.opacity = '0';
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-950/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/70 to-transparent" />
          <div className="relative h-full flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5">
            <div className="min-w-0 max-w-[64%] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
              {banners[currentBannerIndex].badge && (
                <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-amber-300 block leading-none mb-0.5">
                  {banners[currentBannerIndex].badge}
                </span>
              )}
              <h3 className="text-[13px] sm:text-xl font-black leading-tight line-clamp-2">
                {banners[currentBannerIndex].title}
              </h3>
              {banners[currentBannerIndex].subtitle && (
                <p className="hidden sm:block text-[11px] text-slate-100 line-clamp-1 mt-0.5">
                  {banners[currentBannerIndex].subtitle}
                </p>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateModal();
              }}
              className="shrink-0 self-end mb-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white text-slate-900 rounded-lg text-[10px] sm:text-[11px] font-black active:scale-95 transition-transform whitespace-nowrap shadow-sm"
            >
              أضف إعلانك (+)
            </button>
          </div>

          <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBannerIndex(idx)}
                aria-label={`بانر ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  currentBannerIndex === idx ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ---------------- VIP showcase --------------------------------- */}
        <div
          onClick={() => onSelectAd(vipAd)}
          className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white cursor-pointer"
        >
          <div className="relative h-52 sm:h-72 w-full overflow-hidden bg-slate-100">
            <img src={vipAd.imageUrl} alt={vipAd.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

            <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] shadow flex items-center gap-1">
              <Crown className="w-3 h-3 fill-current" /> VIP
            </div>

            <div className="absolute bottom-4 inset-x-3 space-y-1.5 text-right">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-white">
                <Layers className="w-3 h-3 text-amber-400" />
                <span>{vipAd.category}</span>
                <span>•</span>
                <MapPin className="w-3 h-3 text-red-400" />
                <span>{vipAd.location}</span>
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-black/75 backdrop-blur-md rounded-xl text-white font-extrabold text-sm">
                  {vipAd.title}
                </span>
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-emerald-950/85 backdrop-blur-md rounded-xl text-amber-300 font-extrabold text-sm font-mono">
                  {vipAd.priceSdg.toLocaleString('en-US')} جنيه سوداني
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- آخر الإعلانات (cream card, two-up grid) ------ */}
        <div className="rounded-2xl bg-amber-50/60 border border-amber-200/70 p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-[15px] font-extrabold text-slate-900">آخر الإعلانات</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                آخر {latestAds.length}
              </span>
              <button
                onClick={onOpenCatalog}
                className="text-[11px] font-bold text-emerald-800 flex items-center gap-0.5"
              >
                <span>المنتجات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {latestAds.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              لا توجد إعلانات منشورة بعد.
              <button onClick={onOpenCreateModal} className="text-emerald-700 font-bold underline mr-1">
                كن أول من يعلن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {latestAds.map((ad) => (
                <div
                  key={ad.id}
                  onClick={() => onSelectAd(ad)}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                        فيديو
                      </div>
                    )}
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-slate-900 shadow-xs">
                      {ad.tag || (ad.isVip ? 'VIP' : 'للبيع')}
                    </span>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5 text-right">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-[12px] leading-snug line-clamp-1">
                        {ad.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 flex-wrap">
                        <Layers className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[76px]">{ad.category}</span>
                        <span>•</span>
                        <span className="truncate max-w-[64px]">{ad.location}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{ad.timeAgo}</span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                      <span
                        className={`font-mono font-black text-slate-950 ${
                          ad.priceSdg > 999999 ? 'text-[10px]' : 'text-[11px]'
                        } sm:text-xs whitespace-nowrap`}
                        title={ad.priceSdg > 0 ? `${ad.priceSdg.toLocaleString('en-US')} جنيه سوداني` : 'حسب الاتفاق'}
                      >
                        {ad.priceSdg > 0 ? (
                          <>
                            {ad.priceSdg.toLocaleString('en-US')}
                            <span className="text-emerald-800 font-sans"> ج.س</span>
                          </>
                        ) : (
                          <span className="font-sans text-[11px]">حسب الاتفاق</span>
                        )}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0">
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- Four big shortcut buttons -------------------- */}
        <div className="grid grid-cols-2 gap-2.5">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 active:scale-[0.98] text-white text-[13px] font-bold shadow-sm transition-all"
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ---------------- Category tiles ------------------------------- */}
        <div className="grid grid-cols-3 gap-2.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => onNavigateTab?.('catalog')}
                className="bg-white rounded-2xl border border-slate-200 py-3.5 flex flex-col items-center gap-1.5 hover:border-emerald-400 hover:shadow-sm transition-all"
              >
                <span className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-emerald-800">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-bold text-slate-800">{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* ---------------- Live buying requests (RFQ) ------------------- */}
        {purchaseRequests.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-teal-700" />
                <h4 className="text-xs font-black text-teal-950">طلبات الشراء النشطة من الزبائن</h4>
              </div>
              <button onClick={onOpenCreateModal} className="text-[11px] font-bold text-teal-700 hover:underline">
                أضف طلبك (+)
              </button>
            </div>

            <div className="space-y-2">
              {purchaseRequests.slice(0, 3).map((rfq) => (
                <div
                  key={rfq.id}
                  className="p-2.5 rounded-xl bg-white border border-teal-100 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <strong className="font-bold text-slate-900 block">{rfq.itemName}</strong>
                    <span className="text-[10px] text-slate-500">
                      الكمية: {rfq.quantity} • {rfq.city} •{' '}
                      {rfq.urgency === 'urgent' ? 'عاجل اليوم ⚡' : 'هذا الأسبوع'}
                    </span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[11px] font-bold text-emerald-800 block">
                      {rfq.budgetSdg ? `${rfq.budgetSdg.toLocaleString('en-US')} ج.س` : 'حسب العرض'}
                    </span>
                    <span className="text-[10px] text-slate-400">مطلوب من المتاجر</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store application shortcut, kept visible at the end of the feed */}
        <SanadContactSection compact className="mb-3" />

        <div className="h-16" aria-hidden="true" />

        <button
          onClick={() => onNavigateTab?.('market_home')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold"
        >
          <Store className="w-4 h-4" />
          <span>عندك متجر؟ أضفه إلى منصة سند</span>
        </button>
      </div>
    </div>
  );
};
