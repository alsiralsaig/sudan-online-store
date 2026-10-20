import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(async (reg) => {
        console.log('[PWA] ✅ Service Worker registered with scope:', reg.scope);

        // Ask for background sync rights so offline POS sales flush automatically
        try {
          if ('sync' in reg) {
            await (reg as any).sync.register('sanad-sync-sales');
            console.log('[PWA] ✅ Background Sync registered');
          }
        } catch (err) {
          console.log('[PWA] Background Sync unavailable:', err);
        }

        // Periodic catalog refresh (Chrome only, requires installed PWA)
        try {
          if ('periodicSync' in reg) {
            const status = await (navigator as any).permissions.query({ name: 'periodic-background-sync' });
            if (status.state === 'granted') {
              await (reg as any).periodicSync.register('sanad-refresh-catalog', {
                minInterval: 12 * 60 * 60 * 1000, // twice a day
              });
              console.log('[PWA] ✅ Periodic Background Sync registered');
            }
          }
        } catch (err) {
          console.log('[PWA] Periodic Background Sync unavailable:', err);
        }
      })
      .catch((err) => {
        console.error('[PWA] ❌ Service Worker registration failed:', err);
      });
  });
}

// Handle inventory files opened directly with the installed app (file_handlers)
const launchQueue = (window as any).launchQueue;
if (launchQueue && typeof launchQueue.setConsumer === 'function') {
  launchQueue.setConsumer(async (launchParams: any) => {
    if (!launchParams || !launchParams.files || launchParams.files.length === 0) return;

    const files: { name: string; size: number; type: string }[] = [];
    for (const handle of launchParams.files) {
      try {
        const file = await handle.getFile();
        files.push({ name: file.name, size: file.size, type: file.type });
      } catch (err) {
        console.warn('[PWA] Could not read launched file:', err);
      }
    }

    console.log('[PWA] Files launched into the app:', files);
    window.dispatchEvent(new CustomEvent('sanad-files-launched', { detail: files }));
  });
}

createRoot(document.getElementById('root')!).render(<App />);
