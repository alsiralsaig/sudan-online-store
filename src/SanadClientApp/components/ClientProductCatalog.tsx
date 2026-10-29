import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Sparkles,
  Info,
  Package,
  Layers,
  ArrowUpDown,
  Tag,
  Eye,
  X,
  MapPin,
  Clock,
  ShieldCheck,
  Heart,
  TrendingUp,
  ThumbsUp,
  Flame,
  Share2,
  Star,
  Copy,
} from 'lucide-react';
import type { Product, Branch } from '../../types/index.ts';
import type { ProductReview } from '../types.ts';
import { ClientProductReviews } from './ClientProductReviews.tsx';

interface ClientProductCatalogProps {
  products: Product[];
  branches: Branch[];
  selectedBranch: Branch | null;
  searchQuery: string;
  onAddToCart: (product: Product, quantity: number, isPreOrder?: boolean) => void;
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  viewedProductIds: string[];
  onProductViewed: (productId: string) => void;
  reviews?: ProductReview[];
  onAddReview?: (review: Omit<ProductReview, "id" | "createdAt">) => void;
  currency?: string;
  forcePreOrderOnly?: boolean;
}

export const ClientProductCatalog: React.FC<ClientProductCatalogProps> = ({
  products,
  branches,
  selectedBranch,
  searchQuery,
  onAddToCart,
  wishlistIds = [],
  onToggleWishlist,
  viewedProductIds = [],
  onProductViewed,
  reviews = [],
  onAddReview,
  currency = 'SDG',
  forcePreOrderOnly = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [filterMode, setFilterMode] = useState<'all' | 'in_stock' | 'pre_order'>(
    forcePreOrderOnly ? 'pre_order' : 'all'
  );
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  const getProductReviews = (prodId: string) => reviews.filter((r) => r.productId === prodId);

  const getAverageRating = (prodId: string) => {
    const rList = getProductReviews(prodId);
    if (rList.length === 0) return '5.0';
    return (rList.reduce((sum, r) => sum + r.rating, 0) / rList.length).toFixed(1);
  };

  const handleCopyProductLink = (p: Product) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}?app=client&product=${p.id}` : p.name;
    navigator.clipboard.writeText(url);
    setCopiedProductId(p.id);
    setTimeout(() => setCopiedProductId(null), 2000);
  };

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['الكل', ...Array.from(set)];
  }, [products]);

  // Complementary goods lookup dictionary
  const complementaryKeywords: Record<string, string[]> = {
    سكر: ['شاي', 'دقيق', 'زيت', 'تموين'],
    شاي: ['سكر', 'لبن', 'بسكويت'],
    دقيق: ['سكر', 'خميرة', 'زيت'],
    زيت: ['دقيق', 'سكر', 'صلصة'],
    لابتوب: ['ماوس', 'شاحن', 'هاتف', 'طاقة'],
    سيارة: ['شاحنة', 'بكاسي', 'وقود', 'إطارات'],
  };

  // Recommendation Algorithm: matches against viewed items, wishlist categories & store trends
  const recommendedItems = useMemo(() => {
    if (products.length === 0) return [];

    // Identify user's category & keyword preferences
    const viewedProducts = products.filter((p) => viewedProductIds.includes(p.id));
    const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));
    const userSample = [...viewedProducts, ...wishlistProducts];

    const categoryAffinity: Record<string, number> = {};
    userSample.forEach((p) => {
      if (p.category) {
        categoryAffinity[p.category] = (categoryAffinity[p.category] || 0) + 1;
      }
    });

    // Score all products
    const scored = products.map((prod) => {
      let score = 0;
      let reason = 'الأكثر طلباً وشعبية في المتجر';

      // Category matching score
      if (prod.category && categoryAffinity[prod.category]) {
        score += categoryAffinity[prod.category] * 35;
        reason = `بناءً على تصفحك لقسم ${prod.category}`;
      }

      // Complementary keywords matching
      for (const [kw, comps] of Object.entries(complementaryKeywords)) {
        const userInterested = userSample.some((u) => u.name.includes(kw));
        if (userInterested && comps.some((c) => prod.name.includes(c))) {
          score += 45;
          reason = `منتج مكمّل لتصفحك ومناسب للشراء معاً`;
          break;
        }
      }

      // Popularity boost for active and in-stock products
      if ((prod.currentStock ?? 10) > 0) score += 10;
      if (prod.isPreOrderAllowed || prod.allowPreOrder) score += 15;

      return { product: prod, score, reason };
    });

    // Sort by score descending and take top 4
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [products, viewedProductIds, wishlistIds]);

  // Filter & sort products for main catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery);

      if (!matchesSearch) return false;

      // Category
      if (selectedCategory !== 'الكل' && p.category !== selectedCategory) {
        return false;
      }

      // Pre-order / Stock filter
      const isPreOrderProduct = p.isPreOrderAllowed || p.allowPreOrder || (p.currentStock ?? 10) <= 0;
      if (forcePreOrderOnly && !isPreOrderProduct) {
        return false;
      }

      if (filterMode === 'in_stock' && (p.currentStock ?? 10) <= 0) {
        return false;
      }
      if (filterMode === 'pre_order' && !isPreOrderProduct) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.sellingPriceSdg - b.sellingPriceSdg;
      if (sortBy === 'price_desc') return b.sellingPriceSdg - a.sellingPriceSdg;
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return 0;
    });
  }, [products, searchQuery, selectedCategory, filterMode, sortBy, forcePreOrderOnly]);

  const handleQtyChange = (productId: string, delta: number) => {
    setQuantityMap((prev) => {
      const current = prev[productId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleAdd = (product: Product, isPreOrder?: boolean) => {
    const qty = quantityMap[product.id] || 1;
    onAddToCart(product, qty, isPreOrder);
    onProductViewed(product.id);
    setAddedAnimationId(product.id);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const handleOpenQuickView = (product: Product) => {
    setQuickViewProduct(product);
    onProductViewed(product.id);
  };

  const getProductImage = (p: Product) => {
    if (p.imageUrl) return p.imageUrl;
    const lower = p.name.toLowerCase();
    if (lower.includes('سكر') || lower.includes('كنانة')) return '/assets/images/product_sugar_kenana_1792173270044.jpg';
    if (lower.includes('دقيق') || lower.includes('سيقا')) return '/assets/images/product_sayga_flour_1792173271374.jpg';
    if (lower.includes('زيت') || lower.includes('صباح') || lower.includes('شمس')) return '/assets/images/product_cooking_oil_1792173269992.jpg';
    if (lower.includes('شاي') || lower.includes('غزالتين')) return '/assets/images/product_tea_box_1792173271153.jpg';
    if (lower.includes('لابتوب') || lower.includes('ماك')) return '/assets/images/albander_macbook_laptop_1792184108039.jpg';
    if (lower.includes('بوكس') || lower.includes('بيك اب')) return '/assets/images/albander_pickup_truck_1792184123630.jpg';
    if (lower.includes('سيارة') || lower.includes('هيونداي')) return '/assets/images/albander_hyundai_car_1792184093653.jpg';
    return '/assets/images/product_sugar_kenana_1792173270044.jpg';
  };

  return (
    <div className="space-y-8">
      {/* 🌟 'Recommended for You' Section (بناءً على التصفح وسلوك العميل) */}
      {!forcePreOrderOnly && !searchQuery && recommendedItems.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-7 border border-emerald-500/30 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 fill-slate-950" />
              </div>
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <span>موصى به لك (Recommended for You)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                    خوارزمية المطابقة الذكية
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  منتجات مقترحة خصيصاً لك بناءً على سجل مشاهداتك واهتماماتك وسلع الشراء المتكاملة
                </p>
              </div>
            </div>
          </div>

          {/* Recommended cards slider / grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {recommendedItems.map(({ product, reason }) => {
              const isWishlisted = wishlistIds.includes(product.id);
              const img = getProductImage(product);
              const isPreOrder = product.isPreOrderAllowed || product.allowPreOrder || (product.currentStock ?? 10) <= 0;

              return (
                <div
                  key={`rec-${product.id}`}
                  className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden hover:border-emerald-400/60 transition-all flex flex-col justify-between group"
                >
                  <div className="relative aspect-4/3 bg-slate-900/50 overflow-hidden">
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     referrerPolicy="no-referrer" />

                    {/* Recommendation reason tag */}
                    <div className="absolute top-2 right-2 left-2 flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/85 text-amber-300 backdrop-blur-xs border border-amber-400/30 line-clamp-1">
                        {reason}
                      </span>

                      {/* Wishlist Heart Toggle */}
                      <button
                        onClick={() => onToggleWishlist(product)}
                        className={`p-1.5 rounded-full backdrop-blur-md transition-all shrink-0 ${
                          isWishlisted
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-950/60 text-slate-300 hover:text-rose-400'
                        }`}
                        title={isWishlisted ? 'إزالة من المفضلة' : 'حفظ في قائمة الرغبات'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <div className="absolute bottom-2 right-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/90 text-slate-900">
                        {product.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs leading-snug line-clamp-1">
                        {product.name}
                      </h4>
                      <div className="text-[11px] text-slate-300 mt-1 font-mono">
                        <strong className="text-emerald-300 font-bold">
                          {product.sellingPriceSdg.toLocaleString()}
                        </strong>{' '}
                        {currency}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAdd(product, isPreOrder)}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>{isPreOrder ? 'حجز مسبق' : 'أضف للسلة'}</span>
                      </button>
                      <button
                        onClick={() => handleOpenQuickView(product)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                        title="تفاصيل"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Pills & Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        {/* Category Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 shrink-0 ml-1">التصنيفات:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter and Sort row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">عرض:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterMode === 'all' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                الكل ({products.length})
              </button>
              <button
                onClick={() => setFilterMode('in_stock')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterMode === 'in_stock' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                متوفر فوري
              </button>
              <button
                onClick={() => setFilterMode('pre_order')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                  filterMode === 'pre_order' ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>حجز مسبق</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 font-semibold focus:outline-none"
            >
              <option value="featured">المميزة والأحدث</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
              <option value="name">الاسم أبجدياً</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">لا توجد منتجات مطابقة للبحث</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            لم نتمكن من العثور على أي منتج يطابق معايير البحث المحددة. جرب تغيير كلمات البحث أو اختيار تصنيف آخر.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('الكل');
              setFilterMode('all');
            }}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((p) => {
            const isPreOrder = p.isPreOrderAllowed || p.allowPreOrder || (p.currentStock ?? 10) <= 0;
            const isAdded = addedAnimationId === p.id;
            const isWishlisted = wishlistIds.includes(p.id);
            const currentQty = quantityMap[p.id] || 1;
            const img = getProductImage(p);

            return (
              <div
                key={p.id}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                {/* Product Image Section */}
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                  <img
                    src={img}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                   referrerPolicy="no-referrer" />

                  {/* Top Overlay: Badges and Wishlist Heart Button */}
                  <div className="absolute top-2.5 right-2.5 left-2.5 flex items-start justify-between gap-1 pointer-events-none">
                    <div className="flex flex-col gap-1 items-start pointer-events-auto">
                      {isPreOrder && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>طلب مسبق</span>
                        </span>
                      )}
                      {p.category && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/90 text-slate-800 backdrop-blur-xs shadow-2xs">
                          {p.category}
                        </span>
                      )}
                    </div>

                    {/* Bookmark to Wishlist Button */}
                    <button
                      onClick={() => onToggleWishlist(p)}
                      className={`p-2 rounded-full backdrop-blur-md transition-all pointer-events-auto shadow-xs active:scale-90 ${
                        isWishlisted
                          ? 'bg-rose-500 text-white'
                          : 'bg-white/90 text-slate-600 hover:text-rose-600 hover:bg-white'
                      }`}
                      title={isWishlisted ? 'إزالة من المفضلة' : 'حفظ في قائمة الرغبات'}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Stock status indicator */}
                  <div className="absolute bottom-2.5 right-2.5">
                    {(p.currentStock ?? 10) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white backdrop-blur-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                        <span>متوفر بالمخزون</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600/90 text-white backdrop-blur-xs flex items-center gap-1">
                        <span>حجز واستلام لاحق</span>
                      </span>
                    )}
                  </div>

                  {/* Quick View Button */}
                  <button
                    onClick={() => handleOpenQuickView(p)}
                    className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-2xs"
                  >
                    <Eye className="w-4 h-4" />
                    <span>نظرة سريعة</span>
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-emerald-700 transition-colors">
                      {p.name}
                    </h3>

                    {/* Star Rating summary badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex items-center text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-800">{getAverageRating(p.id)}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({getProductReviews(p.id).length} تقييم)</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>الوحدة: <strong>{p.unit || 'قطعة'}</strong></span>
                      {p.barcode && <span>• كود: {p.barcode}</span>}
                    </div>
                  </div>

                  {/* Price & Cart Actions */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className="text-lg font-black text-slate-950 font-mono">
                          {p.sellingPriceSdg.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs font-bold text-emerald-700">{currency}</span>
                      </div>
                    </div>

                    {/* Quantity Selector + Add Button */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                        <button
                          onClick={() => handleQtyChange(p.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-xs text-slate-800">
                          {currentQty}
                        </span>
                        <button
                          onClick={() => handleQtyChange(p.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleAdd(p, isPreOrder)}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                          isAdded
                            ? 'bg-emerald-700 text-white'
                            : isPreOrder
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تمت الإضافة!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>{isPreOrder ? 'حجز مسبق' : 'أضف للسلة'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="relative aspect-video bg-slate-100">
              <img
                src={getProductImage(quickViewProduct)}
                alt={quickViewProduct.name}
                className="w-full h-full object-cover"
               referrerPolicy="no-referrer" />
              <button
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-3 left-3 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute top-3 right-3">
                <button
                  onClick={() => onToggleWishlist(quickViewProduct)}
                  className={`p-2 rounded-full shadow-md backdrop-blur-xs transition-all ${
                    wishlistIds.includes(quickViewProduct.id)
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/90 text-slate-700 hover:text-rose-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wishlistIds.includes(quickViewProduct.id) ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="absolute bottom-3 right-3">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-md">
                  {quickViewProduct.sellingPriceSdg.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-semibold text-emerald-700">{quickViewProduct.category}</span>
                <h2 className="text-xl font-black text-slate-900">{quickViewProduct.name}</h2>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                منتج عالي الجودة ومعتمد وفق أحدث المعايير. يمكنك الشراء الفوري أو الحجز المسبق واستلامه من أقرب فرع لمؤسستنا، مع إمكانية الدفع المريح عبر تطبيق بنكك فور إتمام الطلب.
              </p>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>الوحدة: <strong>{quickViewProduct.unit || 'قطعة'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>
                    الحالة:{' '}
                    <strong>
                      {(quickViewProduct.currentStock ?? 10) > 0 ? 'متوفر بالمخزن' : 'حجز مسبق متوفر'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>الفرع: {selectedBranch?.name || 'كافة الفروع'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>ضمان الأصالة والجودة</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    handleAdd(quickViewProduct, (quickViewProduct.currentStock ?? 10) <= 0);
                    setQuickViewProduct(null);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {(quickViewProduct.currentStock ?? 10) <= 0 ? 'تأكيد الحجز المسبق' : 'إضافة إلى سلة المشتريات'}
                  </span>
                </button>

                <button
                  onClick={() => onToggleWishlist(quickViewProduct)}
                  className={`p-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all ${
                    wishlistIds.includes(quickViewProduct.id)
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wishlistIds.includes(quickViewProduct.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{wishlistIds.includes(quickViewProduct.id) ? 'في المفضلة' : 'حفظ'}</span>
                </button>
              </div>

              {/* 📲 WhatsApp Share & Copy Link Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `مرحباً! أود مشاركة هذا المنتج المميز معك من منصة سند للتجارة الذكية:

*🛒 ${quickViewProduct.name}*
💰 السعر: *${quickViewProduct.sellingPriceSdg.toLocaleString()} ${currency}*
🏷️ القسم: ${quickViewProduct.category}
🏢 الفرع: ${selectedBranch?.name || 'سند'}

تسوق الآن أو احجز مسبقاً عبر منصة سند!`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                  title="مشاركة المنتج عبر واتساب مع الأصدقاء"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>مشاركة عبر واتساب</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyProductLink(quickViewProduct)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                  title="نسخ رابط المنتج"
                >
                  {copiedProductId === quickViewProduct.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
              </div>

              {/* ⭐ Customer Ratings and Reviews Component */}
              {onAddReview && (
                <ClientProductReviews
                  productId={quickViewProduct.id}
                  productName={quickViewProduct.name}
                  reviews={reviews}
                  onAddReview={onAddReview}
                  currency={currency}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
