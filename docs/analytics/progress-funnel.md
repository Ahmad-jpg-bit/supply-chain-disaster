# Campaign progress funnel — definitions

How far do campaigns actually get? This report counts **unique campaign runs**
(`run_id`) from progress events. It doesn't use save records, because a save only
tells you the last place a player saved. Saves were also overwritten under the
old system, and cloud saves exist only for players who verified an email.

Events are sent through the existing GA4 tag (`src/shared/track.js`). They carry
no email, account ID, order ID or save contents. `run_id` is a random ID made in
the browser and isn't linked to the player's email.

## Why this replaces "where do saves stop?"

Old cloud records (`game:{email}`) appeared to pile up at Chapter 2. The code
explains most of that pile-up without needing real abandonment:

1. **When the prompt appeared.** Email capture was first offered after Chapter 2
   (and at game end). A record could therefore exist only from the end of
   Chapter 2 onwards.
2. **When saves were taken.** Records were written at chapter ends, at game end
   and on manual save. A player who stopped mid-Chapter-3 still showed "end of
   Chapter 2".
3. **One record per email, overwritten.** No history was kept, so a later failure
   left the earlier record in place. Failed saves were also swallowed silently.
4. **Off-by-one labelling.** The record stored `chapterIndex` (0-based) of the
   chapter just finished. `chapterIndex: 1` therefore means "finished Chapter 2,
   resumes at Chapter 3". Reading the raw field as a chapter number shifts
   everything by one.
5. **Access gates.** Since 2026-10-21, free players can't start Chapter 2 without
   the Core Game Pass. Any later comparison has to be split by `access`.

None of this was checked against the production records. The KV credentials are
stored as Vercel secrets and couldn't be read for this analysis. Treat the list
as hypotheses; the events below measure the funnel directly.

## Events

| Event | Fires when | De-duplication | Key params |
|---|---|---|---|
| `run_started` | A new campaign run is created | once per run | `run_id`, `industry_id`, `start_chapter`, `cloud` |
| `chapter_started` | A chapter's intro is shown | once per run per chapter (`cs{n}`) | `chapter` |
| `turn_completed` | A quarter resolves | once per run per turn (`t{turn}`) | `chapter`, `turn` |
| `chapter_completed` | A chapter's results are shown | once per run per chapter (`cc{n}`) | `chapter`, `turn` |
| `run_completed` | The campaign's final results are shown | once per run | `chapter` |
| `resume_started` | Continue is pressed on /play | every attempt | `phase`, `chapter`, `turn`, `snapshot_version`, `cloud` |
| `resume_succeeded` | The saved state was restored into the game | every success | as above |
| `resume_failed` | The save couldn't be read and no checkpoint was usable | every failure | `reason` (`missing`/`corrupt`/`unsupported`) |
| `save_recovered` | The latest save was unreadable; the previous checkpoint was used | every recovery | `source` |
| `local_save_failed` | A device save failed | first per error category per page | `reason` (`quota`/`blocked`/`invalid`), `trigger` |
| `cloud_save_prompt_shown` | The one-time "Enable cloud saves" prompt appeared | once per browser | — |
| `cloud_save_verification_completed` | An email code was verified | every success | `source` |
| `cloud_sync_succeeded` / `cloud_sync_failed` | A sync attempt finished | **sampled**: first success / first failure per reason, per run, per page | `reason` |
| `save_conflict_detected` | Another device changed the same run | once per run per cloud revision | `chapter`, `cloud_chapter` |

De-duplication marks are stored on the run itself, so reloading or resuming never
re-sends `turn_completed`, `chapter_started` or `chapter_completed`. Replaying
starts a new `run_id`.

Every progress event also carries:
- `cloud`: `device` (guest) or `verified` (signed in when the event fired);
- `access`: `free`, `core` or `pre_packaging`;
- `industry_id`, `mode: story`, `locale` and `variant`.

## Guided start and explanations (since 2026-10-29)

