import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Share2,
  Eye,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Car,
  Home,
  Smartphone,
  Wheat,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  X,
  CreditCard,
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
  Clock,
  Layers,
  Send,
} from 'lucide-react';
import type { AlbandarListing, AlbandarShowroom, Product, Tenant, Branch } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface AlbandarMarketViewProps {
  tenant: Tenant | null;
  products: Product[];
  currentBranch: Branch | null;
  onNavigateToPOS?: () => void;
  onRefreshProducts?: () => void;
}

const SUDANESE_CITIES = [
  'الكل',
  'بورتسودان',
  'القضارف',
  'عطبرة',
  'شندي',
  'كسلا',
  'الخرطوم',
  'أم درمان',
  'بحري',
  'ود مدني',
  'كوستي',
  'مروي',
  'دنقلا',
  'الأبيض',
  'الفاشر',
];

const MAIN_CATEGORIES = [
  { id: 'all', name: 'كافة الأقسام', icon: Layers },
  { id: 'cars', name: 'سيارات ومركبات', icon: Car },
  { id: 'real_estate', name: 'عقارات وأراضي', icon: Home },
  { id: 'electronics', name: 'هواتف وإلكترونيات', icon: Smartphone },
  { id: 'livestock_crops', name: 'محاصيل وثروة حيوانية', icon: Wheat },
  { id: 'groceries', name: 'سلع ومواد تموينية', icon: ShoppingBag },
  { id: 'fashion', name: 'أزياء وثياب سودانية', icon: Tag },
  { id: 'services', name: 'خدمات وأعمال', icon: Building2 },
];

