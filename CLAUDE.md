# Supply Chain Disaster — CLAUDE.md

> Last updated: 2026-08-31

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

## Tiers & Gating
| Tier | Chapters | Turns | Price |
|---|---|---|---|
| Free | 1–3 | 1–12 | — |
| Starter | 1–5 | 1–20 | $19.99 one-time (lifetime) |
| Full Access | 1–10 | 1–40 | $49.99 one-time (lifetime) |

- **Two paid tiers (since 2026-09-13):** **Starter $19.99** (chapters 1–5) and **Full Access $49.99** (all 10 chapters + Advanced Report + certificate); chapters 1–3 free. This replaced the single-plan model that ran 2026-07-05 → 2026-09-13. Old Standard ($14.99) / Expansion ($25) tiers stay retired; legacy purchases (any stored `tier`) are honoured as Full Access (`PremiumManager.isExpansion()` returns `isPremium()`). **Starter gating + checkout live in the FORK (`D:\supplychaindisaster-next`) only** — the vanilla game code (`src/logic/premium.js`) remains Full-Access-only.
- **Launch offer / price increase:** `$49.99` is launch pricing. Per the homepage announcement bar (`index.html`, countdown deadline hardcoded as `2026-09-19T19:00:00Z`), the list price reverts to **$99** after that date — confirmed genuine by the user 2026-08-20. When working past that date, re-check whether the site/checkout price still reads $49.99 or $99 before assuming either.
- **LS product "Supply Chain Disaster Full Access":** product ID `1197198`, variant ID `1871634` (= `LEMONSQUEEZY_STANDARD_VARIANT_ID`), hosted checkout `https://nexttracksystems.lemonsqueezy.com/checkout/buy/65c58393-3110-4aec-9e52-c93abaf3de33` (hardcoded in `paywall.js` and `index.html`). `LEMONSQUEEZY_EXPANSION_VARIANT_ID` is kept only for legacy order verification.
- **LS product "Supply Chain Disaster — Starter" (added 2026-09-13):** product ID `1358576`, variant ID `2121591`, $19.99 one-time, hosted checkout `https://nexttracksystems.lemonsqueezy.com/checkout/buy/19f46b98-7503-4969-925e-9472ef697e5d` (used on vanilla `pricing.html`/`index.html`; the fork checkout picks it via `LEMONSQUEEZY_STARTER_VARIANT_ID` + `NEXT_PUBLIC_STARTER_ENABLED`).
- Premium stored in `localStorage` key `scd_premium` (fork also uses `scd_tier` = starter|full)
- Promo code `SC10Disaster` → 30-day full access, validated server-side via `/api/redeem-promo`
- Paywall gates (live fork): Ch 3→4 (Starter or Full) and Ch 5→6 (Full only). The legacy vanilla game has a single Ch 3→4 gate (Full only).
- Expired promo grants auto-cleared silently by `PremiumManager._isDataActive()`

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
| `src/logic/premium.js` | PremiumManager — isPremium, isExpansion, redeemPromo, expiry logic |
| `src/logic/billing.js` | BillingManager — routes web→LS, native→RevenueCat |
| `src/ui/paywall.js` | Two-tier paywall modal + promo code input |
| `src/ui/definition-card.js` | CSCP definition flashcard shown after each chapter |
| `src/ui/chapter-transition.js` | Chapter summary overlay (score + next chapter teaser) |
| `src/ui/concept-card.js` | Chapter intro card (shown before chapter begins) |
| `src/ui/procurement-workspace.js` | /play decision screen markup (situation, 3 decision groups, outlook, consequence summary). All numbers come from `GameEngine.estimateTurn()` — never add game math here |
| `src/ui/play-workspace.css` | In-game layout/theme, scoped to `body.scd-playing` (set while a run is active) so marketing pages are unaffected |

### Old/unused files — do not edit
- `api/polar-webhook.js` — deprecated, returns 410
- (deleted 2026-07-18 after import audits: `src/data/scenarios.js`, `src/data/industries.js`, `src/ui/onboarding.js`)

---

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `/api/create-checkout` | Builds LS checkout URL for a given tier |
| `/api/verify-subscription` | Verifies LS order by ID or email |
| `/api/redeem-promo` | Validates promo codes server-side; `SC10Disaster` → 30-day expansion |
| `/api/ls-webhook` | Handles LS webhook events; sends tier-specific purchase welcome emails |
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
The game has **10 chapters total**. Two paid tiers since 2026-09-13 (was single-plan 2026-07-05 → 2026-09-13). Always write:
- "up to 10 chapters" when describing the game generically
- "Chapters 1–3 free" for the free tier
- "Starter — $19.99 one-time" for the entry tier (chapters 1–5; no Advanced Report or certificate)
- "Full Access — $49.99 one-time, lifetime" for the top tier (all 10 chapters + Advanced Report + certificate)
- "40 quarterly turns" for the full game
- Never mention Standard Edition ($14.99) or Expansion Bundle ($25) — retired tiers (distinct from the current Starter tier)
- **No industry picker exists.** `supplychaindisaster.com/play?start=1` — every homepage CTA — redirects entirely to `play.supplychaindisaster.com` (the Next.js fork), which has no industry selection. It's 10 CSCP levels × **3 difficulty tiers** (Guided/Normal/Expert), never "Electronics/FMCG/Pharma" or similar. Say "3 Difficulty Tiers" and "120 Total Scenarios," not "3 Real Industries."
- Only **one** PDF exists (the 5-page Advanced Report) and **one** certificate — never write "Executive Strategy Debrief PDF" as a second, separate PDF.

Files corrected for single-plan pricing (2026-07-05): `index.html`, `about.html`, `terms.html`, `pricing.html`,
`refund.html`, `privacy.html`, `public/llms.txt`, `supply-chain-disruption-simulation.html`,
`supply-chain-management-game.html`, `procurement-simulation-game.html`, `six-sigma-kaizen-supply-chain.html`,
`7cs-supply-chain-4pl-logistics.html`.

Files corrected for the industries → difficulty-tiers rewrite (2026-08-23, commit `a0a5b58`): `index.html` (JSON-LD
featureList + HowTo step, hero eyebrow/stats, hero micro-steps, How It Works cards, FAQ JSON-LD, educator copy,
pricing tiers — removed the fake second "Executive Strategy Debrief PDF" bullet), `about.html`, `terms.html`,
`supply-chain-company-types.html`, `supply-chain-industry-dynamics.html`, `scm-fundamentals-5-pillars.html`.
