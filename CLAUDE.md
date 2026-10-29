# Supply Chain Disaster — CLAUDE.md

> Last updated: 2026-10-29

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

## Packaging & Entitlements (vanilla game — deployed 2026-10-21)
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

## Saves & cloud saves (since 2026-10-22 — deployed)
- **Runs, not slots.** Each campaign is a run; starting a new one never replaces another. Endless/weekly are never saved (unchanged policy).
- **Device saves** happen at run creation, committed briefing choices, resolved turns (before results; a checkpoint), phase changes, debounced draft edits, before checkout (`scd:before-checkout`), on `visibilitychange: hidden` and `pagehide`. Identical snapshots don't create a new revision (avoids phantom "pending sync"). The status never says "saved" unless the write succeeded.
- **Cloud saves** need an emailed code → session. Runs are stored under an internal owner ID (`sv:*` keys), never under the email. Verifying never grants purchases. Signing out removes that account's runs from the browser (warns about unsynced changes first).
- **Conflicts** (the server revision moved on while this device has unsynced changes) keep both versions; the player chooses; the other becomes a device-only copy. Snapshots are never merged. A 409 caused by another tab of the SAME device (its `writeId` is in `meta.recentWrites`) is adopted, not shown as a conflict.
- **Tabs:** the playing tab holds a claim (`scd_run_lock:{runId}`) refreshed every 30 s; a claim older than 90 s (crashed/frozen tab) stops blocking other tabs' sync. Continue always takes the claim (never waits). Every write checks the raw claim + `tabRev`, so a suspended tab that wakes after a takeover stands down; if it holds unsaved progress it offers "Keep this tab's progress as a copy".
- **Deletes:** server tombstones (index entry `deleted: true`) make late/retried/"new" writes to a deleted run return 410; a device holding progress for it can only keep it as a NEW run (new ID) via `recoverDeleted`. Tombstones live as long as the account index (12 months after the account's last write).
- **Server storage:** immutable snapshot per write `sv:run:{owner}:{runId}:{writeId}`; the index entry (`rev`, `writeId`, `cpWriteId`) is the single commit point, written last by `commitIfOwner` (atomic: still holds the per-owner `SET NX EX 10` lock AND index version `sv:idxv:{owner}` unchanged) — a writer whose lock expired gets 503 and commits nothing. Index entries older than 12 months are pruned on read/write. At most current + one checkpoint snapshot remain.
- **Fallback (preferred over code rollback):** `CLOUD_SAVES_ENABLED=false` → every cloud endpoint returns 503 `disabled`; the client shows "Saved · cloud paused", keeps account runs visible, syncs again when re-enabled. Code-rollback target: branch `rollback/safe-pre-saves` (`42b40c5`) = last pre-saves release WITHOUT the insecure `/api/save-game`, `/api/load-game`, `/api/save-progress`. Never redeploy plain `3263fb8` (it re-opens unauthenticated save reads/writes).
- **KV adapter:** `@upstash/redis` returns stored JSON strings already parsed (raw string on failure), so `kvStore.get` parses only when possible — before 2026-10-22 every string value (owner ID, lock token) would have thrown. Covered by the "real client semantics" test. The index commit is a Lua `EVAL` (`COMMIT_IF_OWNER` in `lib/billing/store.js`): lock-token AND index-version compare-and-set.
- **KV:** the Upstash database `upstash-kv-coral-anchor` is shared with `blauda-responder` and `linkloop`; for `supply-chain-game` it is connected to **Production only** (since 2026-10-25). Preview has NO storage and no `CLOUD_SAVE_ID_SECRET`/`RESEND_API_KEY` — Preview APIs fail closed (`not_configured`/500) and can never reach Production. For a real-service check, temporarily connect a separate database to Preview only (done 2026-10-24/25 with `scd-preview-kv`, PAYG, deleted afterwards), plus a Preview-only `CLOUD_SAVE_ID_SECRET`, `RESEND_API_KEY` and `APP_URL` = a fixed alias of the preview (mutations are origin-checked). Preview is behind Vercel Authentication; scripts use the project's automation bypass token via `x-vercel-protection-bypass`. Plan/usage only visible in the Upstash/Vercel dashboard.
- **Rollback:** migration leaves `scd_local_save_v1` in place (fingerprint marker prevents re-migration), and `game:{email}` records are only copied. A code rollback therefore still sees pre-migration saves, but NOT runs created by the new code (`scd_runs_v3`, `sv:*`) — rolling forward again restores them; nothing is deleted by either direction.
- **Grandfathering** comes from `meta.legacyGrant` set once by migration (old local save stamped before 2026-10-21T18:00Z, or an old cloud backup whose *server* `savedAt` predates it). Snapshot flags (`packagingVersion`, `grandfathered`) are kept for compatibility only and never read for access.
- **Retention:** each cloud run is kept for 12 months after its last sync (KV TTL, refreshed on sync); sessions last 30 days, sliding; codes 10 min. Old `game:{email}` records keep their 180-day TTL and are copied (not moved) into the account on verification.
- **Secrets (2026-10-22 audit):** sessions are random IDs in KV (no secret); runs live under a random owner ID; the browser's owner tag is a plain hash of that ID. Only the email → owner lookup key (plus code/IP hashes) uses `CLOUD_SAVE_ID_SECRET` — required, set once, never part of routine rotation, independent of `ENTITLEMENT_TOKEN_SECRET`. To rotate it anyway, list old values in `CLOUD_SAVE_ID_SECRET_PREVIOUS` (re-verification copies the mapping to the new key, old mapping kept). `ENTITLEMENT_TOKEN_SECRET` only signs purchase tokens: rotate with `ENTITLEMENT_TOKEN_SECRET_PREVIOUS` as a grace list (old tokens verify and are re-issued on refresh).
- **Analytics + funnel:** progress events are de-duplicated per run (`meta.sent`); definitions and BigQuery SQL in `docs/analytics/progress-funnel.md` (also the evidence/hypotheses for the old "Chapter 2 pile-up").
- **Config order for launch (no secret values here):** 1) create `CLOUD_SAVE_ID_SECRET` (Production; Preview gets its own value + its own KV) BEFORE the first deploy of cloud saves; 2) deploy; 3) rotate `ENTITLEMENT_TOKEN_SECRET` only in a later, separate change (old value → `ENTITLEMENT_TOKEN_SECRET_PREVIOUS`). Tokens live 30 days (`signToken` default) and every refresh re-issues with the current secret, so PREVIOUS can be removed 31 days after the rotation (any token still signed with the old value has expired by then). Never rotate `CLOUD_SAVE_ID_SECRET` without `CLOUD_SAVE_ID_SECRET_PREVIOUS`.
- **Real-service checks:** `scripts/community-preview-smoke.mjs` (reviews, moderation, CDN-vs-private caching, Preview counting suppression, Preview-session-unknown-to-Production; PLAYER_EMAIL/ADMIN_EMAIL, optional BYPASS + PROD_URL) and `scripts/cloud-preview-smoke.mjs` (BASE_URL + designated TEST_EMAIL; refuses the production host). Needs a Preview with its own temporary database (see "KV" above).
- **Tests:** `tests/cloud.test.mjs` (server ownership/CSRF/codes/revisions) and `tests/runs.test.mjs` (run store + sync end to end through the real API handlers with `SCD_DEV_MEMORY_STORE=1`). `SCD_DEV_MEMORY_STORE=1` gives the API an in-memory store and captures codes in `globalThis.__scdDevMail` — local testing only, ignored when `VERCEL_ENV=production`.

