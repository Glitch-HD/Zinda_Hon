// Service worker: keeps the app shell, face models and audio prompts on the phone so the
// proof-of-life flow still opens on a weak or dropped connection. API calls are never cached.
// The face models (about 20 MB) live in their own cache that is kept across app updates, so a
// pensioner on 2G downloads them once, not after every update.
const CACHE = "zh-v2";
const MODELS = "zh-models-v1";
const PRECACHE = ["/", "/login", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MODELS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live data only
  const isModel = url.pathname.startsWith("/models/") || url.pathname.startsWith("/mediapipe-wasm/");
  if (isModel || url.pathname.startsWith("/_next/static/")) {
    // Cache first: these files never change for a given build. Only complete, successful answers are saved.
    const store = isModel ? MODELS : CACHE;
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(store).then((c) => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  // Pages: network first, fall back to the saved copy when offline.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("/login"))));
});
