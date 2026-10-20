import React, { useState } from "react";
import { Star, CheckCircle, MessageSquare, ThumbsUp, Send, Award, User, Sparkles } from "lucide-react";
import type { ProductReview } from "../types.ts";

interface ClientProductReviewsProps {
  productId: string;
  productName: string;
  reviews: ProductReview[];
  onAddReview: (review: Omit<ProductReview, "id" | "createdAt">) => void;
  currency?: string;
}

export const ClientProductReviews: React.FC<ClientProductReviewsProps> = ({
  productId,
  productName,
  reviews,
  onAddReview,
  currency = "SDG",
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [comment, setComment] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter reviews for this product
  const productReviews = reviews.filter((r) => r.productId === productId);

  // Calculate average rating
  const avgRating =
    productReviews.length > 0
      ? (
          productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
        ).toFixed(1)
      : "5.0";

  // Rating distribution
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: productReviews.filter((r) => Math.round(r.rating) === stars).length,
    percentage:
      productReviews.length > 0
        ? Math.round(
            (productReviews.filter((r) => Math.round(r.rating) === stars).length /
              productReviews.length) *
              100
          )
        : stars === 5
        ? 100
        : 0,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !customerName.trim()) return;

    onAddReview({
      productId,
      customerName: customerName.trim(),
      rating,
      comment: comment.trim(),
      isVerifiedPurchase: true,
    });

    setComment("");
    setCustomerName("");
    setIsFormOpen(false);
    setSuccessMessage("شكراً لك! تم نشر تقييمك بنجاح وكسبت 20 نقطة ولاء إضافية.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200">
      {/* Header and Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>آراء وتقييمات العملاء ({productReviews.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            تجارب حقيقية من متسوقين اشتروا هذا المنتج من فروعنا
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto"
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>{isFormOpen ? "إلغاء التقييم" : "أضف تقييمك ورأيك"}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Review Form Drawer / Accordion */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <span className="font-bold text-xs text-slate-800">
              تقييم منتج: <strong className="text-emerald-700">{productName}</strong>
            </span>
            <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>+20 نقطة ولاء فورية</span>
            </div>
          </div>

          {/* Star selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              درجة تقييمك للمنتج (1 إلى 5 نجوم):
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 transition-transform hover:scale-120"
                >
                  <Star
                    className={`w-6 h-6 ${
                      (hoverRating !== null ? hoverRating >= star : rating >= star)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-mono font-black text-slate-800 mr-2">
                {rating} من 5 نجوم
              </span>
            </div>
          </div>

          {/* Customer Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              اسمك الكامل (كما يظهر للجمهور) *
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: د. إبراهيم عثمان"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Review Text */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              رأيك الصريح وتجربتك مع جودة وتغليف المنتج *
            </label>
            <textarea
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="أخبرنا عن الجودة، التوصيل، هل تنصح الآخرين بشرائه؟..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال ونشر التقييم</span>
            </button>
          </div>
        </form>
      )}

      {/* Ratings Overview Breakdown Card */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col md:flex-row items-center gap-6">
        {/* Big Average Score */}
        <div className="text-center md:border-l md:border-slate-200 md:pl-6 shrink-0 space-y-1">
          <div className="text-4xl font-black text-slate-900 font-mono">{avgRating}</div>
          <div className="flex items-center justify-center gap-0.5 text-amber-400">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  Number(avgRating) >= s ? "fill-amber-400" : "text-slate-300"
                }`}
              />
            ))}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            استناداً إلى {productReviews.length} تقييمات
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 w-full space-y-1.5 text-xs">
          {counts.map(({ stars, count, percentage }) => (
            <div key={stars} className="flex items-center gap-2">
              <span className="w-12 text-slate-600 font-medium text-[11px] flex items-center gap-1">
                <span>{stars}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-[10px] text-slate-400 font-mono text-left">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {productReviews.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Star className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">كن أول من يكتب تقييماً لهذا المنتج!</p>
            <p className="text-[11px] text-slate-400">شارك رأيك وساعد عملاءنا الكرام في اتخاذ قرار الشراء.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {productReviews.map((rev) => (
              <div key={rev.id} className="py-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {rev.customerName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{rev.customerName}</span>
                        {rev.isVerifiedPurchase && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>مشتري معتمد</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(rev.createdAt).toLocaleDateString("ar-SD")}
                      </div>
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          rev.rating >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed pr-9 font-medium">
                  "{rev.comment}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
