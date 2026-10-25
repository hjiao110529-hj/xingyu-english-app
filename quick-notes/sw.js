const CACHE_NAME = "quick-notes-shell-v11";
const APP_URL = new URL("./", self.registration.scope).href;
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.add(APP_URL); } catch (_) {}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("quick-notes-shell-") && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && event.request.mode === "navigate") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      return cached || caches.match(APP_URL);
    }
  })());
});
self.addEventListener("push", event => {
  let data = { title: "随手记事管家", body: "你有一条待处理事件。", url: APP_URL, tag: "quick-notes-reminder" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {
    try { if (event.data) data.body = event.data.text(); } catch (_) {}
  }
  event.waitUntil(self.registration.showNotification(data.title || "随手记事管家", {
    body: data.body || "你有一条待处理事件。",
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || "quick-notes-reminder",
    renotify: true,
    data: { url: data.url || APP_URL }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : APP_URL;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
