/* ============================================================================
   MDM1 AI Office — public configuration (safe to publish)
   ----------------------------------------------------------------------------
   Nothing secret belongs in this file. The Telegram bot token and the ECDSA
   private key live ONLY in GitHub Actions secrets / the bot runner.
   ========================================================================== */
window.OFFICE_CONFIG = {
  officeName: 'المكتب الافتراضي للذكاء الاصطناعي',

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

  /* Where the browser looks for the OpenCode app running on the user's PC.
     The bridge is the HTTPS-capable proxy that also works from mdm1.org. */
  localApi: { url: 'http://127.0.0.1:28894' },
  localBridge: { url: 'https://localhost:28895' },

  /* Optional Supabase state sync. Endpoint and secret are entered by the user
     in the connection panel; nothing is hardcoded here. */
  sync: { url: '', enabled: false },

  /* Cloud fallbacks (keys are entered by the user and kept in localStorage). */
  zen: { baseUrl: 'https://opencode.ai/zen/v1' },

  /* Telegram deep links. Set botUsername once the bot exists (@Name without @). */
  telegram: {
    botUsername: '',
    relayUrl: ''
  },

  storageKey: 'mdm1_office_v2'
};
