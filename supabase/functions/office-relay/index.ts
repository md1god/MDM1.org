// ============================================================================
// Supabase Edge Function: office-relay
// ----------------------------------------------------------------------------
// Outbound bridge for the static office page. The page sends a short message
// with a shared secret; this function verifies it, stores it, and forwards it
// to Telegram and/or WhatsApp. No bot token, WhatsApp token or model key is
// ever exposed to the browser.
//
// Secrets (Supabase Edge Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
//   OFFICE_RELAY_SECRET, OFFICE_TELEGRAM_CHAT_ID (optional default chat),
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//   OFFICE_WHATSAPP_TO (optional default recipient), WHATSAPP_API_VERSION
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-office-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...cors, 'content-type': 'application/json' } });
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });

  try {
    const body = await req.json();
    const supplied = req.headers.get('x-office-secret') || body.secret || '';
    const expected = Deno.env.get('OFFICE_RELAY_SECRET') || '';
    if (!expected || supplied !== expected) return json({ error: 'invalid secret' }, 401);

    const text = String(body.text || '').slice(0, 4000);
    if (!text) return json({ error: 'text required' }, 400);

    const channel = ['telegram', 'whatsapp', 'both'].includes(body.channel) ? body.channel : 'telegram';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const chatId = body.chatId || Deno.env.get('OFFICE_TELEGRAM_CHAT_ID') || null;
    const waTo = String(body.to || Deno.env.get('OFFICE_WHATSAPP_TO') || '').replace(/[^\d]/g, '').slice(0, 15);

    const record = {
      direction: 'out',
      chat_id: chatId ? Number(chatId) : null,
      text,
      delivered: false,
      meta: {
        source: 'mdm1-office-static',
        channel,
        whatsapp_to: waTo || null,
        ua: req.headers.get('user-agent') || ''
      }
    };

    const store = await fetch(`${supabaseUrl}/rest/v1/office_messages`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(record)
    });
    if (!store.ok) return json({ error: 'supabase insert failed', detail: (await store.text()).slice(0, 300) }, 502);
    const stored = await store.json();
    const recordId = stored && stored[0] && stored[0].id;

    async function markDelivered() {
      if (!recordId) return;
      await fetch(`${supabaseUrl}/rest/v1/office_messages?id=eq.${recordId}`, {
        method: 'PATCH',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivered: true, meta: { ...record.meta, delivered_at: new Date().toISOString() } })
      });
    }

    let telegram = { ok: false, skipped: true };
    if ((channel === 'telegram' || channel === 'both')) {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
      if (botToken && chatId) {
        const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        telegram = { ok: tg.ok, status: tg.status };
        if (tg.ok) await markDelivered();
      } else {
        telegram = { ok: false, skipped: true, reason: !botToken ? 'no bot token' : 'no chat id' };
      }
    }

    let whatsapp = { ok: false, skipped: true };
    if (channel === 'whatsapp' || channel === 'both') {
      const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
      const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
      if (!token || !phoneId || !waTo) {
        whatsapp = { ok: false, skipped: true, reason: !token || !phoneId ? 'no whatsapp credentials' : 'no recipient' };
      } else {
        const version = Deno.env.get('WHATSAPP_API_VERSION') || 'v21.0';
        const wa = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: waTo,
            type: 'text',
            text: { body: text.slice(0, 4096), preview_url: false }
          })
        });
        const waBody = await wa.json().catch(() => ({}));
        whatsapp = { ok: wa.ok, status: wa.status, messageId: waBody.messages && waBody.messages[0] && waBody.messages[0].id };
        if (wa.ok) await markDelivered();
      }
    }

    return json({ ok: true, stored: true, channel, telegram, whatsapp });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
