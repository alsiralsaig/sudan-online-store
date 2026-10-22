import React, { useEffect, useState } from 'react';
import { BellRing, X, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { detectPushSupport } from '../../lib/pushSupport.ts';
import type { NotificationAppKey } from './NotificationBell.tsx';

interface PushOptInCardProps {
  app: NotificationAppKey;
  ownerToken?: string;
}

const SNOOZE_KEY = 'sanad_push_prompt_snoozed_until';
const SNOOZE_DAYS = 7;

/**
 * A single, polite opt-in card on the home screen.
 *
 * Phone notifications only arrive after the shopper allows them once — and
 * almost nobody finds that switch inside the bell menu. The card shows up
 * once, explains the benefit in one line, and stays out of the way afterwards
 * (7-day snooze when dismissed, hidden forever once enabled or when the
 * browser cannot deliver push at all).
 */
export const PushOptInCard: React.FC<PushOptInCardProps> = ({ app, ownerToken }) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const check = async () => {
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (snoozedUntil > Date.now()) return;

      const diag = detectPushSupport();
      if (diag.state !== 'ok') return; // unsupported / in-app browser / iOS install first
      if (typeof Notification === 'undefined') return;
      // 'denied' → the bell panel explains how to re-allow it in site settings.
      if (Notification.permission === 'denied') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) return; // already subscribed on this device
      setVisible(true);
    };
    check().catch(() => {});
  }, []);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('لم يتم السماح بالإشعارات — يمكنك تفعيلها لاحقاً من جرس الإشعارات.');
        setBusy(false);
        return;
      }

      const cfg = await api.getPushPublicKey();
      if (!cfg.enabled || !cfg.publicKey) {
        setError('خدمة الإشعارات غير متاحة حالياً.');
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const padding = '='.repeat((4 - (cfg.publicKey.length % 4)) % 4);
      const raw = window.atob((cfg.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const key = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);

      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));

      await api.subscribePush(subscription.toJSON(), app, ownerToken);
      setVisible(false);
    } catch (err) {
      console.warn('[push] opt-in failed:', err);
      setError('تعذّر التفعيل الآن — حاول مرة أخرى من جرس الإشعارات.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-3 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-900 text-white flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-black text-slate-900 leading-snug">
            فعّل الإشعارات على هذا الهاتف
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
            توصلك تنبيهات الأسعار والطلبات والإعلانات حتى لو التطبيق مقفول — ضغطة واحدة.
          </p>

          {error && <p className="text-[10.5px] text-amber-700 mt-1 leading-relaxed">{error}</p>}

          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={enable}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-60 active:scale-95 transition-transform"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />}
              تفعيل الآن
            </button>
            <button
              onClick={snooze}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-[11px] font-bold"
            >
              لاحقاً
            </button>
            <span className="text-[9.5px] text-slate-400 flex items-center gap-0.5 mr-auto">
              <ShieldCheck className="w-3 h-3" /> بدون رسائل مزعجة
            </span>
          </div>
        </div>

        <button
          onClick={snooze}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          title="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
