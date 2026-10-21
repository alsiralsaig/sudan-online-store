import React, { useEffect, useState } from 'react';
import { Phone, X, ChevronUp } from 'lucide-react';
import { SANAD_PHONES, waHref, telHref } from '../../lib/contact.ts';

interface Props {
  /** Where to sit: the shopper app has a bottom navigation bar we must clear. */
  offset?: 'default' | 'above-nav';
  app?: string;
}

/**
 * Always-reachable WhatsApp button.
 * Opens a small sheet with the three official numbers so a visitor can chat
 * or call without hunting through the footer.
 */
export const SanadWhatsAppFab: React.FC<Props> = ({ offset = 'default', app = 'client' }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const bottom =
    offset === 'above-nav' ? 'bottom-24 sm:bottom-6' : 'bottom-5 sm:bottom-6';

  return (
    <div className={`fixed start-4 ${bottom} z-40 print:hidden`} dir="rtl">
      {/* sheet with the numbers */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 -z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="mb-2 w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-[#25D366] text-white">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.954-1.399C8.423 21.492 10.153 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.637 0-3.164-.477-4.46-1.298l-.32-.202-2.946.832.842-2.868-.21-.334C4.015 14.975 3.5 13.529 3.5 12c0-4.687 3.813-8.5 8.5-8.5s8.5 3.813 8.5 8.5-3.813 8.5-8.5 8.5z" />
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.297.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.179.182-.077.357.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z" />
                </svg>
                <span className="text-xs font-black">تواصل مع سند</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-white/20 rounded" aria-label="إغلاق">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2 space-y-1.5">
              {SANAD_PHONES.map((p) => (
                <div key={p.raw} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-900 font-mono" dir="ltr">
                      {p.display}
                    </p>
                    <p className="text-[9px] text-slate-500">{p.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={waHref(p.raw, `مرحباً منصة سند، عندي استفسار (${app === 'merchant' ? 'تاجر' : app === 'admin' ? 'إدارة' : 'زائر'}).`)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#25D366] text-white"
                      title="محادثة واتساب"
                    >
                      واتساب
                    </a>
                    <a
                      href={telHref(p.raw)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-white"
                      title="اتصال"
                    >
                      <Phone className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* the button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="تواصل معنا على واتساب"
        className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1eb85a] text-white rounded-full shadow-lg shadow-[#25D366]/30 w-12 h-12 sm:w-auto sm:h-auto sm:pl-3.5 sm:pr-4 sm:py-3 transition-all active:scale-95"
      >
        {open ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <svg className="w-6 h-6 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.297.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.179.182-.077.357.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z" />
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.954-1.399C8.423 21.492 10.153 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.637 0-3.164-.477-4.46-1.298l-.32-.202-2.946.832.842-2.868-.21-.334C4.015 14.975 3.5 13.529 3.5 12c0-4.687 3.813-8.5 8.5-8.5s8.5 3.813 8.5 8.5-3.813 8.5-8.5 8.5z" />
          </svg>
        )}
        <span className="hidden sm:inline text-[12px] font-black whitespace-nowrap">واتساب</span>
      </button>
    </div>
  );
};

export default SanadWhatsAppFab;
