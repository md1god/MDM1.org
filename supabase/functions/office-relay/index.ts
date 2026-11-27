// ============================================================================
// Supabase Edge Function: office-relay (pwa21 hard-security batch)
// ----------------------------------------------------------------------------
// Static PWA bridge. All protected actions require:
//   apikey: <public Supabase publishable/anon key>   (pinned to server env)
//   Authorization: Bearer <Supabase access_token>    (verified via auth/v1/user)
// The scheduled Actions runner uses x-office-queue-secret instead of a JWT.
// No owner/shared secret is accepted anywhere.
//
// SECURITY: model keys are NEVER read here. `chat` and `models` tell the client
// to use keys it supplies in the browser. Only deterministic, no-model work
// runs server-side. ar: لا توجد مفاتيح نماذج على السيرفر إطلاقاً.
//
// Secrets / env (Supabase Edge Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   OFFICE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEYS —
//     pinned public keys (the dashboard reserves the SUPABASE_ prefix for
//     custom secrets, so OFFICE_PUBLISHABLE_KEY is the configurable one),
//   OFFICE_QUEUE_SECRET            — required for `queue_run` (Actions runner),
//   OFFICE_OTP_SALT                — server salt for SHA-256(code + salt),
//   GROQ_DAILY_LIMIT (default 200), OPENROUTER_DAILY_LIMIT (default 200),
//   TELEGRAM_BOT_TOKEN, OFFICE_TELEGRAM_CHAT_ID (optional),
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION,
//   OFFICE_WHATSAPP_TO (optional default recipient)
// ============================================================================

const USER_KEYS_MESSAGE = 'User-provided keys only; connect your own key in the browser.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OTP_ATTEMPTS = 5;

type AuthUser = { id: string; email: string };

const env = (name: string): string => (Deno.env.get(name) || '').trim();

// Supabase exposes publishable keys as a JSON dictionary under the default
// SUPABASE_PUBLISHABLE_KEYS secret. The dashboard does not allow custom secrets
// beginning with SUPABASE_, so OFFICE_PUBLISHABLE_KEY is the explicit override.
function acceptedPublicKeys(): string[] {
  const keys = new Set<string>();
  for (const value of [env('OFFICE_PUBLISHABLE_KEY'), env('SUPABASE_ANON_KEY')]) {
    if (value) keys.add(value);
  }
  const raw = env('SUPABASE_PUBLISHABLE_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const values = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) keys.add(value.trim());
      }
    } catch (_) { /* malformed default secret: rely on explicit keys */ }
  }
  return [...keys];
}

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed =
    /^https:\/\/(www\.)?mdm1\.org$/.test(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://mdm1.org',
    'Access-Control-Allow-Headers':
      'authorization, apikey, x-client-info, content-type, x-office-queue-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

type Send = (data: unknown, status?: number) => Response;
const json = (req: Request, data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), 'content-type': 'application/json' }
  });

// Length-independent comparison for shared secrets (no timing shortcut on content).
function secretEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// E.164 normalization using the dial code supplied by the browser.
function normalizePhone(input: unknown, dialCode: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  }
  const dial = String(dialCode ?? '').replace(/\D/g, '');
  if (!dial || !digits) return '';
  let national = digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  national = national.replace(/^0+/, '');
  const full = `${dial}${national}`;
  return full.length >= 8 && full.length <= 15 ? `+${full}` : '';
}

// Portal summaries are displayed publicly: scalar/array values only, sensitive
// key names and key-looking values are dropped. ar: ملخص بوابة العميل بدون أسرار.
const SENSITIVE_KEY = /(pass|secret|token|key|credential|auth|otp|code|pin|email|phone|mobile|address|private|session|cookie|signature|jwk|mnemonic|wallet)/i;
const SENSITIVE_VALUE = /(sk-|gsk_|ghp_|bearer\s|BEGIN .*PRIVATE KEY|^\d{6}$)/i;
function sanitizeSummary(input: any, depth = 0): any {
  if (input == null || depth > 3) return null;
  if (typeof input === 'string') {
    const s = input.slice(0, 500);
    return SENSITIVE_VALUE.test(s) ? null : s;
  }
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input === 'boolean') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((v) => sanitizeSummary(v, depth + 1)).filter((v) => v !== null);
  }
  if (typeof input !== 'object') return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input).slice(0, 40)) {
    if (SENSITIVE_KEY.test(k)) continue;
    const safe = sanitizeSummary(v, depth + 1);
    if (safe !== null) out[k.slice(0, 60)] = safe;
  }
  return out;
}

