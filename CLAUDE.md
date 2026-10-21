# Supply Chain Disaster — CLAUDE.md

> Last updated: 2026-10-19

## Project Overview
Supply chain management simulation game at **supplychaindisaster.com**.
Built with Vanilla JS + Vite 7. Deployed on Vercel (account: astronaut362@gmail.com). No framework.

**Core purpose:** Teach real supply chain concepts through crisis decision-making.
Educational angle targets APICS CSCP certification candidates.

Deploy command: `npx vercel --prod` from the project root.

---

## Stack
- **Frontend:** Vanilla JS (ES modules), Vite 7.3.1, Chart.js, pure CSS
- **Backend:** Vercel serverless functions in `/api/`
- **Payments:** Lemon Squeezy (web only — the Android/RevenueCat path is discontinued, see "Android / Capacitor" below)
- **Email:** Resend — sender `hello@supplychaindisaster.com` (domain verified)
- **Dev server:** `npm run dev` → http://localhost:3000
- **Build:** `npx vite build`
- **Tests:** `npm test` — engine regression suite (`tests/`). The golden fixture pins seeded gameplay; only regenerate it (`node tests/make-golden.mjs`) for an intentional rules change

---

## Packaging & Entitlements (vanilla game, since 2026-10-19 — NOT yet deployed/launched)
| Package | What it includes | Price | Status |
|---|---|---|---|
| Free introduction | FMCG Chapter 1 (complete 4-quarter scenario + summary, concept card, debrief), replayable, guest play | — | live in code |
| **Core Game Pass** (`core`) | Catalog `core-2026-10` in `src/data/packages.js`: all 10 chapters of the FMCG, Pharma, Electronics campaigns; chapter jump; replay; Endless; weekly challenge (+ leaderboard posting); Advanced Report PDF; certificate. Content released later is NOT automatically included | USD $19.99 one-time | LS product 1460354 / variant 2278087 (live, store 295627) |
| Challenge Membership (`challenge_membership`) | $5.99/month, $39/year | — | prepared, **disabled** via `CHALLENGE_MEMBERSHIP_ENABLED=false` (server-enforced). Never surface it in copy until the user enables it |
| Legacy Full Access / Standard / Expansion (`legacy_full_access`) | everything (honoured forever) | was $49.99 | no longer sold |
| Legacy Starter (`legacy_starter`, fork) | chapters 1–5 | was $19.99 | fork only |
| Promo `SC10Disaster` (`promo_full_access`) | everything for 30 days | — | `/api/redeem-promo` |

- **Single source of truth:** `src/data/packages.js` (catalog, offers, `resolveAccess` = union of entitlements). Client: `src/logic/entitlements.js` (`Entitlements.canPlay/has/ownsCore/token`). `PremiumManager.isPremium()` now means "any paid entitlement". Server: `lib/billing/` (config allowlist, KV ledger, signed tokens, webhook/checkout/claim/restore service) — outside `/api` so it doesn't count toward the 12-function cap.
- **Access is granted only from verified provider data:** signed `order_*`/`subscription_*` webhooks (store, test/live mode and variant allowlist checked; idempotent; stale events ignored) or an email-verified restore (6-digit code + reconcile with the LS API). Never from the success URL, client params, client-supplied IDs or an unverified email. `/success` polls the checkout claim and shows an honest pending state.
- **Grandfathering:** campaigns saved before the packaging (no `packagingVersion` in the save, or `grandfathered: true`) can be finished free, certificate included. Saves are never deleted when access changes.
- **Limitation:** content ships in the browser, so client gating is UI-level; the server enforces access on leaderboard POST (needs `accessToken` with the weekly feature when `ENTITLEMENT_TOKEN_SECRET` is set), token issuance and refresh.
- **Lemon Squeezy:** store `295627` (slug `nexttracksystems`). Core: product `1460354`, variant `2278087`, checkout `https://nexttracksystems.lemonsqueezy.com/checkout/buy/bfe7302a-7998-4368-9417-192bea4a69b3` (live; verified from the public checkout page 2026-10-21: $19.99, one-time) — set in Vercel Production as `LEMONSQUEEZY_CORE_*`. The price was set to $19.99 (not $19) by the user on 2026-10-21. Never invent IDs or infer a product from its price. Legacy Full Access: product `1197198`, variant `1871634` (`LEMONSQUEEZY_STANDARD_VARIANT_ID`) — recommend archiving it once Core is live. Fork Starter: product `1358576`, variant `2121591` (unverified from this repo).
- **Required env for purchases:** see `.env.example` — `LEMONSQUEEZY_TEST_MODE`, `LEMONSQUEEZY_CORE_*`, `ENTITLEMENT_TOKEN_SECRET`, KV. Without them checkout reports "not available yet" (no fake success).
- **Analytics (GA4 via `src/shared/track.js`):** `free_scenario_complete`, `core_offer_view`, `checkout_start`, `purchase_confirmed` (deduped by order ID locally; the ID is never sent), `paid_campaign_open`. No emails, order IDs or payment data in analytics.
- Dev builds no longer auto-grant premium (`src/main.js`); owner bypass `?dev=nxt2026` works in DEV only.
- **The Next.js fork** (`D:\supplychaindisaster-next`, play.supplychaindisaster.com) still has its own model (Ch 1–3 free, Starter $19.99, Full $49.99) — not changed here.

