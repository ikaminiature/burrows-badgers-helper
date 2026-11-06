const VERSION = "13";
const PREFIX = "bb-helper:" + self.registration.scope + ":";
const CACHE = PREFIX + VERSION;
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./src/app.js",
  "./src/model.js",
  "./src/species.js",
  "./src/skills.js",
  "./src/equipment.js",
  "./src/equipment-rules.js",
  "./src/equipment-view.js",
  "./data/bb2_general_store_ja_en.json",
  "./src/db.js",
  "./src/update.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(
        FILES.map(
          (path) =>
            new Request(new URL(path, self.registration.scope), {
              cache: "reload",
            }),
        ),
      ),
    ),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k)),
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
  e.respondWith(
    caches
      .open(CACHE)
      .then((c) => c.match(e.request))
      .then((hit) => hit || fetch(e.request)),
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") e.waitUntil(self.skipWaiting());
});
