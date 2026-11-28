/* MDM1 AI Office — runtime loader (pwa21)
   ----------------------------------------------------------------------------
   The browser runtime is maintained as five source parts instead of one 270KB
   file. They are concatenated in order and evaluated as one program so all
   existing closures and state stay intact. The injected CSS now lives in
   styles.css; no stylesheet is generated from JavaScript. The ready promise is
   published synchronously so app.js never boots before the runtime exists. */
(function () {
  'use strict';
  var VERSION = '20261128pwa35';
  var PARTS = [
    './standalone-core.part.js',
    './standalone-model.part.js',
    './standalone-domain.part.js',
    './standalone-api.part.js',
    './standalone-autopilot.part.js',
    './standalone-ui.part.js'
  ];
  var resolveReady, rejectReady;
  var ready = new Promise(function (resolve, reject) { resolveReady = resolve; rejectReady = reject; });
  window.MDM1OfficeReady = ready;
  var loaderFetch = window.fetch ? window.fetch.bind(window) : null;

  function fail(error) {
    console.error('MDM1 Office runtime could not load:', error);
    rejectReady(error);
  }

  function loadPart(index, source) {
    if (index >= PARTS.length) {
      try {
        (0, eval)(source);
        resolveReady(window.MDM1Office);
      } catch (error) { fail(error); }
      return;
    }
    if (!loaderFetch) { fail(new Error('fetch is unavailable in this browser.')); return; }
    loaderFetch(PARTS[index] + '?v=' + VERSION, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error(PARTS[index] + ' HTTP ' + response.status);
        return response.text();
      })
      .then(function (text) {
        loadPart(index + 1, source + '\n' + text + '\n//# sourceURL=' + PARTS[index] + '\n');
      })
      .catch(fail);
  }

  loadPart(0, '');
})();
