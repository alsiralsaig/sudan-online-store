import React from 'react';
import {
  Heart,
  ShoppingCart,
  Trash2,
  TrendingDown,
  ArrowRight,
  Package,
  Sparkles,
  Share2,
  Check,
  Clock,
  Layers,
} from 'lucide-react';
import type { Product, Branch } from '../../types/index.ts';
import type { WishlistItem } from '../types.ts';

interface ClientWishlistViewProps {
  wishlist: WishlistItem[];
  products: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onClearWishlist: () => void;
  onAddToCart: (product: Product, quantity: number, isPreOrder?: boolean) => void;
  onAddAllToCart: () => void;
  onExploreCatalog: () => void;
  currency?: string;
}

export const ClientWishlistView: React.FC<ClientWishlistViewProps> = ({
  wishlist,
  products,
  onRemoveFromWishlist,
  onClearWishlist,
  onAddToCart,
  onAddAllToCart,
  onExploreCatalog,
  currency = 'SDG',
}) => {
  // Join wishlist items with product details
  const wishlistProducts = wishlist
    .map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return null;
      const isPriceDrop = prod.sellingPriceSdg < item.originalPriceSdg;
      const priceDifference = item.originalPriceSdg - prod.sellingPriceSdg;
      return {
        item,
        product: prod,
        isPriceDrop,
        priceDifference,
      };
    })
    .filter(Boolean) as {
    item: WishlistItem;
    product: Product;
    isPriceDrop: boolean;
    priceDifference: number;
  }[];

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

  const totalValue = wishlistProducts.reduce(
    (sum, wp) => sum + wp.product.sellingPriceSdg,
    0
  );

  const priceDropCount = wishlistProducts.filter((wp) => wp.isPriceDrop).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>قائمة الرغبات والمفضلة ({wishlistProducts.length} منتجات)</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            المنتجات المحفوظة والمراقبة
          </h2>
          <p className="text-xs text-slate-500">
            تابع المنتجات التي تنوي شراءها لاحقاً وتلقَّ تنبيهات فورية عند انخفاض أسعارها أو فتح الحجز المسبق لها.
          </p>
        </div>

        {wishlistProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onAddAllToCart}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all active:scale-98"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>نقل كافة المنتجات إلى السلة</span>
            </button>

            <button
              onClick={onClearWishlist}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              مسح القائمة
            </button>
          </div>
        )}
      </div>

      {/* Price drop highlight alert if any */}
      {priceDropCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-950 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold block">
                بشرى سارة! يوجد انخفاض في أسعار {priceDropCount} من المنتجات في قائمتك
              </strong>
              <span className="text-[11px] text-emerald-800">
                انخفضت الأسعار مقارنة بوقت حفظها في قائمتك. انتهز الفرصة للشراء الآن بأفضل سعر.
              </span>
            </div>
          </div>
          <button
            onClick={onAddAllToCart}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shrink-0 transition-colors"
          >
            شراء المنتجات المخفضة
          </button>
        </div>
      )}

      {/* Empty State */}
      {wishlistProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-400 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">قائمة رغباتك فارغة حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            تصفح الكتالوج واضغط على علامة القلب ❤️ على أي منتج لحفظه في ملفك الشخصي ومراقبة عروضه وأسعاره لاحقاً.
          </p>
          <button
            onClick={onExploreCatalog}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            تصفح المنتجات الآن
          </button>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {wishlistProducts.map(({ item, product, isPriceDrop, priceDifference }) => {
            const isPreOrder = product.isPreOrderAllowed || product.allowPreOrder || (product.currentStock ?? 10) <= 0;
            const img = getProductImage(product);

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                  <img
                    src={img}
                    alt={product.name}
                    className="w-full h-full object-cover"
                   referrerPolicy="no-referrer" />

                  {/* Price drop badge */}
                  {isPriceDrop && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-sm flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>انخفض {priceDifference.toLocaleString()} {currency}!</span>
                      </span>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveFromWishlist(product.id)}
                    className="absolute top-2.5 left-2.5 p-2 rounded-full bg-white/90 text-rose-600 hover:bg-rose-50 shadow-xs transition-colors"
                    title="حذف من المفضلة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Status tag */}
                  <div className="absolute bottom-2.5 right-2.5">
                    {isPreOrder ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow-2xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>متاح للحجز المسبق</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                        متوفر للتسليم الفوري
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      {product.category}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-1">
                      الوحدة: {product.unit || 'قطعة'} · حُفظ بتاريخ:{' '}
                      {new Date(item.addedAt).toLocaleDateString('ar-SD')}
                    </div>
                  </div>

                  {/* Price section */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className="text-lg font-black text-slate-950 font-mono">
                          {product.sellingPriceSdg.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs font-bold text-emerald-700">{currency}</span>
                      </div>
                      {isPriceDrop && (
                        <div className="text-right">
                          <span className="text-xs text-slate-400 line-through font-mono">
                            {item.originalPriceSdg.toLocaleString()} {currency}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onAddToCart(product, 1, isPreOrder);
                          onRemoveFromWishlist(product.id);
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{isPreOrder ? 'حجز مسبق وسلة' : 'نقل إلى السلة'}</span>
                      </button>

                      <button
                        onClick={() => onRemoveFromWishlist(product.id)}
                        className="p-2 border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition-colors"
                        title="إزالة من القائمة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
