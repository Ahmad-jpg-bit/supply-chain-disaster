# Landing Page Sprint Plan
> Last updated: 2026-04-12

## URGENT

- **Email existing customer their Lemon Squeezy Order ID before deploying the premium-access hardening.**
  Niklas Vögl (niklas.voegl@aon.at) purchased the Expansion Bundle (Order ID: **7910695**) on 2026-03-28.
  He currently has no way to recover access if he clears localStorage.
  Send the recovery email manually via Resend *today*, before this diff goes to production.
  *(Email sent 2026-04-12 — Order ID 7910695 delivered to niklas.voegl@aon.at)*

---

## Premium Access Hardening (2026-04-12)

Problem: `scd_premium` in localStorage is the only record of a purchase.
Clearing browser data, switching devices, or using a different browser silently locks
the user out of content they paid for.

| # | File | Change |
|---|------|--------|
| 1 | `src/success.js` | Show Order ID with one-click copy button on the post-payment page |
| 2 | `api/ls-webhook.js` | Inject Order ID block into welcome emails (Standard + Expansion) |
| 3 | `src/ui/paywall.js` | Elevate "Restore access" from a footer link to a prominent bordered box |
| 4 | `api/verify-subscription.js` | Return `orderId` field; structured error codes `ORDER_NOT_FOUND`, `ORDER_REFUNDED`, `RATE_LIMITED`; filter refunded orders on restore-by-email path |
| 5 | `src/dashboard.js` | One-time dismissible nudge banner for premium users |
| 6 | `src/dashboard.js` + `src/ui/paywall.js` | `scd_pending_resume` — save/restore game state across checkout redirect |

---

## Sprint 1 — Structural Fixes

### 1. Simplify Header ✅
Minimal nav is already wired: `setNavMinimal(true)` called in `LandingPage._render()`.
`src/shared/nav.css` `.site-nav--minimal` hides Resources dropdown, Calculators ↗, Contact, and Search.
Only logo + **Play Free** + **Unlock All ✦** remain visible on the landing page.

### 2. Mission Briefing Hover Bug ✅
**Problem:** `.lp-roadmap-scroll { overflow-x: auto }` implicitly sets `overflow-y: auto`,
clipping the `::after` tooltip that appears below locked chapter nodes.
**Fix:** Added `padding-bottom: 56px` to `.lp-roadmap-track` so the tooltip lives within
the scrollable content area and is no longer clipped.
File: `src/ui/landing-page.css`

### 3. Trust Footer ✅
`createFooter()` already called in `LandingPage._render()`.
`src/shared/footer.js` renders Privacy Policy, Terms of Service, and Refund Policy links.

---

## Sprint 2 — Performance & Visual Polish

### 4. Load Order Sequence ✅
Added `@keyframes lp-section-in` entrance animations with staggered delays:
- `.lp-hero-left` → 0s (hero text loads first)
- `.lp-hero-right` → 0.25s (terminal preview)
- `.lp-ticker` → 0.55s (crisis feed ticker last)
Respects `prefers-reduced-motion`.
File: `src/ui/landing-page.css`

### 5. Reduce Particle Density ✅
- `HERO_COUNT` reduced from 80 → 50
- `LINK_OPACITY` reduced from 0.06 → 0.04
File: `src/graphics/particle-network.js`

### 6. Replace Emoji Icons with SVG ✅
`INDUSTRY_CONFIG` already uses `getIcon('factory'|'store'|'shield', 32)` — SVG outline icons
from `src/graphics/svg-icons.js`. No emoji in use.

---

## Sprint 3 — Copy & Messaging

### 7. Remove Email Capture Jargon ✅
`_intelHTML()` already uses plain language: "Save Your Progress", "back it up and recover
across devices", "PROGRESS_BACKUP.exe". No "encrypt", "volatile memory", or
"command-center access" present.

### 8. Simplify H1 ✅
**Before:** "Where Future Supply Chain Leaders Are Forged."
**After:** "Supply Chain Strategy, Learned Through Simulation."
Focuses on the learning outcome rather than the aspirational framing.
File: `src/ui/landing-page.js`

---

