const CACHE_NAME = 'locket-photobooth-pwa-v18';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/native-api.js',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-512.png',
  '/frames/vuon_khoi.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Không bao giờ cache lời gọi API (/api/*) hoặc request khác method GET
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Chỉ cache asset nội bộ cùng origin theo chiến lược Network-First (ép bỏ qua HTTP cache của iOS Safari)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});

