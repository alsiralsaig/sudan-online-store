import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  ChevronDown,
  ShoppingCart,
  Heart,
  Gift,
  Clock3,
  Store as StoreIcon,
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
  Play,
} from 'lucide-react';
import { NotificationBell } from '../../components/Common/NotificationBell.tsx';
import { SanadLogo } from '../../components/Common/SanadLogo.tsx';
import { TenantApplicationModal } from '../../components/Common/TenantApplicationModal.tsx';
import { ClientSectionsDropdown } from './ClientSectionsDropdown.tsx';
import { SlideStrip } from './SlideStrip.tsx';
import { PushOptInCard } from '../../components/Common/PushOptInCard.tsx';
import { api } from '../../lib/api.ts';
import { useImpressionTracker } from '../../lib/useImpressionTracker.ts';
import { SanadContactSection } from '../../components/Common/SanadContactSection.tsx';
import type { ClientMarketAd, ClientPurchaseRequest } from '../types.ts';

interface ClientMarketHomeViewProps {
  onOpenSections?: () => void;
  onSelectSection?: (sectionKey: string) => void;
  cartCount?: number;
  onOpenCart?: () => void;
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
  onSelectSection,
  cartCount = 0,
  onOpenCart,
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
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [vipIndex, setVipIndex] = useState(0);

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

  /** Newest first, so a freshly approved VIP ad always leads the showcase. */
  const byNewest = (a: ClientMarketAd, b: ClientMarketAd) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

  const vipAds = ads.filter((a) => a.isVip).slice().sort(byNewest);

  const vipPlaceholder: ClientMarketAd = {
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
  } as ClientMarketAd;

  const latestAds = ads.slice(0, 10);

  /**
   * The VIP showcase slides exactly like the banner above it (same size, its
   * own timer): **every** VIP ad first, then the newest ads that carry a photo
   * so the strip never looks empty.
   */
  const vipSlides: ClientMarketAd[] = [
    ...(vipAds.length > 0 ? vipAds : [vipPlaceholder]),
    ...ads.filter((a) => (!!a.imageUrl || !!a.videoUrl) && !a.isVip).slice().sort(byNewest),
  ].slice(0, 8);

