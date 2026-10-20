import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] ✅ Service Worker registered with scope:', reg.scope);
        console.log('[PWA] Registration:', reg);
      })
      .catch((err) => {
        console.error('[PWA] ❌ Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
