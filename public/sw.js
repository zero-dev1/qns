const CACHE_NAME = 'qns-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
  '/og-image.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.error('Failed to cache static assets:', err);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests and external resources
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {
            // Network failed, but we have cached response
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || !networkResponse.ok) {
            return networkResponse;
          }

          // Cache successful responses
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Network failed and not in cache
          return new Response('Network error', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});
