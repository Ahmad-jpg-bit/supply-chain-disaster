# Landing Page Sprint Plan
> Last updated: 2026-04-04

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

## Remaining Work

- [ ] Edit remaining 31 blog drafts for AI writing patterns (retry after rate limit resets)
- [ ] Verify footer `/privacy` link once Privacy Policy page exists
- [ ] QA landing page on mobile — check roadmap scroll, ticker overflow, hero stat layout
