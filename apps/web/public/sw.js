// Service worker mínimo: cachea el app-shell para que el POS cargue offline.
// La cola de ventas offline vive en IndexedDB (lib/offline.ts), no aquí.
const CACHE = 'facturarkos-shell-v1';
const SHELL = ['/', '/pos', '/login', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // No interceptar llamadas al API: las gestiona la app (online/cola offline).
  if (request.method !== 'GET' || request.url.includes('/api/')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match('/pos'))),
  );
});
