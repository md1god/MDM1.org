/* MDM1usd Office — tiny offline service worker.
   Only public static assets are cached. API responses (state/secrets/keys)
   are never cached and are always fetched from the network. */
(function () {
  'use strict';
  var CACHE = 'mdm1-office-pwa-20261127pwa15';
  var CORE = [
    './', './index.html', './portal.html', './styles.css', './app.js', './office-config.js',
    './office-auth.js', './standalone.js', './pwa.js', './manifest.webmanifest',
    './data.json', './app-logo.png', './icon-192.png', './icon-512.png',
    './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png',
    './fonts/cairo-arabic-400-normal.woff2', './fonts/cairo-arabic-600-normal.woff2',
    './fonts/cairo-arabic-700-normal.woff2', './fonts/cairo-arabic-800-normal.woff2',
    './fonts/cairo-latin-400-normal.woff2', './fonts/cairo-latin-600-normal.woff2',
    './fonts/cairo-latin-700-normal.woff2', './fonts/cairo-latin-800-normal.woff2'
  ];
  var STATIC = /\.(?:css|js|json|webmanifest|png|jfif|jpe?g|svg|woff2?|html)$/i;

  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(CACHE).then(function (cache) {
        return Promise.all(CORE.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
        }));
      }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key.indexOf('mdm1-office-pwa-') === 0 && key !== CACHE;
        }).map(function (key) { return caches.delete(key); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return; // Groq/OpenRouter/etc are never intercepted.
    if (url.pathname.indexOf('/api/') !== -1) return; // Dynamic state, tokens and secrets.

    if (req.mode === 'navigate') {
      // Cache each page under its own URL (query stripped) so portal.html never overwrites index.html.
      var pageKey = url.origin + url.pathname;
      event.respondWith(
        fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(pageKey, copy); });
          }
          return res;
        }).catch(function () {
          return caches.match(pageKey).then(function (hit) {
            return hit || caches.match('./index.html');
          }).then(function (hit) { return hit || Response.error(); });
        })
      );
      return;
    }

    if (!STATIC.test(url.pathname)) return;
    event.respondWith(
      caches.match(req).then(function (hit) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () {
          if (hit) return hit;
          // Offline fallback: use the pre-cached copy even if the ?v= query differs.
          return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || Response.error(); });
        });
        return hit || network;
      })
    );
  });
})();
