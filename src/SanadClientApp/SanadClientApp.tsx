import React, { useState, useEffect } from 'react';
import { ClientHeader } from './components/ClientHeader.tsx';
import { ClientHeroBanner } from './components/ClientHeroBanner.tsx';
import { ClientProductCatalog } from './components/ClientProductCatalog.tsx';
import { ClientCartDrawer } from './components/ClientCartDrawer.tsx';
import { ClientOrderTracker } from './components/ClientOrderTracker.tsx';
import { ClientWishlistView } from './components/ClientWishlistView.tsx';
import { ClientLoyaltyDashboard } from './components/ClientLoyaltyDashboard.tsx';
import { ClientFooter } from './components/ClientFooter.tsx';
import { ClientSectionsModal } from './components/ClientSectionsModal.tsx';
import { ClientBottomNav } from './components/ClientBottomNav.tsx';
import { ClientCreateAdOrRequestModal } from './components/ClientCreateAdOrRequestModal.tsx';
import { ClientMarketHomeView } from './components/ClientMarketHomeView.tsx';
import { ClientAdDetailModal } from './components/ClientAdDetailModal.tsx';
import { ClientAutocompleteSearch } from './components/ClientAutocompleteSearch.tsx';
import { SanadAIAssistant } from '../components/Common/SanadAIAssistant.tsx';

import type {
  ClientCartItem,
  ClientActiveTab,
  WishlistItem,
  LoyaltyAccount,
  LoyaltyVoucher,
  ProductReview,
  ClientMarketAd,
  ClientPurchaseRequest,
} from './types.ts';
import type { Product, Branch, Tenant } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { getOwnerToken } from './lib/ownerToken.ts';
import {
  MapPin,
  Phone,
  Building,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  CreditCard,
  LayoutDashboard,
  ExternalLink,
  Heart,
  Gift,
  Gavel,
  Mail,
  Send,
  MessageCircle,
  Trash2,
} from 'lucide-react';

interface SanadClientAppProps {
  onSwitchToAdmin?: () => void;
  onSwitchToSuperAdmin?: () => void;
}

