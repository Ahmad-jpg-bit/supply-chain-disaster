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
| Free | 1–2 | 1–8 | — |
| Standard | 1–8 | 1–32 | $14.99 one-time |
| Expansion Bundle | 1–10 | 1–40 | $25.00 one-time |

- Premium stored in `localStorage` key `scd_premium`
- Promo code `SC10Disaster` → 30-day Expansion access, validated server-side via `/api/redeem-promo`
- Paywall triggers at Ch 2→3 (standard gate) and Ch 8→9 (expansion gate) in `renderChapterSummary()`
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
The game has **10 chapters total** (8 base + 2 expansion). Always write:
- "up to 10 chapters" when describing the game generically
- "8 chapters" only when referring specifically to the Standard Edition ($14.99)
- "10 chapters" when referring specifically to the Expansion Bundle ($25)
- "40 quarterly turns" for the full game; "32 turns" for Standard only

Files already corrected (2026-03-29): `index.html`, `about.html`, `terms.html`, `pricing.html`,
`supply-chain-disruption-simulation.html`, `supply-chain-management-game.html`, `procurement-simulation-game.html`.
