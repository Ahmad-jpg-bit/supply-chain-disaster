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

## Remaining Work

- [ ] Edit remaining 31 blog drafts for AI writing patterns (retry after rate limit resets)
- [ ] Verify footer `/privacy` link once Privacy Policy page exists
- [ ] QA landing page on mobile — check roadmap scroll, ticker overflow, hero stat layout
