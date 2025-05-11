const CACHE_NAME = 'milestones-cache-v3';
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';

const STATIC_ASSETS = [
    '',
    'index.html',
    'styles.css',
    'script.js',
    'manifest.json',
    'icon-192x192.png',
    'icon-512x512.png'
];

// Pre-cache static assets during installation
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => caches.delete(name))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Fetch handler with improved offline support
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Handle static assets with cache-first strategy
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname.includes('icon-')) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request)
                        .then(response => {
                            if (response.ok) {
                                const responseToCache = response.clone();
                                caches.open(STATIC_CACHE)
                                    .then(cache => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                            return response;
                        });
                })
        );
        return;
    }

    // For all other requests, use stale-while-revalidate strategy
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.ok) {
                            const responseToCache = networkResponse.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // If network fails and we're trying to navigate, return index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        // Return a custom offline response for other resources
                        return new Response(JSON.stringify({
                            error: 'You are offline',
                            offline: true
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;
            })
    );
});

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Implement sync logic here when needed
            Promise.resolve()
        );
    }
});