The decision screen has an optional guided start (inline tips on the first
quarter of a new player's first campaign; replayable from the in-game Help) and
"Explain" buttons next to the main terms. These events measure whether that
helps. They carry no email, review text or save contents.

| Event | Fires when | Key params |
|---|---|---|
| `guide_started` | Guidance begins | `trigger` (`auto` = first quarter of a new player's campaign, `replay` = from Help) |
| `guide_skipped` | The player presses Skip guidance, or Stop guidance in Help | `step_id`, `step_index` (1–6), `source` (`help` when stopped from Help) |
| `guide_completed` | The guided quarter resolves, or the last tip is finished | `how` (`turn_confirmed` / `finished`), `steps_seen` |
| `guide_explain_open` | An "Explain" disclosure is opened | `term` (`quarter`, `supplier`, `shipping`, `pricing`, `inspection`, `safety`); once per term per page load |
| `first_turn_complete` (existing) | First quarter resolved in this page load | now also `chapter`, `guide` |
| `turn_completed` (existing) | A quarter resolves | now also `guide`: `guided` / `skipped` / `none` for this game session |

All guide events also carry `industry_id`, `mode`, `chapter` (0 in Endless),
`phase`, and — in campaigns — the run's opaque `run_id`. A guide is never started
automatically in Endless or the weekly challenge, or for a player who has played
before (another campaign past its first quarter, a skipped chapter intro or a
pre-2026-10-22 save).

**Comparisons** (start cohorts ≥ 14 days old; `start_chapter = 1`; split by
`industry_id` and `access`):

| Question | Definition |
|---|---|
| Campaign start → first completed quarter | runs with `run_started` → `turn_completed` with `turn = 1`. Compare start cohorts before and after 2026-10-29 (the release), not guided vs unguided players — new players are guided, returning players are not, so those groups differ by experience. |
| First quarter → next quarter | `turn_completed` `turn = 1` → `turn = 2`, segmented by `guide` on the `turn = 1` event. |
| Guidance completion / skip rate | per `run_id` with `guide_started` (`trigger = auto`): share with `guide_completed` vs `guide_skipped`; `step_id` on skips shows where people leave. |
| Explanations used | `guide_explain_open` by `term`, per run that reached the procurement phase. |
| Save / resume failures | unchanged: `local_save_failed`, `resume_failed`, `save_recovered` per run, before vs after the release. The guide is stored in the browser (`scd_guide_v1`), not in saves, so a change here would point elsewhere. |

Comparing before/after cohorts shows correlation with the release, not proof
the guidance caused it (seasonality, traffic sources and other changes also
move these numbers). Don't report a retention or comprehension improvement
until several complete weekly cohorts on each side agree.

## Beginner Chapter 1 learning layer (live since 2026-10-31 07:24:47 UTC)

FMCG Chapter 1 campaigns get a stock-flow illustration, an opening-shortage
note, an optional "will this order arrive in time?" check on the first quarter
(in place of that quarter's demand guess) and a chapter recap with one optional
hypothetical question. One new event records the two optional questions:

| Event | Fires when | Key params |
|---|---|---|
| `reflection_answer` | The arrival check is answered or skipped; the recap question is answered | `question` (`arrival_q1` / `transfer_ch1`), `answered` (true/false), `correct` (true/false, or `skipped`) |

It carries the same context as the guide events (`industry_id`, `mode`,
`chapter`, `phase`, opaque `run_id`). No answer text beyond the fixed option, no
email, no save contents. Register `question` and `correct` as event-scoped
dimensions if you want them in GA4 reports (16 in total).

**Progression (existing events, `industry_id = fmcg`, `start_chapter = 1`):**
campaign start → first quarter (`run_started` → `turn_completed` `turn = 1`) →
second quarter (`turn = 2`) → Chapter 1 complete (`chapter_completed`
`chapter = 1`). Compare start cohorts before and after the release.

**Read with care:**
- Guided vs skipped cohorts are self-selected: people who skip guidance differ
  from people who follow it (experience, motivation, device). Differences
  between them cannot by themselves show that guidance caused better
  progression or understanding.
- Correct answers to the two questions show recognition in the moment, not
  lasting understanding; the arrival check also follows the guided tips that
  explain the same idea. Use them alongside observed beginner sessions, not as
  a mastery score.

## Beginner FMCG Chapter 1 funnel — measurement handoff

**Release baseline:** production deployment `dpl_DCoXKrVDPFSFQ85rjD6B9jLZNCTS`
(commit `0f071fe`) created **2026-10-31 07:24:47 UTC** (12:24:47 PKT), build ~24 s.
Treat events from 2026-10-31 07:25 UTC onward as post-release. The previous
release (`168a8e5`, 2026-10-29) had no beginner layer.

Reference snapshot (public community counts, server-side, production only,
bots and owner sessions excluded; cumulative since 2026-10-25, not split by
industry, start chapter or date): **52 campaigns with ≥1 completed quarter,
184 completed quarterly scenarios** at 2026-10-31 07:46 UTC. Re-read
`/api/community?view=stats` later for a post-release delta. Not a funnel.

### Event-to-funnel mapping (actual events)

| Step | Event | Fires when | Key params | Has `run_id`? |
|---|---|---|---|---|
| /play viewed | `pregame_view` (+ GA's automatic `page_view`) | the pre-game page renders, once per page load | `entry`, `runs`, `in_progress`, `cloud` | no |
| Campaign started | `run_started` | a new campaign run is created (not on resume) | `industry_id`, `start_chapter`, `mode` (=story), `cloud` | **yes** |
| — (don't use for campaigns) | `game_start` | every game start in a page load, incl. resumes, Endless, weekly | `industry_id`, `mode`, `start_chapter`, `resumed` | no |
| First turn completed | `turn_completed` with `turn = 1` | quarter 1 resolves (once per run) | `chapter`, `turn`, `guide`, `industry_id`, `access`, `cloud` | **yes** |
| — (don't use for campaigns) | `first_turn_complete` | first quarter resolved **in that page load** (also after a resume, also Endless) | `industry_id`, `mode`, `chapter`, `guide` | no |
| Second turn completed | `turn_completed` with `turn = 2` | quarter 2 resolves (once per run) | as above | **yes** |
| FMCG Chapter 1 completed | `chapter_completed` with `chapter = 1` | the chapter summary opens (once per run) | `chapter`, `turn`, `industry_id`, `access` | **yes** |
| Free-intro end screen shown | `free_scenario_complete` | the free-intro completion screen (recap already shown) opens for a player without Core | `industry_id`, `chapter` | no |
| Upgrade offer viewed | `core_offer_view` | the Core Game Pass modal opens; from the free-intro screen `source = intro_complete` | `source`, `owned` | no |
| (offer requested elsewhere) | `paid_offer_open` | HUD button, locked content or `?upgrade=1` asks for the modal (not fired from the free-intro screen) | `source` | no |
| Checkout started | `checkout_start` | the server returned a checkout URL, just before redirecting to Lemon Squeezy — **intent only** | `offer`, `source` | no |
| Purchase confirmed | `purchase_confirmed` | on `/success`, only after the server-verified claim (signed webhook → KV ledger) reports `active`; once per order per browser | `offer` | no |

`purchase_confirmed` is reliable when it fires but **undercounts** (the buyer
must stay on `/success` until confirmation; blocked GA loses it). Revenue and
order counts come from Lemon Squeezy / the KV ledger, not GA. A checkout click
or a `/success` page view is never a purchase.

### Restricting to FMCG campaigns that start at Chapter 1

- **Campaign-based (BigQuery export):** cohort = `run_started` with
  `industry_id = 'fmcg'` and `start_chapter = 1`; join `turn_completed`
  (`turn = 1`, `turn = 2`) and `chapter_completed` (`chapter = 1`) on `run_id`.
  Later-chapter starts drop out via `start_chapter`; replays are separate runs.
- **GA4 Exploration (no BigQuery):** same conditions as step parameters
  (below). Funnels count **users**, not campaigns — a replaying player counts
  once; use it for direction.
- **Exclude test activity** (GA does not honour `?stats=off`; that flag only
  excludes the public community counts):
  1. Hostname exactly `www.supplychaindisaster.com` (drops localhost and
     `*.vercel.app` previews; dev builds never send).
  2. GA4 internal-traffic rule for the owner's IP address(es), with the
     "Internal traffic" data filter switched to **Active**.
  3. Known owner sessions: on 2026-10-29 and 2026-10-30 a few production
     verification sessions set the GA opt-out only after the page loaded, so a
     handful of `page_view`/`pregame_view` hits from the owner may exist —
     exclude by IP or those time windows. The 2026-10-31 release checks
     blocked GA before page scripts (nothing sent).

### What can be linked

- **Per campaign (via `run_id`, BigQuery only):** `run_started`,
  `chapter_started`, `turn_completed`, `chapter_completed`, `run_completed`,
  `resume_started`/`resume_succeeded`, `local_save_failed`, `guide_started`/
  `guide_skipped`/`guide_completed`/`guide_explain_open` and
  `reflection_answer` (campaign mode).
- **Per user/session only:** `pregame_view`, `game_start`,
  `first_turn_complete`, `free_scenario_complete`, `paid_offer_open`,
  `core_offer_view`, `checkout_start`, `purchase_confirmed`. In BigQuery they
  can be joined to campaigns only approximately, by `user_pseudo_id` (same
  browser/cookie) and `ga_session_id`. "/play viewed → campaign started" and
  "Chapter 1 completed → purchase" are therefore user/session-level rates.
- **Guide cohorts:** use `guide` on the `turn = 1` event. Guided vs skipped are
  self-selected and returning players are never auto-guided — compare
  before/after release cohorts, not guided vs skipped, for effect claims.

### GA4 setup (owner steps)

1. **Admin → Custom definitions → Create custom dimension** (scope: Event) for
   any not yet registered: `industry_id`, `start_chapter`, `chapter`, `turn`,
   `guide`, `access`, and `source` (offer source; low cardinality). Skip
   `run_id` (high cardinality; BigQuery has it anyway). Dimensions aren't
   retroactive in GA4 reports — register them now.
2. **Admin → Data streams → (web stream) → Configure tag settings → Define
   internal traffic:** add the owner's IP. Then **Admin → Data filters →
   Internal traffic → Active**.
3. **Admin → Events:** mark `purchase_confirmed` as a key event.
4. **Explore → Funnel exploration** "Beginner FMCG Ch1", open funnel off,
   date range from 2026-10-31, filter Hostname = `www.supplychaindisaster.com`:
   1. `run_started` — `industry_id` = fmcg, `start_chapter` = 1
   2. `turn_completed` — `turn` = 1, `industry_id` = fmcg
   3. `turn_completed` — `turn` = 2, `industry_id` = fmcg
   4. `chapter_completed` — `chapter` = 1, `industry_id` = fmcg
   5. `core_offer_view` — `source` = intro_complete
   6. `checkout_start` — `source` = intro_complete
   7. `purchase_confirmed`

   Steps 5–7 are user-level and include players who own nothing yet; read
   them as rates among users who reached step 4.
5. Optional, for campaign counts: **Admin → Product links → BigQuery** (daily
   export) and use the SQL in "BigQuery (GA4 export)" below with
   `industry_id = 'fmcg'` and `start_chapter = 1`.

### Measurement gaps (practical impact)

- Top-of-funnel and purchase events carry no `run_id` → conversion to offer,
  checkout and purchase is per user/session, not per campaign.
- `purchase_confirmed` undercounts → use Lemon Squeezy / KV ledger for purchases.
- GA has no test-traffic marker → owner play counts unless IP/hostname filters are set.
- Custom dimensions aren't retroactive → events before registration lack those
  parameters in GA4 reports (BigQuery keeps them).
- The free-intro end screen has no own view event → `free_scenario_complete`
  (fires as it opens) is the proxy.
- No client error telemetry → stuck UI (like the rationing trap fixed in
  `0f071fe`) only shows up as drop-off between steps.
- Without BigQuery, campaign-level funnels aren't available; GA4 explorations
  count users.

### Symptoms worth investigating if they recur

- Runs with `turn_completed` `turn = 1` but no `turn = 2` rising, especially
  after short first quarters (rationing, crisis messages).
- `chapter_completed` `chapter = 1` falling relative to `turn_completed`
  `turn = 4` (chapter-end screens).
- `reflection_answer` with `answered = false` dominating, or `guide_skipped`
  concentrated at one `step_id`.
- `checkout_start` with `source = intro_complete` rising without matching
  `core_offer_view` (unintended clicks) or without purchases in the ledger.
- `resume_failed`, `save_recovered` or `local_save_failed` increasing.
- Player reports of an unresponsive Confirm or Continue button (see the
  unconfirmed quarter-2 stop in CLAUDE.md), keyboard focus stuck behind an
  overlay, or an overlay that doesn't close.

## GA4 setup (one-time)

In **Admin → Custom definitions → Create custom dimension**, scope **Event**,
register exactly these (dimension name = event parameter):

| Dimension | Event parameter | Values |
|---|---|---|
| Chapter | `chapter` | 1–10 |
| Turn | `turn` | 1–40 (quarter number in the campaign) |
| Start chapter | `start_chapter` | 1–10 (on `run_started`, `game_start`) |
| Save phase | `phase` | `PHASE_CHAPTER_INTRO`, `PHASE_STORY`, `PHASE_PROCUREMENT`, `PHASE_CHAPTER_SUMMARY`, `PHASE_GAME_OVER` |
| Save mode | `cloud` | `device` (guest, saved in this browser) / `verified` (signed in to cloud saves) |
| Access tier | `access` | `free` / `core` / `pre_packaging` |
| Industry | `industry_id` | `fmcg` / `pharma` / `electronics` |
| Error reason | `reason` | e.g. `quota`, `blocked`, `network`, `http_500`, `deleted_elsewhere`, `missing`, `corrupt` |
| Save trigger | `trigger` | `choice`, `turn`, `phase`, `draft`, `manual`, `hidden`, `navigate`, `resume`, `run_created` |
| Snapshot version | `snapshot_version` | `1` (old chapter-end save) / `2` |
| Guide state | `guide` | `guided` / `skipped` / `none` |
| (Guide trigger) | `trigger` | `auto` / `replay` — reuses the Save trigger dimension above; no new registration |
| Guide step | `step_id` | `story`, `brief`, `stock`, `order`, `cost`, `confirm`, `none` |
| Explained term | `term` | `quarter`, `supplier`, `shipping`, `pricing`, `inspection`, `safety` |
| Guide outcome | `how` | `turn_confirmed` / `finished` |

**Do not register `run_id`.** It's a random, unique-per-campaign identifier:
as a report dimension it's high-cardinality, collapses into "(other)" and adds
nothing to GA4 reports. It's sent so the BigQuery export can count unique
campaigns. It isn't linked to the player's email or account. If a player asks
for deletion, GA4's user-deletion tools cover it with the rest of their events.

GA4 allows 50 event-scoped custom dimensions per property; this uses 14.

## Funnel steps (unique `run_id`)

| # | Step | Definition |
|---|---|---|
| 1 | Started a campaign | `run_started` |
| 2 | Completed the first quarter | `turn_completed` with `turn = 1` |
| 3 | Completed Chapter 1 | `chapter_completed` with `chapter = 1` |
| 4 | **Reached** Chapter 2 | `chapter_started` with `chapter = 2` |
| 5 | **Completed** Chapter 2 | `chapter_completed` with `chapter = 2` |
| 6 | Reached Chapter 3 | `chapter_started` with `chapter = 3` |
| 7 | Finished | `run_completed` |
| R | Resumed successfully (side metric) | ≥1 `resume_succeeded` for the run |

Keep "reached" (step 4) and "completed" (step 5) separate. The gap between steps
3 and 4 for `access = free` is mostly the paywall, not abandonment.

**Segments**
- `cloud` on `run_started`: `device` (guest) vs `verified`. A guest can verify
  partway through. For "verified at any point", use the latest `cloud` value seen
  for the run.
- `access` on each step: free / core / pre_packaging.
- `industry_id`.

**Cohort rules**
- Count only runs whose `run_started` is at least **14 days** before the
  analysis date. A recently started run hasn't had time to progress.
- Compare cohorts of equal length (for example weekly start cohorts) and the
  same follow-up window.
- Restrict the campaign funnel to `run_started` with `start_chapter = 1`. A run that
  starts at a later chapter (Core) has no turn 1 or Chapter 1.
- Never treat "no cloud save" as abandonment. Most players never turn on cloud
  saves.
- `cloud_sync_*` events are sampled. Use them for error rates, not volume.

## BigQuery (GA4 export)

```sql
-- Unique runs per funnel step, by start cohort week, guest vs verified, access tier.
-- Replace `project.analytics_XXXX` with the GA4 export dataset.
DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
DECLARE cutoff     DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY);

WITH ev AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS d,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'run_id')  AS run_id,
    (SELECT COALESCE(value.int_value, CAST(value.double_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'chapter') AS chapter,
    (SELECT COALESCE(value.int_value, CAST(value.double_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'turn')    AS turn,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'cloud')   AS cloud,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'access')  AS access
  FROM `project.analytics_XXXX.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', start_date) AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND event_name IN ('run_started','turn_completed','chapter_started','chapter_completed','run_completed','resume_succeeded')
),
runs AS (
  SELECT run_id, MIN(d) AS started, ANY_VALUE(cloud) AS start_cloud
  FROM ev WHERE event_name = 'run_started' AND run_id IS NOT NULL
  GROUP BY run_id
  HAVING MIN(d) <= cutoff                       -- enough follow-up time
),
steps AS (
  SELECT
    r.run_id,
    DATE_TRUNC(r.started, WEEK) AS cohort_week,
    r.start_cloud,
    MAX(e.cloud = 'verified') AS ever_verified,
    MAX(IF(e.event_name = 'chapter_started' AND e.chapter = 2, e.access, NULL)) AS access_at_ch2,
    MAX(e.event_name = 'turn_completed'    AND e.turn = 1)    AS s2_first_turn,
    MAX(e.event_name = 'chapter_completed' AND e.chapter = 1) AS s3_ch1_done,
    MAX(e.event_name = 'chapter_started'   AND e.chapter = 2) AS s4_ch2_reached,
    MAX(e.event_name = 'chapter_completed' AND e.chapter = 2) AS s5_ch2_done,
    MAX(e.event_name = 'chapter_started'   AND e.chapter = 3) AS s6_ch3_reached,
    MAX(e.event_name = 'run_completed')                       AS s7_finished,
    MAX(e.event_name = 'resume_succeeded')                    AS resumed
  FROM runs r JOIN ev e USING (run_id)
  GROUP BY 1, 2, 3
)
SELECT
  cohort_week,
  start_cloud,
  ever_verified,
  COUNT(*)                     AS s1_started,
  COUNTIF(s2_first_turn)       AS s2_first_turn,
  COUNTIF(s3_ch1_done)         AS s3_ch1_done,
  COUNTIF(s4_ch2_reached)      AS s4_ch2_reached,
  COUNTIF(s5_ch2_done)         AS s5_ch2_done,
  COUNTIF(s6_ch3_reached)      AS s6_ch3_reached,
  COUNTIF(s7_finished)         AS s7_finished,
  COUNTIF(resumed)             AS resumed_ok
FROM steps
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

To split Chapter 2 by access tier, group by `access_at_ch2` on the rows where
`s4_ch2_reached` is true. Free runs stop at the Chapter 1 boundary by design.

## GA4 Exploration (no BigQuery)

**Funnel exploration**, open funnel off:
- Steps 1–7 as in the table above, each as event name plus parameter condition.
- Breakdown: `cloud`, or `access` from the custom dimensions.
- GA4 funnels count **users**, not campaigns: one player can have several
  runs, and replaying creates a new run. Use the Exploration for direction and
  the BigQuery query above for unique-run counts.
- **Saves are not progress.** A run saves many times per quarter (choices,
  phases, drafts), so never count save events or cloud records as "players who
  reached chapter N". Use `chapter_started` (reached) and `chapter_completed`
  (completed), which fire once per run per chapter.