## Community: play statistics + ratings/reviews (deployed 2026-10-25, `b367662` / dpl_Ao1Msr9CbhuYF3KiWinEQbUtAAvQ)
- One function `api/community.js` (+ `lib/community/stats.js`, `lib/community/reviews.js`). Full definitions, exclusions, limitations and moderation policy: `docs/community-metrics.md`.
- **/play strip** (≤3 metrics): campaigns played (distinct run IDs with ≥1 completed quarter), quarterly scenarios completed (distinct run+scenario), player rating (published only). Counted only when `VERCEL_ENV=production` (`COMMUNITY_STATS_ENABLED=false` pauses); bots/headless/`navigator.webdriver`/`?stats=off` excluded; idempotent SET NX dedupe records → INCR counters; `cm:since` = first counted day, shown as "since". Never seed, estimate or show placeholder numbers; never call runs "players". Fallback when counting hasn't started: "3 industries to choose from".
- **Reviews:** verified cloud account whose STORED cloud snapshot proves ≥1 completed quarter (`lib/community/evidence.js` — catalogue/scenario-order consistency; client meta is only a pre-filter; a hand-forged consistent snapshot remains possible and is documented); one per account; rating-only publishes, text → pending, any text edit → pending again; moderators publish/reject/hide with a reason, never edit; reports never unpublish. Index + aggregate committed atomically (`commitIfOwner` on `rv:lock`/`rv:indexv`). Plain text only (`textContent`). No aggregate-rating structured data.
- **Admin:** `/admin-reviews` (noindex), access = `REVIEW_ADMIN_EMAILS` via the normal cloud-save email code. Also "Recount play statistics" (reconcile from dedupe records).
- Prompts: `mountReviewPrompt` after the free intro (IntroComplete) and campaign end (game over, win or lose); "Not now" is per run. Entry point: "Rate & review" on /play. Guest drafts live in `scd_review_draft` and survive verification.
- Public GET views are cached by Vercel's CDN only (`Vercel-CDN-Cache-Control`); browsers revalidate (a browser stale-while-revalidate showed players stale data after their own change).
- Primary stats controls are server-side (production-only gate before any KV write — Preview shares Production KV; origin/header check; catalogue validation; SET NX dedupe; per-run and per-IP caps). Owner testing is excluded server-side: progress events from a signed-in `REVIEW_ADMIN_EMAILS` session are never counted (`api/community.js`). User-agent/webdriver/`?stats=off` filters are supplemental. Max public delay: stats 5 min (≤25 min once after a quiet spell), reviews 1 min (≤5 min); `mine`/`admin`/POST are `no-store`.
- Homepage offers (2026-10-24): no Institutions/classroom plan, no "coming soon" classroom features or fake course-management UI — classroom products are deferred; only a contact link. Nav purchase button = "Core Game Pass" → `/play?upgrade=1` (the only page that opens the offer).

