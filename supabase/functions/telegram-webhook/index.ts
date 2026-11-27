// ============================================================================
// Supabase Edge Function: telegram-webhook
// ----------------------------------------------------------------------------
// Receives Telegram updates, issues signed one-time secret links for the
// private office page, stores incoming secret messages, and verifies OTP
// replies from the chat that requested the code.
//
// Set a Telegram webhook with a secret token:
//   https://api.telegram.org/bot<BOT>/setWebhook?url=<this function URL>&secret_token=<TELEGRAM_WEBHOOK_SECRET>
//
// Secrets / env:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
//   OFFICE_PRIVATE_JWK (full JSON including "d"),
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role only — never exposed),
//   OFFICE_OTP_SALT (must match office-relay; required to verify OTP replies),
//   OFFICE_TOKEN_TTL_HOURS (default 6, hard cap 6),
//   OFFICE_PAGE_URL (default https://mdm1.org/office/)
//
// OTP reply formats (chat id must match the pending OTP meta):
//   "MDM1 OTP 123456"  or  "123456"
// ar: الرد على رمز OTP من نفس المحادثة يؤكد الرمز ويربط القناة بالحساب.
// ============================================================================

const jsonHeaders = { 'content-type': 'application/json' };
// Accept both "123456" and the prefixed forms used by the bot's own message
// ("MDM1 OTP 123456" / "MDM1 OTP: 123456").
const OTP_REPLY_RE = /^(?:MDM1\s*OTP:?\s*)?(\d{6})$/i;

const env = (name: string): string => (Deno.env.get(name) || '').trim();

function secretEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signToken(payload: object, privateJwkJson: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(privateJwkJson),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));
  // WebCrypto ECDSA returns raw r||s (IEEE P1363), exactly what the browser verifies.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bodyBytes);
  return `${b64url(bodyBytes)}.${b64url(new Uint8Array(sig))}`;
}

async function sendMessage(text: string, chatId: number, parseMode = 'HTML') {
  const token = env('TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true })
  });
  return { ok: res.ok, status: res.status };
}

// Confirm a 6-digit reply only when it belongs to a pending OTP for this chat.
// The plaintext code is never stored or echoed back.
async function handleOtpReply(code: string, chatId: number, username: string) {
  const salt = env('OFFICE_OTP_SALT');
  const supabaseUrl = env('SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!salt || !supabaseUrl || !serviceKey) {
    await sendMessage('⚠️ OTP verification is not configured on the server.', chatId);
    return;
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json'
  };

  // Match by chat id stored in office_otp_codes.meta by office-relay otp_send.
  const query =
    `/rest/v1/office_otp_codes?channel=eq.telegram&used=eq.false` +
    `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&meta->>telegram_chat_id=eq.${encodeURIComponent(String(chatId))}` +
    `&select=target_hash,code_hash,meta&order=created_at.desc&limit=1`;

  let pending: any = null;
  try {
    const res = await fetch(`${supabaseUrl}${query}`, { headers });
    if (res.ok) pending = ((await res.json()) as any[])[0] || null;
  } catch (_) { /* handled below */ }

  if (!pending) {
    await sendMessage('❌ لا يوجد رمز OTP قيد الانتظار لهذه المحادثة.\nNo pending OTP for this chat.', chatId);
    return;
  }

  const codeHash = await sha256Hex(code + salt); // SHA-256(code + server salt)
  let verified = false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/office_otp_consume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_target_hash: pending.target_hash,
        p_channel: 'telegram',
        p_code_hash: codeHash,
        p_email: String(pending.meta?.email || '')
      })
    });
    if (res.ok) {
      const out = await res.json();
      verified = Boolean(Array.isArray(out) ? out[0]?.ok : out?.ok);
    }
  } catch (_) { /* handled below */ }

  // Audit without the code or any secret. The RPC marks used=true, writes
  // meta.verified and upserts office_identities via service_role.
  await fetch(`${supabaseUrl}/rest/v1/office_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_type: verified ? 'otp_verified' : 'otp_failed',
      actor: username || String(chatId),
      summary: verified ? 'OTP verified via Telegram' : 'OTP verification failed',
      meta: { chat_id: chatId, target_hash: pending.target_hash }
    })
  }).catch(() => undefined);

  await sendMessage(
    verified
      ? '✅ تم تأكيد رمز OTP وربط حسابك بنجاح.\nOTP confirmed and your account is linked.'
      : '❌ رمز OTP غير صالح أو منتهي. حاول مرة أخرى.\nInvalid or expired OTP.',
    chatId
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const expected = env('TELEGRAM_WEBHOOK_SECRET');
  const supplied = req.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!expected || !secretEquals(supplied, expected)) {
    return new Response(JSON.stringify({ error: 'invalid secret' }), { status: 401, headers: jsonHeaders });
  }

  try {
    const update = await req.json();
    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat) return new Response('ok', { headers: jsonHeaders });

    const chatId = Number(msg.chat.id);
    if (!Number.isFinite(chatId)) return new Response('ok', { headers: jsonHeaders });
    const text = String(msg.text || '').trim();
    const username = msg.from?.username || msg.from?.first_name || '';

    if (/^\/start(\s|$)|^\/secret(\s|$)/.test(text)) {
      const code = text.replace(/^\/(start|secret)\s*/, '').trim() || 'direct';
      // The page rejects tokens longer than 6 hours; keep the issuer in sync.
      const ttlHours = Math.min(6, Math.max(0.25, Number(env('OFFICE_TOKEN_TTL_HOURS') || 6) || 6));
      const now = Date.now();
      const token = await signToken(
        { sub: 'mdm1-office', chat: chatId, user: username, code, iat: now, exp: now + ttlHours * 3600_000 },
        env('OFFICE_PRIVATE_JWK')
      );
      const page = env('OFFICE_PAGE_URL') || 'https://mdm1.org/office/';
      await sendMessage(
        `🔐 <b>رمز الدخول الخاص بالمكتب</b>\n\n<code>${token}</code>\n\n` +
        `افتح ${page} والصق الرمز في شاشة الدخول. صالح لمدة ${ttlHours} ساعة.\n` +
        `لا تشارك هذا الرمز مع أحد.`,
        chatId
      );
      return new Response('ok', { headers: jsonHeaders });
    }

    // OTP replies are consumed here; never fall through to the "echo" handler.
    const otp = text.match(OTP_REPLY_RE);
    if (otp) {
      await handleOtpReply(otp[1], chatId, username);
      return new Response('ok', { headers: jsonHeaders });
    }

    // Any other message is treated as a secret note for the CEO.
    const supabaseUrl = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/rest/v1/office_messages`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          direction: 'in',
          chat_id: chatId,
          username,
          text: text.slice(0, 4000),
          meta: { update_id: update.update_id }
        })
      });
    }
    await sendMessage(`✅ تم استلام رسالتك وتخزينها في صندوق المكتب الخاص.\n\n${text.slice(0, 200)}`, chatId);
    return new Response('ok', { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});
