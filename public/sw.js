// Bump CACHE whenever the shell list or the offline page changes — activate
// deletes every other cache, which is how installed phones pick up new icons.
const CACHE = "good-content-shell-v3";
const SHELL = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            "<!doctype html><meta name='viewport' content='width=device-width'><title>Offline</title><body style='font-family:system-ui;padding:2rem;background:#f5f0e1;color:#0e2018'><h1>You’re offline.</h1><p>Reconnect to open your private library.</p></body>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          ),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