## Blog Automation (separate pipeline)

- Daily cron at 09:00 UTC via `.github/workflows/publish-blog.yml`
- `scripts/publish-today.js` → md-to-html → blog.html card → sitemap + rss + vite.config
- Schedule: 39 posts Apr 4 – May 13 2026 in `blog-schedule.json`
- 3 posts published (Apr 4–6). 36 pending.
- Blog draft humanization: 6/37 files edited. 31 remaining (paused, will retry).

---

## Loading Screen (2026-04-12)

- [x] Loading screen — instant inline CSS render on `/play` (root `index.html`), smooth 0.4 s
      fade-out on game ready (LandingPage mount / dev bypass / checkout resume paths all covered)
- [x] 4 s + 8 s slow-connection fallback messages ("Still loading…" / "Almost there…")
- [x] Homepage → `/play` navigation transition overlay (dark fade before browser navigation)
- Skeleton pulse skipped — all game panels populate synchronously; no blank panel state exists.

> **Measure this:** Monitor `game_started` rate in GA4 week-on-week after this deploy.
> The blank black screen was estimated to cause 10–15 % drop-off between `page_view` and
> `game_started` on `/play`. Expect this metric to improve within 7 days of deployment.

---

## Industry Difficulty Badges (2026-04-12)

- [x] Industry difficulty badges added — Intermediate / Start here / Advanced with persona matching lines
- [x] FMCG recommended accent (border glow + "Recommended" corner tag) shown to first-time players only
- [x] "Start with Fast-Moving Consumer Goods" guidance line shown to first-time players only
- First-time detection uses three existing keys: `scd_skipped_intros`, `scd_progress_email`, `scd_premium`

> **Measure this:** Monitor which industry first-time players select after this change. If FMCG
> selection increases among new players, the badge guidance is working. A higher Chapter 1
> completion rate on FMCG vs Electronics would confirm an easier onboarding path.

---

## Static Homepage — Option C (2026-04-14) ✅

Separated marketing homepage from the game SPA:

| File | Change |
|---|---|
| `index.html` | Rewritten as fully static marketing page (hero, industries, curriculum, pricing, FAQ) — all content in raw HTML, crawlable without JS |
| `play.html` | New game SPA entry extracted from old `index.html`; canonical `/play` |
| `src/home.js` | Lightweight module entry: boots `createNav`, `createFooter`, `initAmbientParticles` |
| `vite.config.js` | Added `play` entry; updated `inject-static-seo-nav` plugin to skip `play.html` instead of `index.html` |
| `vercel.json` | Removed `/play → /` permanent redirect; updated `/game → /play` |

**Impact:** `index.html` is now 42 kB of static HTML (up from ~0 kB readable content). Googlebot Wave 1 crawl now sees the full marketing page without JS rendering. Game bundle (683 kB) only loads on `/play`, not on the homepage.

> **Measure this:** Monitor Google Search Console Coverage report — pages previously indexed as "Crawled, not indexed" or "Discovered, not indexed" should move to "Indexed" within 2–4 weeks of Googlebot re-crawling. Also check if organic impressions for non-brand keywords improve.

---

## Marketing Homepage Redesign (2026-04-14)

- [x] Marketing homepage rebuilt as static HTML — navy/amber design,
      DM Serif Display headlines, full sections including social
      proof, features, educators CTA, testimonial, 4-tier pricing

> **Homepage is fully static HTML** — crawlable by search engines
> without JS execution. All SEO meta tags preserved from previous
> implementation. Google Search Console submission recommended
> after this deploy.

---

## Chapter Progress Indicator (2026-04-15) ✅

Reduces mid-game abandonment by giving players persistent visibility of where they are in the game before the paywall fires.

- [x] Chapter progress indicator added to game header (`Chapter X · Turn Y of Z`)
      — `#hud-turn-text` element injected in `play.html` header, populated by `renderChapterProgress()`.
      Hidden on landing/industry selection; only visible once game is in progress.
      Mobile: chapter label hidden via CSS, turn info remains (`Turn 3 of 4 · Ending soon`).
