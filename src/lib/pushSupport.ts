/**
 * Why phone notifications may not be available, explained clearly.
 *
 * Web push needs three things at once: a secure page, a real browser engine
 * with Service Worker + PushManager, and the user's permission. When one of
 * them is missing the app can only fall back to in-app alerts — but the user
 * deserves to know *which* one, otherwise «لا يدعم» looks like a bug in Sanad.
 */

export type PushSupportState =
  | 'ok'
  | 'insecure'
  | 'in_app_browser'
  | 'no_push_api'
  | 'ios_needs_install'
  | 'embedded'
  | 'unknown';

export interface PushSupport {
  state: PushSupportState;
  /** One-line headline in Arabic. */
  title: string;
  /** Numbered steps that actually fix it on this device. */
  steps: string[];
  /** True when retrying from here could work (permission prompt etc.). */
  canRetry: boolean;
  /** True when the fix is impossible in this context (must reopen elsewhere). */
  needsOtherBrowser: boolean;
}

const UA = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

/**
 * بصمات المتصفحات المدمجة داخل التطبيقات فقط.
 *
 * ملاحظة مهمة: كنا نطابق `GSA/` و`; wv)` وحدها، فظهرت رسالة «أنت تفتح من
 * فيسبوك/واتساب» لأناس يفتحون Chrome عادي — لأن بعض إصدارات أندرويد تضيف
 * `wv` لأسباب أخرى. الآن المطابقة تحتاج بصمة صريحة، والرسالة نفسها عامة
 * ولا تتهم تطبيقاً بعينه.
 */
const IN_APP_PATTERNS = [
  /FBAN|FBAV|FB_IAB|FBIOS/i,
  /Instagram/i,
  /Line\//i,
  /WhatsApp/i,
  /Telegram|TelegramBot/i,
  /Snapchat/i,
  /MicroMessenger/i,
  /Twitter/i,
  /musical_ly|BytedanceWebview|TikTok/i,
];

export const isInAppBrowser = (): boolean => IN_APP_PATTERNS.some((re) => re.test(UA()));

export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(UA()) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

export const isStandalone = (): boolean =>
  (typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true)) ||
  false;

/** Detects the real blocker. Order matters: most specific reason first. */
export function detectPushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return { state: 'unknown', title: 'جارٍ الفحص…', steps: [], canRetry: true, needsOtherBrowser: false };
  }

  const secure =
    window.isSecureContext ||
    location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);

  const embedded = window.self !== window.top;

  /*
   * القدرة الحقيقية أولاً، والتفسير بعدها.
   *
   * ليه: الرسالة كانت تُبنى على تخمين نوع المتصفح قبل أن نتحقق هل الإشعارات
   * تعمل فعلاً. النتيجة أن مستخدم Chrome سليم يرى تحذيراً عن «المتصفحات
   * المدمجة». الآن: لو كل الواجهات موجودة والإذن غير مرفوض، فالحالة «ok»
   * ولا تظهر أي رسالة مزعجة.
   */
  const hasApis =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const granted = hasApis && Notification.permission === 'granted';

  if (secure && hasApis && granted) {
    return { state: 'ok', title: '', steps: [], canRetry: true, needsOtherBrowser: false };
  }

  if (!secure) {
    return {
      state: 'insecure',
      title: 'الرابط مفتوح بدون شهادة آمنة (http) — إشعارات الهاتف تحتاج https.',
      steps: ['افتح المنصة من رابطها الرسمي الذي يبدأ بـ https://sudan-online-store-eta.vercel.app'],
      canRetry: true,
      needsOtherBrowser: true,
    };
  }

  if (isInAppBrowser() && !hasApis) {
    return {
      state: 'in_app_browser',
      title: 'يبدو أنك تفتح المنصة من داخل تطبيق (واتساب/فيسبوك…) أو متصفح مدمج — وهذا النوع يمنع إشعارات الهاتف.',
      steps: [
        'اضغط زر ⋯ أو ⋮ أعلى الشاشة واختر «فتح في المتصفح» أو «Open in Chrome».',
        'أو انسخ الرابط وافتحه في Chrome (أندرويد) أو Safari (آيفون).',
        'ثم افتح جرس الإشعارات واضغط «تفعيل إشعارات الهاتف».',
      ],
      canRetry: true,
      needsOtherBrowser: true,
    };
  }

  if (embedded) {
    return {
      state: 'embedded',
      title: 'الصفحة معروضة داخل إطار (preview) ولا تسمح بطلب إذن الإشعارات.',
      steps: [
        'افتح المنصة في تبويب مستقل من المتصفح مباشرة، وليس من نافذة المعاينة.',
        'ثم اضغط «تفعيل إشعارات الهاتف».',
      ],
      canRetry: true,
      needsOtherBrowser: true,
    };
  }

  if (isIos() && !isStandalone() && !isInAppBrowser()) {
    return {
      state: 'ios_needs_install',
      title: 'على الآيفون لازم تضيف التطبيق لشاشة الجهاز أولاً (iOS 16.4+).',
      steps: [
        'افتح المنصة بـ Safari (ليس Chrome).',
        'اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».',
        'افتح التطبيق من الأيقونة الجديدة، واضغط «تفعيل إشعارات الهاتف».',
      ],
      canRetry: false,
      needsOtherBrowser: false,
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      state: 'no_push_api',
      title:
        'هذا المتصفح لا يوفّر إشعارات الويب. استخدم Chrome (أندرويد) أو Safari (آيفون) أو Edge.',
      steps: [
        'افتح الرابط في Chrome / Safari / Edge بشكل مباشر.',
        'لو كنت في وضع التخفي (Incognito) اخرج منه — التخفي يمنع الإشعارات.',
        'ثم اضغط «تفعيل إشعارات الهاتف».',
      ],
      canRetry: true,
      needsOtherBrowser: true,
    };
  }

  if (!('Notification' in window)) {
    return {
      state: 'no_push_api',
      title: 'المتصفح لا يوفّر واجهة الإشعارات — جرّب Chrome أو Safari.',
      steps: [
        'افتح الرابط في متصفح حديث (Chrome 90+ / Safari 16.4+).',
        'ثم اضغط «تفعيل إشعارات الهاتف».',
      ],
      canRetry: true,
      needsOtherBrowser: true,
    };
  }

  return { state: 'ok', title: '', steps: [], canRetry: true, needsOtherBrowser: false };
}
