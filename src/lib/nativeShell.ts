/** كشف غلاف أندرويد/TWA حتى لا نستخدم روابط blob التي لا يفتحها. */
export interface SanadAndroidBridge {
  print?: () => void;
  openUrl?: (url: string) => void;
  savePdf?: (base64: string, fileName: string) => void;
}

export function sanadAndroidBridge(): SanadAndroidBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as any).AndroidApp as SanadAndroidBridge | undefined;
  return bridge && typeof bridge.print === 'function' ? bridge : null;
}

export function isSanadAndroidShell(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (sanadAndroidBridge()) return true;
  const ua = navigator.userAgent || '';
  if (/SanadWrapper|SanadMerchant|SanadMarketplace|SanadPlatformAdmin/i.test(ua)) return true;
  const android = /Android/i.test(ua);
  if (!android) return false;
  const webview = /; wv\)|\bwv\b/i.test(ua);
  const installed = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const twa = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  return webview || installed || twa;
}

export function openExternalFromApp(url: string): void {
  const bridge = sanadAndroidBridge();
  if (bridge?.openUrl) { bridge.openUrl(url); return; }
  // في الغلاف: أي رابط خارجي يمر عبر shouldOverrideUrlLoading ويُفتح في النظام.
  window.location.href = url;
}
