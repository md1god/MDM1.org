// ============================================================================
// Supabase Edge Function: office-relay
// ----------------------------------------------------------------------------
// Outbound bridge for the static office page. The page sends a short message
// with a shared secret; this function verifies it, then either:
//   • stores/forwards a Telegram or WhatsApp message, or
//   • lists/calls free model backends using server-side keys.
// No bot token, WhatsApp token or model key is ever exposed to the browser.
//
// Secrets (Supabase Edge Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
//   OFFICE_RELAY_SECRET, OFFICE_TELEGRAM_CHAT_ID (optional default chat),
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//   OFFICE_WHATSAPP_TO (optional default recipient), WHATSAPP_API_VERSION,
//   OPENCODE_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-office-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PROVIDERS = {
  zen: { base: 'https://opencode.ai/zen/v1', key: 'OPENCODE_API_KEY' },
  groq: { base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY' },
  openrouter: { base: 'https://openrouter.ai/api/v1', key: 'OPENROUTER_API_KEY' }
};
const PROVIDER_ORDER = ['zen', 'groq', 'openrouter'];
const GROQ_FREE_IDS = [
  'llama-3.3-70b-versatile', 'llama-3.1-8b-instant',
  'openai/gpt-oss-120b', 'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-32b', 'moonshotai/kimi-k2-instruct-0905',
  'allam-2-7b', 'gemma2-9b-it'
];
const MODEL_CACHE_TTL = 5 * 60 * 1000;
let modelCache: { at: number; data: any } = { at: 0, data: null };

function asNumbers(value: any): number[] {
  if (typeof value === 'boolean' || value == null) return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9eE+.-]/g, ''));
    return Number.isFinite(n) ? [n] : [];
  }
  if (Array.isArray(value)) return value.flatMap(asNumbers);
  if (typeof value === 'object') return Object.values(value).flatMap(asNumbers);
  return [];
}

function isFreeModel(provider: string, model: any): boolean {
  const id = String(model && model.id || '');
  if (!id || /:batch/i.test(id)) return false;
  if (provider === 'groq') return GROQ_FREE_IDS.indexOf(id) !== -1;
  if (provider === 'zen') {
    const cost = model.cost;
    if (cost && typeof cost === 'object' && ('input' in cost || 'output' in cost)) {
      const nums = (['input', 'output'] as const).flatMap((k) => asNumbers(cost[k]));
      return nums.length > 0 && nums.every((x) => x === 0);
    }
    const nums = asNumbers(cost);
    if (nums.length) return nums.every((x) => x === 0);
    return /-free$/i.test(id);
  }
  const pricing = model.pricing || {};
  const nums = (['prompt', 'completion'] as const).flatMap((k) => asNumbers(pricing[k]));
  if (!nums.length || nums.some((x) => x !== 0)) return false;
  const out = (model.architecture || {}).output_modalities;
  if (Array.isArray(out) && out.length && out.some((x: string) => String(x) !== 'text')) return false;
  return !/guard|embed|moderat/i.test(id);
}

async function listProviderModels(provider: string) {
  const spec = PROVIDERS[provider as keyof typeof PROVIDERS];
  const key = Deno.env.get(spec.key) || '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mdm1.org';
    headers['X-Title'] = 'MDM1 AI Office';
  }
  if (!key && provider !== 'openrouter') {
    return { connected: false, keyPresent: false, models: [], free: [], error: 'no server key' };
  }
  try {
    const res = await fetch(`${spec.base}/models`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const raw = Array.isArray(j) ? j : (j.data || []);
    const models = raw
      .filter((m: any) => m && m.id)
      .map((m: any) => ({ id: String(m.id), name: String(m.name || ''), free: isFreeModel(provider, m) }));
    const free = models.filter((m: any) => m.free).map((m: any) => m.id);
    return {
      connected: Boolean(key),
      keyPresent: Boolean(key),
      models,
      free,
      error: key ? null : 'no server key'
    };
  } catch (err) {
    return {
      connected: false,
      keyPresent: Boolean(key),
      models: [],
      free: [],
      error: String((err as Error).message || err)
    };
  }
}

