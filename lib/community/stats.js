/**
 * Public participation statistics — aggregate counters only.
 *
 * Source: progress events the game sends when a quarter resolves (client-run
 * game; see the limitation note in docs/community-metrics.md). Each event
 * names a run ID, chapter, quarter and the scenario that quarter used.
 *
 *   campaigns played          = distinct run IDs with ≥1 completed quarter
 *   quarterly scenarios done  = distinct (run ID, scenario ID) pairs
 *
 * Idempotent: every counted thing has a dedupe record created with SET NX;
 * the counter is incremented only when that record is new, so retries,
 * reloads and resumes never double count. The dedupe records are the retained
 * source for reconcile() (recount by scanning them).
 *
 * Exclusions: anything outside the Vercel production environment (previews,
 * local, tests), bots by user agent, invalid catalogue/progression data, more
 * than 40 scenarios per run, and per-IP rate limits. Nothing personal is
 * stored: the IP is only used as a keyed hash for rate limiting.
 */

import crypto from 'crypto';
import { CHAPTER_SCENARIOS } from '../../src/data/scenarios-expanded.js';
import { EXPANSION_CHAPTER_SCENARIOS } from '../../src/data/expansion-scenarios.js';
import { CHAPTERS } from '../../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../../src/data/expansion-chapters.js';

export const RECORD_TTL = 60 * 60 * 24 * 400;
export const MAX_SCENARIOS_PER_RUN = 40;
export const EVENTS_PER_IP_HOUR = 240;
const RUN_ID_RE = /^(r|lv1|imp)-[A-Za-z0-9]{1,40}$/;   // run-store newId() / migration ids
const INDUSTRIES = new Set(['fmcg', 'pharma', 'electronics']);
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|node-fetch|axios/i;

const ALL_SCENARIOS = { ...CHAPTER_SCENARIOS, ...EXPANSION_CHAPTER_SCENARIOS };
const CHAPTER_BY_ID = Object.fromEntries([...CHAPTERS, ...EXPANSION_CHAPTERS].map(c => [c.id, c]));
const SCENARIO_CHAPTER = {};
for (const [chapterId, list] of Object.entries(ALL_SCENARIOS)) for (const sc of list) SCENARIO_CHAPTER[sc.id] = chapterId;

export const SK = {
    run: (runId) => `cm:run:${runId}`,
    scenario: (runId, scenarioId) => `cm:sc:${runId}:${scenarioId}`,
    runCap: (runId) => `cm:runcap:${runId}`,
    campaigns: 'cm:count:campaigns',
    scenarios: 'cm:count:scenarios',
    since: 'cm:since',
    rate: (who) => `cm:rate:${who}`,
};

const ipKey = (secret, ip) => crypto.createHmac('sha256', secret || 'scd-stats').update(`stats-ip\u0000${ip || 'unknown'}`).digest('base64url').slice(0, 24);

/** Validate a progress event against the real catalogue and plausible progression. */
export function validateProgress(e) {
    if (!e || typeof e !== 'object') return 'bad_event';
    if (!RUN_ID_RE.test(String(e.runId || ''))) return 'bad_run';
    if (!INDUSTRIES.has(e.industryId)) return 'bad_industry';
    const chapter = CHAPTER_BY_ID[e.chapterId];
    if (!chapter) return 'bad_chapter';
    if (SCENARIO_CHAPTER[e.scenarioId] !== e.chapterId) return 'bad_scenario';
    const turn = Number(e.turn);
    if (!Number.isInteger(turn) || turn < chapter.turnsRange[0] || turn > chapter.turnsRange[1]) return 'bad_turn';
    return null;
}

/**
 * Count one completed quarter.
 * deps: { store, countingEnabled: boolean, secret, now? }   ctx: { ip, userAgent }
 * @returns {{ status, body }}
 */
export async function recordProgress(deps, ctx, event) {
    const bad = validateProgress(event);
    if (bad) return { status: 400, body: { error: bad } };
    if (!deps.countingEnabled) return { status: 202, body: { counted: false, reason: 'not_counted_here' } };
    if (BOT_UA.test(String(ctx.userAgent || ''))) return { status: 202, body: { counted: false, reason: 'automated' } };
    const { store, now = Date.now() } = deps;
    const n = await store.incr(SK.rate(ipKey(deps.secret, ctx.ip)), 3600);
    if (n > EVENTS_PER_IP_HOUR) return { status: 429, body: { error: 'rate_limited' } };

    const out = { campaign: false, scenario: false };
    if (await store.set(SK.run(event.runId), { at: now, industryId: event.industryId }, { nx: true, ex: RECORD_TTL })) {
        await store.incr(SK.campaigns);
        out.campaign = true;
        await store.set(SK.since, new Date(now).toISOString().slice(0, 10), { nx: true });
    }
    if (await store.set(SK.scenario(event.runId, event.scenarioId), { at: now, turn: Number(event.turn) }, { nx: true, ex: RECORD_TTL })) {
        const perRun = await store.incr(SK.runCap(event.runId), RECORD_TTL);
        if (perRun <= MAX_SCENARIOS_PER_RUN) { await store.incr(SK.scenarios); out.scenario = true; }
    }
    return { status: 200, body: { counted: true, ...out } };
}

/** Public aggregate (no per-run data). */
export async function readCounts(store) {
    const [campaigns, scenarios, since] = await Promise.all([store.get(SK.campaigns), store.get(SK.scenarios), store.get(SK.since)]);
    return { campaigns: Number(campaigns || 0), scenarios: Number(scenarios || 0), since: since || null };
}

/** Recount both counters from the retained dedupe records (admin). */
export async function reconcile(store) {
    const campaigns = await store.countKeys('cm:run:');
    const scenarios = await store.countKeys('cm:sc:');
    const before = await readCounts(store);
    await store.set(SK.campaigns, campaigns);
    await store.set(SK.scenarios, scenarios);
    return { before, after: { campaigns, scenarios, since: before.since } };
}
