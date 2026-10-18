// Keeps the album site's own files (page, font, logo, icons) available
// offline. Songs, covers and albums.json come from daily.shalonely.com and
// are never cached here. Bump VERSION whenever these files change.
const VERSION = 'albums-v1';
const SHELL = [
  '/',
  '/fonts/cormorant-garamond.woff2',
  '/fonts/cormorant-garamond-italic.woff2',
  '/logo.png',
  '/dust.svg',
  '/favicon-32.png',
  '/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // The page: try the network first so updates show up, fall back offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Fonts, logo and icons: from the cache when we have them.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
