const CACHE = 'volantino-studio-202610231649';
const RT = 'volantino-rt-v1'; // runtime cache: fonts, CDN libs and models (kept across app updates)
const RT_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|storage\.googleapis\.com)$/;
async function rtPut(req, res) { try { const c = await caches.open(RT); await c.put(req, res); const ks = await c.keys(); if (ks.length > 160) await Promise.all(ks.slice(0, ks.length - 160).map(k => c.delete(k))); } catch (e) {} }
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== RT).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Network-first for CDN models / fonts; cache-first for app shell
  if (url.origin !== location.origin) {
    if (e.request.method !== 'GET' || !RT_HOSTS.test(url.hostname)) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
    e.respondWith(fetch(e.request).then((res) => {
      if (res && (res.ok || (res.type === 'opaque' && url.hostname === 'fonts.googleapis.com'))) rtPut(e.request, res.clone());
      return res;
    }).catch(() => caches.match(e.request).then((m) => m || Response.error())));
    return;
  }
  // Network-first for the page itself so updates show up immediately (cache = offline fallback)
  // Shared flyer projects (p/<id>.json): always from network, never cached
  if (url.pathname.includes('/p/') && url.pathname.endsWith('.json')) { e.respondWith(fetch(e.request)); return; }
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