- [x] 1px amber progress bar below header
      — `#game-progress-bar` / `#game-progress-fill` in `play.html`; width = `(completedTurns / maxTurns) × 100%`;
      CSS `transition: width 0.4s ease`. Updates every turn via `renderChapterProgress()`.
- [x] "Ending soon" anticipation signal at Turn 3–4 of 4
      — Amber 11px text appended to turn indicator at the last 2 turns of any chapter.
      Free-tier Chapter 2 last turn shows "Final turn coming" instead to prime paywall expectation.
- [x] Chapter transition summary screen with key stats
      — `ChapterTransition.show()` now receives `{ engineState }` from `renderChapterSummary()`.
      Displays Final Cash, Chapter Profit (green/red), and Missed Sales units.
      Narrative consequence line derived from score + profit + stockouts.
      Auto-advances after 6 seconds (depleting amber bar animation); cancelled on manual click.
      Expansion chapters (9–10) resolved from combined `[...CHAPTERS, ...EXPANSION_CHAPTERS]`.

> **Measure this:** Monitor `round_completed` events in GA4 — specifically the drop-off between
> Turn 4 and Turn 8 within Chapter 1. If players are now completing chapters at a higher rate,
> the progress indicator is reducing mid-game abandonment.
> Compare week-on-week after deployment.

---

## Homepage CTA Optimisation (2026-04-15)

- [x] Hero CTA updated — "Play Chapter 1 Free — No Sign Up →"
- [x] Friction-removal line added below CTAs — "Takes 15 minutes. No account. No install. Runs in your browser."
- [x] Micro-explainer steps added below stats bar — "1. Pick your industry → 2. Make procurement decisions → 3. See if your supply chain survives"
- [x] Terminal widget DECIDE button links to /play (with existing fade transition)

> **Measure this:** Watch `cta_clicked` and `game_started` in GA4
> over the next 7 days. Target: `game_started` rate should move
> from 10% of visitors to 20%+. If `cta_clicked` increases but
> `game_started` does not, the problem is the loading screen or
> /play landing experience, not the homepage CTA.

---

## /play Friction Fix — Skip Marketing Hero (2026-04-15)

- [x] `/play?start=1` parameter skips marketing hero and goes directly to industry selection
- [x] All homepage CTAs updated to `/play?start=1`
- [x] Direct `/play` navigation preserved for returning users

> **This was a critical friction fix.** The user flow was:
> Homepage → /play → second Play Free click → industry selection
> It is now:
> Homepage → /play?start=1 → industry selection (direct)
>
> **Measure this:** Watch `game_started` rate in GA4 over the next
> 7 days. Removing the redundant click should meaningfully improve
> the homepage → game_started conversion rate. Target: `game_started`
> rate should move from 10% to 25%+ of /play visitors.

---

## Debrief Report

### Data Collector (2026-04-22) ✅

`src/game/debrief-collector.js` — singleton that silently captures all gameplay
data required for the post-game debrief report. Persists to localStorage under
`scd_debrief_v1` so data survives page refreshes.

- [x] Debrief data collector implemented
- [x] Hooked into `engine.init()` — session metadata (industry, archetype, initial state)
- [x] Hooked into `engine.initEndless()` — endless-mode session metadata
- [x] Hooked into `engine.makeDecision()` — full story decision log per turn
      (fixes audit blind spot: `lastStoryChoice` was overwritten each turn)
- [x] Hooked into `engine.processTurn()` — per-quarter record with:
      - `playerOrder` vs `optimalOrder` (order-up-to formula against deterministic forecast)
      - `orderDeviation` percentage
      - `serviceLevel` per turn
      - full procurement choices (supplier, inspection, shipping, pricing)
- [x] Hooked into `engine.processTurn()` — crisis event log (turn, chapter, id, severity, effects)
- [x] Hooked into `engine.processTurn()` (CHAPTER_SUMMARY branch) — chapter-end snapshot:
      - `avgServiceLevel`, `totalStockouts`, `totalOverstock`
      - `cashStart` / `cashEnd` / `cashDelta`
      - `bullwhipRatio` (Var(orders) / Var(demand) for chapter turns)
      - mastery score + decision breakdown
      - crisis events scoped to chapter

