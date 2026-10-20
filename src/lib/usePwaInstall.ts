import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      console.log('[PWA] ✅ App is already installed (standalone mode)');
    }

    // Check if service worker is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwRegistered(true);
          console.log('[PWA] ✅ Service Worker is registered:', reg.scope);
        } else {
          console.warn('[PWA] ⚠️ No Service Worker registered');
        }
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] ✅ beforeinstallprompt event fired!');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] ✅ App installed successfully!');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    console.log('[PWA] Attempting to install...', {
      hasDeferredPrompt: !!deferredPrompt,
      isInstallable,
      swRegistered,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    });

    if (!deferredPrompt) {
      console.warn('[PWA] ⚠️ No deferred prompt available');
      console.log('[PWA] ℹ️ User can install manually via browser menu (⋮ → Install app)');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', choice.outcome);
      
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
      return choice.outcome === 'accepted';
    } catch (err) {
      console.error('[PWA] ❌ Install prompt error:', err);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    swRegistered,
  };
}
