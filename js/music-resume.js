/* MDM1 — keeps the background song and its position across page navigations (same tab).
   Idempotent; works with any page that has <audio id="bg-music"> (static or created by global.js). */
(function () {
  "use strict";
  if (window.__mdm1MusicResume) return; window.__mdm1MusicResume = 1;
  var KEY = "mdm1_music_pos", CHOICE = "mdm1_music_choice", MAX_AGE = 30 * 60 * 1000;
  function rd() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function wr(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function path(u) { try { return new URL(u, location.href).pathname; } catch (e) { return ""; } }

  function setup(a) {
    if (a._mr) return; a._mr = 1;
    var yes = false; try { yes = sessionStorage.getItem(CHOICE) === "yes"; } catch (e) {}
    var s = rd(), applied = !(yes && s && s.src && s.t > 0 && Date.now() - s.ts < MAX_AGE);
    var playedOnce = false;
    if (!applied) {
      var cur = path(a.currentSrc || a.getAttribute("src") || a.src || "");
      if (cur !== s.src) {
        a.querySelectorAll("source").forEach(function (x) { x.remove(); });
        a.src = s.src;
        var m = s.src.match(/\/audio\/(\d+)\.opus$/);
        if (m) { try { sessionStorage.setItem("mdm1_track", m[1]); } catch (e) {} }
      }
      a.addEventListener("loadedmetadata", function () {
        if (playedOnce || applied === "done") return;
        var d = a.duration, t = s.t + (s.p ? (Date.now() - s.ts) / 1000 : 0);
        if (d && isFinite(d)) t = t % d;
        try { a.currentTime = Math.max(0, t); } catch (e) {}
      });
    }
    a.addEventListener("playing", function () { playedOnce = true; });
    var last = 0;
    function save(force) {
      if (!playedOnce && !force) return;
      var src = path(a.currentSrc || a.src || ""); if (!src) return;
      if (!playedOnce && a.currentTime < 0.5) return;
      wr({ src: src, t: a.currentTime, ts: Date.now(), p: a.paused ? 0 : 1 });
    }
    a.addEventListener("timeupdate", function () { var n = Date.now(); if (n - last > 1000) { last = n; save(); } });
    a.addEventListener("pause", function () { save(); });
    window.addEventListener("pagehide", function () { save(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") save(); });
  }

  function find(tries) {
    var a = document.getElementById("bg-music");
    if (a && a.tagName === "AUDIO") return setup(a);
    if (tries > 0) setTimeout(function () { find(tries - 1); }, 150);
  }
  function go() { setTimeout(function () { find(20); }, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
