import React from 'react';
import { Phone, Mail, MessageCircle, ExternalLink } from 'lucide-react';
import {
  SANAD_PHONES,
  SANAD_EMAILS,
  SANAD_SOCIALS,
  telHref,
  waHref,
  mailHref,
  type SocialChannel,
} from '../../lib/contact.ts';

const socialIcon = (key: SocialChannel['key']): React.ReactNode => {
  switch (key) {
    case 'tiktok':
      return (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.58c0 1.95-.54 3.93-1.67 5.51-1.15 1.6-2.86 2.72-4.78 3.14-1.92.42-3.99.16-5.75-.75-1.76-.92-3.15-2.48-3.86-4.35-.71-1.87-.66-4 .14-5.82.8-1.82 2.32-3.3 4.19-4.08 1.87-.78 4.02-.78 5.88-.01v4.16c-1.07-.48-2.31-.59-3.46-.29-1.15.3-2.14 1.05-2.73 2.08-.59 1.03-.66 2.29-.19 3.37.47 1.08 1.45 1.91 2.61 2.22 1.16.31 2.42.08 3.4-.62.98-.7 1.59-1.85 1.61-3.08V.02h.06z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return <MessageCircle className="w-4 h-4" />;
  }
};

interface Props {
  /** 'dark' sits on the dark-green platform chrome, 'light' on white pages. */
  variant?: 'light' | 'dark';
  /** Hide the section title (for tight layouts). */
  compact?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Reach-us block: tap-to-call, WhatsApp chat, e-mail and official social pages.
 * Used by the shopper landing page, the merchant app and the admin console.
 */
export const SanadContactSection: React.FC<Props> = ({
  variant = 'light',
  compact = false,
  title = 'تواصل معنا',
  subtitle = 'نجيك على الواتساب أو نتكلم معاك مباشرة — أي وقت.',
  className = '',
}) => {
  const dark = variant === 'dark';

  const card = dark
    ? 'bg-slate-900/80 border border-slate-700/70'
    : 'bg-white border border-slate-200';
  const heading = dark ? 'text-white' : 'text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const rowBg = dark
    ? 'bg-slate-800/70 border border-slate-700'
    : 'bg-slate-50 border border-slate-200';
  const numberText = dark ? 'text-white' : 'text-slate-900';
  const socialChip = dark
    ? 'bg-slate-800/70 border border-slate-700 hover:bg-slate-700'
    : 'bg-slate-50 border border-slate-200 hover:bg-slate-100';

  return (
    <section className={`${card} rounded-2xl p-4 sm:p-5 ${className}`} dir="rtl">
      {!compact && (
        <div className="mb-4">
          <h3 className={`text-sm sm:text-base font-black ${heading} flex items-center gap-2`}>
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            {title}
          </h3>
          <p className={`text-[11px] sm:text-xs ${muted} mt-1`}>{subtitle}</p>
        </div>
      )}

      {/* phones: call + whatsapp */}
      <div className="space-y-2">
        {SANAD_PHONES.map((p) => (
          <div
            key={p.raw}
            className={`${rowBg} rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-[13px] font-black ${numberText} font-mono`} dir="ltr">
                  {p.display}
                </p>
                <p className={`text-[10px] ${muted}`}>{p.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={telHref(p.raw)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1"
              >
                <Phone className="w-3 h-3" /> اتصال
              </a>
              <a
                href={waHref(p.raw)}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#25D366] text-white hover:bg-[#1eb85a] flex items-center gap-1"
              >
                <MessageCircle className="w-3 h-3" /> واتساب
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* emails */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {SANAD_EMAILS.map((e) => (
          <a
            key={e.address}
            href={mailHref(e.address)}
            className={`${rowBg} rounded-xl p-2.5 flex items-center gap-2 hover:border-emerald-400 transition-colors min-w-0`}
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold ${numberText} truncate`} dir="ltr">
                {e.address}
              </p>
              <p className={`text-[10px] ${muted}`}>{e.label}</p>
            </div>
          </a>
        ))}
      </div>

      {/* socials */}
      <div className="mt-3">
        {!compact && (
          <p className={`text-[11px] font-bold ${muted} mb-2`}>تابعنا على:</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SANAD_SOCIALS.map((s) => (
            <a
              key={s.key}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              title={`${s.name} — ${s.handle}`}
              className={`${socialChip} rounded-xl p-2 flex items-center gap-2 transition-colors min-w-0`}
            >
              <span className={`${s.accent} shrink-0`}>{socialIcon(s.key)}</span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-bold ${numberText} truncate`}>{s.name}</span>
                <span className={`block text-[9px] ${muted} truncate`} dir="ltr">
                  {s.handle}
                </span>
              </span>
              <ExternalLink className={`w-3 h-3 ${muted} shrink-0 ms-auto`} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SanadContactSection;