---

## Game Architecture
- **8 base chapters × 4 turns = 32 turns.** Expansion adds Ch 9–10 (turns 33–40, 8 more turns)
- **Engine phases:** `CHAPTER_INTRO → STORY → PROCUREMENT → CHAPTER_SUMMARY → GAME_OVER`
- **Chapter end flow:** `ChapterTransition` → `DefinitionCard` (CSCP concept) → email gate / paywall / continue

### Key source files
| File | Purpose |
|---|---|
| `src/logic/engine.js` | Core game engine, state machine |
| `src/dashboard.js` | Main UI orchestrator — wires everything together |
| `src/data/chapters.js` | Base chapters 1–8 with descriptions and real-world examples |
| `src/data/expansion-chapters.js` | Expansion chapters 9–10 |
| `src/data/cscp-definitions.js` | APICS CSCP definitions shown at chapter end (one per chapter) |
| `src/data/scenarios-expanded.js` | Active scenario data (replaces old scenarios.js) |
| `src/data/expansion-scenarios.js` | Expansion-only scenarios (Port Strikes, Fuel Hikes, etc.) |
| `src/logic/premium.js` | PremiumManager — legacy `scd_premium` record + promo redeem; `isPremium()` = any paid entitlement |
| `src/data/packages.js` | Package catalog (free intro, Core, membership, legacy), offers, `resolveAccess` |
| `src/logic/entitlements.js` | Client access state (signed token cache + legacy records), checkout claim, restore code |
| `lib/billing/*` | Server billing: env allowlist, KV ledger, tokens, webhook/checkout/claim/restore service |
| `src/ui/intro-complete.js` | Free-intro completion screen + Core offer |
| `src/logic/billing.js` | BillingManager — native RevenueCat path (discontinued; no longer used by the paywall) |
| `src/ui/paywall.js` | Core Game Pass offer modal ("Included" for owners) + email-code restore + promo code |
| `src/ui/definition-card.js` | CSCP definition flashcard shown after each chapter |
| `src/ui/chapter-transition.js` | Chapter summary overlay (score + next chapter teaser) |
| `src/ui/concept-card.js` | Chapter intro card (shown before chapter begins) |
| `src/ui/pregame-page.js` | /play pre-game page (hero, industry picker + mission preview, resume, access, FAQ). Copy in `src/i18n/pregame.js`; industry facts from `src/logic/industry-profiles.js` (engine constants) — never hand-type numbers. Replaced `landing-page.js` (deleted 2026-10-18; `landing-page.css` stays — the homepage uses it) |
| `src/logic/save-game.js` | Campaign saves (saveVersion 2): full snapshot that resumes at any turn. Auto-saved to localStorage `scd_local_save_v1` at every safe point; HUD "Save" saves now and backs up to email (`/api/save-game`) if one is set. Superset of the legacy chapter-boundary gameState, so old email saves and recall-cron still work |
| `src/shared/track.js` | GA4 product events via the existing gtag (no new vendor). Dev builds log to `window.__scdAnalytics` instead of sending |
| `src/ui/procurement-workspace.js` | /play decision screen markup (situation, 3 decision groups, outlook, consequence summary). All numbers come from `GameEngine.estimateTurn()` — never add game math here |
| `src/ui/play-workspace.css` | In-game layout/theme, scoped to `body.scd-playing` (set while a run is active) so marketing pages are unaffected |

### Old/unused files — do not edit
- `api/polar-webhook.js` — deprecated, returns 410
- (deleted 2026-07-18 after import audits: `src/data/scenarios.js`, `src/data/industries.js`, `src/ui/onboarding.js`)