## Gameplay comprehension (deployed 2026-10-29, `ca29663` / dpl_9BR8RyJJLFGdfYEBT54v5awXQCew)
- Rollback target that keeps secure cloud saves: dpl_Ao1Msr9CbhuYF3KiWinEQbUtAAvQ (`b367662`, the 2026-10-25 release).
- Decision screen: "Quarter N at a glance" brief (`turnGoal`/`turnNote` in `src/ui/procurement-workspace.js`, from `estimateTurn` + `computeProjection` only — never a recommended quantity), quantity block first, groups `supply`/`pricing`/`protection` phrased as questions, `explainHTML` disclosures (one delegated listener in `dashboard.init`), known/estimate/unknown legend, `choicesSummary`.
- State strip: money/stock/last demand primary; in-transit shown whenever non-zero; profit behind "More details" (`_updateMetricSubs`).
- Guided start: `src/logic/guide-state.js` (pure, tested) + `src/ui/guide-coach.js`; stored in localStorage `scd_guide_v1`, **never in snapshots**. Auto-starts only on a new player's first campaign quarter (not Endless/weekly, not returning players); Help dialog (`src/ui/help-dialog.js`, HUD "Help") replays it in any mode.
- Results card leads with `src/logic/turn-story.js` (what happened / your choices vs starting position vs events vs demand variation / one thing to remember). Extra context goes on a display copy — `lastTurnResult` is the saved history entry, don't add fields to it. Crisis `consequenceText` is a function in live data (use `crisisText`).
- Analytics: `guide_started|skipped|completed`, `guide_explain_open`, `guide` param on `turn_completed`/`first_turn_complete`; comparison method in `docs/analytics/progress-funnel.md`. No data yet — don't claim improvement.
- Briefing consistency patch (deployed 2026-10-29, `168a8e5` / dpl_A4K1iqHGqxEHz1UdioaoopR1Mu1P; rollback dpl_9BR8RyJJLFGdfYEBT54v5awXQCew): briefings that describe the player's position use tokens (`{stock}`, `{nextQuarter}`, `{lastQuarter}`, `{onTheWay}`) filled by `src/logic/scenario-text.js`, which looks text up by scenario id (saves carry old scenario copies). Never hard-code current stock/shipment/demand numbers in scenario text; `tests/scenario-text.test.mjs` guards it. Results money line = sales vs this quarter's costs (the engine expenses the whole order) + total cash change naming only recorded extras.
- Browser-pane testing: a hidden pane stalls View Transitions/rAF; set `document.startViewTransition = undefined` in the test page. Production checks: `?stats=off` (no progress POST) + `window['ga-disable-G-2Z03B7JFE1']=true`.

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
| `src/logic/save-game.js` | Builds/restores v2 snapshots (full engine state, resumes at any turn). Storage is NOT here |
| `src/logic/run-store.js` | Every campaign is its own **run** in localStorage (`scd_runs_v3` index, `scd_run_v3:{id}` latest, `scd_run_v3_cp:{id}` known-good checkpoint). Validated writes, quota-aware eviction, multi-tab guard (`tabRev` + claim lock), idempotent migration of the old `scd_local_save_v1`, pre-packaging grant recorded ONCE on the run (`legacyGrant`) |
| `src/logic/cloud-sync.js` | Verified-account sync: session, outbox (meta `localRev > ackedLocalRev` + persisted `inflight`), debounce/backoff, revision-safe acks, conflict capture/resolution, other-device download, legacy import. Only the tab holding a run's claim syncs it |
| `src/ui/save-panel.js` | Save & progress dialog (device/cloud status, Save now, email-code sign-in, sign-out), one-time cloud prompt, conflict chooser, tab-lock dialog |
| `src/ui/campaigns-panel.js` | /play Continue card + "Your campaigns" (other runs, completed runs, other-device runs, old-backup import, delete with explicit device/cloud scope) |
| `lib/cloud/*` | Server: email codes → opaque session cookie (`scd_sess`, HttpOnly) bound to an internal owner ID; owner-scoped runs with revisions (409 stale / 410 deleted tombstone / idempotent `writeId`), per-owner KV lock, legacy `game:{email}` copy-on-verify |
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
| `/api/cloud-account` | Cloud-save sign-in: GET session status; POST `request-code` / `verify-code` (sets session cookie) / `sign-out` / `legacy` / `legacy-dismiss`. Never grants purchases |
| `/api/cloud-runs` | Owner-scoped runs: GET list / one (`?id`, `&head=1`, `&checkpoint=1`), PUT `{runId, expectedRev, writeId, meta, snapshot}`, DELETE `?id&expectedRev`. Session + CSRF header required for mutations. The old unauthenticated `/api/save-game` + `/api/load-game` (and `/api/save-progress`) were removed 2026-10-22 |
| `/api/recall-cron` | Day-3/day-10 spaced-recall emails to old `game:*` records. **Not scheduled** (`vercel.json` `crons` is empty) and paused by `CAMPAIGNS_PAUSED`. New saves no longer create `game:*` records, so it would only reach pre-2026-10-22 savers. `CRON_SECRET`-guarded; skips `unsub:{email}` |
| `/api/community` | Public play stats + reviews (GET `?view=stats|reviews|mine|admin`; POST `progress`, `review`, `delete-review`, `report`, `moderate`, `reconcile`). See "Community" above |
| `/api/send-email` | Contact form handler |
| `/api/unsubscribe` | GET `?email=` — one-click unsubscribe (sets `unsub:{email}` in KV, no expiry). POST `?broadcast=1` — one-off re-engagement broadcast to everyone in the `game:*` saved-progress list; `CRON_SECRET`-guarded, `?dry=1` reports counts without sending. Idempotent via `announced:{email}`. Both live in one file to stay under Vercel Hobby's 12-function cap — see note below |

