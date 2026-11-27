/* MDM1usd Office — PWA install helper (no keys, no network calls beyond this app). */
(function () {
  'use strict';
  var deferredPrompt = null;
  var installed = false;
  var VERSION = '20261127pwa10';
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
        label = '💻 تثبيت التطبيق';
        title = 'ثبّت MD1\u0075sd Company على جهازك';
      } else {
        label = '💻 تثبيت التطبيق';
        title = 'إضافة MD1\u0075sd Company إلى الشاشة الرئيسية/التطبيقات';
      }
      /* Guard is essential: assigning textContent creates a childList mutation,
         which would otherwise re-trigger the observer forever. */
      if (btn.textContent !== label) btn.textContent = label;
      if (btn.getAttribute('title') !== title) btn.setAttribute('title', title);
    });
  }

  function showInstallHelp() {
    var old = document.getElementById('pwaInstallModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'pwaInstallModal';
    modal.className = 'pwa-install-modal';
    modal.innerHTML =
      '<div class="pwa-install-card" role="dialog" aria-modal="true" aria-label="تثبيت التطبيق">' +
      '<h2>💻 تثبيت مكتب MD1\u0075sd</h2>' +
      '<p>هذا التطبيق يُثبَّت من المتصفح (PWA) ولا يوجد ملف تحميل بصيغة APK أو EXE. اتبع الخطوات حسب متصفحك:</p>' +
      '<ol>' +
      '<li><strong>Chrome / Edge على الكمبيوتر:</strong> القائمة ⋮ ← «تثبيت التطبيق» أو «حفظ وتثبيت».</li>' +
      '<li><strong>iPhone Safari:</strong> زر المشاركة ← «إضافة إلى الشاشة الرئيسية».</li>' +
      '<li><strong>Android Chrome:</strong> القائمة ⋮ ← «تثبيت التطبيق» / «إضافة إلى الشاشة الرئيسية».</li>' +
      '<li><strong>Firefox:</strong> القائمة ← «تطبيق» ← «تثبيت الموقع كتطبيق».</li>' +
      '</ol>' +
      '<p class="pwa-install-note">يجب فتح الرابط على <code>https://mdm1.org/office/</code> — لا يعمل التثبيت من ملف محلي أو نافذة خاصة.</p>' +
      '<div class="pwa-install-actions">' +
      (deferredPrompt && typeof deferredPrompt.prompt === 'function' ? '<button type="button" class="office-btn primary" id="pwaPromptBtn">طلب تثبيت التطبيق</button>' : '') +
      '<button type="button" class="office-btn" id="pwaCloseBtn">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    var close = function () { if (modal.parentNode) modal.remove(); };
    modal.querySelector('#pwaCloseBtn').onclick = close;
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    var promptBtn = modal.querySelector('#pwaPromptBtn');
    if (promptBtn) promptBtn.onclick = function () {
      close();
      install();
    };
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
          toast('✅ جارٍ تثبيت MD1\u0075sd Company على جهازك...');
        }
        deferredPrompt = null;
        updateButtons();
      }).catch(function () { deferredPrompt = null; updateButtons(); });
      return;
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

  window.MDM1PWA = { install: install, showHelp: showInstallHelp, toast: toast, isStandalone: standalone };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  if (window.MutationObserver) {
    new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