---

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `/api/create-checkout` | GET offer availability; POST `{offer}` → allowlisted LS checkout URL + claim ID (membership refused while disabled) |
| `/api/verify-subscription` | Access API: `claim` (pending/active), `refresh` (re-validate token), `restore-request` / `restore-verify` (email one-time code) |
| `/api/redeem-promo` | Validates promo codes server-side; `SC10Disaster` → 30-day expansion |
| `/api/ls-webhook` | Verified LS webhooks → KV ledger (idempotent, refund/out-of-order safe); Core welcome email on first paid order |
| `/api/save-progress` | Sends "operational data secured" email to player + internal notification |
| `/api/save-game` / `/api/load-game` | Store/restore game state in Vercel KV by email (no-op without KV env) |
| `/api/recall-cron` | Daily Vercel cron (`vercel.json` crons, 14:00 UTC): sends day-3/day-10 spaced-recall emails to saved players. `CRON_SECRET`-guarded; no-op until KV is configured. Skips anyone with `unsub:{email}` set |
| `/api/send-email` | Contact form handler |
| `/api/unsubscribe` | GET `?email=` — one-click unsubscribe (sets `unsub:{email}` in KV, no expiry). POST `?broadcast=1` — one-off re-engagement broadcast to everyone in the `game:*` saved-progress list; `CRON_SECRET`-guarded, `?dry=1` reports counts without sending. Idempotent via `announced:{email}`. Both live in one file to stay under Vercel Hobby's 12-function cap — see note below |

