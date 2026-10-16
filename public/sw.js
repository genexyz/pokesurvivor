/* ============ sw.js — lets the game be installed as an app ============
 * - Game code (html, js, css): network first, so every update arrives right
 *   away; when offline, the last saved copy.
 * - Sprites, icons and font: they never change, served from the cache
 *   (saved as they get used: nothing is downloaded all at once).
 * - External services are left alone.
 */
const CODE = 'ps-code-v1',
  ART = 'ps-art-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(CODE)
      .then(c => c.addAll(['./', './index.html', './css/style.css', './manifest.webmanifest']))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(ks => Promise.all(ks.filter(k => k !== CODE && k !== ART).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const art = /\/assets\/(pokemon|icons|fonts)\//.test(url.pathname);
  if (art) {
    e.respondWith(
      caches.open(ART).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CODE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        // Offline: the saved copy. The home page is only a fallback when
        // opening the site (never in place of a script or an image).
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
        return Response.error();
      })
  );
});
