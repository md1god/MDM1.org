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

  window.sendMagicLink = function (email, meta) {                     // passwordless sign-up / sign-in (join + ideas pages)
    meta = meta || {};
    var data = {};
    if (meta.name) data.name = String(meta.name).trim().slice(0, 80);
    if (meta.country) data.country = String(meta.country).trim().slice(0, 60);
    return client.auth.signInWithOtp({ email: String(email || "").trim().toLowerCase(),
      options: { emailRedirectTo: location.origin + location.pathname, data: data } });
  };
  window.signOutMember = function () { return client.auth.signOut(); };

  window.getSubscriberCount = async function () {
    try { var r = await client.rpc("subscriber_count"); return r.error ? null : Number(r.data); } catch (e) { return null; }
  };
})();
