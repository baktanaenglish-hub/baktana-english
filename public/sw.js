// Minimal service worker: network-first for everything, falling back to the cache when offline.
// /api responses are never cached (progress must come from the server or localStorage).
// The Android APK download goes straight to the network so the browser saves it as a normal file.
// Paths are relative to the worker's scope so the app also works under a sub-path (GitHub Pages).
const CACHE = 'baktana-v1';
const SCOPE = new URL(self.registration.scope).pathname;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(SCOPE + 'api/') ||
    url.pathname.endsWith('.apk')
  )
    return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Offline navigation to any route: serve the cached app shell.
        if (request.mode === 'navigate') return (await caches.match(SCOPE)) ?? Response.error();
        return Response.error();
      }),
  );
});
