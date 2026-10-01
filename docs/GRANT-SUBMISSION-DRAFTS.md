# MDM1 Hub — Grant Submission Drafts

> These are drafts for review. They have not been submitted.

## 1. Ethereum Ecosystem Support Program

**Project name:** MDM1 Hub / StableProof Public Data Layer

**One-line summary:** An open-source, multichain transparency and verification layer for stablecoins and public Web3 services.

**Problem:** Users and builders must visit multiple explorers and project pages to compare contract identity, supply, reserve disclosures, mint/redeem activity, liquidity history, and contract permissions. Project-specific pages are difficult to compare and may mix sponsored claims with on-chain facts.

**Solution:** MDM1 Hub will provide a neutral, source-linked dashboard and reusable widgets. The first integration is MD1USD, but the architecture is designed for multiple stablecoins and public Web3 services. Each data point displays its source, timestamp, and verification status. The open-source core will remain reusable by communities and other ecosystems.

**First milestones:**

- Publish adapters for Ethereum-compatible ERC-20 contracts and a documented adapter interface.
- Add 10–20 stablecoin examples with explorer links, supply, reserve disclosures, and mint/redeem activity where available.
- Publish a public dashboard, embeddable widget, and reproducible data snapshots.
- Add automated tests, documentation, contribution guidelines, and a transparent sponsorship policy.

**Public-good impact:** The tool reduces information friction, makes public blockchain data easier to verify, and gives researchers and users a neutral comparison surface. It does not custody funds, execute trades, promise returns, or rank projects by payment.

**Budget request:** To be set after confirming the grant's current budget template. Proposed use: engineering, data adapters, testing, documentation, public deployment, and security review. No funds requested for liquidity, trading, price support, or customer deposits.

**Links:**

- Repository PR: https://github.com/md1god/MDM1.org/pull/5
- Public page after merge: https://mdm1.org/pages/hub-services.html
- Initial token project: https://md1usd.com/

## 2. Gitcoin Grants

**Round category:** Ethereum / Web3 public goods, subject to the active round's eligibility.

**Project description:** MDM1 Hub is open-source public infrastructure for transparent stablecoin and Web3 service data. It combines a public directory, on-chain source links, reusable widgets, and documentation. MD1USD is the initial test integration, not the exclusive beneficiary.

**Why now:** The MVP page and public repository are live as a reviewable starting point. Funding would turn the static prototype into a reusable data layer with more adapters, historical snapshots, tests, and documentation.

**Community proof plan:** Invite independent maintainers to add projects, publish monthly data reports, document every data source, and measure usage through public aggregate metrics rather than collecting unnecessary personal data.

**Funding use:** Engineering milestones and public documentation only. No market-making, token promotion, or guaranteed-return activity.

## 3. Arbitrum Grants / Infrastructure & Tools

**Fit condition:** Apply only if the project adds a real Arbitrum deployment or adapter and the program is accepting infrastructure/tooling applications.

**Proposed Arbitrum milestone:** Add Arbitrum One and an Arbitrum-compatible adapter to the dashboard, index selected stablecoin contracts, publish explorer-linked supply and permission data, and release a widget that Arbitrum projects can embed.

**Deliverables:** Working adapter, tests, documentation, public demo, and a usage report. The project remains neutral and does not custody or route user funds.

## Application discipline

- Do not claim an independent audit unless a named auditor issued one.
- Do not describe sponsorship as a security rating.
- Do not claim that a stablecoin is redeemable unless the redemption path has been tested and documented.
- Confirm legal, tax, identity, and country eligibility requirements for each grant before submission.
