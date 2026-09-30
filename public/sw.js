// Minimal service worker for PWA installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.origin === self.location.origin && url.pathname === SHARE_PATH) {
    event.respondWith(takeShare(event.request));
    return;
  }
  // Pass-through (no caching for now to keep things simple)
  event.respondWith(fetch(event.request));
});

// ─── Copilot share target (additive) ───────────────────────────────────────
// A file shared to Copilot from another app — a budget app's CSV export — is
// POSTed here by the phone (manifest share_target). It is kept in Cache Storage
// for the page, which uploads it with an ordinary same-origin fetch: the upload
// then carries the session like any other, whatever the phone did with cookies
// on the share itself. The page empties the cache once it has read it.
// src/app/copilot2/share/route.ts is the fallback before this worker is active.
const SHARE_PATH = '/copilot2/share';
const SHARE_CACHE = 'copilot-share';
const SHARE_MAX_FILES = 5;

async function takeShare(request) {
  const to = (q) => Response.redirect(new URL('/copilot2?tab=money&' + q, self.location.origin).href, 303);
  try {
    const form = await request.formData();
    const files = form.getAll('file').filter((f) => f && typeof f === 'object' && f.size > 0).slice(0, SHARE_MAX_FILES);
    const cache = await caches.open(SHARE_CACHE);
    for (const k of await cache.keys()) await cache.delete(k);
    for (let i = 0; i < files.length; i++) {
      await cache.put(SHARE_PATH + '/file/' + i, new Response(files[i], {
        headers: { 'content-type': files[i].type || 'application/octet-stream', 'x-file-name': encodeURIComponent(files[i].name || 'shared') },
      }));
    }
    return to('shared=' + files.length);
  } catch (e) {
    // Said on the Money tab rather than dropped: a share that vanished looks
    // exactly like one that worked and imported nothing.
    return to('shared=error&why=' + encodeURIComponent('The shared file could not be read: ' + ((e && e.message) || e)));
  }
}

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
