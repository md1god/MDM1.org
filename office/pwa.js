/* MDM1usd Office — PWA + real store-package downloads (no keys, no manual steps). */
(function () {
  'use strict';
  var deferredPrompt = null;
  var installed = false;
  var VERSION = '20261128pwa24';
  var MANIFEST_URL = '../downloads/packages.json?v=' + VERSION;
  var manifestCache = null;
  var standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  function secureContext() {
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  if ('serviceWorker' in navigator && secureContext()) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js?v=' + VERSION, { scope: './' }).catch(function () { /* offline still works via cache if already installed */ });
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    installed = true;
    updateButtons();
    toast('✅ تم تثبيت التطبيق على جهازك.');
  });

  function toast(text, ms) {
    var old = document.querySelector('.pwa-toast');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'pwa-toast';
    box.setAttribute('role', 'status');
    box.textContent = text;
    document.body.appendChild(box);
    window.setTimeout(function () { if (box.parentNode) box.remove(); }, ms || 8500);
  }

  function updateButtons() {
    var buttons = document.querySelectorAll('.install-app-btn');
    Array.prototype.forEach.call(buttons, function (btn) {
      var label, title;
      if (standalone || installed) {
        label = '✅ التطبيق مثبّت';
        title = 'يعمل التطبيق الآن كنافذة مستقلة';
        btn.disabled = true;
      } else {
        label = '⬇️ تحميل التطبيق';
        title = 'حفظ حزمة التطبيق بصيغة ZIP لتثبيتها على Windows أو Android';
      }
      /* Guard: assigning textContent creates a childList mutation which would
         otherwise re-trigger the MutationObserver below forever. */
      if (btn.textContent !== label) btn.textContent = label;
      if (btn.getAttribute('title') !== title) btn.setAttribute('title', title);
    });
  }

  function detectedOs() {
    var ua = String(navigator.userAgent || '');
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/mac os x|macintosh/i.test(ua)) return 'mac';
    if (/linux/i.test(ua)) return 'linux';
    return 'windows';
  }

  function loadManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);
    return nativeFetchCompat(MANIFEST_URL).then(function (r) {
      if (!r.ok) throw new Error('packages.json HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !Array.isArray(j.packages)) throw new Error('manifest format invalid');
      manifestCache = j;
      return j;
    });
  }

  function nativeFetchCompat(url) {
    if (window.fetch) return window.fetch(url, { cache: 'no-store' });
    return Promise.reject(new Error('fetch unavailable'));
  }

  function bytesToHex(buf) {
    var bytes = new Uint8Array(buf), out = '';
    for (var i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
    return out;
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function downloadPackage(key, button) {
    var oldLabel = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '⏳ جارٍ تجهيز الحزمة...'; }
    return loadManifest().then(function (m) {
      var pkg = m.packages.find(function (p) { return p.key === key; });
      if (!pkg) throw new Error('الحزمة غير موجودة في ملف الوصف');
      var chain = Promise.resolve([]);
      (pkg.parts || []).forEach(function (part) {
        chain = chain.then(function (acc) {
          return nativeFetchCompat('../downloads/' + encodeURIComponent(part)).then(function (r) {
            if (!r.ok) throw new Error(part + ' HTTP ' + r.status);
            return r.arrayBuffer();
          }).then(function (buf) { return acc.concat(new Uint8Array(buf)); });
        });
      });
      return chain.then(function (chunks) {
        var total = chunks.reduce(function (n, c) { return n + c.length; }, 0);
        if (total !== num(pkg.bytes, total)) throw new Error('حجم الحزمة غير مطابق');
        var all = new Uint8Array(total), off = 0;
        chunks.forEach(function (c) { all.set(c, off); off += c.length; });
        if (!window.crypto || !crypto.subtle) throw new Error('التحقق المشفر غير مدعوم في هذا المتصفح');
        return crypto.subtle.digest('SHA-256', all.buffer).then(function (digest) {
          if (bytesToHex(digest) !== String(pkg.sha256 || '').toLowerCase()) throw new Error('فشل التحقق من بصمة الحزمة');
          return { bytes: all, pkg: pkg };
        });
      });
    }).then(function (out) {
      saveBlob(new Blob([out.bytes], { type: 'application/zip' }), out.pkg.filename);
      toast('✅ تم حفظ ' + out.pkg.filename + ' على جهازك (' + Math.round(out.bytes.length / 1024 / 1024) + ' MB). افتح الملف ثم ثبّت التطبيق كأي برنامج عادي.');
      return { ok: true, filename: out.pkg.filename, bytes: out.bytes.length };
    }).catch(function (e) {
      toast('❌ تعذّر تنزيل الحزمة: ' + e.message, 12000);
      return { ok: false, error: e.message };
    }).then(function (r) {
      if (button) { button.disabled = false; button.textContent = oldLabel; }
      return r;
    });
  }

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

  function showInstallHelp() {
    var old = document.getElementById('pwaInstallModal');
    if (old) old.remove();
    var detected = detectedOs();
    var modal = document.createElement('div');
    modal.id = 'pwaInstallModal';
    modal.className = 'pwa-install-modal';
    modal.innerHTML =
      '<div class="pwa-install-card" role="dialog" aria-modal="true" aria-label="تنزيل تطبيق MD1usd Office">' +
      '<h2>⬇️ تنزيل تطبيق MD1&#117;sd Office</h2>' +
      '<p>اختر حزمة نظامك؛ سيبدأ الحفظ مباشرة على جهازك. تم التحقق من بصمة SHA-256 قبل الحفظ، ثم تفتح الحزمة لتثبيت التطبيق كأي برنامج مثبّت.</p>' +
      '<div class="pwa-download-actions">' +
      '<button type="button" class="office-btn primary" id="pwaDownloadWindows">💻 تحميل حزمة ويندوز .zip' + (detected === 'windows' ? ' — موصى به' : '') + '</button>' +
      '<button type="button" class="office-btn primary" id="pwaDownloadAndroid">🤖 تحميل حزمة أندرويد .zip' + (detected === 'android' ? ' — موصى به' : '') + '</button>' +
      '</div>' +
      '<div id="pwaDownloadStatus" class="pwa-install-note">جاهز للتنزيل المباشر — لا توجد خطوات يدوية.</div>' +
      '<div class="pwa-install-actions"><button type="button" class="office-btn" id="pwaCloseBtn">إغلاق</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    var close = function () { if (modal.parentNode) modal.remove(); };
    modal.querySelector('#pwaCloseBtn').onclick = close;
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    var status = modal.querySelector('#pwaDownloadStatus');
    modal.querySelector('#pwaDownloadWindows').onclick = function () {
      var self = this;
      status.textContent = 'جارٍ تجميع حزمة ويندوز والتحقق منها...';
      downloadPackage('windows', self).then(function (r) {
        status.textContent = r.ok ? '✅ اكتمل الحفظ: ' + r.filename : '❌ ' + r.error;
      });
    };
    modal.querySelector('#pwaDownloadAndroid').onclick = function () {
      var self = this;
      status.textContent = 'جارٍ تجميع حزمة أندرويد والتحقق منها...';
      downloadPackage('android', self).then(function (r) {
        status.textContent = r.ok ? '✅ اكتمل الحفظ: ' + r.filename : '❌ ' + r.error;
      });
    };
  }

  function install() {
    if (standalone || installed) {
      toast('التطبيق مثبّت بالفعل ويعمل كنافذة مستقلة.');
      return;
    }
    /* Use the browser's real install flow when it offers one; otherwise save
       the verified package directly to the device. */
    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      deferredPrompt.prompt();
      return Promise.resolve(deferredPrompt.userChoice).then(function (choice) {
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') installed = true;
        updateButtons();
      }).catch(function () { showInstallHelp(); });
    }
    showInstallHelp();
  }

  function bind() {
    var buttons = document.querySelectorAll('.install-app-btn');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (btn.getAttribute('data-pwa-bound') === '1') return;
      btn.setAttribute('data-pwa-bound', '1');
      btn.addEventListener('click', install);
    });
    updateButtons();
  }

  window.MDM1PWA = { install: install, showHelp: showInstallHelp, download: downloadPackage, toast: toast, isStandalone: standalone };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  if (window.MutationObserver) {
    new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