// The accepted public keys are pinned to server env (publishable and/or the
// legacy anon JWT) so a key from another Supabase project is never accepted.
// Both values are public; the service-role key is never accepted here.
// ar: منع رموز مشاريع أخرى عبر تثبيت المفاتيح العامة في إعدادات السيرفر.
function checkApiKey(req: Request): { ok: true; key: string } | { ok: false; status: number; error: string } {
  const expected = acceptedPublicKeys();
  if (!expected.length) return { ok: false, status: 503, error: 'publishable key not configured' };
  const supplied = req.headers.get('apikey') || '';
  if (!supplied) return { ok: false, status: 401, error: 'apikey required' };
  if (!expected.some((key) => secretEquals(supplied, key))) {
    return { ok: false, status: 401, error: 'invalid apikey' };
  }
  return { ok: true, key: supplied };
}

// Verify the JWT with Supabase itself; never trust body.user_id.
async function verifyGoogleJwt(
  req: Request,
  apikey: string
): Promise<{ ok: true; user: AuthUser } | { ok: false; status: number; error: string }> {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  if (!match) return { ok: false, status: 401, error: 'missing bearer token' };
  const supabaseUrl = env('SUPABASE_URL').replace(/\/+$/, '');
  if (!supabaseUrl) return { ok: false, status: 503, error: 'relay backend not configured' };

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey, Authorization: `Bearer ${match[1].trim()}` }
    });
  } catch (_) {
    return { ok: false, status: 502, error: 'auth service unavailable' };
  }
  if (!res.ok) return { ok: false, status: 401, error: 'invalid or expired token' };

  let j: any = {};
  try { j = await res.json(); } catch (_) { return { ok: false, status: 401, error: 'invalid auth response' }; }
  if (j?.app_metadata?.provider !== 'google') {
    return { ok: false, status: 403, error: 'Google sign-in required' };
  }
  const email = String(j.email || '').trim();
  if (!email) return { ok: false, status: 403, error: 'Google email required' };
  const id = String(j.sub || j.id || '');
  if (!UUID_RE.test(id)) return { ok: false, status: 401, error: 'invalid user subject' };
  return { ok: true, user: { id, email } };
}

function backend(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL').replace(/\/+$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url, key } : null;
}

