import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  X,
  Trash2,
  Smartphone,
  ShieldAlert,
  ShoppingBag,
  Package,
  Megaphone,
  Store,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

export type NotificationAppKey = 'client' | 'merchant' | 'admin';

interface NotificationItem {
  id: string;
  app: NotificationAppKey;
  kind: string;
  title: string;
  body: string;
  linkTab?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  app: NotificationAppKey;
  ownerToken?: string;
  /** Called when a notification is tapped — usually switches the app tab. */
  onNavigate?: (tab: string) => void;
  /** Dark chrome (admin bar) vs light chrome (headers). */
  theme?: 'light' | 'dark';
  className?: string;
}

const KIND_ICON: Record<string, React.FC<{ className?: string }>> = {
  new_ad: Megaphone,
  ad_reviewed: Megaphone,
  new_store_request: Store,
  store_request_reviewed: Store,
  new_order: ShoppingBag,
  order_status: Package,
  low_stock: ShieldAlert,
  subscription: ShieldAlert,
  system: Sparkles,
};

/** Human friendly relative time in Arabic. */
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(iso).toLocaleDateString('ar-EG');
};

/**
 * The notification bell: unread badge, in-app feed, and the entry point for
 * enabling real phone notifications (web push) on this device.
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  app,
  ownerToken,
  onNavigate,
  theme = 'light',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushState, setPushState] = useState<'unknown' | 'off' | 'on' | 'unsupported' | 'denied' | 'working'>('unknown');
  const [scanning, setScanning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications(app, ownerToken);
      setItems(res.notifications || []);
      setUnread(res.unreadCount || 0);
    } catch {
      /* offline — keep the last known list */
    }
  }, [app, ownerToken]);

  useEffect(() => {
    // Refresh automatic alerts (low stock, expiring subscriptions) then load.
    api
      .lazyScanNotifications()
      .catch(() => {})
      .finally(() => load());

    const timer = setInterval(load, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Work out the current push state for this device
  useEffect(() => {
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setPushState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? 'on' : 'off');
    };
    check().catch(() => setPushState('unsupported'));
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  };

  const enablePush = async () => {
    setPushState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        return;
      }

      const cfg = await api.getPushPublicKey();
      if (!cfg.enabled || !cfg.publicKey) {
        setPushState('unsupported');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
        }));

      await api.subscribePush(subscription.toJSON(), app, ownerToken);
      setPushState('on');
      await api.sendTestPush(app, ownerToken);
      await load();
    } catch (err) {
      console.warn('[push] enable failed:', err);
      setPushState('off');
    }
  };

  const disablePush = async () => {
    setPushState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushState('off');
    } catch {
      setPushState('on');
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      await api.scanNotifications();
      await load();
    } catch {
      /* offline */
    } finally {
      setScanning(false);
    }
  };

  const markAll = async () => {
    await api.markAllNotificationsRead(app, ownerToken).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      api.markNotificationRead(item.id).catch(() => {});
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (item.linkTab && onNavigate) {
      onNavigate(item.linkTab);
      setOpen(false);
    }
  };

  const removeItem = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    await api.deleteNotification(item.id).catch(() => {});
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    if (!item.read) setUnread((u) => Math.max(0, u - 1));
  };

  const isDark = theme === 'dark';

  return (
    <div className={`relative ${className}`} ref={wrapRef} dir="rtl">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        title="الإشعارات"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
          isDark
            ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-500 hover:bg-slate-50'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black font-mono flex items-center justify-center ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Mobile: a full sheet on top of everything (never clipped or covered).
          Desktop: the usual anchored dropdown. */}
      {open && (
        <div
          className="sm:hidden fixed inset-0 z-[75] bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          className="fixed inset-x-2 top-14 z-[80] sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-[22rem] sm:z-[70] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(78vh, 640px)' }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 text-white">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black">الإشعارات</span>
              {unread > 0 && (
                <span className="text-[10px] bg-rose-600 px-1.5 py-0.5 rounded-full font-bold">{unread} جديد</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={runScan} title="فحص التنبيهات (مخزون / اشتراكات)" className="p-1.5 rounded-lg hover:bg-white/10">
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={markAll} title="تحديد الكل كمقروء" className="p-1.5 rounded-lg hover:bg-white/10">
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Push opt-in */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
            {pushState === 'on' ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> إشعارات الهاتف مفعّلة على هذا الجهاز
                </span>
                <button onClick={disablePush} className="text-[10px] text-slate-500 hover:text-rose-600 underline">
                  إيقاف
                </button>
              </div>
            ) : pushState === 'denied' ? (
              <span className="text-[10px] text-amber-700 leading-relaxed block">
                الإشعارات ممنوعة من إعدادات المتصفح. افتح إعدادات الموقع واسمح بالإشعارات ثم أعد المحاولة.
              </span>
            ) : pushState === 'unsupported' ? (
              <span className="text-[10px] text-slate-500 block">
                هذا المتصفح لا يدعم إشعارات الهاتف — ستظهر الإشعارات داخل التطبيق فقط.
              </span>
            ) : (
              <button
                onClick={enablePush}
                disabled={pushState === 'working'}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-60"
              >
                {pushState === 'working' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                تفعيل إشعارات الهاتف
              </button>
            )}
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1" style={{ minHeight: 0 }}>
            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[11px]">لا توجد إشعارات حالياً</div>
            ) : (
              items.map((item) => {
                const Icon = KIND_ICON[item.kind] || Bell;
                return (
                  <div
                    key={item.id}
                    onClick={() => openItem(item)}
                    className={`flex gap-2.5 px-3 py-2.5 border-b border-slate-100 cursor-pointer transition-colors ${
                      item.read ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/50 hover:bg-emerald-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        item.read ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-[11px] leading-snug ${item.read ? 'font-bold text-slate-700' : 'font-black text-slate-900'}`}>
                          {item.title}
                        </p>
                        <button
                          onClick={(e) => removeItem(e, item)}
                          className="p-1 text-slate-300 hover:text-rose-600 shrink-0"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.body}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">{timeAgo(item.createdAt)}</span>
                    </div>
                    {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