export const AlbandarMarketView: React.FC<AlbandarMarketViewProps> = ({
  tenant,
  products,
  currentBranch,
  onNavigateToPOS,
  onRefreshProducts,
}) => {
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'listings' | 'showrooms'>('listings');

  // Listings state
  const [listings, setListings] = useState<AlbandarListing[]>([]);
  const [showrooms, setShowrooms] = useState<AlbandarShowroom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');

  // Selected Listing Modal (Details & Purchase)
  const [selectedListing, setSelectedListing] = useState<AlbandarListing | null>(null);
  const [copiedBankak, setCopiedBankak] = useState<boolean>(false);
  const [bankakSlipTxn, setBankakSlipTxn] = useState<string>('');
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  // Post Ad Modal State
  const [isPostAdModalOpen, setIsPostAdModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('cars');
  const [newPriceSdg, setNewPriceSdg] = useState('');
  const [newCity, setNewCity] = useState('بورتسودان');
  const [newCondition, setNewCondition] = useState('جديد');
  const [newPhone, setNewPhone] = useState(tenant?.phone || '+249912300000');
  const [newWhatsapp, setNewWhatsapp] = useState(tenant?.phone || '+249912300000');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newLocationDetails, setNewLocationDetails] = useState('');
  const [newBankak, setNewBankak] = useState(tenant?.settings.bankakAccount || '');
  const [isSubmittingAd, setIsSubmittingAd] = useState(false);

  // Merchant Fast-Publish Modal
  const [isPublishProductModalOpen, setIsPublishProductModalOpen] = useState(false);
  const [selectedProductIdToPublish, setSelectedProductIdToPublish] = useState(products[0]?.id || '');
  const [publishCategory, setPublishCategory] = useState('groceries');
  const [isPublishing, setIsPublishing] = useState(false);

  // Load marketplace data
  const loadMarketplaceData = async () => {
    try {
      setLoading(true);
      const [listingsRes, showroomsRes] = await Promise.all([
        api.getAlbandarListings({
          category: selectedCategory,
          city: selectedCity,
          search: searchQuery,
          condition: selectedCondition,
        }),
        api.getAlbandarShowrooms(),
      ]);

      setListings(listingsRes.listings);
      setShowrooms(showroomsRes.showrooms);
    } catch (err) {
      console.warn('Failed to load Albandar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [selectedCategory, selectedCity, selectedCondition]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMarketplaceData();
  };

  // Open details and count view
  const handleOpenListingDetails = (item: AlbandarListing) => {
    setSelectedListing(item);
    api.incrementListingView(item.id);
  };

  // Generate WhatsApp Direct Link
  const getWhatsAppLink = (item: AlbandarListing) => {
    const cleanPhone = item.sellerWhatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(
      `السلام عليكم ورحمة الله، استفسار بخصوص إعلانك في سوق البندر: «${item.title}» المعروض بسعر ${item.priceSdg.toLocaleString()} ج.س في مدينة ${item.city}. هل ما زال العرض متاحاً للمعاينة؟`
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  // Copy Bankak account
  const handleCopyBankak = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedBankak(true);
    setTimeout(() => setCopiedBankak(false), 2500);
  };

  // Submit Ad
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPriceSdg || !newPhone) {
      alert('يرجى ملء الحقول الأساسية: عنوان الإعلان، السعر، ورقم الهاتف');
      return;
    }

    try {
      setIsSubmittingAd(true);
      const res = await api.createAlbandarListing({
        title: newTitle,
        category: newCategory as any,
        priceSdg: Number(newPriceSdg),
        city: newCity,
        condition: newCondition,
        sellerPhone: newPhone,
        sellerWhatsapp: newWhatsapp || newPhone,
        description: newDescription,
        imageUrl: newImageUrl || undefined,
        locationDetails: newLocationDetails,
        bankakAccount: newBankak,
        sellerName: tenant?.tradeName || tenant?.name || 'معلن في البندر',
        sellerType: tenant ? 'merchant' : 'individual',
      });

      if (res.success) {
        setIsPostAdModalOpen(false);
        // Reset form
        setNewTitle('');
        setNewPriceSdg('');
        setNewDescription('');
        setNewImageUrl('');
        loadMarketplaceData();
        alert('تم نشر إعلانك بنجاح في سوق البندر!');
      }
    } catch (err: any) {
      alert(err.message || 'فشل نشر الإعلان');
    } finally {
      setIsSubmittingAd(false);
    }
  };

  // Merchant publish product
  const handlePublishProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductIdToPublish) return;

    try {
      setIsPublishing(true);
      const res = await api.publishProductToAlbandar(
        selectedProductIdToPublish,
        publishCategory,
        'جديد أصلي',
        currentBranch?.name || tenant?.address
      );

      if (res.success) {
        setIsPublishProductModalOpen(false);
        loadMarketplaceData();
        if (onRefreshProducts) onRefreshProducts();
        alert(`تم نشر المنتج بنجاح في سوق البندر بمعرض متجرك «${tenant?.tradeName || tenant?.name}»!`);
      }
    } catch (err: any) {
      alert(err.message || 'فشل نشر المنتج إلى سوق البندر');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      {/* Al-Bandar Header Hero Banner */}
      <div className="bg-gradient-to-l from-emerald-950 via-slate-900 to-slate-900 text-white border-b border-emerald-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>السوق السوداني المفتوح</span>
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-300">بدون عمولة أو وسيط</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <span>سوق البندر التجاري</span>
                <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  AL-BANDAR
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                المنصة السودانية الرائدة لبيع وشراء السيارات، العقارات، الأجهزة، المحاصيل، والسلع التموينية مع معارض المحلات الموثقة وتواصل مباشر عبر واتساب والدفع عبر بنكك وفوري.
              </p>

              {/* City Quick Pills / Indicators */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>المدن النشطة:</span>
                </span>
                <span>بورتسودان</span>
                <span>·</span>
                <span>القضارف</span>
                <span>·</span>
                <span>عطبرة</span>
                <span>·</span>
                <span>كسلا</span>
                <span>·</span>
                <span>شندي</span>
                <span>·</span>
                <span>الخرطوم</span>
                <span>·</span>
                <span>ود مدني</span>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Post Ad Button */}
              <button
                onClick={() => setIsPostAdModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>أضف إعلانك في البندر</span>
              </button>

              {/* Merchant Publish Button if merchant logged in */}
              {tenant && (
                <button
                  onClick={() => setIsPublishProductModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>نشر صنف من متجري</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن سيارة، شقة للإيجار، ماك بوك، سمسم القضارف، سكر كنانة، أو رقم هاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* City Selector */}
            <div className="w-full sm:w-44 shrink-0">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                aria-label="اختر المدينة السودانية"
                className="w-full py-2.5 px-3 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SUDANESE_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'الكل' ? '📍 كل المدن السودانية' : `📍 ${c}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
              بحث في البندر
            </button>
          </form>

          {/* Main SubTab Switcher (Listings vs Showrooms) */}
          <div className="flex items-center gap-2 mt-6 border-b border-slate-800 pt-1 text-xs sm:text-sm">
            <button
              onClick={() => setActiveSubTab('listings')}
              className={`pb-3 font-bold transition-colors relative flex items-center gap-2 ${
                activeSubTab === 'listings'
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>إعلانات وعروض السوق ({listings.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('showrooms')}
              className={`pb-3 font-bold transition-colors relative flex items-center gap-2 mr-6 ${
                activeSubTab === 'showrooms'
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>دليل معارض ومحلات البندر ({showrooms.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeSubTab === 'listings' ? (
          <>
            {/* Category Segmented Filter Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                {MAIN_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Secondary Filter Line (Condition and City indicator) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>حالة المعروض:</span>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    aria-label="تصفية حسب حالة السلعة"
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none"
                  >
                    <option value="all">كافة الحالات</option>
                    <option value="جديد">جديد بالكرتونة</option>
                    <option value="مستعمل بحالة ممتازة">مستعمل بحالة ممتازة</option>
                    <option value="وارد دبي">وارد دبي والخليج</option>
                    <option value="إنتاج محلي نخب أول">إنتاج محلي نخب أول</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span>
                    النتائج المعروضة:{' '}
                    <strong className="text-slate-800 font-mono">{listings.length}</strong> إعلان
                  </span>
                  {selectedCity !== 'الكل' && (
                    <button
                      onClick={() => setSelectedCity('الكل')}
                      className="text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>إلغاء فلتر ({selectedCity})</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Merchant Promotion Banner for Sync with POS */}
            {tenant && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-right">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                      أنت مسجل كتاجر معتمد: «{tenant.tradeName || tenant.name}»
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      يمكنك نشر أصنافك من المخزون إلى سوق البندر بنقرة واحدة، لتصل إلى آلاف الزبائن في السودان مباشرة!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsPublishProductModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    نشر صنف جديد للجمهور
                  </button>
                  {onNavigateToPOS && (
                    <button
                      onClick={onNavigateToPOS}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      العودة لكاشير POS
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Listings Grid */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs">جاري تحميل إعلانات سوق البندر...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                <h2 className="text-sm font-bold text-slate-700">لا توجد إعلانات مطابقة في هذا التصنيف حالياً</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  جرب تغيير التصنيف أو تصفح مدينة أخرى، أو كن أول من يضيف إعلاناً في هذا القسم!
                </p>
                <button
                  onClick={() => setIsPostAdModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700"
                >
                  أضف إعلانك الآن مجاناً
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {listings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Image Thumbnail with Overlay Tags */}
                      <div
                        onClick={() => handleOpenListingDetails(item)}
                        className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden cursor-pointer"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Top Overlay Badges */}
                        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                          <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{item.city}</span>
                          </span>

                          {item.isVerifiedMerchant && (
                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xs">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>معرض موثق</span>
                            </span>
                          )}
                        </div>

                        {/* Bottom Overlay Badge */}
                        <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-sans px-2 py-0.5 rounded">
                          {item.condition}
                        </span>
                      </div>

                      {/* Content Card Info */}
                      <div className="p-3.5 space-y-2">
                        {/* Category & Views */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-emerald-700">{item.categoryNameAr}</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Eye className="w-3 h-3 text-slate-400" />
                            <span>{item.viewsCount} مشاهدة</span>
                          </span>
                        </div>

                        {/* Title */}
                        <h2
                          onClick={() => handleOpenListingDetails(item)}
                          className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-emerald-700 transition-colors"
                        >
                          {item.title}
                        </h2>

                        {/* Seller Name */}
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.sellerName}</span>
                        </p>

                        {/* Price Display */}
                        <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                          <div>
                            <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
                              {item.priceSdg.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-emerald-700 mr-1">ج.س</span>
                          </div>

                          {item.priceUsd && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              ~${item.priceUsd.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Footers: WhatsApp + Call + Details */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-3 gap-1.5">
                      {/* WhatsApp Button */}
                      <a
                        href={getWhatsAppLink(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                        title="تواصل فوري عبر واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </a>

                      {/* Phone Call Button */}
                      <a
                        href={`tel:${item.sellerPhone}`}
                        className="flex items-center justify-center gap-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                        title="اتصال مباشر بالبائع"
                      >
                        <Phone className="w-3 h-3" />
                        <span>اتصال</span>
                      </a>

                      {/* Details & Buy Modal Button */}
                      <button
                        onClick={() => handleOpenListingDetails(item)}
                        className="py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        معاينة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* SHOWROOMS & STORES DIRECTORY (معارض ومحلات البندر) */
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span>دليل معارض ومحلات البندر الموثقة في السودان</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                تصفح المحلات التجارية والشركات المسجلة في بورتسودان، عطبرة، القضارف، وكسلا، مع إمكانية التواصل المباشر مع مدراء المعارض والطلب بالهاتف أو واتساب.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {showrooms.map((shw) => (
                <div
                  key={shw.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        <img
                          src={shw.logo}
                          alt={shw.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{shw.name}</h3>
                          {shw.verified && (
                            <span title="معرض موثق رسمياً">
                              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-700 font-medium">{shw.tradeName}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>
                            {shw.city} · {shw.address}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {shw.bio}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                      <span>
                        المعروضات النشطة: <strong className="text-slate-800">{shw.listingsCount}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        التقييم: <strong className="text-amber-600">★ {shw.rating}</strong>
                      </span>
                      {shw.bankakAccount && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700">بنكك: {shw.bankakAccount}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <a
                      href={`https://wa.me/${shw.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `السلام عليكم، استفسار من خلال دليل معارض سوق البندر عن خدمات ومعروضات: ${shw.name}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>محادثة واتساب</span>
                    </a>

                    <a
                      href={`tel:${shw.phone}`}
                      className="flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>اتصال بالمعرض</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: LISTING DETAILS & DIRECT BUY (تفاصيل الإعلان) */}
      {/* ======================================================== */}
      {selectedListing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">تفاصيل الإعلان في سوق البندر</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-emerald-700 font-semibold">{selectedListing.categoryNameAr}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedListing(null);
                  setPaymentSuccessNotice(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Product Hero Image */}
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 relative">
                <img
                  src={selectedListing.imageUrl}
                  alt={selectedListing.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-3 py-1 rounded-lg">
                  📍 {selectedListing.city} - {selectedListing.locationDetails || 'وسط السوق'}
                </span>
              </div>

              {/* Title & Price */}
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {selectedListing.title}
                </h3>
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="text-2xl font-black text-emerald-700 font-mono">
                    {selectedListing.priceSdg.toLocaleString()} ج.س
                  </span>
                  {selectedListing.priceUsd && (
                    <span className="text-sm font-bold text-slate-500 font-mono">
                      (ما يعادل ${selectedListing.priceUsd.toLocaleString()} دولار)
                    </span>
                  )}
                </div>
              </div>

              {/* Specifications & Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">المدينة</span>
                  <span className="font-bold text-slate-800">{selectedListing.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الحالة</span>
                  <span className="font-bold text-slate-800">{selectedListing.condition}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">القسم</span>
                  <span className="font-bold text-slate-800">{selectedListing.categoryNameAr}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المشاهدات</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedListing.viewsCount}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900">وصف الإعلان والتفاصيل:</h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {selectedListing.description}
                </p>
              </div>

              {/* Seller Information Card */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    {selectedListing.sellerName.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">{selectedListing.sellerName}</span>
                      {selectedListing.isVerifiedMerchant && (
                        <span title="تاجر موثق">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{selectedListing.sellerPhone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={getWhatsAppLink(selectedListing)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>محادثة واتساب</span>
                  </a>

                  <a
                    href={`tel:${selectedListing.sellerPhone}`}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال</span>
                  </a>
                </div>
              </div>

              {/* Sudanese Payment Option: Bankak & Fawry Box */}
              {selectedListing.bankakAccount && (
                <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">
                        الدفع المباشر عبر تطبيق بنكك (بنك الخرطوم)
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      حساب معتمد
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">رقم الحساب للتحويل:</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-slate-900 tracking-wider">
                        {selectedListing.bankakAccount}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyBankak(selectedListing.bankakAccount || '')}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      {copiedBankak ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>نسخ الحساب</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Submit Bankak Txn Ref */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      هل قمت بالتحويل؟ أدخل رقم المعاملة (Txn Ref) لتأكيد الحجز:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="مثال: BNK-2026-987654"
                        value={bankakSlipTxn}
                        onChange={(e) => setBankakSlipTxn(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                      <button
                        onClick={() => {
                          if (!bankakSlipTxn.trim()) {
                            alert('يرجى إدخال رقم المعاملة');
                            return;
                          }
                          setPaymentSuccessNotice(
                            `تم تسجيل إشعار التحويل (${bankakSlipTxn}) بنجاح! تم إبلاغ البائع «${selectedListing.sellerName}» بحجز المعروض.`
                          );
                          setBankakSlipTxn('');
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        إرسال الإشعار
                      </button>
                    </div>

                    {paymentSuccessNotice && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{paymentSuccessNotice}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">كود الإعلان: #{selectedListing.id}</span>
              <button
                onClick={() => {
                  setSelectedListing(null);
                  setPaymentSuccessNotice(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: POST AD IN AL-BANDAR (أضف إعلانك في البندر) */}
      {/* ======================================================== */}
      {isPostAdModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900">نشر إعلان جديد في سوق البندر</h3>
              </div>
              <button
                onClick={() => setIsPostAdModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAd} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">عنوان الإعلان *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تويوتا كورولا 2021 خالية من الملاحظات / شقة مفروشة بورتسودان..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">القسم الرئيسي *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  >
                    <option value="cars">🚗 سيارات ومركبات</option>
                    <option value="real_estate">🏠 عقارات وأراضي</option>
                    <option value="electronics">📱 هواتف وإلكترونيات</option>
                    <option value="livestock_crops">🌾 محاصيل وثروة حيوانية</option>
                    <option value="groceries">🛒 سلع ومواد تموينية</option>
                    <option value="fashion">👗 أزياء وثياب سودانية</option>
                    <option value="services">🛠️ خدمات وأعمال</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">المدينة / الولاية *</label>
                  <select
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  >
                    {SUDANESE_CITIES.filter((c) => c !== 'الكل').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">السعر بالجنيه السوداني (SDG) *</label>
                  <input
                    type="number"
                    required
                    placeholder="مثال: 15000000"
                    value={newPriceSdg}
                    onChange={(e) => setNewPriceSdg(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">حالة السلعة</label>
                  <select
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  >
                    <option value="جديد">جديد بالكرتونة</option>
                    <option value="مستعمل بحالة ممتازة">مستعمل بحالة ممتازة</option>
                    <option value="وارد دبي">وارد دبي والخليج</option>
                    <option value="إنتاج محلي نخب أول">إنتاج محلي نخب أول</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">رقم الهاتف للاتصال (+249) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+249912345678"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">رقم الواتساب (+249)</label>
                  <input
                    type="text"
                    placeholder="+249912345678"
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">رابط صورة المعروض (أو اختر من النماذج)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-mono"
                />
                <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                  <span className="text-slate-400">نماذج سريعة:</span>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('/src/assets/images/albander_hyundai_car_1792184093653.jpg')}
                    className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded hover:bg-emerald-100"
                  >
                    سيارة هيونداي
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('/src/assets/images/albander_pickup_truck_1792184123630.jpg')}
                    className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded hover:bg-emerald-100"
                  >
                    بوكس تايوتا
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('/src/assets/images/albander_macbook_laptop_1792184108039.jpg')}
                    className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded hover:bg-emerald-100"
                  >
                    لابتوب ماك بوك
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('/src/assets/images/product_sugar_kenana_1792173270044.jpg')}
                    className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded hover:bg-emerald-100"
                  >
                    سكر كنانة
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">وصف الإعلان والمواصفات</label>
                <textarea
                  rows={3}
                  placeholder="أذكر كافة التفاصيل، الموقع بالتحديد، طريقة التسليم، والملاحظات..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">رقم حساب بنكك (اختياري للاستلام الفوري)</label>
                <input
                  type="text"
                  placeholder="مثال: 1982736"
                  value={newBankak}
                  onChange={(e) => setNewBankak(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostAdModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAd}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isSubmittingAd ? 'جاري النشر...' : 'نشر الإعلان في سوق البندر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: MERCHANT FAST-PUBLISH FROM POS / INVENTORY */}
      {/* ======================================================== */}
      {isPublishProductModalOpen && tenant && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  نشر منتج من مخزون متجرك إلى سوق البندر
                </h3>
              </div>
              <button
                onClick={() => setIsPublishProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishProduct} className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-slate-700 leading-relaxed">
                سيتم نشر المنتج كـ <strong className="text-emerald-800">«معروض من متجر موثق»</strong> باسم{' '}
                <strong>{tenant.tradeName || tenant.name}</strong>، وستصلك استفسارات الزبائن مباشرة على هاتفك والواتساب.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">اختر المنتج من مخزونك *</label>
                <select
                  value={selectedProductIdToPublish}
                  onChange={(e) => setSelectedProductIdToPublish(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-semibold text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.sellingPriceSdg.toLocaleString()} ج.س ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">القسم في سوق البندر</label>
                <select
                  value={publishCategory}
                  onChange={(e) => setPublishCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                >
                  <option value="groceries">🛒 سلع ومواد تموينية</option>
                  <option value="electronics">📱 هواتف وإلكترونيات</option>
                  <option value="cars">🚗 سيارات وقطع غيار</option>
                  <option value="livestock_crops">🌾 محاصيل وثروة حيوانية</option>
                  <option value="fashion">👗 أزياء وثياب سودانية</option>
                  <option value="furniture_home">🛋️ أثاث ومنزليات</option>
                  <option value="services">🛠️ خدمات وتوصيل</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1 font-mono">
                <div>المدينة: {tenant.city}</div>
                <div>رقم التواصل المسجل: {tenant.phone}</div>
                <div>حساب بنكك المسجل: {tenant.settings.bankakAccount || '1982736'}</div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPublishProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isPublishing ? 'جاري النشر...' : 'نشر الآن في سوق البندر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
