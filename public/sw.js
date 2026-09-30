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
  if (event.request.mode === 'navigate' && url.origin === self.location.origin && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(networkThenKept(event.request, url.pathname));
    return;
  }
  if (event.request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(keptThenNetwork(event.request));
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

// ─── Log money without signal (additive) ───────────────────────────────────
// The Log money page is kept as it was last opened and shown from here when
// the network is not there — a move logged on it goes into the phone's outbox
// and is sent when the signal is back (bookLocal.ts). Network first, always: a
// kept copy is only ever the fallback, and the page works out today and says
// it is offline itself, since a copy from yesterday still says yesterday.
const PAGE_CACHE = 'copilot-pages';
const OFFLINE_PAGES = ['/copilot2/log'];

// The page's scripts, styles and fonts, kept as they are fetched, so the kept
// page also runs offline. Safe to serve from here first: everything under
// /_next/static/ is named by its content hash, so a name never means two files.
// Trimmed to the newest few hundred, or every deploy would add its files forever.
const STATIC_CACHE = 'copilot-static';
const STATIC_KEEP = 300;

async function keptThenNetwork(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Only what the server itself calls immutable: a dev server's chunks keep
  // their names across edits, and keeping one would serve yesterday's code.
  if (res.ok && res.status === 200 && /immutable/.test(res.headers.get('cache-control') || '')) {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - STATIC_KEEP))) await cache.delete(k);
  }
  return res;
}

async function networkThenKept(request, path) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(request);
    // Only the page itself: a redirect is the sign-in, not a page to keep.
    if (res.ok && res.status === 200 && !res.redirected) await cache.put(path, res.clone());
    return res;
  } catch (e) {
    const kept = await cache.match(path);
    if (kept) return kept;
    throw e;
  }
}