**Vercel Hobby plan caps serverless functions at 12** (**12 used as of 2026-10-24 — the cap is reached**) (one per file in `/api/`, `polar-webhook.js` included even though it's dead). Adding a new one-off endpoint means either deleting/consolidating an existing file first or folding the new logic into one that already exists — `unsubscribe.js` does the latter (unsubscribe + broadcast in one handler, branched on HTTP method). Check `ls api/*.js | wc -l` before adding a new file.

---

## Email System (Resend)
- **From:** `hello@supplychaindisaster.com` (domain verified in Resend — do not change)
- **Resend account:** ahmad.faruqi1211@gmail.com
- **Purchase welcome:** triggered by `order_created` LS webhook → tier-specific HTML email to buyer
- **Cloud-save codes:** one-time 6-digit codes for cloud saves (`lib/cloud/http.js`), and for purchase restore (`api/verify-subscription.js`). The old "save progress" checkpoint email and its modal were removed 2026-10-22
- **Contact form:** forwards message to `ahmad.faruqi1211@gmail.com`
- **Internal notifications:** none for saves any more (the save-progress CC was removed with the modal)
- `RESEND_API_KEY` is set in `.env` and must also be set in Vercel environment variables

### Email templates (both in `api/ls-webhook.js`)
- **Standard welcome:** subject "Your Standard Edition is ready — Supply Chain Disaster"
- **Expansion welcome:** subject "Your Expansion Bundle is ready — Supply Chain Disaster"
- Design: dark theme (`#080b14`), gradient accent bars, circular feature check badges, restore-access hint block

### Unsubscribe / suppression (added 2026-08-31)
- Every marketing-ish email (recall-cron, the one-off announcement broadcast) must link `GET /api/unsubscribe?email={email}` — sets `unsub:{email}` in KV, no expiry, no confirmation step needed on the recipient's end.
- Any future sender that iterates the `game:*` saved-progress list **must check `unsub:{email}` before sending** — recall-cron and the broadcast endpoint both do this already.
- Transactional email (purchase welcome, one-time codes, contact form) is not gated by this — only re-engagement/marketing sends are.
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

## Blog template (deployed 2026-10-25 with `b367662`)
- Article sources stay as authored HTML. At build (and in `npm run dev`) `scripts/blog/transform.mjs` (Vite plugin `scripts/blog/vite-plugin.mjs`, parser `node-html-parser` pinned devDependency, build-time only) adds: breadcrumbs + BreadcrumbList JSON-LD, standard meta line (author, published, "Updated" only when the article's own `dateModified` is later, reading time = words/230), "On this page" (≥4 sections and ≥6 min), table scroll regions, ONE game/tool module (built from the article's last CTA block's heading/paragraph minus offer/duration claim sentences + catalog-derived offer lines from `src/data/offer-copy.js`), share/copy + "Suggest a correction" (/contact?subject=…), related reading (same topic newest first, then newest overall).
- The index (`blog.html`) has an empty `#ab-index` filled from the articles (cards, search + topic filter over an embedded catalog, Blog JSON-LD listing every post). Pagination: `/blog-page-N` (flat files — a `blog/` directory next to `blog.html` would make `/blog` ambiguous).
- The build FAILS on missing structure (one H1 in `.article-header`, `.article-content`, `.article-meta`, `.article-tag`, canonical = `/slug`, BlogPosting `datePublished`, meta description, author; images need width/height) and refuses sources that already contain generated `ab-*` components.
- New article checklist: `.article-header` (h1, `.article-tag` topic, `.article-meta`), `.article-content`, BlogPosting JSON-LD, optional `.mission-briefing` CTA, `<script type="module" src="/src/blog.js">`, add to `vite.config.js` input + sitemap. Don't hand-write a "Table of Contents" or breadcrumbs.
- `tests/blog.test.mjs` verifies all articles: normalized content/links/lists/tables/heading IDs preserved, metadata + existing JSON-LD unchanged, components exactly once, anchors resolve, reading time, related links, no stale offer claims.
- FAQPage JSON-LD is kept where it mirrors visible FAQ text (9 articles, aligned 2026-10-24). Google stopped showing FAQ rich results for all sites on 2026-05-07; the markup isn't invalid, it just earns no rich result. Never add review/aggregate-rating markup.
- Search: query/topic are text only (textContent / DOM-built `<mark>`); never `innerHTML` with user input.

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
