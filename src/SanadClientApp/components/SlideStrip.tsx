import React, { useEffect, useRef, useState } from 'react';

interface SlideStripProps {
  /** Current slide index (controlled by the parent so it owns the timer). */
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  /** Height / shape classes for the whole viewport of the strip. */
  className?: string;
  /** One child per slide — each must be `w-full shrink-0 h-full`. */
  children: React.ReactNode;
  dots?: boolean;
  /** Forwarded container ref (used by the impression tracker). */
  containerRef?: React.Ref<HTMLDivElement>;
}

/**
 * Horizontal slide strip (like the reference market app).
 *
 * The slides live side by side on a single track that is translated on the X
 * axis, so switching a slide is a smooth movement instead of a fade. Works
 * with:
 *   • auto-advance (the parent changes `index`),
 *   • swipe / drag with the finger (live follow + snap),
 *   • the dots underneath,
 *   • RTL (the translation sign flips automatically).
 */
export const SlideStrip: React.FC<SlideStripProps> = ({
  index,
  count,
  onIndexChange,
  className = '',
  children,
  dots = true,
  containerRef,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // The live drag lives in a ref so even a swipe that finishes inside a single
  // frame is never lost (state batching would swallow the pointerup).
  const dragRef = useRef<{ startX: number; delta: number } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [rtl, setRtl] = useState(true);

  // RTL flips the direction: +100% shows the next slide, −100% in LTR.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setRtl(getComputedStyle(el).direction !== 'ltr');
  }, []);

  const direction = rtl ? 1 : -1;
  const width = trackRef.current?.offsetWidth || 1;
  /**
   * الحماية من مؤشر شريحة غير موجود.
   *
   * لو الإعلانات اتحدّثت والعدد قلّ (إعلان انتهى أو انسحب) والمؤشر فضل على ٣
   * مثلاً، كان الشريط يفضل مزحوم لبرّه ويظهر مكانه فراغ أبيض — والمستخدم
   * يحس إن «الشاشة انسحبت لليمين». هنا نقيّد المؤشر داخل حدود الشرائح.
   */
  const lastIndex = Math.max(count - 1, 0);
  const safeIndex = Math.min(Math.max(index, 0), lastIndex);
  const basePercent = safeIndex * 100 * direction;
  const livePercent = dragging ? basePercent - (dragDelta / width) * 100 * direction : basePercent;

  const onPointerDown = (e: React.PointerEvent) => {
    if (count < 2) return;
    dragRef.current = { startX: e.clientX, delta: 0 };
    setDragging(true);
    setDragDelta(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const raw = e.clientX - d.startX;
    /**
     * لا نسمح بسحب الشريحة خارج أول/آخر شريحة.
     *
     * لماذا: الشريط يتبع الإصبع بلا حد، فسحب لليمين من الشريحة الأولى يزيح
     * المحتوى ويكشف فراغاً — ويحسّ المستخدم أن «الشاشة بتنسحب» بدل أن يُبدّل
     * الشريحة. هنا نترك ٣٠% شدّ مطاطي كأقصى حد عند الطرفين.
     */
    const limit = width * 0.3;
    const atStart = safeIndex <= 0 && raw > 0;
    const atEnd = safeIndex >= lastIndex && raw < 0;
    d.delta = atStart || atEnd ? Math.max(-limit, Math.min(limit, raw)) : raw;
    setDragDelta(d.delta);
  };

  const finishDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDragging(false);
    setDragDelta(0);

    const threshold = Math.max(35, width * 0.12);
    if (Math.abs(d.delta) < threshold) return; // a tap, not a swipe
    const next = d.delta < 0 ? safeIndex + 1 : safeIndex - 1;
    if (next < 0) onIndexChange(count - 1);
    else if (next >= count) onIndexChange(0);
    else onIndexChange(next);
  };
  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerLeave={(e) => {
        // only finish when the pointer really left the strip
        if (dragRef.current && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
          finishDrag();
        }
      }}
      // pan-y يمنع المتصفح من سحب الصفحة أفقياً أثناء تمرير الشرائح
      style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
    >
      <div
        ref={trackRef}
        className={`flex h-full w-full ${dragging ? '' : 'transition-transform duration-[550ms] ease-out'}`}
        style={{ transform: `translateX(${livePercent}%)`, willChange: 'transform' }}
      >
        {children}
      </div>

      {dots && count > 1 && (
        <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(i);
              }}
              aria-label={`شريحة ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
