/* ============================================================================
   MDM1 AI Office — public configuration (safe to publish)
   ----------------------------------------------------------------------------
   Nothing secret belongs in this file. The Telegram bot token and the ECDSA
   private key live ONLY in GitHub Actions secrets / the bot runner.
   ========================================================================== */
window.OFFICE_CONFIG = {
  officeName: 'MD1\u0075sd Company',
  /* Local brand image copied into office/ (public, no secrets). */
  brandImage: 'app-logo.webp?v=20261128pwa30',

  /* Private page gate. The passphrase itself is never stored — only its hash. */
  requireUnlock: true,
  passphraseSalt: 'mdm1-office-v1',
  passphraseHash: '7c5834f40beea2e6f5ac436904499a9d1e9d65431fe0cb0e4e229c3941c1d9f9',

  /* Public half of the key the Telegram bot signs secret tokens with.
     The private half (d) must stay in the bot secret store. */
  publicKeyJwk: {
    kty: 'EC',
    crv: 'P-256',
    x: 'a964y_u4EP3GQmGwd1yx45WYtVAYfDbIl2CbSG7brmg',
    y: 'zr8aQFDHSgMQCQkcp6Ca5grJN3ktsXRJrUAImza_uNE'
  },
  /* Rotated 2026-11-27. Tokens must be short-lived and carry a chat id. */
  tokenTtlHours: 6,
  maxTokenTtlHours: 6,

  /* Browser-local model (the same WebGPU assistant already used on mdm1.org).
     No local service, bridge, or password is needed — weights run in the tab. */
  webllm: { moduleUrl: 'https://esm.run/@mlc-ai/web-llm' },

  /* Optional Supabase state sync. Endpoint and secret are entered by the user
     in the connection panel; nothing is hardcoded here. */
  sync: { url: '', enabled: false },

  /* Public Supabase Auth settings. The publishable key is safe in a static
     page; it is not a service-role key. Google/email sign-in is an extra
     identity layer for messaging/sync — the office passphrase is still
     required to open the page. */
  auth: {
    enabled: true,
    supabaseUrl: 'https://fksjltytevcmpjxzamhp.supabase.co',
    publishableKey: 'sb_publishable_fFnLwsu5bB3w-WRSsYoPWw_M3iLhDS-',
    redirectTo: ''
  },

  /* Optional outbound messaging through the Supabase Edge relay. Tokens stay
     in Edge Function secrets; only the public function URL is stored here. */
  messaging: {
    relayUrl: 'https://fksjltytevcmpjxzamhp.supabase.co/functions/v1/office-relay',
    /* Public anon JWT: required by the Supabase function gateway, not a secret.
       It only grants the anon role; model keys stay in Edge Function secrets. */
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2psdHl0ZXZjbXBqeHphbWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTgxMTEsImV4cCI6MjA5NzY5NDExMX0.nSgcMvEI4fjtKArc-1y7DkX_04kvclg8LCm3PahsiII'
  },

  /* Provider endpoints. Keys are entered by the user and live only in the
     encrypted browser vault — never in localStorage plaintext or this file. */
  zen: { baseUrl: 'https://opencode.ai/zen/v1' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1' },

  /* Model lab + quality governance. No secrets live in this file. */
  quality: {
    enabled: true,
    threshold: 70,
    maxRetries: 2,
    note: 'Models are benchmarked and prompt-calibrated before assignment; every proposal is reviewed by a department monitor, auditor and corrector.'
  },

  /* Telegram deep links. Set botUsername once the bot exists (@Name without @). */
  telegram: {
    botUsername: '',
    relayUrl: ''
  },

  storageKey: 'mdm1_office_v2'
};
