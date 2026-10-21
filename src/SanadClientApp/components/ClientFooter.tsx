import React, { useState } from 'react';
import {
  Send,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Download,
  Check,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';
import { SanadLogo } from '../../components/Common/SanadLogo.tsx';
import { SANAD_PHONES, SANAD_EMAILS, SANAD_SOCIALS, telHref, waHref, mailHref } from '../../lib/contact.ts';
import { usePwaInstall } from '../../lib/usePwaInstall.ts';
import type { ClientActiveTab } from '../types.ts';

interface ClientFooterProps {
  onSwitchToAdmin?: () => void;
  setActiveTab: (tab: ClientActiveTab) => void;
  wishlistCount: number;
  loyaltyPoints: number;
  storeName?: string;
}

interface SocialChannel {
  name: string;
  handle: string;
  url: string;
  color: string;
  badge: string;
  iconSvg: React.ReactNode;
}

export const ClientFooter: React.FC<ClientFooterProps> = ({
  setActiveTab,
  wishlistCount,
  loyaltyPoints,
  storeName = 'سند للتجارة ونقاط البيع الذكية',
}) => {
  const { isInstallable, promptInstall } = usePwaInstall();

  // Contact form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    type: 'inquiry',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const socialChannels: SocialChannel[] = SANAD_SOCIALS.map((s) => ({
    name: s.name,
    handle: s.handle,
    url: s.url,
    color: 'hover:text-white',
    badge: s.badge,
    iconSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
        {s.key === 'tiktok' && (
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.58c0 1.95-.54 3.93-1.67 5.51-1.15 1.6-2.86 2.72-4.78 3.14-1.92.42-3.99.16-5.75-.75-1.76-.92-3.15-2.48-3.86-4.35-.71-1.87-.66-4 .14-5.82.8-1.82 2.32-3.3 4.19-4.08 1.87-.78 4.02-.78 5.88-.01v4.16c-1.07-.48-2.31-.59-3.46-.29-1.15.3-2.14 1.05-2.73 2.08-.59 1.03-.66 2.29-.19 3.37.47 1.08 1.45 1.91 2.61 2.22 1.16.31 2.42.08 3.4-.62.98-.7 1.59-1.85 1.61-3.08V.02h.06z" />
        )}
        {s.key === 'instagram' && (
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        )}
        {s.key === 'youtube' && (
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        )}
        {s.key === 'facebook' && (
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        )}
      </svg>
    ),
  }));

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.message.trim()) {
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const generatedTicket = `SND-TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      setTicketNumber(generatedTicket);
      setIsSubmitting(false);

      // Save to localStorage inquiries
      try {
        const stored = JSON.parse(localStorage.getItem('sanad_customer_inquiries') || '[]');
        stored.push({
          ticket: generatedTicket,
          ...formData,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('sanad_customer_inquiries', JSON.stringify(stored));
      } catch (e) {
        console.warn('Storage save inquiry error:', e);
      }
    }, 600);
  };

  const handleResetForm = () => {
    setFormData({ name: '', phone: '', type: 'inquiry', message: '' });
    setTicketNumber(null);
  };

  return (
    <footer className="bg-slate-950 text-white mt-16 border-t border-slate-800">
      {/* Upper Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Column 1: Brand Info & Social Media Links (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <SanadLogo size="lg" theme="dark" variant="full" />
            </div>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-md">
              المنصة السحابية السودانية المتكاملة لنقاط البيع الذكية، التجارة الإلكترونية، وإدارة
              المخزون المتعدد. صُممت لتناسب بيئة الأعمال وتعمل بكفاءة دون إنترنت مع دعم بنكك والتحصيل
              المباشر بالعملات الأجنبية.
            </p>

            {/* Social Media Channels with official icons & direct links */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  قنوات التواصل ومجتمع سند:
                </span>
                <span className="h-px flex-1 bg-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {socialChannels.map((ch, idx) => (
                  <a
                    key={idx}
                    href={ch.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:text-white transition-all duration-200 group shadow-2xs ${ch.color}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-slate-800/80 group-hover:bg-white/20 transition-colors">
                        {ch.iconSvg}
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white group-hover:text-white">
                          {ch.name.split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono group-hover:text-white/80">
                          {ch.handle}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 group-hover:bg-white/20 group-hover:text-white font-medium">
                      {ch.badge}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Contact Line */}
            <div className="pt-2 space-y-2 text-xs text-slate-400">
              {SANAD_PHONES.map((p) => (
                <div key={p.raw} className="flex items-center gap-2 flex-wrap">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href={telHref(p.raw)} className="font-mono text-white font-bold hover:text-emerald-300" dir="ltr">
                    {p.display}
                  </a>
                  <a
                    href={waHref(p.raw)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#25D366]/15 text-[#25D366] font-bold hover:bg-[#25D366]/25"
                  >
                    واتساب
                  </a>
                  <span className="text-[10px] text-slate-500">{p.label}</span>
                </div>
              ))}
              {SANAD_EMAILS.map((e) => (
                <div key={e.address} className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                  <a href={mailHref(e.address)} className="font-mono text-white hover:text-teal-300" dir="ltr">
                    {e.address}
                  </a>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>الخرطوم · بورتسودان · أم درمان · مدني</span>
              </div>
            </div>
          </div>

          {/* Column 2: Interactive Feedback & Inquiries Contact Form (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 md:p-7 shadow-xl backdrop-blur-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-white text-base">
                    نموذج الاستفسار والملاحظات المباشر
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  أرسل ملاحظتك، استفسارك عن طلب، أو مقترحك مباشرة لخدمة العملاء دون مغادرة المتجر
                </p>
              </div>

              <span className="shrink-0 px-2.5 py-1 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 rounded-full text-[11px] font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>رد سريع</span>
              </span>
            </div>

            {ticketNumber ? (
              /* Success Confirmation Card */
              <div className="py-8 space-y-4 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-white">
                    تم استلام استفسارك بنجاح يا غالي!
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    فريق دعم منصة سند ومسؤول المتجر سيقومون بمراجعة رسالتك والتواصل معك عبر الهاتف أو
                    الواتساب في أقرب وقت.
                  </p>
                </div>

                <div className="inline-block p-3 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400">
                  <span>رقم التذكرة: </span>
                  <span className="font-bold font-mono text-white">{ticketNumber}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={`https://wa.me/249912345678?text=${encodeURIComponent(
                      `مرحباً، أرسلت استفساراً عبر نموذج المتجر برقم التذكرة ${ticketNumber} بخصوص: ${formData.message}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <span>متابعة التذكرة عبر واتساب</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    إرسال استفسار آخر
                  </button>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      الاسم الكريم <span className="text-emerald-400">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد عبد الله"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      رقم الهاتف أو الواتساب <span className="text-emerald-400">*</span>:
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="09XXXXXXXX أو 01XXXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    نوع الاستفسار أو الملاحظة:
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    <option value="inquiry">استفسار عام عن المنتجات أو الأسعار</option>
                    <option value="order_track">متابعة طلبية سابقة أو تأخير شحنة</option>
                    <option value="product_request">طلب توفير بضاعة غير متوفرة</option>
                    <option value="payment">استفسار بخصوص الدفع ببنكك أو العملات الأجنبية</option>
                    <option value="suggestion">مقترح لتطوير المتجر أو ملاحظة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    نص الرسالة أو الاستفسار <span className="text-emerald-400">*</span>:
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="اكتب تفاصيل استفسارك أو طلبك هنا..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 order-2 sm:order-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>بياناتك محمية ولن تُستخدم لغير متابعة استفسارك</span>
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 order-1 sm:order-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>جارٍ الإرسال...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 rtl:-scale-x-100" />
                        <span>إرسال الاستفسار الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Middle Navigation & Value Props */}
        <div className="pt-8 border-t border-slate-850 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-300">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6">
            <button
              onClick={() => setActiveTab('catalog')}
              className="hover:text-emerald-400 transition-colors font-medium"
            >
              كتالوج المنتجات
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('pre_orders')}
              className="hover:text-emerald-400 transition-colors font-medium"
            >
              الطلبات المسبقة
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('wishlist')}
              className="hover:text-emerald-400 transition-colors font-medium"
            >
              قائمة الرغبات ({wishlistCount})
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('loyalty')}
              className="hover:text-amber-400 transition-colors font-medium"
            >
              نقاط الولاء ({loyaltyPoints})
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('track_order')}
              className="hover:text-emerald-400 transition-colors font-medium"
            >
              تتبع الطلبات
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('branches_info')}
              className="hover:text-emerald-400 transition-colors font-medium"
            >
              فروعنا ومواقعنا
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isInstallable && (
              <button
                onClick={promptInstall}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                title="تثبيت التطبيق على الشاشة الرئيسية (PWA)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تثبيت التطبيق (PWA)</span>
              </button>
            )}

          </div>
        </div>

        {/* Bottom Rights Bar */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-right">
          <div>
            منصة سند للتجارة الذكية ونقاط البيع السحابية (Sanad POS & Commerce) © 2026. كافة الحقوق
            محفوظة.
          </div>
          <div className="text-[11px] font-mono text-slate-600 flex items-center gap-2">
            <span>تطبيق المتسوقين PWA</span>
            <span>•</span>
            <span>دعم أوفلاين وتعدد العملات</span>
            <span>•</span>
            <span className="text-emerald-500">جاهز للتشغيل</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
