const CACHE_NAME = "ea-luxury-shell-v78";
const APP_SHELL = [
  "./",
  "./index.html",
  "./product.html",
  "./collection.html",
  "./cart.html",
  "./favorites.html",
  "./styles.css?v=60",
  "./app.js?v=68",
  "./collection.js?v=8",
  "./product-detail.js?v=27",
  "./favorites.js?v=2",
  "./ea-icon.svg",
  "./ea-icon-192.svg",
  "./ea-icon-512.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await Promise.all(APP_SHELL.map(async path => {
          try {
            const request = new Request(path, { cache: "reload" });
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response);
          } catch (error) {
            console.warn("تعذر تخزين ملف مؤقتًا:", path, error);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("ea-luxury-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // الشبكة أولًا لصفحات HTML وملفات التشغيل والتنسيق؛ والنسخة المخزنة احتياط عند انقطاع الإنترنت.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return (await caches.match("./index.html")) || Response.error();
        }
        return Response.error();
      })
  );
});
