const CACHE_NAME = 'xingyu-english-v1-1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const base = self.registration.scope;
    await cache.addAll([
      base,
      new URL('index.html', base).href,
      new URL('content.js?v=2', base).href,
      new URL('manifest.json', base).href,
      new URL('icon-192.png', base).href,
      new URL('icon-512.png', base).href
    ]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('xingyu-english-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  event.respondWith((async () => {
    if (isNavigation) {
      try {
        const fresh = await fetch(request, {cache: 'no-store'});
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return (await caches.match(request)) || (await caches.match(self.registration.scope)) || (await caches.match(new URL('index.html', self.registration.scope).href));
      }
    }
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      throw err;
    }
  })());
});
