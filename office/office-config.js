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
    x: 'syCiLroZrlxpwI4Pvls8K31nJTMFD_5BXlRbW8LxUJ8',
    y: '7D9-RPo_TahhSartHG2bYJBMq-G-eSf_Ys64J7xtAT4'
  },
  tokenTtlHours: 24,

  /* Where the browser looks for the OpenCode app running on the user's PC. */
  localApi: { url: 'http://127.0.0.1:28894' },

  /* Cloud fallbacks (keys are entered by the user and kept in localStorage). */
  zen: { baseUrl: 'https://opencode.ai/zen/v1' },

  /* Telegram deep links. Set botUsername once the bot exists (@Name without @). */
  telegram: {
    botUsername: '',
    relayUrl: ''
  },

  storageKey: 'mdm1_office_v2'
};