// Service-role-only database helper. The key is never returned to the client.
async function db(
  path: string,
  opts: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<Response> {
  const b = backend();
  if (!b) throw new Error('relay backend not configured');
  const headers: Record<string, string> = {
    apikey: b.key,
    Authorization: `Bearer ${b.key}`,
    'Content-Type': 'application/json'
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  return fetch(`${b.url}/rest/v1${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
}

async function dbRows(path: string): Promise<any[]> {
  const res = await db(path);
  if (!res.ok) throw new Error(`db read failed: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

async function rpc(name: string, args: Record<string, unknown>) {
  const res = await db(`/rpc/${name}`, { method: 'POST', body: args });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch (_) { /* non-json error */ }
  let error: string | null = null;
  if (!res.ok) {
    error = String((data && (data.message || data.error)) || text).slice(0, 300);
  }
  return { ok: res.ok, status: res.status, data, error };
}

function quotaLimit(provider: string): number {
  const raw = provider === 'groq' ? env('GROQ_DAILY_LIMIT') : env('OPENROUTER_DAILY_LIMIT');
  const n = Number(raw || 200);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 200;
}

function generateOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

/* ── 1/2. per-user encrypted state ───────────────────────────────────────── */

async function handleStateGet(send: Send, user: AuthUser) {
  const rows = await dbRows(
    `/office_user_state?user_id=eq.${encodeURIComponent(user.id)}&select=blob,version,updated_at&limit=1`
  );
  const row = rows[0] || null;
  return send({
    ok: true,
    blob: row ? String(row.blob || '') : '',
    version: row ? Number(row.version || 0) : 0,
    updated_at: row ? (row.updated_at || null) : null
  });
}

async function handleStatePut(send: Send, body: any, user: AuthUser) {
  const blob = String(body.blob ?? '');
  const expected = Number(body.expected);
  if (!blob || blob.length > 8_000_000 || !Number.isInteger(expected) || expected < 0) {
    return send({ ok: false, error: 'blob and non-negative integer expected are required' }, 400);
  }
  const out = await rpc('office_user_state_write', {
    p_user_id: user.id, p_blob: blob, p_expected: expected
  });
  if (!out.ok || !Array.isArray(out.data) || !out.data[0]) {
    return send({ ok: false, error: 'state write failed', detail: out.error }, 502);
  }
  const row = out.data[0];
  return send({
    ok: true,
    version: Number(row.version),
    conflict: Boolean(row.conflict),
    blob: String(row.blob || '')
  });
}

/* ── 3/4. portal links (hash-only, non-sensitive summary) ────────────────── */

async function handlePortalCreate(send: Send, body: any, user: AuthUser) {
  const token = String(body.token || '');
  if (token.length < 12 || token.length > 1024) {
    return send({ ok: false, error: 'token required (12-1024 chars)' }, 400);
  }
  const rawTtl = Number(body.ttlHours ?? 6);
  const ttlHours = Number.isFinite(rawTtl) ? Math.min(720, Math.max(0.25, rawTtl)) : 6;
  const expires_at = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  const summary = sanitizeSummary(body.summary || {});
  const token_hash = await sha256Hex(token);

  const res = await db('/office_portal_links?on_conflict=token_hash', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { token_hash, summary, created_by: user.id, expires_at, revoked: false }
  });
  if (!res.ok) return send({ ok: false, error: 'portal link save failed', detail: (await res.text()).slice(0, 200) }, 502);
  return send({ ok: true, expires_at, summary });
}

async function handlePortalGet(send: Send, body: any) {
  const token = String(body.token || '');
  if (!token) return send({ ok: false, error: 'token required' }, 400);
  const rows = await dbRows(
    `/office_portal_links?token_hash=eq.${await sha256Hex(token)}&select=summary,expires_at,revoked&limit=1`
  );
  const row = rows[0] || null;
  if (!row) return send({ ok: false, error: 'portal link not found' }, 404);
  if (row.revoked || !row.expires_at || Date.parse(row.expires_at) <= Date.now()) {
    return send({ ok: false, error: 'portal link expired or revoked' }, 410);
  }
  return send({ ok: true, summary: row.summary || {}, expires_at: row.expires_at });
}

/* ── 5/6. daily quota ────────────────────────────────────────────────────── */

function validProvider(value: unknown): value is 'groq' | 'openrouter' {
  return value === 'groq' || value === 'openrouter';
}

async function handleQuotaReserve(send: Send, body: any, user: AuthUser) {
  if (!validProvider(body.provider)) return send({ ok: false, error: 'provider must be groq or openrouter' }, 400);
  const cost = Number(body.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1000) {
    return send({ ok: false, error: 'invalid cost' }, 400);
  }
  const out = await rpc('office_quota_reserve', {
    p_user_id: user.id, p_provider: body.provider, p_cost: cost, p_limit: quotaLimit(body.provider)
  });
  if (!out.ok || !Array.isArray(out.data) || !out.data[0]) {
    return send({ ok: false, error: 'quota reserve failed', detail: out.error }, 502);
  }
  const row = out.data[0];
  return send({
    ok: true,
    allowed: Boolean(row.allowed),
    used: Number(row.used || 0),
    limit: Number(row.daily_limit || 0),
    day: row.day
  });
}

async function handleQuotaRelease(send: Send, body: any, user: AuthUser) {
  if (!validProvider(body.provider)) return send({ ok: false, error: 'provider must be groq or openrouter' }, 400);
  const cost = Number(body.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1000) {
    return send({ ok: false, error: 'invalid cost' }, 400);
  }
  const out = await rpc('office_quota_release', {
    p_user_id: user.id, p_provider: body.provider, p_cost: cost
  });
  if (!out.ok || !Array.isArray(out.data) || !out.data[0]) {
    return send({ ok: false, error: 'quota release failed', detail: out.error }, 502);
  }
  const row = out.data[0];
  return send({ ok: true, used: Number(row.used || 0), cost: Number(row.cost || 0), day: row.day });
}

/* ── 7/8/9. OTP + identities ─────────────────────────────────────────────── */

async function storeOtp(
  target_hash: string,
  channel: string,
  code_hash: string,
  expires_at: string,
  meta: Record<string, unknown>
): Promise<boolean> {
  const res = await db('/office_otp_codes?on_conflict=target_hash,channel', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { target_hash, channel, code_hash, expires_at, attempts: 0, used: false, meta }
  });
  return res.ok;
}

async function invalidateOtp(target_hash: string, channel: string) {
  await db(`/office_otp_codes?target_hash=eq.${target_hash}&channel=eq.${channel}`, {
    method: 'PATCH', body: { used: true }
  });
}

async function knownTelegramChat(target_hash: string): Promise<string> {
  const rows = await dbRows(
    `/office_otp_codes?target_hash=eq.${target_hash}&channel=eq.telegram&select=meta&order=created_at.desc&limit=20`
  );
  for (const row of rows) {
    const id = String(row?.meta?.telegram_chat_id || '').replace(/\D/g, '');
    if (id) return id;
  }
  return '';
}

async function handleOtpSend(send: Send, body: any, user: AuthUser) {
  const channel = String(body.channel || '').toLowerCase();
  if (!['telegram', 'whatsapp', 'google'].includes(channel)) {
    return send({ ok: false, error: 'channel must be telegram, whatsapp or google' }, 400);
  }
  if (channel === 'google') {
    // Google users already have a verified identity; no OTP is minted here.
    return send({ ok: true, handled: false, message: 'Use Google sign-in' });
  }

  const salt = env('OFFICE_OTP_SALT');
  if (!salt) return send({ ok: false, error: 'OTP salt not configured' }, 503);

  const target = normalizePhone(body.target, body.dialCode);
  if (!target) return send({ ok: false, error: 'invalid phone target; provide target and dialCode' }, 400);

  const code = generateOtp();
  const codeHash = await sha256Hex(code + salt); // plaintext code never stored
  const targetHash = await sha256Hex(target);
  const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();
  const suppliedChat = String(body.chatId ?? '').replace(/\D/g, '');
  const chatId = channel === 'telegram'
    ? (suppliedChat || await knownTelegramChat(targetHash))
    : '';

  let botToken = '';
  let waToken = '';
  let phoneId = '';
  if (channel === 'telegram') {
    botToken = env('TELEGRAM_BOT_TOKEN');
    if (!botToken) return send({ ok: false, error: 'no telegram bot token' }, 503);
    if (!chatId) {
      return send({ ok: false, error: 'telegram chat id unknown; start the bot and pass chatId' }, 400);
    }
  } else {
    waToken = env('WHATSAPP_ACCESS_TOKEN');
    phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
    if (!waToken || !phoneId) return send({ ok: false, error: 'no whatsapp credentials' }, 503);
  }

  const meta = {
    user_id: user.id,
    email: user.email,
    target,
    purpose: String(body.purpose || '').slice(0, 120),
    telegram_chat_id: chatId ? Number(chatId) : null
  };
  if (!await storeOtp(targetHash, channel, codeHash, expires_at, meta)) {
    return send({ ok: false, error: 'otp storage failed' }, 502);
  }

  let delivered = false;
  if (channel === 'telegram') {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: `🔐 MDM1 OTP: <code>${code}</code> (10 دقائق / 10 min)`,
        parse_mode: 'HTML'
      })
    });
    delivered = res.ok;
  } else {
    const version = env('WHATSAPP_API_VERSION') || 'v21.0';
    const res = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: target.replace(/\D/g, ''),
          type: 'text',
          text: { body: `MDM1 OTP: ${code}`, preview_url: false }
        })
      }
    );
    delivered = res.ok;
  }

  if (!delivered) {
    await invalidateOtp(targetHash, channel);
    return send({ ok: false, error: `otp delivery failed via ${channel}` }, 502);
  }
  // The response never contains the code — no demo codes in production.
  return send({ ok: true, handled: true, channel, expires_at });
}