| Key | Shape |
|---|---|
| `scd_debrief_v1` | `{ industry, startTime, initialCash, initialInventory, startingArchetype, quarters[], storyDecisions[], chapters[], crisisEvents[] }` |

Next: ~~build the debrief report UI~~ ✅ done — see PDF Debrief Report section below.

---

## PDF Debrief Report (2026-04-22) ✅

Added `jspdf-autotable` v5.0.7 (jsPDF v4.2.0 was already installed).

### New files
| File | Purpose |
|---|---|
| `src/ui/debrief-screen.js` | Overlay component + `downloadPDF()` — all PDF logic lives here |
| `src/ui/debrief-screen.css` | Styles for the in-browser debrief overlay |

### PDF structure (5 pages)
| Page | Content |
|---|---|
| 1 — Cover | Industry, date, blended score ring, grade badge, score breakdown pills |
| 2 — Performance Summary | 4-stat 2×2 grid (cash, service level, mastery, bullwhip) + diagnostic insights + mastery bars |
| 3 — Decision Audit | Full `autoTable` — Quarter, Chapter, Your Order, Optimal Order, Deviation (colour-coded), Svc Level, Cash; auto-paginates |
| 4 — Chapter Breakdown | Per-chapter: score bar, 4 metric pills, decision chips, top crisis strip |
| 5 — Learning Summary | Data-driven narrative (bullwhip, order accuracy, inventory balance, crisis resilience) + italic disclaimer |

### Design
- RGB tokens mirror `digital-guide.js` exactly (NAVY/BLUE/AMBER/GREEN/RED)
- Deviation column: green ≤ 10%, amber >25%, red <−25%
- File name: `supply-chain-debrief-{industry}-{YYYY-MM-DD}.pdf`

### Integration points (minimal, additive only)
| File | Change |
|---|---|
| `src/dashboard.js` | Import + instantiate `DebriefScreen`; pass `onDebrief` callback in `endGame()` |
| `src/ui/game-over-screen.js` | Accept `onDebrief` param; render "Debrief Report" button; wire click handler |

### Gate
"Debrief Report" button always shown on game-over screen.
`downloadPDF()` button inside the overlay is **only rendered when `isPremium === true`**.
Non-premium players see the in-browser summary + a locked-state upsell hint instead.

---

## Monetisation Model Pivot (2026-04-22) ✅

All chapters are now free to play. The debrief report is the paid feature.

| # | File | Change |
|---|------|--------|
| 1 | `src/logic/premium.js` | `isChapterLocked()` always returns `false`; updated header comment |
| 2 | `src/dashboard.js` | `renderChapterSummary()` — removed `nextIsExpansionLocked` / `nextIsLocked` paywall intercept; all chapters now call `advanceFromChapterSummary()` directly |
| 3 | `src/ui/landing-page.js` | Roadmap badges removed (all nodes `lp-roadmap-node--free`); legend updated to "All 8 chapters — no account needed"; pricing tiers updated: Free = full game, Standard = Debrief Report ($14.99) |
| 4 | `index.html` | Pricing grid updated (Free = full game, Standard = debrief, Expansion = Ch 9–10 + cert); FAQ updated with "Is the full game really free?" entry; JSON-LD + OG/Twitter meta updated |

**Niklas Vögl** (niklas.voegl@aon.at, Order ID 7910695): no action needed. Existing expansion-tier record grants `isPremium() = true`, which now means full debrief access. All chapters becoming free is additive — their paid purchase is now worth more, not less.

---

## Remaining Work

- [ ] Edit remaining 31 blog drafts for AI writing patterns (retry after rate limit resets)
- [ ] Verify footer `/privacy` link once Privacy Policy page exists
- [ ] QA landing page on mobile — check roadmap scroll, ticker overflow, hero stat layout

---

# Engagement & Interactivity Roadmap
> Saved: 2026-07-08 · Wave 3 shipped 2026-07-08 (commit dabafc5) · Wave 4+ remains queued

Goal: move the game beyond click-an-option / MCQ interactions toward **direct
manipulation with continuous feedback**, in service of the core purpose —
making supply chain concepts stick.

