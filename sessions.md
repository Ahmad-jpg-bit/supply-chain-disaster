# Supply Chain Disaster — Session Log

---

## 2026-04-05 — Landing Page Quality Sprint

**Deployed to:** https://www.supplychaindisaster.com
**Vercel inspection:** https://vercel.com/ahmad-fs-projects/supply-chain-game/hfEK3uRg9Fs83PguvLZDoiEpczY7

### Sprint 1 — Conversion Architecture & Trust

**1a. Simplified Header**
- `src/shared/nav.js` — Added `setNavMinimal(active)` export; toggles `.site-nav--minimal` class on the nav element
- `src/shared/nav.css` — `.site-nav--minimal` hides Resources dropdown, Calculators ↗, Contact, Search. Logo + Play Free + Unlock All ✦ remain visible
- `src/ui/landing-page.js` — Calls `setNavMinimal(true)` on render; restores full nav (`setNavMinimal(false)`) before every `onLaunch` trigger (industry cards + survival cards)

**1b. Mission Briefing Tooltip Fix**
- `src/ui/landing-page.css` — Tooltip on locked chapters (Ch 3–8) repositioned from `bottom: calc(100% + 10px)` (above, clipped by overflow container) to `top: calc(100% + 8px)` (below, always visible). Copy changed to "Unlock with Standard Edition — $14.99 one-time". `.lp-roadmap-scroll` padding-bottom increased to `3.5rem`

**1c. Footer — Privacy Policy Added**
- `src/shared/footer.js` — Added "Privacy Policy" (`/privacy`) to the Legal link group and the footer-bottom bar
- `src/ui/landing-page.js` — Imports and calls `createFooter()` at end of `_render()` so the footer now appears on the landing page

---

### Sprint 2 — Performance & Visual Hierarchy

**2a. Load Order: Hero Text → Terminal → Crisis Feed**
- `src/ui/landing-page.css` — Added staged entrance animations:
  - Hero left (text): `lp-fade-in-up` 0.5s, no delay
  - Hero right (terminal panel): `lp-fade-in-up` 0.6s, 0.25s delay
  - Crisis ticker: `lp-fade-in` 0.5s, 1.4s delay

**2b. Background Particle Reduction**
- `src/graphics/particle-network.js` — Reduced ambient particle density and opacity:
  - `AMBIENT_COUNT`: 40 → 20
  - `AMBIENT_COUNT_MOBILE`: 15 → 8
  - Blue opacity: 0.7 → 0.3 · Green: 0.6 → 0.22 · Amber: 0.5 → 0.18
  - `LINK_OPACITY`: 0.15 → 0.06

**2c. Industry Icons — Emojis Replaced with SVG**
- `src/ui/landing-page.js` — `INDUSTRY_CONFIG` icons swapped from emoji to `getIcon()` SVG:
  - Electronics ⚡ → `factory` icon
  - FMCG 📦 → `store` icon
  - Pharma 💊 → `shield` icon
- `src/ui/landing-page.css` — `.lp-ind-icon` restyled as a 48×48 accent-coloured icon tile; SVG stroked with `var(--ind-accent)`
- `src/style.css` — `.lp-survival-card-icon` updated from `font-size: 2rem` to an SVG-ready flex container

---

### Sprint 3 — Copy & Positioning

**3a. Jargon Reduction — "Encrypt" Removed**
- `src/ui/landing-page.js` — All encrypt/encrypted/encrypting language replaced across the Save Progress section (template HTML + `_handleEmailSubmit` async handler):
  - Section label: "Intelligence Briefing" → "Save Progress"
  - H2: "Secure Your Operational Data" → "Save Your Progress"
  - Body copy rewritten to plain language (no "volatile memory" / "command-center access")
  - Terminal title: `SECURE_BACKUP.exe` → `PROGRESS_BACKUP.exe`
  - Prompt: "ENTER COMMAND CENTER ACCESS" → "ENTER YOUR EMAIL"
  - Email placeholder: `commander@yourdomain.com` → `you@example.com`
  - Button: "Encrypt →" → "Save Progress →" / "Encrypted ✓" → "Saved ✓"
  - Status messages updated to match

**3b. Headline Alignment**
- `src/ui/landing-page.js` — H1 kept ("Where Future Supply Chain Leaders Are Forged." — already on target). Subtitle rewritten to remove "Bullwhip Effect" as the first thing newcomers see:
  - Before: "Don't just study the Bullwhip Effect — feel it. Navigate complex mission-based chapters designed to teach you end-to-end supply chain tactics."
  - After: "Experience real supply chain crises through simulation. Work through scenario-driven chapters that teach procurement, inventory strategy, and supplier risk — the way professionals learn."