  useEffect(() => {
    if (vipSlides.length < 2) return;
    const timer = setInterval(() => {
      setVipIndex((i) => (i + 1) % vipSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [vipSlides.length]);

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
      {/* ---- Slim top bar: logo + «أقسام» (right) · actions (left) ------
          The old full-width header (slogan block + search field + tab rows)
          was pure dead space on a phone; the reference landing page opens
          straight onto the market, so this is now the only header here. */}
      <div className="bg-white sticky top-0 z-30 border-b border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="max-w-md md:max-w-4xl mx-auto px-2.5 py-2 flex items-center justify-between gap-2">
          {/* Logo sits to the right of «أقسام» */}
          <div className="flex items-center gap-1.5 min-w-0">
            <SanadLogo
              size="sm"
              variant="compact"
              onClick={() => onNavigateTab?.('market_home')}
            />

            <div className="relative">
              <button
                onClick={() => setSectionsOpen((v) => !v)}
                aria-expanded={sectionsOpen}
                aria-haspopup="menu"
                className={`px-3.5 py-2 rounded-xl text-[13px] font-black flex items-center gap-1.5 transition-all active:scale-95 ${
                  sectionsOpen
                    ? 'bg-emerald-800 text-white'
                    : 'bg-emerald-900 hover:bg-emerald-800 text-white'
                }`}
              >
                <span>أقسام</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${sectionsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Menu drops directly under the pill */}
              <ClientSectionsDropdown
                isOpen={sectionsOpen}
                onClose={() => setSectionsOpen(false)}
                onSelectSection={(key) => {
                  if (onSelectSection) onSelectSection(key);
                  else onOpenSections?.();
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCart && (
              <button
                onClick={onOpenCart}
                className="relative w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                title="سلة المشتريات"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black font-mono flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenAssistant}
              className="w-9 h-9 rounded-xl border border-slate-200 text-emerald-800 flex items-center justify-center active:scale-95 transition-transform"
              title="المساعد الذكي سند"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
            </button>

            <button
              onClick={onOpenSearch}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
              title="بحث في السوق"
            >
              <Search className="w-4 h-4" />
            </button>

            <NotificationBell app="client" ownerToken={ownerToken} onNavigate={onNavigateTab} />
          </div>
        </div>

        {/* Thin shortcut strip — scrolls on its own, never widens the page */}
        <div className="max-w-md md:max-w-4xl mx-auto overflow-x-auto no-scrollbar border-t border-slate-100/80">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 w-max">
            <button
              onClick={() => setTenantModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-900 text-white text-[11px] font-black whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1 shadow-sm"
            >
              <StoreIcon className="w-3 h-3" /> طلب متجر
            </button>
            <button
              onClick={() => onNavigateTab?.('catalog')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1"
            >
              🛍️ كافة المنتجات
            </button>
            <button
              onClick={() => onNavigateTab?.('pre_orders')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-500" /> الطلبات المسبقة
            </button>
            <button
              onClick={() => onNavigateTab?.('wishlist')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1"
            >
              <Heart className="w-3 h-3 text-rose-500" /> الرغبات
            </button>
            <button
              onClick={() => onNavigateTab?.('loyalty')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1"
            >
              <Gift className="w-3 h-3 text-amber-600" /> الولاء والمكافآت
            </button>
            <button
              onClick={() => onNavigateTab?.('track_order')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1"
            >
              <Clock3 className="w-3 h-3 text-emerald-700" /> تتبع طلبي
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md md:max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        {/* One-time invitation to allow phone notifications (drives real push) */}
        <PushOptInCard app="client" ownerToken={ownerToken} />

        {/* ---------------- Banner (photo-led, sliding like the reference) -- */}
        <SlideStrip
          containerRef={heroRef}
          index={currentBannerIndex}
          count={banners.length}
          onIndexChange={(i) => {
            setCurrentBannerIndex(i);
            setRotationTick((t) => t + 1);
          }}
          className="rounded-2xl shadow-sm border border-slate-200 aspect-[3.4/1] sm:aspect-[3.9/1] bg-slate-900"
        >
          {banners.map((banner, idx) => (
            <div
              key={(banner as any).id ?? idx}
              className="relative w-full shrink-0 h-full cursor-pointer"
              onClick={() => {
                const shown: any = banners[idx];
                if (shown?.id) api.trackMarketBannerClick(shown.id).catch(() => {});
                if (shown?.linkUrl) window.open(shown.linkUrl, '_blank');
              }}
            >
              <img
                src={banner.image}
                alt={banner.title}
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = '0';
                }}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-950/45 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/70 to-transparent pointer-events-none" />

              <div className="relative h-full flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5">
                <div className="min-w-0 max-w-[64%] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  {banner.badge && (
                    <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-amber-300 block leading-none mb-0.5">
                      {banner.badge}
                    </span>
                  )}
                  <h3 className="text-[13px] sm:text-xl font-black leading-tight line-clamp-2">
                    {banner.title}
                  </h3>
                  {banner.subtitle && (
                    <p className="hidden sm:block text-[11px] text-slate-100 line-clamp-1 mt-0.5">
                      {banner.subtitle}
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
            </div>
          ))}
        </SlideStrip>

        {/* ---------------- VIP showcase (sliding, same size) ------------ */}
        <SlideStrip
          index={vipIndex}
          count={vipSlides.length}
          onIndexChange={setVipIndex}
          className="rounded-2xl shadow-sm border border-slate-200 bg-white h-52 sm:h-72"
        >
          {vipSlides.map((slide) => (
            <div key={slide.id} className="relative w-full shrink-0 h-full overflow-hidden bg-slate-100">
              {slide.imageUrl ? (
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onClick={() => onSelectAd(slide)}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0';
                  }}
                  className="w-full h-full object-cover cursor-pointer"
                />
              ) : slide.videoUrl ? (
                <video
                  src={slide.videoUrl}
                  className="w-full h-full object-cover cursor-pointer"
                  muted
                  playsInline
                  preload="metadata"
                  onClick={() => onSelectAd(slide)}
                />
              ) : (
                <div className="w-full h-full bg-slate-200" />
              )}
              {slide.videoUrl && (
                <span className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center pointer-events-none">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

              <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] shadow flex items-center gap-1">
                <Crown className="w-3 h-3 fill-current" /> {slide.isVip ? 'VIP' : slide.tag || 'مميّز'}
              </div>

              <button
                onClick={() => onSelectAd(slide)}
                className="absolute bottom-5 inset-x-3 space-y-1.5 text-right block"
              >
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-white">
                  <Layers className="w-3 h-3 text-amber-400" />
                  <span>{slide.category}</span>
                  <span>•</span>
                  <MapPin className="w-3 h-3 text-red-400" />
                  <span>{slide.location}</span>
                </span>
                <span className="block">
                  <span className="inline-block px-3 py-1 bg-black/75 backdrop-blur-md rounded-xl text-white font-extrabold text-sm">
                    {slide.title}
                  </span>
                </span>
                <span className="block">
                  <span className="inline-block px-3 py-1 bg-emerald-950/85 backdrop-blur-md rounded-xl text-amber-300 font-extrabold text-sm font-mono">
                    {slide.priceSdg > 0
                      ? `${slide.priceSdg.toLocaleString('en-US')} جنيه سوداني`
                      : 'حسب الاتفاق'}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </SlideStrip>

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
                    ) : ad.videoUrl ? (
                      // No cover photo: show the clip's own first frame.
                      <video
                        src={ad.videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                        بلا صورة
                      </div>
                    )}
                    {ad.videoUrl && (
                      <span className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center">
                        <Play className="w-3 h-3 fill-current" />
                      </span>
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
          onClick={() => setTenantModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold"
        >
          <Store className="w-4 h-4" />
          <span>عندك متجر؟ أضفه إلى منصة سند</span>
        </button>
      </div>

      <TenantApplicationModal
        isOpen={tenantModalOpen}
        onClose={() => setTenantModalOpen(false)}
        source="client"
      />
    </div>
  );
};