## Shipped (context)

- **Wave 1 (2026-07-06):** predict-before-reveal forecast call (`src/ui/prediction-prompt.js`),
  board-meeting spaced-recall MCQ with $20k bonus (`src/ui/board-question.js` +
  `src/data/recall-questions.js`), concept-in-action lines (`src/logic/concept-insights.js`).
- **Wave 2 (2026-07-08):** persistent world memory (`src/logic/world-memory.js`,
  in `engine.state.worldMemory`, included in save payload). Echoes: loyalty shield,
  re-onboarding premium, quality debt (redeemable), reliability credit — surfaced
  as "THE CHAIN REMEMBERS" in the turn summary.

## Wave 3 — SHIPPED 2026-07-08 (commit dabafc5, all five verified in-browser + 23 Node tests)

### 1. Demand forecast slider + personal MAPE
Replace the binary cover/stock-out call in `src/ui/prediction-prompt.js` with a
slider: the player forecasts the actual demand number (range ≈ 500–1,500 around
the 1,000 baseline, with a faint volatility band from history). After the turn,
score the call: APE = |actual − forecast| / actual. Track a running session MAPE
in `dashboard._resolveTurn()` (replace `_predictionStats`), render verdict +
running MAPE in the turn-summary chip (`.tsc-prediction`), grade thresholds:
<10% excellent, <20% good. The player *becomes* the forecaster — MAPE stops
being a flashcard and becomes their own score. Smallest effort; do first.

### 2. Live planning workbench (inventory projection)
In the procurement panel, a live SVG projection that updates as the player drags
order quantity / safety stock / changes supplier or shipping: projected on-hand
inventory for the next ~4 turns (arrivals from `state.inTransit` + the new order
landing at `_computeLeadTimeTurns()`, demand = deterministic forecast), with a
shaded stockout-risk zone below safety stock and a holding-cost signal when far
above it. Hook where `updateCostEstimate()` already listens (order-input,
safety-stock-slider, `.psc` / `.shc` / `.option-card` clicks) in
`renderProcurementPhase()`. This makes every turn feel like operating a system
instead of submitting a form. Biggest upgrade to the core loop.

### 3. Counterfactual replay on the turn summary
"Replay this quarter" button on `TurnSummaryCard`: a slider re-runs the SAME
quarter (same demand, same crisis — no re-rolls) with a different order
quantity, showing side-by-side deltas: missed sales, holding cost, profit.
Implementation: pure recompute function (new `src/logic/counterfactual.js`);
engine must expose turn-start snapshots on the result — `_snapInventory` /
`_snapInTransit` already exist in `processTurn()` for the debrief, just attach
them to `result` (e.g. `result.startingInventory`, `result.startingInTransit`).
Comparing "what happened" vs "what would have happened" is one of the strongest
known teaching mechanics.

### 4. Crisis rationing allocator
When a turn ends in significant shortage (e.g. `missedSales > 300`), before the
summary card, show an allocation overlay: three customer segments — a premium
payer, your oldest loyal account, a churn-risk retailer — each with a demand
bar; the player drags the fulfilled units between them. No "right" answer:
allocation adjusts satisfaction, next-turn demand modifiers, and writes to
world memory (favoring/starving the loyal account should echo later). Teaches
rationing & shortage gaming (a bullwhip cause) by making the player do it.
Engine addition: `applyAllocation(result, weights)` post-`processTurn` (avoids
splitting the synchronous turn resolution).

