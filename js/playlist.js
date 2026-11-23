/* MDM1 - background playlist: songs 1-12 (audio/1.opus ... audio/12.opus).
   For the pages that run their own music script (index, hub, chat, whitepaper). Pages using js/global.js get the same logic there. */
(function () {
  "use strict";
  var N = 12, KEY = "mdm1_track";
  var audio = document.getElementById("bg-music");
  if (!audio || audio.dataset.playlist) return;
  audio.dataset.playlist = "1";
  audio.loop = false;
  function nextTrack(a) {
    var cs = a.currentSrc || a.src || "", now = Date.now();
    if (a.__advFor === cs && now - (a.__advT || 0) < 3000) return;
    a.__advFor = cs; a.__advT = now;
    var m = cs.match(/\/audio\/(\d+)\.opus/), n = m ? (parseInt(m[1], 10) % N) + 1 : 1;
    var s = a.querySelectorAll("source"); for (var q = 0; q < s.length; q++) s[q].remove();
    a.loop = false; a.src = "/audio/" + n + ".opus";
    try { sessionStorage.setItem(KEY, String(n)); } catch (e) {}
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }
  audio.addEventListener("ended", function () { nextTrack(audio); });
  audio.addEventListener("error", function () { nextTrack(audio); });
  if (/\.opus(\?|$)/.test(audio.getAttribute("src") || "")) return;
  try {
    var i = parseInt(sessionStorage.getItem(KEY), 10);
    if (!(i >= 1 && i <= N)) {
      var m = location.pathname.match(/(\d+)\.html$/), h = 0, k = location.pathname;
      if (m) h = parseInt(m[1], 10); else for (var j = 0; j < k.length; j++) h = (h * 31 + k.charCodeAt(j)) >>> 0;
      i = (h % N) + 1;
    }
    var load = function (n) {
      var s = audio.querySelectorAll("source"); for (var q = 0; q < s.length; q++) s[q].remove();
      audio.src = "/audio/" + n + ".opus";
      try { sessionStorage.setItem(KEY, String(n)); } catch (e) {}
    };
    load(i);
  } catch (e) { /* keep the page's own source */ }
})();
