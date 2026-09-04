// Minimal service worker for PWA installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through (no caching for now to keep things simple)
  event.respondWith(fetch(event.request));
});

// ─── Copilot push (additive) ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Copilot';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/copilot/icon-192.png',
    badge: '/copilot/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/copilot' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/copilot';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
