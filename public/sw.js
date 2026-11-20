// Service worker: keeps the app shell, face models and audio prompts on the phone so the
// proof-of-life flow still opens on a weak or dropped connection. API calls are never cached.
const CACHE = "zh-v1";
const PRECACHE = ["/", "/login", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live data only
  const heavyStatic = url.pathname.startsWith("/models/") || url.pathname.startsWith("/mediapipe-wasm/") || url.pathname.startsWith("/_next/static/");
  if (heavyStatic) {
    // Cache first: these files never change for a given build.
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
    return;
  }
  // Pages: network first, fall back to the saved copy when offline.
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("/login"))));
});
