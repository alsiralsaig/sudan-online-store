// Sanad POS & Commerce Service Worker (PWA)
const CACHE_NAME = 'sanad-pwa-v7.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/sanad-icon-192.png',
  '/icons/sanad-icon-512.png',
  '/icons/sanad-maskable-512.png',
  '/icons/sanad-apple-180.png',
  '/icons/sanad-favicon-96.png',
  '/sanad-banner.png'
];

/* ------------------------------------------------------------------ */
/*  Install / Activate                                                 */
/* ------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Precache non-critical item failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* ------------------------------------------------------------------ */
/*  Fetch — network first for navigation, cache fallback for assets    */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const isAsset = /\/assets\/|\/wasm\/|\.(png|jpe?g|gif|svg|ico|webp|css|js|wasm|woff2?|ttf|otf)$/i.test(url.pathname);
  const isDocument =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html';

  // 1) The HTML shell and the service worker itself must NEVER be served stale,
  //    otherwise a new deploy keeps loading the previous bundle forever.
  if (isDocument) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // 2) Hashed build assets are immutable: cache-first, refresh in background.
  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || Response.error());

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 3) Everything else (manifest, icons, images): stale-while-revalidate.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || networkFetch;
    })
  );
});

/* ------------------------------------------------------------------ */
/*  Push Notifications                                                 */
/*  Used for: order alerts, low-stock warnings, shift reminders        */
/* ------------------------------------------------------------------ */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'سند',
    body: 'لديك إشعار جديد من منصة سند',
    icon: '/icons/sanad-icon-192.png',
    badge: '/icons/sanad-favicon-96.png',
    url: '/',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      dir: 'rtl',
      lang: 'ar',
      tag: payload.tag || 'sanad-notification',
      data: { url: payload.url },
      vibrate: [90, 40, 90],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ------------------------------------------------------------------ */
/*  Background Sync — flush offline POS sales when connection returns  */
/* ------------------------------------------------------------------ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sanad-sync-sales') {
    event.waitUntil(notifyClientsToSync('background-sync'));
  }
});

/* ------------------------------------------------------------------ */
/*  Periodic Background Sync — refresh catalog in the background       */
/* ------------------------------------------------------------------ */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sanad-refresh-catalog') {
    event.waitUntil(notifyClientsToSync('periodic-sync'));
  }
});

/**
 * Ask every open window to run its own sync routine.
 * The page owns the IndexedDB connection and the API client,
 * so we delegate instead of duplicating that logic here.
 */
async function notifyClientsToSync(reason) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (clientList.length === 0) {
    // No window open — refresh the shell so the next launch has fresh HTML
    if (reason === 'periodic-sync') {
      try {
        const response = await fetch('/index.html', { cache: 'no-cache' });
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
      } catch (e) {
        /* offline — nothing to do */
      }
    }
    return;
  }

  clientList.forEach((client) => {
    client.postMessage({ type: 'SANAD_SYNC_REQUEST', reason });
  });
}

/* ------------------------------------------------------------------ */
/*  Messages from the page                                             */
/* ------------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