### 5. Concept-named achievements
localStorage-persisted, awarded at turn/chapter end, toast on unlock:
- **Bullwhip Tamer** — chapter bullwhip ratio < 1.5
- **TCO Hawk** — lowest total landed cost (not lowest unit price) chapter
- **Forecast Oracle** — session MAPE < 10% over 8+ calls (ties into #1)
- **Loyalty Dividend** — trigger the loyalty shield
- **Clean Streak** — clear quality debt / 8 clean quarters
Badges force the vocabulary. Small, do alongside #1.

**Recommended order:** 1 → 2 → 3 → 5 → 4 (allocator has the most new UI).
**Verification pattern:** Node tests for pure logic (see
`test-world-memory.mjs` approach), browser playtest via `.claude/launch.json`
dev server, `npx vite build`, deploy `npx vercel --prod`.

## Wave 4+ — queued (not yet designed in detail)

- **Diegetic crisis inbox — SHIPPED 2026-07-08 (commit eedf080).** Crises are
  pre-rolled (`engine.prepareTurnCrisis()`, cloned) and arrive as priority
  messages from six recurring characters (`src/logic/crisis-inbox.js` +
  `src/ui/crisis-inbox.js`) with paid mitigation options on six crisis types.
  Board-confidence meter (`src/logic/board-confidence.js`, 0–100 in HUD, saved)
  moves on results/allocations/crisis handling/board answers; at zero, a
  dismissal overlay routes into game over. Human vignettes
  (`src/data/vignettes.js`) render on notable outcomes in the turn summary.
- **Supplier negotiation — SHIPPED 2026-07-11 (commit 140a939).** Chapter-start
  volume-commitment contracts (`src/logic/negotiation.js` + `src/ui/negotiation-overlay.js`);
  terms + counter concessions gated on the world-memory relationship score;
  `engine.state.activeContract` applies a cost discount or shortfall fee, saved,
  expires at chapter end.
- **Career/title progression — SHIPPED 2026-07-11 (commit 140a939).** Six-rung
  ladder (`src/logic/career.js` + `src/ui/career-hud.js`), rank tracks progress
  nudged by board confidence, between-chapter reviews framed on CSCP domains,
  HUD rank chip, `careerRankIndex` saved.
- **Route-drawing map — SHIPPED 2026-07-11 (commit 08698b2).** SVG intermodal
  lane builder at logistics-chapter start (`src/logic/route-planner.js` +
  `src/ui/route-planner-overlay.js`); `engine.state.activeRoute` applies a
  shipping cost factor + lead-time mod for the chapter, saved, expires at
  chapter end. (Built with SVG, no external map assets.)
- **Spaced-recall emails — SHIPPED 2026-07-12 (commit c3c9477), dormant until KV.**
  Daily Vercel cron (`vercel.json` crons @ 14:00 UTC → `api/recall-cron.js`) sends
  day-3 / day-10 single-question retrieval emails to saved players via Resend.
  `CRON_SECRET`-guarded (set in prod). Verified live: 401 without bearer, 200
  `{skipped:'kv-not-configured'}` with it. **Activates when the KV store is
  created** — no saved players to email until then. `?dry=1` counts without sending.
- **Weekly seeded Endless challenge + global leaderboard — SHIPPED 2026-07-12
  (commits ec9edf2, f61eb60).** Seeded RNG (`src/logic/seeded-rng.js` mulberry32
  + ISO-week config; `engine._rng` threaded through demand variance + crisis
  rolls, seeded only for weekly so all players face the same run — verified
  byte-identical). KV sorted-set board (`api/leaderboard.js`: GET top 25 /
  POST submit+rank / DELETE admin-clear guarded by CRON_SECRET). UI
  (`src/ui/leaderboard.js` + landing banner + endless death-screen submit).
  Live round-trip verified against prod KV. **This was the final roadmap item.**

---

## UI Modernization — in-game screens (2026-07-14)

Finding from a live desktop review: the "old-school dashboard" feel no longer
comes from surface styling (backdrop/glows already refreshed) — it comes from
the **layout skeleton, uniform panel chrome, and hard state swaps**. Ordered by
impact-per-effort:

### Structural
1. **Story-mode layout.** `.dashboard-grid` is `250px 1fr 300px`; during STORY
   the action panel is `display:none` but its 300px column is still reserved —
   measured: story card 666px wide inside a 1248px grid with a dead right
   gutter. Add a `story-mode` grid class (mirror of `proc-mode`) so decision
   moments fill the stage.
2. **Retire the left rail of five stacked metric boxes** (`play.html`
   `.metrics-panel`) in favor of one compact horizontal KPI strip used across
   all phases — the procurement `proc-kpi-bar` is already the right pattern.
   Two competing KPI systems means players re-learn the screen every phase.
   Keep `cash-display` etc. IDs so AnimatedCounter/sparkline wiring survives.
3. **Fewer boxes, fewer borders.** Nearly every element is the same
   `glass-panel` (1px white-10% border + blur), and they nest. Reserve
   borders/elevation for the active interactive surface; let secondary content
   sit on the backdrop separated by spacing and type weight.

### Narrative presentation
4. **Render scenarios as communications, not a text blob in tabs.** Copy
   already has characters ("your Bangkok distributor…"). Sender-tagged message
   blocks, fast skippable typewriter reveal; Intelligence/Financials as
   slide-in sheets instead of enterprise tabs. Same visual language as the
   shipped crisis inbox.
5. **View transitions.** `renderGameState()` does `innerHTML = ''` hard swaps.
   Wrap phase changes in `document.startViewTransition()` (feature-detected,
   honors `prefers-reduced-motion`). Also replaces the `⚙ EXECUTING…` spinner
   moment.

### Detail polish (cheap, each one dates the UI)
6. **Emoji-as-icons** (📊 🔗 📡 intel labels, 📦 ⚠ 🛡 banners, ⚙ spinner) →
   `svg-icons.js` set.
7. **White default scrollbar** in dark modals → `color-scheme: dark` + thin
   styled scrollbars in `base.css`.
8. **ALL-CAPS microlabels everywhere** → keep caps for the KPI strip as
   flavor, sentence case elsewhere (intel/financials section labels).
9. **Chart.js stock look** → faint/no gridlines, gradient area fill, rounded
   caps, dark tooltip, animated draw-in.
10. **Stock Tailwind palette** (`#0f172a`/`#3b82f6`/`#f59e0b`) → tint the
    near-black toward a signature hue; move raw hexes scattered in
    `dashboard.js` into CSS tokens. (Careful: `base.css` is shared with
    marketing pages.)
11. **Numbered chapter circles read as pagination** → slim segmented progress
    rail, current chapter as labeled pill.

**Keep:** the bottom crisis ticker (diegetic trading-floor feed) — just add
edge fade masks + pause-on-hover so it reads deliberate.

**Status (2026-07-14):** SHIPPED — 1 (story-mode grid class, story card 760px
on a full-width stage), 2 (`.metrics-panel` moved out of the grid into a
horizontal KPI strip shared by all phases; procurement's duplicate
`proc-kpi-bar` reduced to just the market-conditions pill in
`.proc-alert-row`), 5 (`startViewTransition` wraps phase changes +
outcome reveal via `_withViewTransition`; HUD/strip/ticker excluded from the
root fade), 6 (intel/banner/spinner emoji → `svg-icons.js`, added `box` +
`spinner` icons), 7 (`color-scheme: dark` + thin scrollbars in `base.css`),
9 (bullwhip live chart: gradient demand fill, no x-grid, dark tooltip,
600ms draw-in — qty preview still updates with `update('none')`),
11 (chapter circles → segmented rail with labeled current-chapter pill).
Ticker fades/pause already existed. Verified in-browser (story → outcome →
procurement cycle, no console errors) + `npx vite build` clean.
**Wave 2 (2026-07-15):** SHIPPED — 4 (comms-style narrative: scenarios arrive
as briefings from crisis-inbox characters — `SENDERS` exported from
`crisis-inbox.js` + new `ops` sender Sofia Reyes, mapped by
`_scenarioSender()` on `highlightNode`; skippable ~185 chars/s typewriter
honoring `prefers-reduced-motion`; options fade in when the text lands;
Mission/Intelligence/Financials tabs replaced by slide-in side sheets with
backdrop + Escape close), 3 (flattened box-in-box chrome: story text,
intel sources, and fin sections sit on the surface with spacing/type only;
fin total keeps its accounting rule line), 8 (intel/fin labels
sentence-cased, uppercase transform removed; KPI strip keeps caps as
flavor), 10 (inline hexes in `dashboard.js` template strings → CSS tokens;
Chart.js canvas colors and the `${accent}55` hex-alpha risk accents stay
literal by necessity; the site-wide `--bg-color` hue shift was deliberately
skipped — `base.css` is shared with marketing pages and the in-game
backdrop already has its own layered-gradient treatment). Verified
in-browser (typewriter caught mid-stream at 108/472 chars, skip-click,
both sheets, Escape, full decision cycle, zero console errors) +
`npx vite build` clean. **Roadmap complete.**

---

## UI Modernization — wave 3: overlay surfaces (2026-07-16)

The decision screen is done; the second wave extends the same visual language
to the overlays players see every turn/chapter. Survey found ~60 pictorial
emoji used as UI icons across `src/ui/*` (turn-summary 23, consequence 11,
debrief 11, plus chapter-transition, board-question, crisis-inbox,
negotiation, route-planner, paywall, leaderboard, endless-death, certificate).
Typographic glyphs (✓ ✗ → ★ ✦ ≈ ✕) and the colored 🥇🥈🥉 rank medals stay.

1. **`iconify(glyph, size)` helper in `svg-icons.js`** — maps known emoji to
   SVG icons, passes unknown strings through. Used at render sites whose icon
   values come from data (world-memory echoes, debrief insights, endless-death
   causes, crisis-engine archetypes) so saved states and the jsPDF export
   (which needs raw text) keep working.
2. **New icons:** search, plane, target, bolt, alertCircle, xCircle, fileText,
   wrench, history, book, refresh, mail, handshake, map, lock, download.
3. **Direct `getIcon` swaps** for hardcoded emoji in: turn-summary-card
   (income statement rows, key driver, forecast target, contract, mitigation,
   echoes label, concept book, replay), consequence-overlay, chapter-transition
   (🔒), board-question (📘), crisis-inbox (📨), negotiation (🤝),
   route-planner eyebrow (🗺), leaderboard eyebrows (🏆), endless-death,
   certificate (🏆/⬇), dashboard archetype briefing.
4. **Paywall:** ✅ status prefixes → typographic ✓ (styled by the success
   class); the dev-only 🧪 test-mode banner stays.
5. **Content fix found in passing:** certificate canvas still draws
   "EXPANSION BUNDLE COMPLETE" — retired tier name, must not appear.
6. **Out of scope this wave:** onboarding.js + landing-page.js (marketing
   surfaces, separate pass), route-planner leg icons inside SVG `<text>`,
   jsPDF internals.

**Third pass (2026-07-16): landing page done.** Hero crisis-feed ticker
(6 items), chapter-select lock chip, weekly-challenge badge, and demo
"scenario alert" label now use the SVG set; industry cards already did.
Verified live: zero pictorial emoji anywhere on the rendered landing page,
12 ticker SVGs (6 × loop), trophy + warning badges confirmed; lock chip is
the same verified getIcon pattern (couldn't stage a free-player view — an
auto-restore path re-grants `scd_premium` in the test browser).
**Dead onboarding code removed (2026-07-17):** `src/ui/onboarding.js`
deleted (nothing imported it — the landing page replaced it) along with
124 orphaned style.css rules (~880 lines). Deletion was class-audited:
every removed selector requires a class used exclusively by onboarding.js;
shared classes the landing page reuses (`ch-select-*`, `btn-primary`,
`btn-glow`…) and the `gameover-grade-*` rules that shared a media block
were preserved and verified live (landing renders, chapter-select cards
styled, industry launch works, build clean, zero console errors).

**Status (2026-07-16): SHIPPED.** 16 icons + `iconify()` added; swaps landed
in turn-summary-card, consequence-overlay, debrief (DOM only — PDF keeps raw
glyphs by design), chapter-transition, board-question, crisis-inbox,
negotiation, route-planner, leaderboard, endless-death, certificate,
dashboard archetype chip; paywall ✅→✓; certificate canvas now says "FULL RUN
COMPLETE" (was the retired "EXPANSION BUNDLE" tier name). Verified live: full
turn played through prediction prompt → crisis inbox (mail SVG) → turn summary
(all statement rows SVG, zero pictorial emoji, ✦/✓ pass-throughs intact) →
consequence banner; `iconify` unit-checked for variation-selector emoji,
pass-through, and null. No console errors; `npx vite build` clean.
