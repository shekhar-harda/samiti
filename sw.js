const V = "samiti-v2";
const CORE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
const CDN = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all([...CORE, ...CDN].map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first (so updates arrive), but fall back to the cache after 4 s or when offline.
function networkFirst(r) {
  return new Promise(res => {
    let done = false;
    const timer = setTimeout(() => {
      caches.match(r, { ignoreSearch: true }).then(x => { if (x && !done) { done = true; res(x); } });
    }, 4000);
    fetch(r).then(x => {
      clearTimeout(timer);
      const cp = x.clone();
      caches.open(V).then(c => c.put(r, cp)).catch(() => {});
      if (!done) { done = true; res(x); }
    }).catch(() => {
      clearTimeout(timer);
      if (done) return;
      caches.match(r, { ignoreSearch: true }).then(x => x || caches.match("index.html")).then(x => { done = true; res(x || Response.error()); });
    });
  });
}

// Static files and the Firebase scripts: cache first, fill the cache on first use.
function cacheFirst(r) {
  return caches.match(r).then(x => x || fetch(r).then(res => {
    if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)).catch(() => {}); }
    return res;
  }));
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) e.respondWith(networkFirst(r));
    else e.respondWith(cacheFirst(r));
  } else if (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) {
    e.respondWith(cacheFirst(r));
  }
  // Firestore / Auth network calls are not touched.
});
