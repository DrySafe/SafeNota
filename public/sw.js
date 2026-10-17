// Only the static offline page is cached. Financial data, sessions, emails and
// documents are always requested from the network and never added to caches.
const CACHE = "safenota-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add("/offline.html")),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("safenota-offline-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET")
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () =>
        (await caches.match("/offline.html")) ||
        new Response("SafeNota: conecte-se à internet para continuar.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    ),
  );
});
