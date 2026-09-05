const CACHE_NAME = 'mdm1-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './data/games.json',
  './i18n/ar.json',
  './i18n/en.json',
  './i18n/fr.json',
  './audio/games.opus'
];

// تثبيت الـ Service Worker وتخزين الملفات
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// تقديم الملفات المخزنة عند انقطاع الشبكة أو لسرعة الاستجابة
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
