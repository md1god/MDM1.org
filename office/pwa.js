/* MDM1usd Office — PWA install helper (no keys, no network calls beyond this app). */
(function () {
  'use strict';
  var deferredPrompt = null;
  var installed = false;
  var VERSION = '20261127pwa4';
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
    updateButtons();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    installed = true;
    updateButtons();
    toast('✅ تم تثبيت التطبيق على جهازك. يمكنك فتحه من الشاشة الرئيسية أو قائمة التطبيقات.');
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
      } else if (deferredPrompt) {
        label = '⬇️ تثبيت التطبيق';
        title = 'ثبّت المكتب الافتراضي على جهازك';
      } else {
        label = '⬇️ تحميل التطبيق';
        title = 'إضافة المكتب الافتراضي إلى الشاشة الرئيسية/التطبيقات';
      }
      /* Guard is essential: assigning textContent creates a childList mutation,
         which would otherwise re-trigger the observer forever. */
      if (btn.textContent !== label) btn.textContent = label;
      if (btn.getAttribute('title') !== title) btn.setAttribute('title', title);
    });
  }

  function install() {
    if (standalone || installed) {
      toast('التطبيق مثبّت بالفعل ويعمل كنافذة مستقلة.');
      return;
    }
    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          installed = true;
          toast('✅ جارٍ تثبيت المكتب الافتراضي على جهازك...');
        }
        deferredPrompt = null;
        updateButtons();
      }).catch(function () { deferredPrompt = null; updateButtons(); });
      return;
    }
    toast('للتثبيت يدوياً: Chrome / Edge → القائمة ⋮ ← «تثبيت التطبيق» · iPhone Safari ← «مشاركة» ثم «إضافة إلى الشاشة الرئيسية» · Firefox ← القائمة ← «تطبيق».\nالصفحة يجب أن تكون على https://mdm1.org/office/ أو localhost حتى يظهر خيار التثبيت.', 12000);
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

  window.MDM1PWA = { install: install, toast: toast, isStandalone: standalone };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  if (window.MutationObserver) {
    new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
