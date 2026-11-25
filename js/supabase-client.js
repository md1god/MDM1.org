/* MDM1 - Supabase client for the whole site.
   Only the project URL and the PUBLISHABLE key live here: they are designed to be public, and security comes from
   Row Level Security (see supabase/migrations). The secret / service_role key must never appear in the repo or in any page. */
(function () {
  "use strict";
  var URL = "https://fksjltytevcmpjxzamhp.supabase.co";
  var KEY = "sb_publishable_fFnLwsu5bB3w-WRSsYoPWw_M3iLhDS-";
  var lib = window.supabase;
  if (!lib || typeof lib.createClient !== "function") return;     // library not loaded: pages keep working without it
  var client = lib.createClient(URL, KEY);
  window.supabaseLib = lib;
  window.supabase = client;                                        // pages call supabase.from(...) / supabase.auth.* directly
  if (typeof client.createClient !== "function") client.createClient = lib.createClient;   // js/ads.js still calls supabase.createClient(...)

  // Verify the one-time email code returned by signInWithOtp.
  // Supabase establishes the authenticated session; never trust a browser-local profile as identity.
  window.verifyEmailCode = function (email, token) {
    return client.auth.verifyOtp({
      email: String(email || "").trim().toLowerCase(),
      token: String(token || "").replace(/\s+/g, ""),
      type: "email"
    });
  };

  window.sendMagicLink = function (email, meta) {                     // passwordless sign-up / sign-in (join + ideas pages)
    meta = meta || {};
    var data = {};
    if (meta.name) data.name = String(meta.name).trim().slice(0, 80);
    if (meta.country) data.country = String(meta.country).trim().slice(0, 60);
    return client.auth.signInWithOtp({ email: String(email || "").trim().toLowerCase(),
      options: { emailRedirectTo: location.origin + location.pathname, data: data } });
  };
  // Cooldown guard: Supabase rejects repeat sends with 429 ("only request this after N seconds"), so we stop the
  // request on the client and tell the visitor how long to wait instead of showing a generic failure.
  var COOLDOWN_MS = 60000, lastSend = 0;
  var rawSend = window.sendMagicLink;
  window.sendMagicLink = function (email, meta) {
    var wait = COOLDOWN_MS - (Date.now() - lastSend);
    if (wait > 0) return Promise.resolve({ data: null, error: { code: "cooldown", message: "انتظر " + Math.ceil(wait / 1000) + " ثانية قبل إعادة الإرسال" } });
    lastSend = Date.now();
    return rawSend(email, meta).then(function (r) {
      if (r && r.error) { lastSend = /rate|429|after \d+ seconds/i.test(String(r.error.message || "") + String(r.error.code || "")) ? Date.now() : 0; }
      return r;
    });
  };

  // One-tap sign-in with Google or Microsoft ("microsoft" is "azure" inside Supabase).
  // The providers must be enabled in Supabase Dashboard > Authentication > Providers.
  // Which OAuth providers are switched on in Supabase (GET /auth/v1/settings -> { external: { google: true, ... } }).
  // A disabled provider makes /authorize answer with a raw JSON 400 page that replaced the whole site; checking first lets
  // the sign-in dialog say "not enabled" instead. If this lookup fails for any reason we simply continue as before.
  var settingsP = null;
  function providerEnabled(name) {
    if (typeof fetch !== "function") return Promise.resolve(true);
    if (!settingsP) {
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : 0;
      settingsP = fetch(URL + "/auth/v1/settings", { headers: { apikey: KEY }, cache: "no-store", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(timer); return r.ok ? r.json() : null; })
        .catch(function () { clearTimeout(timer); return null; })
        .then(function (j) { if (!j) settingsP = null; return j; });   // do not cache a failed lookup
    }
    return settingsP.then(function (j) { return j && j.external && typeof j.external[name] === "boolean" ? j.external[name] : true; });
  }

  // OAuth runs in a small popup (a new tab on phones) so the page the visitor is on is never reloaded: the background
  // music keeps playing and nothing is lost. If the browser blocks the popup we fall back to the normal redirect.
  var POP_KEY = "mdm1_oauth_popup";
  window.signInWithProvider = function (provider) {
    var name = provider === "microsoft" ? "azure" : provider;
    var options = { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true };
    if (name === "azure") options.scopes = "email";
    return providerEnabled(name).then(function (on) {
      if (!on) return { data: null, error: { code: "provider_disabled", message: "provider is not enabled" } };
      return client.auth.signInWithOAuth({ provider: name, options: options }).then(function (r) {
        if (!r || r.error || !r.data || !r.data.url) return r;
        var w = null;
        try { w = window.open(r.data.url, "mdm1auth", "popup=yes,width=480,height=700"); } catch (e) { w = null; }
        if (!w || w.closed) { location.assign(r.data.url); return r; }
        try { localStorage.setItem(POP_KEY, String(Date.now())); } catch (e) {}
        return r;
      });
    });
  };
  // The popup lands back on this site: once the session is stored (the page that opened it picks it up on its own),
  // the popup closes itself. Only for a return that this browser started a moment ago.
  (function () {
    var back = false;
    try {
      var t = Number(localStorage.getItem(POP_KEY)) || 0, tail = String(location.hash) + String(location.search);
      if (t && Date.now() - t < 300000) {
        if (/[#?&](access_token|code)=/.test(tail)) back = true;
        else if (/[#?&]error=/.test(tail)) localStorage.removeItem(POP_KEY);
      }
    } catch (e) {}
    if (!back) return;
    client.auth.onAuthStateChange(function (ev, session) {
      if (!session || (ev !== "SIGNED_IN" && ev !== "INITIAL_SESSION")) return;
      try { localStorage.removeItem(POP_KEY); } catch (e) {}
      setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
    });
  })();

  window.signOutMember = function () { return client.auth.signOut(); };

  window.getSubscriberCount = async function () {
    try { var r = await client.rpc("subscriber_count"); return r.error ? null : Number(r.data); } catch (e) { return null; }
  };
})();
