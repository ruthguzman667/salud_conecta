// Service worker de Salud Conecta (MVP).
// Guarda en caché lo básico para poder abrir la app sin conexión.
// Si cambia el código, sube el número de versión para que se actualice.
const VERSION = 'saludconecta-v6';
const CORE = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La página: primero la red (para ver cambios) y, si falla, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('/index.html', '/styles.css', '/app.js', copy)); return r; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  // Lo demás (iconos, letra de Google Fonts): copia guardada y, si no hay, la red.
  if (url.origin === location.origin || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => hit)));
  }
});