async function handleOtpVerify(send: Send, body: any, user: AuthUser) {
  const channel = String(body.channel || '').toLowerCase();
  if (channel === 'google') {
    return send({
      ok: false, handled: false, linked: false,
      message: 'Use Google sign-in', error: 'Use Google sign-in'
    }, 400);
  }
  if (!['telegram', 'whatsapp'].includes(channel)) {
    return send({ ok: false, error: 'channel must be telegram or whatsapp' }, 400);
  }
  const salt = env('OFFICE_OTP_SALT');
  if (!salt) return send({ ok: false, error: 'OTP salt not configured' }, 503);

  const target = normalizePhone(body.target, body.dialCode);
  if (!target) return send({ ok: false, error: 'invalid phone target; provide target and dialCode' }, 400);
  const code = String(body.code || '').trim();
  if (!/^\d{6}$/.test(code)) return send({ ok: false, error: 'invalid code format' }, 400);

  const out = await rpc('office_otp_consume', {
    p_target_hash: await sha256Hex(target),
    p_channel: channel,
    p_code_hash: await sha256Hex(code + salt),
    p_email: user.email,
    p_max_attempts: MAX_OTP_ATTEMPTS
  });
  if (!out.ok || !Array.isArray(out.data) || !out.data[0]) {
    return send({ ok: false, error: 'otp verification failed', detail: out.error }, 502);
  }
  const row = out.data[0];
  if (!row.ok) {
    return send({ ok: false, error: row.error || 'invalid code', attempts_left: Number(row.attempts_left || 0) }, 400);
  }
  return send({ ok: true, linked: true, channel, attempts_left: Number(row.attempts_left || 0) });
}

