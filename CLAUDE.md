# Supply Chain Disaster — CLAUDE.md

> Last updated: 2026-03-29

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
- **Payments:** Lemon Squeezy (web) + RevenueCat (native Android via Capacitor)
- **Email:** Resend — sender `hello@supplychaindisaster.com` (domain verified)
- **Dev server:** `npm run dev` → http://localhost:3000
- **Build:** `npx vite build`

---

## Tiers & Gating
| Tier | Chapters | Turns | Price |
|---|---|---|---|
| Free | 1–3 | 1–12 | — |
| Full Access | 1–10 | 1–40 | $6.99 one-time (lifetime) |

- **Single-plan pricing (since 2026-07-05):** one $6.99 lifetime purchase unlocks everything — all 10 chapters + Advanced Report. Old Standard ($14.99) / Expansion ($25) tiers are retired; legacy purchases (any stored `tier`) are honoured as Full Access (`PremiumManager.isExpansion()` returns `isPremium()`).
- **LS product "Supply Chain Disaster Full Access":** product ID `1197198`, variant ID `1871634` (= `LEMONSQUEEZY_STANDARD_VARIANT_ID`), hosted checkout `https://nexttracksystems.lemonsqueezy.com/checkout/buy/65c58393-3110-4aec-9e52-c93abaf3de33` (hardcoded in `paywall.js` and `index.html`). `LEMONSQUEEZY_EXPANSION_VARIANT_ID` is kept only for legacy order verification.
- Premium stored in `localStorage` key `scd_premium`
- Promo code `SC10Disaster` → 30-day full access, validated server-side via `/api/redeem-promo`
- Paywall triggers at Ch 3→4 (single gate) — any premium unlocks all remaining chapters
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

### Old/unused files — do not edit
- `src/data/scenarios.js` — superseded by `scenarios-expanded.js`
- `src/data/industries.js` — duplicate of `src/logic/industries.js`
- `api/polar-webhook.js` — deprecated, returns 410

---

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `/api/create-checkout` | Builds LS checkout URL for a given tier |
| `/api/verify-subscription` | Verifies LS order by ID or email |
| `/api/redeem-promo` | Validates promo codes server-side; `SC10Disaster` → 30-day expansion |
| `/api/ls-webhook` | Handles LS webhook events; sends tier-specific purchase welcome emails |
| `/api/save-progress` | Sends "operational data secured" email to player + internal notification |
| `/api/send-email` | Contact form handler |

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

## Android / Capacitor
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
The game has **10 chapters total**. Single plan since 2026-07-05. Always write:
- "up to 10 chapters" when describing the game generically
- "Chapters 1–3 free" for the free tier
- "Full Access — $6.99 one-time, lifetime" for the paid plan (all 10 chapters + Advanced Report)
- "40 quarterly turns" for the full game
- Never mention Standard Edition ($14.99) or Expansion Bundle ($25) — retired tiers

Files corrected for single-plan pricing (2026-07-05): `index.html`, `about.html`, `terms.html`, `pricing.html`,
`refund.html`, `privacy.html`, `public/llms.txt`, `supply-chain-disruption-simulation.html`,
`supply-chain-management-game.html`, `procurement-simulation-game.html`, `six-sigma-kaizen-supply-chain.html`,
`7cs-supply-chain-4pl-logistics.html`.
