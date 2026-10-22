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

## GA4 setup (one-time)

In **Admin → Custom definitions**, register these as **event-scoped custom
dimensions**:
- `run_id`
- `chapter`
- `turn`
- `phase`
- `cloud`
- `access`
- `reason`
- `trigger`
- `snapshot_version`

Without this step they don't appear in Explorations. The BigQuery export
includes them either way. Note that GA4 caps event-scoped custom dimensions at
50 per property.

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
- Count users by "Event count" uniqueness on `run_id`, if your property allows a
  custom unique dimension. Otherwise use BigQuery: GA4 funnels count users, not
  runs, and one player can have several runs.
