import { useEffect, useRef } from 'react';
import { api } from './api.ts';

/**
 * Reports a banner as "seen" only when it is genuinely visible:
 *   • at least half of it inside the viewport (IntersectionObserver)
 *   • the tab is in the foreground
 *   • it stays that way for `dwellMs` (so fast swipes past don't inflate the numbers)
 * Each distinct `key` (banner + the rotation it appeared in) counts at most once,
 * so a banner is re-counted when it comes back around, but never double-counted.
 */
export const useImpressionTracker = (
  ref: React.RefObject<HTMLElement | null>,
  bannerId: string | undefined,
  options: { dwellMs?: number; once?: boolean; key?: string } = {}
) => {
  const { dwellMs = 1000, once = true } = options;
  const seen = useRef<Set<string>>(new Set());
  const slotKey = options.key || bannerId || '';

  useEffect(() => {
    const el = ref.current;
    if (!el || !bannerId) return;
    if (once && seen.current.has(slotKey)) return;

    let visible = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const arm = () => {
      clear();
      if (!visible || document.visibilityState !== 'visible') return;
      timer = setTimeout(() => {
        if (!visible || document.visibilityState !== 'visible') return;
        if (seen.current.has(slotKey)) return;
        seen.current.add(slotKey);
        api.trackMarketBannerImpressions([bannerId]).catch(() => {
          // let a later rotation retry
          seen.current.delete(slotKey);
        });
      }, dwellMs);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        visible = !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.5;
        arm();
      },
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(el);

    const onVisibility = () => arm();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clear();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ref, bannerId, slotKey, dwellMs, once]);
};

export default useImpressionTracker;
