import { useCallback, useEffect, useRef } from 'react';

/**
 * سجل تنقّل داخل التطبيق يقرأه زر الرجوع في التلفون.
 * ---------------------------------------------------------------------
 * المشكلة: الشاشات (تبويب / متجر / تفاصيل إعلان / نافذة) كانت حالة React
 * فقط، فزر الرجوع لا يجد صفحة في سجل الـWebView فيطلب «اضغط رجوع تاني
 * للخروج» رغم أن المستخدم داخل متجر بعيد.
 *
 * لماذا hash وليس pushState؟
 *   تغيير `location.hash` يُنشئ **خطوة تنقّل حقيقية** في سجل الـWebView،
 *   فيصبح `web.canGoBack()` صحيحاً في كل إصدارات أندرويد (بما فيها الأغلفة
 *   القديمة التي لا تتعامل مع pushState). أما pushState فقد لا تُحتسب
 *   في بعض إصدارات WebView.
 *
 * الصيغة:  #s=<JSON مشفّر>   مثال: #s=%7B%22page%22%3A%22store%22%7D
 */

export interface AppHistoryState {
  /** الشاشة: market_home | market_browse | store | ad | cart | sections | search | <tab> */
  page: string;
  /** معرّف إضافي (slug المتجر أو معرّف الإعلان) */
  id?: string;
  /** التبويب النشط وقت الدخول */
  tab?: string;
}

const HASH_PREFIX = '#s=';

function parseHash(hash: string): AppHistoryState | null {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null;
  try {
    const raw = decodeURIComponent(hash.slice(HASH_PREFIX.length));
    const parsed = JSON.parse(raw) as AppHistoryState;
    if (parsed && typeof parsed.page === 'string') return parsed;
  } catch {
    /* hash تالف — نتجاهله */
  }
  return null;
}

function encodeState(state: AppHistoryState): string {
  return HASH_PREFIX + encodeURIComponent(JSON.stringify(state));
}

function sameState(a: AppHistoryState | null, b: AppHistoryState | null): boolean {
  if (!a || !b) return a === b;
  return a.page === b.page && (a.id || '') === (b.id || '');
}

export function useAppHistory(
  /** يُستدعى بالحالة المطلوب الرجوع إليها */
  onRestore: (state: AppHistoryState) => void,
  /** حالة الشاشة الحالية */
  current: AppHistoryState,
) {
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const currentRef = useRef(current);
  currentRef.current = current;
  /** الحالة التي دفعناها بأنفسنا — لا نُعيد تطبيقها عند وصول حدث الرجوع */
  const selfPushed = useRef<AppHistoryState | null>(null);
  const booted = useRef(false);

  /** تحديث الحالة الحالية بدون إضافة خطوة (لتصحيح الوصف فقط) */
  const replace = useCallback((state: AppHistoryState) => {
    try {
      window.history.replaceState(window.history.state, '', encodeState(state));
      selfPushed.current = state;
    } catch {
      /* تجاهل */
    }
  }, []);

  /** الانتقال لشاشة جديدة: خطوة حقيقية في سجل التلفون */
  const push = useCallback((state: AppHistoryState) => {
    if (sameState(currentRef.current, state)) return;
    selfPushed.current = state;
    try {
      window.location.hash = encodeState(state).slice(1); // بدون # المكررة
    } catch {
      /* تجاهل */
    }
  }, []);

  useEffect(() => {
    const handle = () => {
      const target = parseHash(window.location.hash);
      // إذا كان هذا الحدث ناتجاً عن دفعنا نحن، لا نُعيد التطبيق
      if (sameState(target, selfPushed.current)) {
        selfPushed.current = null;
        return;
      }
      selfPushed.current = null;
      if (!target) {
        // رجعنا إلى ما قبل أول خطوة ⇒ الصفحة الرئيسية
        restoreRef.current({ page: 'market_home', tab: 'market_home' });
        return;
      }
      // لا نُعيد تطبيق نفس الشاشة التي نحن عليها
      if (sameState(target, currentRef.current)) return;
      restoreRef.current(target);
    };

    if (!booted.current) {
      booted.current = true;
      // عند أول تحميل: لا نضيف خطوة، لكن ننظّف أي hash قديم
      if (window.location.hash && !parseHash(window.location.hash)) {
        try {
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        } catch {
          /* تجاهل */
        }
      }
    }

    window.addEventListener('hashchange', handle);
    window.addEventListener('popstate', handle);
    return () => {
      window.removeEventListener('hashchange', handle);
      window.removeEventListener('popstate', handle);
    };
  }, []);

  return { push, replace };
}
