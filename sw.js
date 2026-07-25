// オフラインでも開けるようにするための仕組み(サービスワーカー)
// 方針: まずネットから取りに行き、つながらないときだけ保存済みを使う。
//       こうしておくと、更新したのに古い画面が出る、という事故が起きません。

const CACHE = "jinsei-monosashi-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  // よそのサイトのものは扱わない
  if (new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
