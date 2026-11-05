const CACHE = "bb-helper-v3";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./src/app.js",
  "./src/model.js",
  "./src/db.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
