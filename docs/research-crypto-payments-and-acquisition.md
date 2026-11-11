# Sources reviewed: crypto payments and first-customer acquisition

## RedotPay Connect
- Official payment flow docs: https://redotpay.readme.io/reference/payment
  - Offers Paylink redirect to a RedotPay-hosted page and Open-API options. The documented Paylink flow still expects the customer's site/server to create a merchant order and call `/openapi/v2/order/create`; final payment is also confirmed by a RedotPay webhook to the merchant server. For a static GitHub Pages site, do not put API signing secrets in browser code; either use a merchant-hosted link created in the merchant dashboard (if available for the user's account) with manual reconciliation, or add a secure backend for API/webhook confirmation.
- Official product page: https://www.redotpay.com/redotpay-connect
  - Describes merchant infrastructure, stablecoin acceptance and local-currency or crypto settlement. It does not establish that a consumer RedotPay wallet alone grants merchant/API access.
- Product announcement: https://www.redotpay.com/news/redotpay-enters-b2b-market-with-redotpay-connect-a-new-gateway-slashes-fees-for-global-merchants
  - Announced RedotPay Connect in June 2026; terms, eligibility and settlement details must be confirmed in merchant onboarding.

## Binance Pay
- Official merchant API introduction: https://developers.binance.com/en/docs/products/binance-pay-merchant/introduction
  - Merchant acquiring requires merchant cooperation; Binance notifies merchants of payment status. Some collection flows require merchant permissions, OAuth/API credentials and verified webhooks. A personal Binance account is not, by itself, proof of merchant checkout/API access.
- Merchant apply FAQ: https://www.binance.com/en/support/faq/detail/7a49148912214defa816f14ee51b9f9f
- Merchant website: https://merchant.binance.com/en

## Crypto refunds/consumer risk
- FTC consumer guidance: https://consumer.ftc.gov/articles/what-know-about-cryptocurrency-scams
  - Crypto transfers are typically not reversible; refunds generally require the recipient to send funds back. Be explicit about asset, network, refund terms and transaction-finality before payment.

## Hosted payment links and customer acquisition
- Stripe Payment Links documentation: https://docs.stripe.com/payment-links
- Stripe country availability: https://stripe.com/global
- PayPal Payment Links: https://www.paypal.com/us/business/accept-payments/payment-links
- Google SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
  - Descriptive title/snippet, useful page content, logical internal links and Search Console URL inspection.
- Google local ranking tips: https://support.google.com/business/answer/7091?hl=en
  - Local results are mainly based on relevance, distance and prominence; complete accurate profile information and genuine reviews matter, and ranking cannot be purchased.

## Implications for MDM1
- The live MDM1 site is a static GitHub Pages site. No merchant API secrets should be committed or exposed in frontend JavaScript.
- For custom website/automation work, the safer initial model is fixed-scope service packages with an approved quote/deposit and provider-hosted checkout/payment link. A true subscription/automatic recurring entitlement needs an explicit billing design and may need backend records/webhooks. Crypto wallets alone do not establish payment completion for a specific order.
- Do not publish unconfirmed payment addresses, networks, merchant status, or auto-renew promises. Never ask the user to paste private keys, seed phrases, passwords, or API secrets in chat.