async function handleIdentityGet(send: Send, user: AuthUser) {
  const rows = await dbRows(
    `/office_identities?user_id=eq.${encodeURIComponent(user.id)}&select=telegram,whatsapp,google_email,updated_at&limit=1`
  );
  const identities = rows[0] || {
    telegram: null, whatsapp: null, google_email: user.email, updated_at: null
  };
  return send({
    ok: true,
    identities,
    telegram: identities.telegram || null,
    whatsapp: identities.whatsapp || null,
    google_email: identities.google_email || user.email
  });
}

/* ── 10/11/12/13. deterministic task queue ──────────────────────────────── */

// Supported deterministic queue_run actions; unknown ones are failed, never
// delegated to a model. ar: الإجراءات المعروفة؛ أي إجراء آخر يُسجَّل كفشل.
const QUEUE_ACTIONS = ['mark_done', 'notify', 'archive'];

async function handleQueueAdd(send: Send, body: any, user: AuthUser) {
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return send({ ok: false, error: 'payload object required' }, 400);
  }
  if (JSON.stringify(payload).length > 20_000) return send({ ok: false, error: 'payload too large' }, 400);

  let runAfter = new Date();
  if (body.runAfter) {
    runAfter = new Date(body.runAfter);
    if (Number.isNaN(runAfter.getTime())) return send({ ok: false, error: 'invalid runAfter' }, 400);
    runAfter = new Date(Math.min(runAfter.getTime(), Date.now() + 365 * 86400_000));
  }
  const kind = String(body.kind || 'generic').slice(0, 60) || 'generic';
  const res = await db('/office_task_queue', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      user_id: user.id, kind, payload, status: 'pending',
      run_after: runAfter.toISOString(), attempts: 0
    }
  });
  if (!res.ok) return send({ ok: false, error: 'queue insert failed', detail: (await res.text()).slice(0, 200) }, 502);
  const row = (await res.json())[0] || {};
  return send({ ok: true, id: row.id, status: 'pending', run_after: row.run_after });
}

