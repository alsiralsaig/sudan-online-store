import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  /** لو ما اتمرّر، الصفحة تتعيد تحميل وتفحص نسخة جديدة من سند */
  onRefresh?: () => Promise<void> | void;
  theme?: 'dark' | 'light';
}

const THRESHOLD = 68;
const MAX_PULL = 112;

function isScrollable(el: HTMLElement) {
  const s = window.getComputedStyle(el);
  const oy = s.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight + 2;
}

/** الصفحة أو الحاوية اللي بتتمرّر وصلت رأسها؟ */
function isAtTop(target: EventTarget | null) {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (isScrollable(el)) return el.scrollTop <= 1;
    el = el.parentElement;
  }
  const root = document.scrollingElement || document.documentElement;
  return (root.scrollTop || window.scrollY || 0) <= 1;
}

function shouldIgnore(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-ptr]')) {
    return true;
  }
  if (target.closest('[role="dialog"], [aria-modal="true"]')) return true;
  return false;
}

async function reloadApp() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
      for (const r of regs) {
        if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      await new Promise((ok) => setTimeout(ok, 280));
    }
  } catch {
    /* أوفلاين — نعيد تحميل الكاش */
  }
  window.location.reload();
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  theme = 'dark',
}) => {
  const startY = useRef(0);
  const startX = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(THRESHOLD);
    try {
      await (onRefresh ? onRefresh() : reloadApp());
    } finally {
      setRefreshing(false);
      setOffset(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      const t = e.touches[0];
      if (!t) return;
      if (shouldIgnore(e.target)) {
        armed.current = false;
        return;
      }
      startY.current = t.clientY;
      startX.current = t.clientX;
      armed.current = isAtTop(e.target);
      pulling.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed.current || refreshing) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;
      if (!pulling.current) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
          armed.current = false;
          return;
        }
        if (dy < 8) return;
        if (!isAtTop(e.target)) {
          armed.current = false;
          return;
        }
        pulling.current = true;
      }
      if (dy <= 0) {
        setOffset(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      const damp = Math.min(MAX_PULL, dy * 0.42);
      setOffset(damp);
    };

    const onEnd = () => {
      if (!pulling.current) {
        armed.current = false;
        return;
      }
      pulling.current = false;
      armed.current = false;
      setOffset((cur) => {
        if (cur >= THRESHOLD) {
          void runRefresh();
          return THRESHOLD;
        }
        return 0;
      });
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refreshing, runRefresh]);

  const dark = theme === 'dark';
  const ready = offset >= THRESHOLD;
  const visible = offset > 6 || refreshing;

  return (
    <>
      <div
        aria-hidden={!visible}
        className={`pointer-events-none fixed left-1/2 z-[90] -translate-x-1/2 transition-opacity ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ top: Math.max(10, Math.min(offset, MAX_PULL) * 0.35) }}
      >
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black shadow-lg ${
            dark
              ? 'bg-slate-800 text-white border border-slate-400'
              : 'bg-white text-slate-900 border border-slate-300'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
            style={!refreshing ? { transform: `rotate(${offset * 2.4}deg)` } : undefined}
          />
          <span>
            {refreshing ? 'جاري التحديث…' : ready ? 'أفلت للتحديث' : 'اسحب للتحديث'}
          </span>
        </div>
      </div>
      {children}
    </>
  );
};
