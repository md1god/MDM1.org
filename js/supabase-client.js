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
  window.signInWithProvider = function (provider) {
    var name = provider === "microsoft" ? "azure" : provider;
    var options = { redirectTo: location.origin + location.pathname };
    if (name === "azure") options.scopes = "email";
    return client.auth.signInWithOAuth({ provider: name, options: options });
  };

  // Sign in with the 6-digit code from the email. Unlike the link, a code cannot be burned by an email
  // scanner (Gmail / Outlook pre-open links, which gives "Email link is invalid or has expired").
  window.verifyEmailCode = function (email, code) {
    return client.auth.verifyOtp({ email: String(email || "").trim().toLowerCase(), token: String(code || "").replace(/\s+/g, ""), type: "email" });
  };

  // Errors Supabase appends to the URL after a failed redirect (#error=access_denied&error_description=...).
  try {
    var q = new URLSearchParams((location.hash || "").replace(/^#/, "") || location.search.replace(/^\?/, ""));
    if (q.get("error")) {
      window.mdm1AuthError = { code: q.get("error_code") || q.get("error"), message: q.get("error_description") || q.get("error") };
      history.replaceState(null, "", location.pathname);
    }
  } catch (e) { /* ignore */ }

  window.signOutMember = function () { return client.auth.signOut(); };

  window.getSubscriberCount = async function () {
    try { var r = await client.rpc("subscriber_count"); return r.error ? null : Number(r.data); } catch (e) { return null; }
  };
})();
