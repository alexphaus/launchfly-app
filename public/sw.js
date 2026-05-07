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
