import React from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Share2,
  MapPin,
  Clock,
  Layers,
  Crown,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { ClientMarketAd } from '../types.ts';

interface ClientAdDetailModalProps {
  ad: ClientMarketAd | null;
  onClose: () => void;
}

export const ClientAdDetailModal: React.FC<ClientAdDetailModalProps> = ({ ad, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!ad) return null;

  const handleShare = () => {
    const text = `${ad.title} - ${ad.priceSdg > 0 ? ad.priceSdg.toLocaleString() + ' ج.س' : 'حسب الاتفاق'}\n${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: ad.title, text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappPhone = (ad.whatsapp || ad.phone || '249912345678').replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir="rtl"
      >
        {/* Header Media */}
        <div className="relative aspect-[16/10] w-full bg-slate-900">
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {ad.isVip && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-md">
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>إعلان مميز VIP</span>
            </div>
          )}

          <div className="absolute bottom-4 inset-x-4 space-y-1 text-right text-white">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-900/80 backdrop-blur-xs text-[11px] font-bold">
              {ad.category} • {ad.location}
            </span>
            <h3 className="text-lg sm:text-xl font-black drop-shadow-md">{ad.title}</h3>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-right">
          {/* Price Box */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 font-semibold block">السعر المطلوب:</span>
              <span className="text-xl font-black text-emerald-950 font-mono">
                {ad.priceSdg > 0 ? `${ad.priceSdg.toLocaleString()} جنيه سوداني` : 'قابل للتفاوض'}
              </span>
            </div>

            <div className="text-left font-mono text-[11px] text-emerald-700">
              <span className="block font-bold">دفع مباشر / بنكك</span>
              <span>{ad.timeAgo}</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">تفاصيل ومواصفات الإعلان:</h4>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {ad.description ||
                'معروض للبيع بحالة ممتازة وبسعر مناسب في السوق المحلي، المعاينة والتسليم فوري في المدينة المحددة، ويدعم الدفع نقداً أو تحويل بنكك بنك الخرطوم.'}
            </p>
          </div>

          {/* Publisher & Trust */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800">
                المعلن: {ad.publisherName || 'تاجر موثق في منصة سند'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">معلن معتمد</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5">
          <a
            href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
              `مرحباً، أستفسر عن إعلانك في منصة سند: ${ad.title}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>محادثة واتساب فورية</span>
          </a>

          {ad.phone && (
            <a
              href={`tel:${ad.phone}`}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>اتصال</span>
            </a>
          )}

          <button
            onClick={handleShare}
            className="p-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl transition-colors"
            title="مشاركة"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
