/* MDM1 — background music memory (same tab/session).
   1) Each page keeps its own song and resumes from where it stopped when you come back to it.
   2) A song is never restarted from 0 on another page: positions are also kept per song, so a song shared
      by several pages carries on where it left off (you gradually hear all of it).
   3) A page visited for the first time never starts with the song you just heard on the previous page.
   Idempotent; works with <audio id="bg-music"> (static or created by global.js). */
(function () {
  "use strict";
  if (window.__mdm1MusicResume) return; window.__mdm1MusicResume = 1;
  var KEY = "mdm1_music_v2", TRACKS = 12;
  function rd() { try { var o = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (o && o.pages && o.tracks) return o; } catch (e) {} return { pages: {}, tracks: {}, last: "" }; }
  function wr(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function path(u) { try { return new URL(u, location.href).pathname; } catch (e) { return ""; } }
  var PAGE = location.pathname.replace(/index\.html$/, "");
  var TRK = /\/audio\/(\d+)\.opus$/;

  function setup(a) {
    if (a._mr) return; a._mr = 1;
    var st = rd(), mine = st.pages[PAGE];
    var cur = path(a.currentSrc || a.getAttribute("src") || a.src || "");
    var src = cur, t = 0;
    if (mine && mine.src) { src = mine.src; t = mine.t || 0; }
    else {
      var m = cur.match(TRK);
      if (m && st.last && st.last === cur) {            // new page whose song equals the one just heard → take the next song
        src = "/audio/" + ((parseInt(m[1], 10) % TRACKS) + 1) + ".opus";
      }
      t = (st.tracks[src] && st.tracks[src].t) || 0;     // continue that song where it stopped
    }
    var swap = src && src !== cur && (TRK.test(src) || !!mine);
    if (swap) {
      a.querySelectorAll("source").forEach(function (x) { x.remove(); });
      a.src = src;
      var mm = src.match(TRK);
      if (mm) { try { sessionStorage.setItem("mdm1_track", mm[1]); } catch (e) {} }
    }
    var playedOnce = false;
    if (t > 1) {
      a.addEventListener("loadedmetadata", function () {
        if (playedOnce) return;
        var d = a.duration, x = t; if (d && isFinite(d)) { if (x > d - 3) x = 0; }
        try { a.currentTime = x; } catch (e) {}
      });
    }
    a.addEventListener("playing", function () { playedOnce = true; });
    var last = 0;
    function save() {
      if (!playedOnce) return;
      var s = path(a.currentSrc || a.src || ""); if (!s) return;
      var o = rd(), d = a.duration, pos = a.currentTime;
      if (d && isFinite(d) && pos > d - 3) pos = 0;      // finished → next time start over
      o.pages[PAGE] = { src: s, t: pos }; o.tracks[s] = { t: pos }; o.last = s; wr(o);
    }
    a.addEventListener("timeupdate", function () { var n = Date.now(); if (n - last > 1000) { last = n; save(); } });
    a.addEventListener("pause", save);
    a.loop = false;
    a.addEventListener("ended", function () {
      save();
      var cs = a.currentSrc || a.src || "", now = Date.now();
      if (a.__advFor === cs && now - (a.__advT || 0) < 3000) return;   // another handler already advanced
      a.__advFor = cs; a.__advT = now;
      var m = cs.match(/\/audio\/(\d+)\.opus/), n = m ? (parseInt(m[1], 10) % TRACKS) + 1 : 1;
      a.querySelectorAll("source").forEach(function (x) { x.remove(); });
      a.src = "/audio/" + n + ".opus";
      try { sessionStorage.setItem("mdm1_track", String(n)); } catch (e) {}
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    });
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") save(); });
  }

  function find(n) {
    var a = document.getElementById("bg-music");
    if (a && a.tagName === "AUDIO") return setup(a);
    if (n > 0) setTimeout(function () { find(n - 1); }, 150);
  }
  function go() { setTimeout(function () { find(20); }, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
