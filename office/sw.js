/* MDM1usd Office — tiny offline service worker.
   Only public static assets are cached. API responses (state/secrets/keys)
   are never cached and are always fetched from the network. */
(function () {
  'use strict';
  var VERSION = '20261128pwa31';
  var CACHE = 'mdm1-office-pwa-' + VERSION;
  /* Versioned URLs match index.html, so a deploy can never serve a cached old
     fragment next to a fresh index (and vice versa). */
  var CORE = [
    './?v=' + VERSION, './index.html?v=' + VERSION, './styles.css?v=' + VERSION, './app.js?v=' + VERSION, './office-config.js?v=' + VERSION,
    './office-auth.js?v=' + VERSION, './standalone.js?v=' + VERSION, './standalone-core.part.js?v=' + VERSION,
    './standalone-model.part.js?v=' + VERSION, './standalone-domain.part.js?v=' + VERSION,
    './standalone-api.part.js?v=' + VERSION, './standalone-ui.part.js?v=' + VERSION,
    './pwa.js?v=' + VERSION, './manifest.webmanifest?v=' + VERSION,
    './data.json?v=' + VERSION, './app-logo.webp?v=' + VERSION, './icon-192.webp?v=' + VERSION, './icon-512.webp?v=' + VERSION,
    './office-background.webp?v=' + VERSION, './apple-touch-icon.png?v=' + VERSION
  ];
  var STATIC = /\.(?:css|js|json|webmanifest|png|webp|jfif|jpe?g|svg|html)$/i;

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
      /* Keep the requested path (e.g. /office/portal.html) instead of rewriting
         every navigation to index.html. */
      event.respondWith(
        fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html?v=' + VERSION).then(function (fallback) { return fallback || Response.error(); });
          });
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
        }).catch(function () { return hit || Response.error(); });
        return hit || network;
      })
    );
  });
})();