async function handleQueueList(send: Send, user: AuthUser) {
  const rows = await dbRows(
    `/office_task_queue?user_id=eq.${encodeURIComponent(user.id)}` +
    `&select=id,kind,payload,status,run_after,attempts,result,created_at,updated_at` +
    `&order=created_at.desc&limit=200`
  );
  return send({ ok: true, tasks: rows });
}

async function handleQueueComplete(send: Send, body: any, user: AuthUser) {
  const id = String(body.id || '');
  if (!UUID_RE.test(id)) return send({ ok: false, error: 'invalid task id' }, 400);
  let result: any = { action: 'client_complete', ok: true };
  if (body.result && typeof body.result === 'object') {
    result = sanitizeSummary(body.result) || result;
  }
  const out = await rpc('office_task_finish', {
    p_id: id, p_user_id: user.id, p_status: 'done', p_result: result
  });
  if (!out.ok) return send({ ok: false, error: 'queue complete failed', detail: out.error }, 502);
  if (out.data !== true) return send({ ok: false, error: 'task not found for this user' }, 404);
  return send({ ok: true, id, status: 'done' });
}

// No model calls: only Telegram/WhatsApp text delivery using messaging secrets.
async function deliverNotification(payload: any) {
  const channel = payload.channel === 'whatsapp' ? 'whatsapp' : 'telegram';
  const text = String(payload.text || payload.message || '').slice(0, 4000) || 'MDM1 office notification';
  const out: any = { ok: false, channel, telegram: { ok: false, skipped: true }, whatsapp: { ok: false, skipped: true } };

  if (channel === 'telegram') {
    const token = env('TELEGRAM_BOT_TOKEN');
    const chatId = String(payload.chatId || env('OFFICE_TELEGRAM_CHAT_ID') || '').replace(/\D/g, '');
    if (!token || !chatId) {
      out.error = !token ? 'no bot token' : 'no chat id';
      return out;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId), text, disable_web_page_preview: true })
    });
    out.telegram = { ok: res.ok, status: res.status };
    out.ok = res.ok;
  } else {
    const token = env('WHATSAPP_ACCESS_TOKEN');
    const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
    const to = String(payload.to || env('OFFICE_WHATSAPP_TO') || '').replace(/\D/g, '').slice(0, 15);
    if (!token || !phoneId || !to) {
      out.error = !token || !phoneId ? 'no whatsapp credentials' : 'no recipient';
      return out;
    }
    const version = env('WHATSAPP_API_VERSION') || 'v21.0';
    const res = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4096), preview_url: false }
        })
      }
    );
    const body = await res.json().catch(() => ({}));
    out.whatsapp = { ok: res.ok, status: res.status, messageId: body?.messages?.[0]?.id || null };
    out.ok = res.ok;
  }
  return out;
}