async function listModels(force: boolean) {
  if (!force && modelCache.data && Date.now() - modelCache.at < MODEL_CACHE_TTL) return modelCache.data;
  const pairs = await Promise.all(PROVIDER_ORDER.map(async (p) => [p, await listProviderModels(p)] as const));
  const providers: Record<string, any> = {};
  pairs.forEach(([p, v]) => { providers[p] = v; });
  const models: string[] = [];
  const free: string[] = [];
  const modelProviders: Record<string, string> = {};
  PROVIDER_ORDER.forEach((p) => {
    providers[p].models.forEach((m: any) => {
      if (models.indexOf(m.id) === -1) {
        models.push(m.id);
        modelProviders[m.id] = p;
      }
      if (providers[p].free.indexOf(m.id) !== -1 && free.indexOf(m.id) === -1) free.push(m.id);
    });
  });
  const defaultProvider = PROVIDER_ORDER.find((p) => providers[p].connected && providers[p].free.length)
    || PROVIDER_ORDER.find((p) => providers[p].connected)
    || null;
  const data = {
    ok: true,
    action: 'models',
    connected: Boolean(defaultProvider),
    defaultProvider,
    providers,
    models,
    free,
    modelProviders
  };
  modelCache = { at: Date.now(), data };
  return data;
}

function num(value: any, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...cors, 'content-type': 'application/json' } });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });

  try {
    const body = await req.json();
    const supplied = req.headers.get('x-office-secret') || body.secret || '';
    const expected = Deno.env.get('OFFICE_RELAY_SECRET') || '';
    if (!expected || supplied !== expected) return json({ error: 'invalid secret' }, 401);

    const action = String(body.action || 'message');

    /* ── model catalogue / chat relay (keys stay server-side) ───────────── */
    if (action === 'models') {
      return json(await listModels(Boolean(body.refresh)));
    }

    if (action === 'chat') {
      const model = String(body.model || '').slice(0, 200);
      const messages = Array.isArray(body.messages)
        ? body.messages.slice(-20).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '').slice(0, 8000)
        }))
        : [];
      if (!model || !messages.length) return json({ error: 'model and messages required' }, 400);

      const listing = await listModels(false);
      let provider = String(body.provider || 'auto');
      if (provider === 'auto') provider = listing.modelProviders[model] || listing.defaultProvider || '';
      const spec = PROVIDERS[provider as keyof typeof PROVIDERS];
      if (!spec) return json({ error: 'unknown provider', provider, model }, 400);
      const key = Deno.env.get(spec.key) || '';
      if (!key) return json({ error: `no server key for ${provider}`, provider, model }, 502);

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        Authorization: `Bearer ${key}`
      };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://mdm1.org';
        headers['X-Title'] = 'MDM1 AI Office';
      }
      const upstream = await fetch(`${spec.base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: num(body.temperature, 0.7),
          max_tokens: Math.min(2000, Math.max(64, Number(body.max_tokens) || 1200))
        })
      });
      const raw = await upstream.text();
      let j: any = {};
      try { j = JSON.parse(raw); } catch (_) { j = {}; }
      if (!upstream.ok) {
        const msg = (j.error && j.error.message) || j.message || raw.slice(0, 200) || `HTTP ${upstream.status}`;
        const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 502;
        return json({ ok: false, error: msg, provider, model }, status);
      }
      const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      if (!text) return json({ ok: false, error: 'empty reply', provider, model }, 502);
      return json({
        ok: true,
        choices: [{ message: { content: text } }],
        provider,
        model,
        usage: j.usage || null
      });
    }

    /* ── outbound messaging (original behaviour) ────────────────────────── */
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
