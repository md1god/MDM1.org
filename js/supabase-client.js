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

  window.getSubscriberCount = async function () {
    try { var r = await client.rpc("subscriber_count"); return r.error ? null : Number(r.data); } catch (e) { return null; }
  };
  window.subscribeEmail = async function (email, first, last) {
    var row = { email: String(email || "").trim().toLowerCase() };
    if (first) row.first_name = String(first).trim().slice(0, 80);
    if (last) row.last_name = String(last).trim().slice(0, 80);
    var r = await client.from("subscribers").insert(row);
    if (r.error && r.error.code === "23505") return { ok: true, duplicate: true };   // already subscribed
    return { ok: !r.error, error: r.error ? r.error.message : null };
  };
})();