export const SanadClientApp: React.FC<SanadClientAppProps> = ({
  onSwitchToSuperAdmin,
}) => {
  // Default to Market Home (matching user screenshot 2)
  const [activeTab, setActiveTab] = useState<ClientActiveTab>('market_home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSectionsModalOpen, setIsSectionsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<ClientMarketAd | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  // Cart State
  const [cart, setCart] = useState<ClientCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_client_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<LoyaltyVoucher | null>(null);

  // Market Ads State (Matching Screenshots)
  const [marketAds, setMarketAds] = useState<ClientMarketAd[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_market_ads');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'ad_1',
        title: 'مكيفات آيس فخامه وجوده',
        category: 'الإلكترونيات',
        priceSdg: 1350000,
        location: 'الخرطوم',
        timeAgo: 'قبل 12 دقيقة',
        imageUrl: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
        isVip: true,
        tag: 'VIP',
        phone: '0912345678',
        whatsapp: '0912345678',
        description: 'مكيفات ماء كرتين أصلية وموفرة للطاقة مع كفالة سنتين وتركيب فوري.',
        publisherName: 'معرض الأجهزة المعتمد',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad_2',
        title: 'مكواة تجعيد الشعر الاحترافية',
        category: 'قسم الخدمات',
        priceSdg: 70000,
        location: 'الخرطوم',
        timeAgo: 'قبل 15 دقيقة',
        imageUrl: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
        isVip: false,
        tag: 'service',
        phone: '0923456789',
        whatsapp: '0923456789',
        description: 'مكواة كيراتين 3D حرارة عالية لصالونات التجميل مع ضمان التشغيل.',
        publisherName: 'متجر الجمال والعناية',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad_3',
        title: 'عرض خاص صهاريج مياه ومواد تموينية',
        category: 'قسم الخدمات',
        priceSdg: 0,
        location: 'الخرطوم',
        timeAgo: 'قبل 17 دقيقة',
        imageUrl: '/assets/aistudio/Screenshot_________________9bd493de.jpg',
        isVip: false,
        tag: 'service',
        phone: '0934567890',
        whatsapp: '0934567890',
        description: 'صهاريج مياه معالجة بولي إيثيلين سعات مختلفة مع التوصيل داخل الخرطوم.',
        publisherName: 'مؤسسة النيل للخدمات',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad_4',
        title: 'هيونداي توسان 2022 بحالة الوكالة',
        category: 'السيارات والمركبات',
        priceSdg: 38000000,
        location: 'بورتسودان',
        timeAgo: 'قبل ساعة',
        imageUrl: '/assets/images/albander_hyundai_car_1792184093653.jpg',
        isVip: true,
        tag: 'VIP',
        phone: '0911223344',
        whatsapp: '0911223344',
        description: 'ترخيص ساري، ممشى قليل، فحص كامل خالية من الصدمات.',
        publisherName: 'معرض الشرق للسيارات',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad_5',
        title: 'لابتوب آبل ماك بوك برو M2 شاشة ريتينا',
        category: 'الإلكترونيات',
        priceSdg: 2850000,
        location: 'الخرطوم',
        timeAgo: 'قبل ساعتين',
        imageUrl: '/assets/images/albander_macbook_laptop_1792184108039.jpg',
        isVip: false,
        tag: 'electronics',
        phone: '0955667788',
        whatsapp: '0955667788',
        description: 'ذاكرة 16GB، سعة 512GB SSD، بطارية ممتازة مع الشاحن الأصلي.',
        publisherName: 'ديجيتال ستور الخرطوم',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad_6',
        title: 'شاحنة بيك آب تويوتا هايلوكس دبل كاب',
        category: 'السيارات والمركبات',
        priceSdg: 45000000,
        location: 'القضارف',
        timeAgo: 'قبل 3 ساعات',
        imageUrl: '/assets/images/albander_pickup_truck_1792184123630.jpg',
        isVip: false,
        tag: 'truck',
        phone: '0999887766',
        whatsapp: '0999887766',
        description: 'جاهزة للعمل الزراعي والتجاري، صيانة دورية ومحرك سليم 100%.',
        publisherName: 'وكالة القضارف التجارية',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  // Customer Custom Purchase Requests (RFQ submitted via + button)
  const [purchaseRequests, setPurchaseRequests] = useState<ClientPurchaseRequest[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_purchase_requests');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'rfq_1',
        itemName: 'مولد كهرباء استرا كوري 5KVA سحب سلك',
        category: 'أجهزة ومعدات',
        quantity: 1,
        budgetSdg: 1800000,
        city: 'الخرطوم',
        customerName: 'طارق عبد المحمود',
        customerPhone: '0912345678',
        urgency: 'urgent',
        notes: 'مطلوب استلام فوري في حي الرياض، والدفع جاهز كاش أو بنكك.',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        status: 'open',
        quotesCount: 3,
      },
      {
        id: 'rfq_2',
        itemName: '50 شوال سكر كنانة عبوة 50 كيلو جملة',
        category: 'سلع ومواد تموينية',
        quantity: 50,
        budgetSdg: 3400000,
        city: 'بورتسودان',
        customerName: 'مؤسسة البركة للمواد الغذائية',
        customerPhone: '0922334455',
        urgency: 'this_week',
        notes: 'مطلوب فواتير رسمية وتسليم في ميناء بورتسودان أو مخازن سلالاب.',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'open',
        quotesCount: 2,
      },
    ];
  });

  // Wishlist State
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_client_wishlist');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        productId: 'prod_sugar_50kg',
        addedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        originalPriceSdg: 68000,
      },
      {
        productId: 'prod_tea_ghazaltain',
        addedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        originalPriceSdg: 26000,
      },
    ];
  });

  // Viewed products for recommendations
  const [viewedProductIds, setViewedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_client_viewed');
      return saved ? JSON.parse(saved) : ['prod_sugar_50kg', 'prod_cooking_oil_4l'];
    } catch {
      return ['prod_sugar_50kg', 'prod_cooking_oil_4l'];
    }
  });

  // Loyalty Program Account State
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount>(() => {
    try {
      const saved = localStorage.getItem('sanad_client_loyalty');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      customerName: 'محمد أحمد علي',
      customerPhone: '0912345678',
      currentPoints: 1450,
      lifetimePoints: 3200,
      tier: 'silver',
      history: [
        {
          id: 'h_1',
          type: 'earned',
          points: 350,
          description: 'نقاط مكتسبة من فاتورة طلب تمويني',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          referenceOrderNumber: 'ORD-2026-784',
        },
        {
          id: 'h_2',
          type: 'bonus',
          points: 500,
          description: 'مكافأة التسجيل والترحيب في سند',
          date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      activeVouchers: [
        {
          id: 'vch_init_1',
          code: 'SANAD-LOYALTY-3K',
          title: 'قسيمة خصم 3,000 جنيه',
          description: 'خصم مباشر 3,000 SDG على أي طلب تتجاوز قيمته 20,000 SDG',
          pointsCost: 300,
          discountType: 'fixed_amount',
          discountValue: 3000,
          minOrderValueSdg: 20000,
          isRedeemed: true,
          redeemedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };
  });

  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string>('');

  // Product Reviews State
  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_product_reviews');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'rev_1',
        productId: 'prod_sugar_50kg',
        customerName: 'عثمان إبراهيم',
        rating: 5,
        comment: 'سكر كنانة الأبيض غني عن التعريف، نقي وممتاز والتوصيل سريع.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        isVerifiedPurchase: true,
      },
    ];
  });

  // Load Primary Data from platform API
  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, branchRes, tenantRes] = await Promise.allSettled([
          api.getProducts(),
          api.getBranches(),
          api.getCurrentTenant(),
        ]);

        if (prodRes.status === 'fulfilled' && prodRes.value?.products) {
          setProducts(prodRes.value.products);
        }
        if (branchRes.status === 'fulfilled' && branchRes.value?.branches) {
          setBranches(branchRes.value.branches);
          if (branchRes.value.branches.length > 0 && !selectedBranch) {
            setSelectedBranch(branchRes.value.branches[0]);
          }
        }
        if (tenantRes.status === 'fulfilled' && tenantRes.value?.tenant) {
          setTenant(tenantRes.value.tenant);
        }
      } catch (err) {
        console.warn('Failed loading store data:', err);
      }
    }
    loadData();
  }, []);

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('sanad_client_cart', JSON.stringify(cart));
  }, [cart]);

  // Save Wishlist to LocalStorage
  useEffect(() => {
    localStorage.setItem('sanad_client_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Market ads live on the server so the admin can moderate them.
  const [myAds, setMyAds] = useState<ClientMarketAd[]>([]);
  const [adPricing, setAdPricing] = useState({ standardFeeSdg: 0, vipFeeSdg: 5000, currency: 'SDG' });

  const loadMarketAds = React.useCallback(async () => {
    try {
      const res = await api.getMarketAds(getOwnerToken());
      const toAd = (a: any): ClientMarketAd => ({
        id: a.id,
        title: a.title,
        category: a.category,
        priceSdg: a.priceSdg,
        location: a.location,
        timeAgo: a.createdAt ? new Date(a.createdAt).toLocaleDateString('ar-EG') : 'الآن',
        imageUrl: a.imageUrl,
        videoUrl: a.videoUrl,
        isVip: a.isVip,
        tag: a.isVip ? 'VIP' : undefined,
        phone: a.phone,
        whatsapp: a.whatsapp,
        description: a.description,
        publisherName: a.publisherName,
        createdAt: a.createdAt,
        // extra fields used by the owner panel
        ...(a.status ? { status: a.status, feeSdg: a.feeSdg, rejectionReason: a.rejectionReason } : {}),
      } as ClientMarketAd);

      setMarketAds(res.ads.map(toAd));
      setMyAds(res.mine.map(toAd));
      if (res.pricing) setAdPricing(res.pricing);
    } catch (err) {
      console.warn('[ads] تعذر تحميل إعلانات السوق:', err);
    }
  }, []);

  useEffect(() => {
    loadMarketAds();
  }, [loadMarketAds]);

  // Save Purchase Requests
  useEffect(() => {
    localStorage.setItem('sanad_purchase_requests', JSON.stringify(purchaseRequests));
  }, [purchaseRequests]);

  const handleAddToCart = (product: Product, quantity = 1, isPreOrder = false) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, isPreOrder }];
    });
    setIsCartOpen(true);
  };

  const handleToggleWishlist = (productId: string, currentPriceSdg: number) => {
    setWishlist((prev) => {
      const exists = prev.some((w) => w.productId === productId);
      if (exists) {
        return prev.filter((w) => w.productId !== productId);
      }
      return [
        ...prev,
        {
          productId,
          addedAt: new Date().toISOString(),
          originalPriceSdg: currentPriceSdg,
        },
      ];
    });
  };

  const handleNewAdCreated = () => {
    // The ad is pending review, so it is not in the public feed yet.
    // Reload so the owner panel reflects it immediately.
    loadMarketAds();
  };

  const handleDeleteMyAd = async (id: string) => {
    try {
      await api.deleteMyMarketAd(id, getOwnerToken());
      setMyAds((prev) => prev.filter((a) => a.id !== id));
      setMarketAds((prev) => prev.filter((a) => a.id !== id));
      return true;
    } catch (err) {
      console.warn('[ads] delete failed:', err);
      return false;
    }
  };

  const handleNewRequestCreated = (req: ClientPurchaseRequest) => {
    setPurchaseRequests((prev) => [req, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 pb-16">
      {/* 1. Header (Navigation & Branch Selector) */}
      <ClientHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        cartTotal={cart.reduce((sum, item) => sum + item.quantity * item.product.sellingPriceSdg, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBranch={selectedBranch}
        branches={branches}
        onSelectBranch={setSelectedBranch}
        tenant={tenant}
        wishlistCount={wishlist.length}
        loyaltyPoints={loyaltyAccount.currentPoints}
        currency="SDG"
        products={products}
      />

      {/* 2. Main Content Views */}
      <main className="flex-1">
        {/* Tab 1: Market Home (The Screenshot View) */}
        {activeTab === 'market_home' && (
          <ClientMarketHomeView
            onOpenSections={() => setIsSectionsModalOpen(true)}
            onOpenSearch={() => setIsSearchModalOpen(true)}
            onOpenAssistant={() => {
              // Trigger AI chat open via query or state
              const btn = document.querySelector('button[title*="المساعد الذكي"]') as HTMLButtonElement;
              if (btn) btn.click();
            }}
            onSelectAd={(ad) => setSelectedAdForDetail(ad)}
            onOpenCatalog={() => setActiveTab('catalog')}
            ads={marketAds}
            purchaseRequests={purchaseRequests}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        )}

        {/* Tab 2: Storefront Catalog */}
        {(activeTab === 'catalog' || activeTab === 'pre_orders') && (
          <div>
            <ClientHeroBanner
              storeName={tenant?.tradeName || tenant?.name || 'سند'}
              onExploreProducts={() => setActiveTab('catalog')}
              onExplorePreOrders={() => setActiveTab('pre_orders')}
              onTrackOrder={() => setActiveTab('track_order')}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <ClientProductCatalog
                products={products}
                branches={branches}
                selectedBranch={selectedBranch}
                onAddToCart={handleAddToCart}
                searchQuery={searchQuery}
                forcePreOrderOnly={activeTab === 'pre_orders'}
                currency="SDG"
                wishlistIds={wishlist.map((w) => w.productId)}
                onToggleWishlist={(p) => handleToggleWishlist(p.id, p.sellingPriceSdg)}
                viewedProductIds={viewedProductIds}
                onProductViewed={(id) => setViewedProductIds((prev) => Array.from(new Set([...prev, id])))}
                reviews={reviews}
                onAddReview={(newRev) => {
                  const fullReview: ProductReview = {
                    id: `rev_${Date.now()}`,
                    ...newRev,
                    createdAt: new Date().toISOString(),
                  };
                  setReviews((prev) => [fullReview, ...prev]);
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: المزادات (Auctions) */}
        {activeTab === 'auctions' && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-2 shadow-lg">
              <div className="flex items-center gap-2">
                <Gavel className="w-6 h-6 text-amber-400" />
                <h2 className="text-xl sm:text-2xl font-black">مزادات سند الحية</h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                تصفح مزادات السيارات، الأجهزة، والعقارات النشطة، وشارك في المزايدة المباشرة!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  🔴 مباشر الآن
                </span>
                <h4 className="font-bold text-sm text-slate-900">
                  مزاد سيارة تويوتا فورتشنر 2021
                </h4>
                <p className="text-xs text-slate-500">
                  أعلى سومة حالية: 52,000,000 ج.س • ينتهي بعد 3 ساعات
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs"
                >
                  تقديم مزايدة أو إضافة مزاد (+)
                </button>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  ⏳ مزاد قادم
                </span>
                <h4 className="font-bold text-sm text-slate-900">
                  مزاد أجهزة حاسوب وسيرفرات ديل
                </h4>
                <p className="text-xs text-slate-500">يبدأ السعر من 850,000 ج.س • الموقع: الخرطوم</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
                >
                  تذكير بموعد المزاد
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: الرسائل (Messages) */}
        {activeTab === 'messages' && (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">محادثاتك مع المتاجر والمعلنين</h3>
                  <p className="text-xs text-slate-500">تواصل مباشر وآمن بخصوص طلباتك وإعلاناتك</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                      سند
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-900 block">خدمة عملاء سند</strong>
                      <p className="text-[11px] text-slate-600">مرحباً بك! تم تأكيد طلبك ORD-2026-784 وجارٍ تجهيزه.</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">10:45 ص</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                      م
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-900 block">معرض الأجهزة المعتمد</strong>
                      <p className="text-[11px] text-slate-500">بخصوص استفسارك عن مكيف آيس، متاح التسليم اليوم.</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">أمس</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: المزيد (More Menu) */}
        {activeTab === 'more' && (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-4" dir="rtl">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">القائمة والخدمات الإضافية</h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('wishlist')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-right border border-slate-200 space-y-1 transition-all"
                >
                  <Heart className="w-5 h-5 text-red-500" />
                  <strong className="text-xs font-bold text-slate-900 block">قائمة الرغبات</strong>
                  <span className="text-[11px] text-slate-500">{wishlist.length} منتجات محفوظة</span>
                </button>

                <button
                  onClick={() => setActiveTab('loyalty')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-right border border-slate-200 space-y-1 transition-all"
                >
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <strong className="text-xs font-bold text-slate-900 block">نقاط ومكافآت الولاء</strong>
                  <span className="text-[11px] text-slate-500">{loyaltyAccount.currentPoints} نقطة</span>
                </button>

                <button
                  onClick={() => setActiveTab('track_order')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-right border border-slate-200 space-y-1 transition-all"
                >
                  <Truck className="w-5 h-5 text-teal-600" />
                  <strong className="text-xs font-bold text-slate-900 block">تتبع الشحنات والطلبات</strong>
                  <span className="text-[11px] text-slate-500">مسار حي برقم الطلب</span>
                </button>

                <button
                  onClick={() => setActiveTab('branches_info')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-right border border-slate-200 space-y-1 transition-all"
                >
                  <Building className="w-5 h-5 text-emerald-700" />
                  <strong className="text-xs font-bold text-slate-900 block">فروعنا ومواقعنا</strong>
                  <span className="text-[11px] text-slate-500">{branches.length} فروع في السودان</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Tab 6: Wishlist View */}
        {activeTab === 'wishlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ClientWishlistView
              wishlist={wishlist}
              products={products}
              onRemoveFromWishlist={(id) => setWishlist((prev) => prev.filter((w) => w.productId !== id))}
              onClearWishlist={() => setWishlist([])}
              onAddToCart={handleAddToCart}
              onAddAllToCart={() => {
                wishlist.forEach((w) => {
                  const p = products.find((prod) => prod.id === w.productId);
                  if (p) handleAddToCart(p, 1);
                });
              }}
              onExploreCatalog={() => setActiveTab('catalog')}
              currency="SDG"
            />
          </div>
        )}

        {/* Tab 7: Loyalty Dashboard */}
        {activeTab === 'loyalty' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ClientLoyaltyDashboard
              loyaltyAccount={loyaltyAccount}
              onRedeemVoucher={(voucher) => {
                setLoyaltyAccount((prev) => ({
                  ...prev,
                  currentPoints: prev.currentPoints - voucher.pointsCost,
                  activeVouchers: [...prev.activeVouchers, { ...voucher, isRedeemed: true }],
                }));
              }}
              onApplyVoucherToCart={(voucher) => {
                setAppliedVoucher(voucher);
                setIsCartOpen(true);
              }}
              activeAppliedVoucherId={appliedVoucher?.id}
              onExploreProducts={() => setActiveTab('catalog')}
              currency="SDG"
            />
          </div>
        )}

        {/* Tab 8: Order Tracker */}
        {activeTab === 'track_order' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ClientOrderTracker branches={branches} initialOrderNumber={trackingOrderNumber} currency="SDG" />
          </div>
        )}

        {/* Tab 9: Branches Info */}
        {activeTab === 'branches_info' && (
          <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xs space-y-2">
              <h2 className="text-2xl font-black text-slate-900">شبكة فروعنا ومواقع الاستلام</h2>
              <p className="text-xs text-slate-500">
                يمكنك زيارة أي من فروعنا المنتشرة للاستلام المباشر أو الاستفسار أو الدفع نقداً.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
                        <span className="text-[11px] text-slate-400 font-mono">{b.city}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      فرع معتمد
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{b.address || 'وسط المدينة، السوق الكبير'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                      <a href={`tel:${b.phone}`} className="font-mono text-emerald-700 font-bold hover:underline">
                        {b.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>مواعيد العمل: يومياً من 8:00 ص حتى 10:00 م</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <ClientCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={(productId, qty) => {
          setCart((prev) =>
            qty <= 0
              ? prev.filter((i) => i.product.id !== productId)
              : prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
          );
        }}
        onRemoveItem={(productId) => setCart((prev) => prev.filter((i) => i.product.id !== productId))}
        onClearCart={() => setCart([])}
        branches={branches}
        selectedBranch={selectedBranch}
        tenant={tenant}
        onOrderCompleted={(order) => {
          setTrackingOrderNumber(order.orderNumber);
          setActiveTab('track_order');
        }}
        appliedVoucher={appliedVoucher}
        onApplyVoucher={setAppliedVoucher}
        availableVouchers={loyaltyAccount.activeVouchers}
        currency="SDG"
      />

      {/* 3. Sections Bottom Sheet Modal (Screenshot 1) */}
      <ClientSectionsModal
        isOpen={isSectionsModalOpen}
        onClose={() => setIsSectionsModalOpen(false)}
        onSelectSection={(key) => {
          if (key === 'showrooms_shops') setActiveTab('catalog');
          else if (key === 'auctions') setActiveTab('auctions');
          else if (key === 'business_directory') setActiveTab('branches_info');
          else setActiveTab('catalog');
        }}
      />

      {/* 4. Center (+) Button Action Modal (Post Ad or Request from Stores) */}
      <ClientCreateAdOrRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAdCreated={handleNewAdCreated}
        onRequestCreated={handleNewRequestCreated}
        pricing={adPricing}
      />

      {/* Owner panel: ads awaiting review, with delete */}
      {myAds.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-amber-950">إعلاناتك</h3>
              <span className="text-[10px] text-amber-700">{myAds.length} إعلان</span>
            </div>
            <div className="space-y-2">
              {myAds.map((ad) => (
                <div key={ad.id} className="flex items-center gap-2 bg-white rounded-xl p-2 border border-amber-100">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{ad.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {ad.status === 'pending'
                        ? `قيد المراجعة${ad.feeSdg ? ` • رسوم ${ad.feeSdg.toLocaleString('en-US')} ج.س` : ''}`
                        : ad.status === 'rejected'
                        ? `مرفوض: ${ad.rejectionReason || 'لم يستوف الشروط'}`
                        : 'منشور'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('حذف هذا الإعلان نهائياً؟')) await handleDeleteMyAd(ad.id);
                    }}
                    className="shrink-0 p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    title="حذف الإعلان"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Ad Detail Modal with WhatsApp */}
      <ClientAdDetailModal
        ad={selectedAdForDetail}
        onClose={() => setSelectedAdForDetail(null)}
      />

      {/* 6. Intelligent Autocomplete Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs pt-16">
          <div className="w-full max-w-xl bg-white rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">البحث الذكي في المتجر والسوق</h3>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-800"
              >
                إغلاق
              </button>
            </div>
            <ClientAutocompleteSearch
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectProduct={(p) => {
                handleAddToCart(p);
                setIsSearchModalOpen(false);
              }}
              onSelectCategory={() => {
                setActiveTab('catalog');
                setIsSearchModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 7. Professional Footer with Social Media & Contact Form */}
      <ClientFooter
        setActiveTab={setActiveTab}
        wishlistCount={wishlist.length}
        loyaltyPoints={loyaltyAccount.currentPoints}
        storeName={tenant?.tradeName || tenant?.name}
      />

      {/* 8. Fixed Bottom Navigation Bar (Screenshot 2) */}
      <ClientBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
      />

      {/* 9. Floating Sudanese Dialect AI Assistant */}
      <SanadAIAssistant
        currentMode="client"
        tenantName={tenant?.tradeName || tenant?.name}
        branchName={selectedBranch?.name}
      />
    </div>
  );
};