async function handleQueueRun(send: Send, supplied: string) {
  // Never fall back to OFFICE_RELAY_SECRET: that value is entered in the
  // browser's connection panel and must not authorize scheduled queue runs.
  const expected = env('OFFICE_QUEUE_SECRET');
  if (!expected || !secretEquals(supplied, expected)) {
    return send({ ok: false, error: 'invalid queue secret' }, 401);
  }

  const claim = await rpc('office_task_claim', { p_limit: 25 });
  if (!claim.ok || !Array.isArray(claim.data)) {
    return send({ ok: false, error: 'queue claim failed', detail: claim.error }, 502);
  }
  const tasks = claim.data;
  const counts = { claimed: tasks.length, done: 0, failed: 0, archived: 0, unknown: 0 };
  const results: any[] = [];

  for (const task of tasks) {
    const action = String(task.payload?.action || '');
    let status = 'failed';
    let result: any = {
      action,
      ok: false,
      error: `unknown deterministic action (supported: ${QUEUE_ACTIONS.join(', ')})`
    };

    // A failed delivery must not strand this row in "running" or abort the
    // rest of the batch: every claimed task is always finished explicitly.
    try {
      if (action === 'mark_done') {
        status = 'done';
        result = { action, ok: true, note: 'marked done by queue runner' };
      } else if (action === 'archive') {
        status = 'archived';
        result = { action, ok: true, note: 'archived by queue runner' };
      } else if (action === 'notify') {
        const delivery = await deliverNotification(task.payload || {});
        status = delivery.ok ? 'done' : 'failed';
        result = { action, ok: delivery.ok, channel: delivery.channel, error: delivery.error || null };
      } else {
        counts.unknown++;
      }
    } catch (err) {
      status = 'failed';
      result = { action, ok: false, error: String((err as Error)?.message || err).slice(0, 300) };
    }

    if (status === 'done') counts.done++;
    else if (status === 'archived') counts.archived++;
    else counts.failed++;

    let finished = false;
    try {
      const out = await rpc('office_task_finish', {
        p_id: task.id, p_user_id: null, p_status: status, p_result: result
      });
      finished = out.ok && out.data === true;
    } catch (_) { /* reported in results; SQL reclaims stale rows as a fallback */ }
    results.push({ id: task.id, status, action, ok: status !== 'failed', finished });
  }

  return send({ ok: true, action: 'queue_run', ...counts, results });
}

/* ── legacy outbound message (unchanged API) ─────────────────────────────── */

async function handleLegacyMessage(send: Send, body: any, req: Request) {
  const text = String(body.text || '').slice(0, 4000);
  if (!text) return send({ ok: false, error: 'text required' }, 400);

  const channel = ['telegram', 'whatsapp', 'both'].includes(body.channel) ? body.channel : 'telegram';
  const chatId = body.chatId || env('OFFICE_TELEGRAM_CHAT_ID') || null;
  const waTo = String(body.to || env('OFFICE_WHATSAPP_TO') || '').replace(/\D/g, '').slice(0, 15);
  const meta = {
    source: 'mdm1-office-static',
    channel,
    whatsapp_to: waTo || null,
    ua: req.headers.get('user-agent') || ''
  };

  const store = await db('/office_messages', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      direction: 'out',
      chat_id: chatId ? Number(chatId) : null,
      text,
      delivered: false,
      meta
    }
  });
  if (!store.ok) {
    return send({ ok: false, error: 'supabase insert failed', detail: (await store.text()).slice(0, 300) }, 502);
  }
  const stored = await store.json();
  const recordId = stored && stored[0] && stored[0].id;

  async function markDelivered() {
    if (!recordId) return;
    await db(`/office_messages?id=eq.${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      body: { delivered: true, meta: { ...meta, delivered_at: new Date().toISOString() } }
    });
  }

  let telegram: any = { ok: false, skipped: true };
  if (channel === 'telegram' || channel === 'both') {
    const botToken = env('TELEGRAM_BOT_TOKEN');
    if (botToken && chatId) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      telegram = { ok: res.ok, status: res.status };
      if (res.ok) await markDelivered();
    } else {
      telegram = { ok: false, skipped: true, reason: !botToken ? 'no bot token' : 'no chat id' };
    }
  }

  let whatsapp: any = { ok: false, skipped: true };
  if (channel === 'whatsapp' || channel === 'both') {
    const token = env('WHATSAPP_ACCESS_TOKEN');
    const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId || !waTo) {
      whatsapp = { ok: false, skipped: true, reason: !token || !phoneId ? 'no whatsapp credentials' : 'no recipient' };
    } else {
      const version = env('WHATSAPP_API_VERSION') || 'v21.0';
      const res = await fetch(
        `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp', to: waTo, type: 'text',
            text: { body: text.slice(0, 4096), preview_url: false }
          })
        }
      );
      const waBody = await res.json().catch(() => ({}));
      whatsapp = { ok: res.ok, status: res.status, messageId: waBody?.messages?.[0]?.id || null };
      if (res.ok) await markDelivered();
    }
  }

  return send({ ok: true, stored: true, channel, telegram, whatsapp });
}

