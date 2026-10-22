import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { NotificationAppKey } from './NotificationBell.tsx';

interface InAppAlertBannerProps {
  app: NotificationAppKey;
  ownerToken?: string;
  onNavigate?: (tab: string) => void;
  /** Poll interval in ms (default 45s — cheap and still feels instant). */
  intervalMs?: number;
}

interface AlertItem {
  id: string;
  title: string;
  body: string;
  linkTab?: string;
}

/**
 * Phone-style alert that drops from the top of the screen while the app is
 * open — so a new notification is never missed even when the user is on the
 * home screen and the bell is out of sight (and even on browsers where web
 * push is blocked, which is common inside Facebook/WhatsApp browsers).
 */
export const InAppAlertBanner: React.FC<InAppAlertBannerProps> = ({
  app,
  ownerToken,
  onNavigate,
  intervalMs = 45000,
}) => {
  const [queue, setQueue] = useState<AlertItem[]>([]);
  const [current, setCurrent] = useState<AlertItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const timerRef = useRef<number | null>(null);

  // First load only records what already exists — no banner storm on opening.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.getNotifications(app, ownerToken);
        if (cancelled) return;
        const list = (res.notifications || []) as AlertItem[];

        if (!primed.current) {
          list.forEach((n) => seen.current.add(n.id));
          primed.current = true;
          return;
        }

        const fresh = list.filter((n) => !seen.current.has(n.id));
        if (fresh.length === 0) return;
        fresh.forEach((n) => seen.current.add(n.id));
        setQueue((prev) => [...prev, ...fresh]);
      } catch {
        /* offline — try again on the next tick */
      }
    };

    poll();
    const id = window.setInterval(poll, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', poll);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', poll);
    };
  }, [app, ownerToken, intervalMs]);

  // Show the queue one item at a time
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    setLeaving(false);
    try {
      navigator.vibrate?.([18, 60, 18]);
    } catch {
      /* vibration is a nice-to-have */
    }
  }, [queue, current]);

  // Auto dismiss
  useEffect(() => {
    if (!current) return;
    timerRef.current = window.setTimeout(() => dismiss(), 8000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, 220);
  };

  const open = () => {
    if (!current) return;
    if (current.linkTab && onNavigate) onNavigate(current.linkTab);
    dismiss();
  };

  if (!current) return null;

  return (
    <div
      dir="rtl"
      className={`fixed inset-x-2 top-2 z-[95] mx-auto max-w-md transition-all duration-200 ${
        leaving ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl ring-1 ring-white/10 overflow-hidden">
        <div className="flex items-start gap-2.5 p-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>

          <button onClick={open} className="flex-1 min-w-0 text-right">
            <p className="text-[12.5px] font-black leading-snug line-clamp-1">{current.title}</p>
            <p className="text-[11px] text-slate-200 leading-relaxed line-clamp-2 mt-0.5">
              {current.body}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
              <CheckCircle2 className="w-3 h-3" /> اضغط للتفاصيل
            </span>
          </button>

          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 shrink-0"
            title="إغلاق"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 pb-1.5 flex items-center gap-1 text-[9.5px] text-slate-400">
          <Smartphone className="w-3 h-3" />
          <span>منصة سند — تنبيه داخل التطبيق</span>
        </div>
      </div>
    </div>
  );
};
