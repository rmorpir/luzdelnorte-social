// Service worker: recibe las notificaciones push (también en iPhone con la app
// añadida a la pantalla de inicio) y abre la publicación al tocarlas.
const SHELL = 'ldn-shell-v2';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/brand/logo.png', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero para la interfaz (así siempre ves la última versión); caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (ASSETS.includes(url.pathname)) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
  }
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Luz del Norte', body: e.data && e.data.text() }; }
  const title = data.title || 'Luz del Norte';
  // En iPhone es obligatorio mostrar siempre una notificación por cada push recibido.
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/#/' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || '/#/', location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) return c.navigate(target);
        c.postMessage({ type: 'open', url: target });
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});