/* ── models / chat: user keys only, no server provider calls ─────────────── */

function modelsPayload() {
  const provider = { connected: false, userKeysRequired: true, models: [], free: [] };
  return {
    ok: true,
    action: 'models',
    connected: false,
    userKeysRequired: true,
    providers: { groq: { ...provider }, openrouter: { ...provider } },
    models: [],
    free: [],
    message: USER_KEYS_MESSAGE
  };
}

// ── router ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const send: Send = (data, status = 200) => json(req, data, status);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return send({ error: 'POST required' }, 405);

  let body: any;
  try { body = await req.json(); } catch (_) { return send({ error: 'invalid json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return send({ error: 'invalid json body' }, 400);
  }
  const action = String(body.action || 'message');

  try {
    if (action === 'chat') {
      // No provider calls, no key reads — always tell the client to use its own key.
      return send({ ok: false, error: USER_KEYS_MESSAGE, userKeysRequired: true }, 403);
    }

    if (action === 'models') {
      const api = checkApiKey(req);
      if (!api.ok) return send({ ok: false, error: api.error }, api.status);
      return send(modelsPayload());
    }

    if (action === 'queue_run') {
      const queueSecret = req.headers.get('x-office-queue-secret') || '';
      if (!backend()) return send({ ok: false, error: 'relay backend not configured' }, 503);
      return await handleQueueRun(send, queueSecret);
    }

    if (action === 'message') {
      // Messaging always requires the signed-in Google user's JWT; no owner key.
      const api = checkApiKey(req);
      if (!api.ok) return send({ ok: false, error: api.error }, api.status);
      const auth = await verifyGoogleJwt(req, api.key);
      if (!auth.ok) return send({ ok: false, error: 'Google sign-in required for messaging' }, 401);
      if (!backend()) return send({ ok: false, error: 'relay backend not configured' }, 503);
      return await handleLegacyMessage(send, body, req);
    }

    const api = checkApiKey(req);
    if (!api.ok) return send({ ok: false, error: api.error }, api.status);

    // Public, hash-only portal lookup: no JWT needed.
    if (action === 'portal_get') return await handlePortalGet(send, body);

    if (!backend()) return send({ ok: false, error: 'relay backend not configured' }, 503);
    const auth = await verifyGoogleJwt(req, api.key);
    if (!auth.ok) return send({ ok: false, error: auth.error }, auth.status);
    const user = auth.user;

    switch (action) {
      case 'state_get': return await handleStateGet(send, user);
      case 'state_put': return await handleStatePut(send, body, user);
      case 'portal_create': return await handlePortalCreate(send, body, user);
      case 'quota_reserve': return await handleQuotaReserve(send, body, user);
      case 'quota_release': return await handleQuotaRelease(send, body, user);
      case 'otp_send': return await handleOtpSend(send, body, user);
      case 'otp_verify': return await handleOtpVerify(send, body, user);
      case 'identity_get': return await handleIdentityGet(send, user);
      case 'queue_add': return await handleQueueAdd(send, body, user);
      case 'queue_list': return await handleQueueList(send, user);
      case 'queue_complete': return await handleQueueComplete(send, body, user);
      default: return send({ ok: false, error: 'unknown action' }, 400);
    }
  } catch (err) {
    const message = String((err as Error)?.message || err);
    return send({ ok: false, error: message.slice(0, 300) }, 500);
  }
});
