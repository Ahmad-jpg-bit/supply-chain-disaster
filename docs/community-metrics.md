# Community metrics and reviews

Public numbers on `/play` (the strip under the industry picker and the "Player reviews" section) come only from `/api/community` (`api/community.js`, `lib/community/*`). Nothing is seeded, estimated or carried over from GA4.

## Metrics shown (at most three)

| Label | Definition | Source |
|---|---|---|
| **campaigns played** | Distinct campaign run IDs with at least one completed quarter | `cm:run:{runId}` dedupe records (SET NX) → counter `cm:count:campaigns` |
| **quarterly scenarios completed** | Distinct (run ID, scenario ID) pairs: each quarter's briefing counts once per campaign, however often the run is reloaded, resumed or retried | `cm:sc:{runId}:{scenarioId}` (SET NX) → counter `cm:count:scenarios` |
| **player rating** | Average of all *published* ratings (rating-only reviews included) and their count | review index aggregate (`rv:index`) |

* "Scenario" here means one quarterly briefing. A campaign has 40 of them, 4 per chapter. Marketing copy calls the free Chapter 1 "the free scenario"; to avoid confusion the public label always says **quarterly scenarios**.
* "Campaigns played" is not a player count. One person can play many campaigns, and the copy says so.
* If counting hasn't started yet, or the API is down, the strip shows "3 industries to choose from" instead (an honest fallback). With no published ratings it shows "Be among the first to review". It never shows a zero or a placeholder.

## Tracking start date

`cm:since` is set atomically by the first counted event, and the UI shows "How we count (since {date})". Nothing before that date is counted, and no history is back-filled.

## What sends an event

`dashboard._resolveTurn` → `CM.recordQuarter()` runs after a campaign (story mode) quarter resolves. The event is `{ runId, industryId, chapterId, scenarioId, turn }`. Endless mode, the weekly challenge and cloud-save writes never send it.

## Exclusions

* **Environment:** events are counted only when `VERCEL_ENV=production`. Preview, local and tests answer `202 counted:false`. Set `COMMUNITY_STATS_ENABLED=false` to pause counting.
* **Automated traffic:** a server-side user-agent filter (bots, crawlers, headless browsers, Lighthouse, curl and similar), plus the client skips counting when `navigator.webdriver` is set.
* **Owner and tester play:** visit `/play?stats=off` once per browser (`?stats=on` undoes it).
* **Invalid data:** the run ID format, industry, chapter and scenario must exist in the real catalogue, the scenario must belong to that chapter, and the turn must fall within the chapter.
* **Abuse:** 240 events per IP per hour (the IP is a keyed hash and isn't stored), and at most 40 scenarios per run.
* **Duplicates:** the dedupe records above.

## Limitations

The game runs in the browser, so a determined person could forge plausible events. The validation, per-run cap and IP limit bound the damage but cannot prove that play happened. Lost events (offline, a closed tab before the request) are not retried, so the totals are slight undercounts. Dedupe records expire after 400 days. Counters stay, but a later reconcile only sees records from the last 400 days.

## Reconciliation

The admin page (`/admin-reviews`, "Recount play statistics") calls `POST {action:'reconcile'}`. That SCANs the retained dedupe records and resets both counters. It shows the before and after values.

## Reviews

* **Who:** a verified cloud-save account (email code) whose cloud campaigns include at least one completed quarter (`meta.turn ≥ 2`). This server record substantiates the "Played a scenario" and "Played the {industry} campaign" labels. The industry is shown only if the account actually played it. There is no "verified buyer" label.
* **One per account.** Editing replaces the review and deleting erases its text. The player can post again later.
* **Statuses:** `pending`, `published`, `rejected`, `hidden` and `deleted`.
  * Rating-only reviews publish immediately.
  * Reviews with text start as pending.
  * **Re-moderation:** any edit of a review with text returns it to pending, which removes it from the public list and the average until it is published again. A rating-only edit updates the average immediately.
* **Aggregates** are recomputed and committed in the same atomic write as the status change (`commitIfOwner`: lock and version check), so the list, count, average and distribution always agree.
* **Moderators** (`REVIEW_ADMIN_EMAILS`, checked through the verified email → owner mapping) can publish, reject or hide with a reason: spam, harassment, personal_information, irrelevant, manipulation or other.
  * Moderators never edit a review's text or rating, and negative sentiment is not a reason.
  * Every action is logged with the review: time, actor (author or moderator), action, reason and an optional internal note.
* **Reports:** anyone can report a published review, once per reporter (keyed IP hash) and at most 20 per hour. Reports only surface the review in the queue; they never unpublish it.
* **Display:**
  * newest first, every published review shown (paged by 10);
  * the average, the published count, how many have text, and the distribution;
  * the date, display name and industry context.

  No curated selection.
* **Safety:** text is plain text. Control and bidi characters are stripped on the server, and the client inserts text with `textContent`. Over-length text is rejected (1,000 / 40 characters), never truncated.
* **No aggregate-rating structured data** is emitted.

## Where the owner manages reviews

1. Add your email to `REVIEW_ADMIN_EMAILS` in Vercel (Production), then redeploy.
2. Open `https://www.supplychaindisaster.com/admin-reviews` (noindex) and sign in with the one-time code.
3. Filter by pending, reported, published, hidden, rejected or all.