**Vercel Hobby plan caps serverless functions at 12** (one per file in `/api/`, `polar-webhook.js` included even though it's dead). Adding a new one-off endpoint means either deleting/consolidating an existing file first or folding the new logic into one that already exists — `unsubscribe.js` does the latter (unsubscribe + broadcast in one handler, branched on HTTP method). Check `ls api/*.js | wc -l` before adding a new file.

---

## Email System (Resend)
- **From:** `hello@supplychaindisaster.com` (domain verified in Resend — do not change)
- **Resend account:** ahmad.faruqi1211@gmail.com
- **Purchase welcome:** triggered by `order_created` LS webhook → tier-specific HTML email to buyer
- **Save progress:** player-requested checkpoint email; includes visual chapter progress bar
- **Contact form:** forwards message to `ahmad.faruqi1211@gmail.com`
- **Internal notifications:** save-progress events CC'd to `ahmad.faruqi1211@gmail.com`
- `RESEND_API_KEY` is set in `.env` and must also be set in Vercel environment variables

### Email templates (both in `api/ls-webhook.js`)
- **Standard welcome:** subject "Your Standard Edition is ready — Supply Chain Disaster"
- **Expansion welcome:** subject "Your Expansion Bundle is ready — Supply Chain Disaster"
- Design: dark theme (`#080b14`), gradient accent bars, circular feature check badges, restore-access hint block

### Unsubscribe / suppression (added 2026-08-31)
- Every marketing-ish email (recall-cron, the one-off announcement broadcast) must link `GET /api/unsubscribe?email={email}` — sets `unsub:{email}` in KV, no expiry, no confirmation step needed on the recipient's end.
- Any future sender that iterates the `game:*` saved-progress list **must check `unsub:{email}` before sending** — recall-cron and the broadcast endpoint both do this already.
- Transactional email (purchase welcome, save-progress checkpoint, contact form) is not gated by this — only re-engagement/marketing sends are.
- One-off re-engagement broadcast: sent 2026-08-31 to the 5 real addresses in the `game:*` list at the time (a 6th, a `kvtest+...` synthetic test address from earlier KV testing, was suppressed instead of emailed). Announced the Next.js-fork rebuild (3 difficulty tiers, 120 scenarios) and linked to `play.supplychaindisaster.com/levels`. Re-running `POST /api/unsubscribe?broadcast=1` is safe — it only reaches players who saved progress after that date and haven't been sent the announcement (tracked via `announced:{email}`).

---

## Promo Codes
| Code | Tier | Duration | Validated |
|---|---|---|---|
| `SC10Disaster` | Expansion | 30 days | Server-side (`/api/redeem-promo`) |

- UI: collapsible "Have a promo code?" section in the paywall modal
- Expiry stored as `expiresAt` timestamp in `scd_premium` localStorage record
- After expiry, `_isDataActive()` clears the record and returns false

---

## Environment Variables
```
RESEND_API_KEY
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_STORE_SLUG=nexttracksystems
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_STANDARD_VARIANT_ID
LEMONSQUEEZY_EXPANSION_VARIANT_ID
LEMONSQUEEZY_WEBHOOK_SECRET
APP_URL=https://supplychaindisaster.com
VITE_LS_TEST_MODE=false
VITE_REVENUECAT_ANDROID_KEY
```

---

## Android / Capacitor — DISCONTINUED (2026-08-20)
Supply Chain Disaster is now web-only. All public-facing Android/RevenueCat/"mobile app" claims
were removed from marketing pages and `privacy.html` on 2026-08-20 per user instruction. The
native Capacitor project (`android/`, `capacitor.config.ts`) and `src/logic/billing.js`'s
native→RevenueCat routing still exist in the repo but are **not to be referenced as a live,
publicly-available distribution channel** in any new copy. Don't write "available on Android",
"Android app", or similar in new content unless the user explicitly re-launches it.

- App ID: `com.nextrack.scmdisaster`
- Config: `capacitor.config.ts`
- Update native: `npx vite build && npx cap sync android`
- RevenueCat product IDs: `com.nextrack.scmdisaster.standard`, `com.nextrack.scmdisaster.expansion`
- RevenueCat entitlement IDs: `standard`, `expansion`

---

## Educational Design (CSCP)
Each chapter end shows a `DefinitionCard` with one APICS CSCP exam concept:
- Term + CSCP domain badge (SCD / SCPE / SCIBP), colour-coded
- Definition (exam-ready language)
- Why it matters for CSCP
- Exam tip (formulas, mnemonics, z-scores)
- Memory hook (one punchy line)

Definitions live in `src/data/cscp-definitions.js`, keyed by chapter ID.

| Chapter | CSCP Term | Domain |
|---|---|---|
| 1 — Demand Forecasting | MAPE | SCPE |
| 2 — Bullwhip Effect | Bullwhip Effect | SCPE |
| 3 — JIT & Safety Stock | Reorder Point & Safety Stock | SCPE |
| 4 — Risk Management | Supply Chain Risk Management (SCRM) | SCD |
| 5 — Total Cost of Ownership | Total Cost of Ownership (TCO) | SCD |
| 6 — Logistics & Transportation | Intermodal Transportation | SCPE |
| 7 — Quality Management | Cost of Quality (COQ) | SCIBP |
| 8 — Sustainability | Reverse Logistics & Circular Economy | SCIBP |
| 9 — Global Crisis Management | Business Continuity Planning (BCP) | SCD |
| 10 — Multi-Regional Networks | Network Design & Nearshoring | SCD |

---

## Static SEO / AISEO Files
- `public/robots.txt` — crawl rules
- `public/sitemap.xml` — sitemap
- `public/llms.txt` — AI/LLM description of the site (llms.txt standard) at `/llms.txt`

---

## Content Consistency Rules
The game has **10 chapters total**. Apex/vanilla packaging since 2026-10-19 (see "Packaging & Entitlements"). Always write:
- "up to 10 chapters" when describing the game generically
- "Chapter 1 free" / "FMCG Chapter 1 free" for the free introduction — never "all 10 chapters free" or "completely free"
- "Core Game Pass — $19.99 one-time" (no subscription) for the paid package; list its contents explicitly and say content released later isn't automatically included; mention that tax is calculated at checkout where it applies
- Never mention the Challenge Membership in public copy while `CHALLENGE_MEMBERSHIP_ENABLED` is false; no classroom/team plans, discounts, crossed-out prices, countdowns, scarcity or testimonials
- Fork copy (play.supplychaindisaster.com) keeps its own model: "Chapters 1–3 free", Starter $19.99, Full Access $49.99
- "40 quarterly turns" for the full game
- Never mention Standard Edition ($14.99) or Expansion Bundle ($25) — retired tiers (distinct from the current Starter tier)
- **Exception (since 2026-09-19):** `/play` serves the *vanilla* game, which DOES have an industry picker (FMCG / Pharma / Electronics) — describe industries on `/play` itself. The rule below still applies to homepage/marketing copy about the fork.
- **No industry picker exists (fork / marketing copy).** `supplychaindisaster.com/play?start=1` — every homepage CTA — redirects entirely to `play.supplychaindisaster.com` (the Next.js fork), which has no industry selection. It's 10 CSCP levels × **3 difficulty tiers** (Guided/Normal/Expert), never "Electronics/FMCG/Pharma" or similar. Say "3 Difficulty Tiers" and "120 Total Scenarios," not "3 Real Industries."
- Only **one** PDF exists (the 5-page Advanced Report) and **one** certificate — never write "Executive Strategy Debrief PDF" as a second, separate PDF.

Files corrected for single-plan pricing (2026-07-05): `index.html`, `about.html`, `terms.html`, `pricing.html`,
`refund.html`, `privacy.html`, `public/llms.txt`, `supply-chain-disruption-simulation.html`,
`supply-chain-management-game.html`, `procurement-simulation-game.html`, `six-sigma-kaizen-supply-chain.html`,
`7cs-supply-chain-4pl-logistics.html`.

Files corrected for the industries → difficulty-tiers rewrite (2026-08-23, commit `a0a5b58`): `index.html` (JSON-LD
featureList + HowTo step, hero eyebrow/stats, hero micro-steps, How It Works cards, FAQ JSON-LD, educator copy,
pricing tiers — removed the fake second "Executive Strategy Debrief PDF" bullet), `about.html`, `terms.html`,
`supply-chain-company-types.html`, `supply-chain-industry-dynamics.html`, `scm-fundamentals-5-pillars.html`.
