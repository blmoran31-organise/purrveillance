// PURRVEILLANCE service worker: lets the app install to the home screen and opens the shell without signal.
// Network first for everything on this site, cached copy as the fallback. Data never goes through here.
const CACHE = 'purrveillance-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'logic.js', 'store.js', 'names.js', 'config.js', 'manifest.json', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // cache: 'no-cache' makes the browser check GitHub for a newer file every time, instead of reusing a
  // copy for up to 10 minutes. Without it a fix could reach a phone as a mix of old and new files (2026-10-03).
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
