// Community: play statistics (dedupe, exclusions, reconcile) and reviews
// (eligibility, one per account, edit/delete, moderation, aggregates, auth).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../lib/billing/store.js';
import { K } from '../lib/cloud/config.js';
import * as svc from '../lib/cloud/service.js';
import { recordProgress, readCounts, reconcile, validateProgress, SK, MAX_SCENARIOS_PER_RUN } from '../lib/community/stats.js';
import * as rv from '../lib/community/reviews.js';
import communityHandler, { handle, communityDeps } from '../api/community.js';
import { completedQuarterEvidence } from '../lib/community/evidence.js';
import { withSeed, scriptedChoices } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { buildSnapshot } from '../src/logic/save-game.js';

const SECRET = 'test-secret-community';
const ORIGIN = 'https://www.supplychaindisaster.com';
function setup(extra = {}) {
    const mail = [];
    const deps = {
        store: memoryStore(),
        cfg: { secret: SECRET, origins: new Set([ORIGIN]), devInsecureCookies: false, enabled: true },
        sendCode: async (to, code) => { mail.push({ to, code }); },
        countingEnabled: true,
        adminEmails: ['owner@example.com'],
        ...extra,
    };
    return { deps, mail };
}
const anon = (ip = '1.1.1.1') => ({ ip, origin: ORIGIN, clientHeader: '1', sid: null, csrf: null, userAgent: 'Mozilla/5.0' });
const as = (s, extra = {}) => ({ ip: '1.1.1.1', origin: ORIGIN, clientHeader: '1', sid: s.sid, csrf: s.csrf, userAgent: 'Mozilla/5.0', ...extra });

async function signIn(deps, mail, email) {
    await svc.requestCode(deps, anon(), { email });
    const code = mail.filter(m => m.to === email).at(-1).code;
    const r = await svc.verifyCode(deps, anon(), { email, code });
    assert.equal(r.status, 200);
    return { sid: r.setSession, csrf: r.body.csrf };
}
/** A real engine snapshot of a campaign played until `turn` (2 = one quarter completed). */
const snapCache = new Map();
function realSnapshot(industryId, turn) {
    const key = `${industryId}:${turn}`;
    if (!snapCache.has(key)) snapCache.set(key, withSeed(11, () => {
        const e = new GameEngine();
        e.init(industryId, true, 0);
        for (let n = 0; !(e.state.turn >= turn && e.state.phase === GAME_PHASES.STORY) && n < 900; n++) {
            const p = e.state.phase;
            if (p === GAME_PHASES.CHAPTER_INTRO) e.advanceFromChapterIntro();
            else if (p === GAME_PHASES.STORY) e.makeDecision(0);
            else if (p === GAME_PHASES.PROCUREMENT) { e.prepareTurnCrisis(); e.processTurn(scriptedChoices(e.state.turn)); }
            else if (p === GAME_PHASES.CHAPTER_SUMMARY) e.advanceFromChapterSummary();
            else break;
        }
        return JSON.stringify(buildSnapshot(e));
    }));
    return JSON.parse(snapCache.get(key));
}
/** Upload a cloud campaign: by default a genuine snapshot; `snapshot` overrides it (forgery tests). */
async function cloudRun(deps, s, turn = 2, industryId = 'fmcg', { snapshot = null, metaTurn = turn } = {}) {
    const runId = ('r-' + Math.random().toString(36).slice(2, 12)).padEnd(10, 'x');
    const r = await svc.putRun(deps, as(s), {
        runId, expectedRev: 0, writeId: 'w' + Math.random().toString(36).slice(2, 12),
        meta: { industryId, chapterNumber: 1, turn: metaTurn, phase: 'PHASE_STORY', status: 'active' },
        snapshot: snapshot || realSnapshot(industryId, turn),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
}
const ev = (runId, scenarioId = 'steady_seas', turn = 1, extra = {}) =>
    ({ runId, industryId: 'fmcg', chapterId: 'demand_forecasting', scenarioId, turn, ...extra });

/* ── Statistics ─────────────────────────────────────────────────────── */

test('stats: validation against the real catalogue', () => {
    assert.equal(validateProgress(ev('r-abc123')), null);
    assert.equal(validateProgress(ev('lv1-x')), null);
    assert.equal(validateProgress(ev('bad id')), 'bad_run');
    assert.equal(validateProgress(ev('r-abc123', 'retailer_panic')), 'bad_scenario', 'scenario from another chapter');
    assert.equal(validateProgress(ev('r-abc123', 'made_up')), 'bad_scenario');
    assert.equal(validateProgress(ev('r-abc123', 'steady_seas', 5)), 'bad_turn', 'turn outside the chapter');
    assert.equal(validateProgress(ev('r-abc123', 'steady_seas', 1, { industryId: 'toys' })), 'bad_industry');
});

test('stats: campaigns and scenarios are deduplicated per run', async () => {
    const { deps } = setup();
    await recordProgress(deps, anon(), ev('r-run1', 'steady_seas', 1));
    await recordProgress(deps, anon(), ev('r-run1', 'steady_seas', 1));          // retry / reload
    await recordProgress(deps, anon(), ev('r-run1', 'holiday_approaching', 2));
    await recordProgress(deps, anon(), ev('r-run2', 'steady_seas', 1));          // same scenario, other run counts
    const c = await readCounts(deps.store);
    assert.equal(c.campaigns, 2);
    assert.equal(c.scenarios, 3);
    assert.match(c.since, /^\d{4}-\d{2}-\d{2}$/);
});

test('stats: nothing counted outside production, from bots, or over the rate limit', async () => {
    const off = setup({ countingEnabled: false }).deps;
    assert.equal((await recordProgress(off, anon(), ev('r-p1'))).body.counted, false);
    assert.deepEqual(await readCounts(off.store), { campaigns: 0, scenarios: 0, since: null });

    const { deps } = setup();
    assert.equal((await recordProgress(deps, { ...anon(), userAgent: 'Mozilla/5.0 HeadlessChrome/120' }, ev('r-b1'))).body.counted, false);
    assert.equal((await readCounts(deps.store)).campaigns, 0);
    for (let i = 0; i < 240; i++) await recordProgress(deps, anon('7.7.7.7'), ev(`r-x${i}`));
    assert.equal((await recordProgress(deps, anon('7.7.7.7'), ev('r-over'))).status, 429);
    assert.equal((await readCounts(deps.store)).campaigns, 240);
});

test('stats: api counts only when deployed to production (never Preview or local)', () => {
    const saved = { ...process.env };
    try {
        process.env.VERCEL_ENV = 'preview'; delete process.env.SCD_DEV_COUNT_STATS;
        assert.equal(communityDeps({}).countingEnabled, false);
        process.env.VERCEL_ENV = 'production';
        assert.equal(communityDeps({}).countingEnabled, true);
        process.env.COMMUNITY_STATS_ENABLED = 'false';
        assert.equal(communityDeps({}).countingEnabled, false);
        delete process.env.VERCEL_ENV; delete process.env.COMMUNITY_STATS_ENABLED;
        assert.equal(communityDeps({}).countingEnabled, false, 'local dev');
    } finally { process.env = saved; }
});

test('stats: per-run scenario cap and reconcile from retained records', async () => {
    const { deps } = setup();
    await recordProgress(deps, anon(), ev('r-cap'));
    await deps.store.set(SK.runCap('r-cap'), MAX_SCENARIOS_PER_RUN, {});
    const r = await recordProgress(deps, anon(), ev('r-cap', 'holiday_approaching', 2));
    assert.equal(r.body.scenario, false, 'over the cap is not counted');
    // Drift the counters, then recount
    await deps.store.set(SK.campaigns, 99, {});
    const rec = await reconcile(deps.store);
    assert.equal(rec.before.campaigns, 99);
    assert.deepEqual([rec.after.campaigns, rec.after.scenarios], [1, 2]);
});

test('stats: progress events need the client header (no cross-site posts)', async () => {
    const { deps } = setup();
    const out = await handle(deps, { ...anon(), clientHeader: null }, { method: 'POST', body: { action: 'progress', ...ev('r-h1') } });
    assert.equal(out.status, 403);
    const evil = await handle(deps, { ...anon(), origin: 'https://evil.example' }, { method: 'POST', body: { action: 'progress', ...ev('r-h1') } });
    assert.equal(evil.status, 403);
});

test('stats view: aggregates only, no rating when none exist', async () => {
    const { deps } = setup();
    const empty = await handle(deps, anon(), { method: 'GET', query: { view: 'stats' } });
    assert.deepEqual(empty.body, { available: true, campaigns: 0, scenarios: 0, since: null, rating: null });
    const none = await handle({ ...deps, store: null }, anon(), { method: 'GET', query: { view: 'stats' } });
    assert.deepEqual(none.body, { available: false });
});

/* ── Reviews ────────────────────────────────────────────────────────── */

test('reviews: only signed-in accounts with a completed quarter can review', async () => {
    const { deps, mail } = setup();
    assert.equal((await rv.submitReview(deps, anon(), { rating: 5 })).status, 401);
    const s = await signIn(deps, mail, 'a@example.com');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).body.error, 'not_eligible');
    await cloudRun(deps, s, 1);                       // started, nothing completed yet
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).body.error, 'not_eligible');
    await cloudRun(deps, s, 2);
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).status, 200);
});

test('reviews: CSRF, origin and validation', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'a@example.com');
    await cloudRun(deps, s);
    assert.equal((await rv.submitReview(deps, as(s, { csrf: 'nope' }), { rating: 4 })).body.error, 'bad_csrf');
    assert.equal((await rv.submitReview(deps, as(s, { origin: 'https://evil.example' }), { rating: 4 })).body.error, 'bad_origin');
    for (const rating of [0, 6, 3.5, '5x', null]) assert.equal((await rv.submitReview(deps, as(s), { rating })).body.error, 'bad_rating');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 4, text: 'x'.repeat(1300) })).body.error, 'too_long');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 4, text: 'x'.repeat(1001) })).body.error, 'too_long', 'never silently truncated');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 4, displayName: 'n'.repeat(41) })).body.error, 'name_too_long');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 4, text: 'x'.repeat(1000) })).status, 200);
});

test('reviews: one per account; rating-only publishes, text waits for moderation', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'a@example.com');
    await cloudRun(deps, s);
    const a = await rv.submitReview(deps, as(s), { rating: 4 });
    assert.equal(a.body.status, 'published');
    assert.deepEqual([a.body.aggregate.count, a.body.aggregate.average], [1, 4]);
    const b = await rv.submitReview(deps, as(s), { rating: 2, text: 'Hard but fair.' });
    assert.equal(b.body.id, a.body.id, 'same review, replaced');
    assert.equal(b.body.status, 'pending');
    assert.equal(b.body.aggregate.count, 0, 'edited review with text leaves the average until re-published');
    const pub = (await rv.publicReviews(deps)).body;
    assert.equal(pub.total, 0);
    const mine = (await rv.myReview(deps, as(s))).body;
    assert.equal(mine.review.status, 'pending');
    assert.equal(mine.review.text, 'Hard but fair.');
});

test('reviews: public view is plain data without email or internal ids', async () => {
    const { deps, mail } = setup();
    const admin = await signIn(deps, mail, 'owner@example.com');
    const s = await signIn(deps, mail, 'player@example.com');
    await cloudRun(deps, s, 3, 'pharma');
    const r = await rv.submitReview(deps, as(s), { rating: 5, text: '<img src=x onerror=alert(1)>‮good\n\n\n\nok', displayName: '  Sam\nR ', industryId: 'pharma' });
    await rv.moderate(deps, as(admin), { id: r.body.id, decision: 'publish' });
    const pub = (await rv.publicReviews(deps)).body;
    const json = JSON.stringify(pub);
    assert.ok(!json.includes('player@example.com') && !json.includes('p•'), 'no email');
    const owner = await deps.store.get(K.owner(Object.keys(Object.fromEntries(deps.store._map)).find(k => k.startsWith('sv:own:')).slice(7)));
    assert.ok(!json.includes(owner), 'no owner id');
    const one = pub.reviews[0];
    assert.deepEqual(Object.keys(one).sort(), ['date', 'displayName', 'id', 'industryId', 'playedScenario', 'rating', 'text']);
    assert.equal(one.text, '<img src=x onerror=alert(1)>good\n\nok', 'stored as plain text: bidi controls stripped, rendering escapes it');
    assert.equal(one.displayName, 'Sam R');
    assert.equal(one.industryId, 'pharma');
    assert.equal(one.playedScenario, true);
});

test('reviews: industry context only when the account actually played it', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'a@example.com');
    await cloudRun(deps, s, 2, 'fmcg');
    await rv.submitReview(deps, as(s), { rating: 3, industryId: 'electronics' });
    assert.equal((await rv.publicReviews(deps)).body.reviews[0].industryId, null);
});

test('reviews: delete erases the text and updates the aggregate; re-review allowed', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'a@example.com');
    await cloudRun(deps, s);
    const r = await rv.submitReview(deps, as(s), { rating: 5 });
    const d = await rv.deleteReview(deps, as(s));
    assert.equal(d.body.aggregate.count, 0);
    assert.equal((await rv.myReview(deps, as(s))).body.review, null);
    assert.equal([...deps.store._map.keys()].filter(k => k.startsWith(`rv:item:${r.body.id}:`)).length, 0, 'text erased');
    assert.equal((await rv.submitReview(deps, as(s), { rating: 1 })).body.aggregate.count, 1);
});

test('reviews: another account cannot change or delete my review', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'a@example.com');
    const b = await signIn(deps, mail, 'b@example.com');
    await cloudRun(deps, a); await cloudRun(deps, b);
    const ra = await rv.submitReview(deps, as(a), { rating: 5 });
    await rv.deleteReview(deps, as(b));
    const rb = await rv.submitReview(deps, as(b), { rating: 1, id: ra.body.id });
    assert.notEqual(rb.body.id, ra.body.id, 'client-supplied id is ignored');
    const pub = (await rv.publicReviews(deps)).body;
    assert.equal(pub.aggregate.count, 2);
    assert.deepEqual(pub.aggregate.distribution, { 1: 1, 2: 0, 3: 0, 4: 0, 5: 1 });
    assert.equal(pub.aggregate.average, 3);
    // Non-admins can't moderate
    assert.equal((await rv.moderate(deps, as(b), { id: ra.body.id, decision: 'hide', reason: 'spam' })).status, 403);
    assert.equal((await rv.moderationQueue(deps, as(b))).status, 403);
});

test('moderation: reasons required, logged, aggregate consistent, newest first', async () => {
    const { deps, mail } = setup();
    const admin = await signIn(deps, mail, 'owner@example.com');
    const players = [];
    for (const [i, rating] of [5, 4, 1].entries()) {
        const s = await signIn(deps, mail, `p${i}@example.com`);
        await cloudRun(deps, s);
        players.push((await rv.submitReview({ ...deps, now: 1000 + i }, as(s), { rating, text: `review ${i}` })).body.id);
    }
    const q = (await rv.moderationQueue(deps, as(admin))).body;
    assert.equal(q.reviews.length, 3);
    assert.equal((await rv.moderate(deps, as(admin), { id: players[2], decision: 'reject' })).body.error, 'reason_required');
    for (const id of players) await rv.moderate({ ...deps, now: 5000 + players.indexOf(id) }, as(admin), { id, decision: 'publish' });
    let pub = (await rv.publicReviews(deps)).body;
    assert.deepEqual(pub.reviews.map(r => r.text), ['review 2', 'review 1', 'review 0'], 'newest first');
    assert.deepEqual([pub.aggregate.count, pub.aggregate.average, pub.aggregate.written], [3, 3.3, 3]);
    await rv.moderate(deps, as(admin), { id: players[0], decision: 'hide', reason: 'personal_information', note: 'had a phone number' });
    pub = (await rv.publicReviews(deps)).body;
    assert.deepEqual([pub.aggregate.count, pub.aggregate.average], [2, 2.5]);
    const hidden = (await rv.moderationQueue(deps, as(admin), { filter: 'hidden' })).body.reviews[0];
    assert.equal(hidden.reasonCode, 'personal_information');
    assert.deepEqual(hidden.log.map(l => l.action), ['submitted', 'publish', 'hide']);
    assert.equal(hidden.text, 'review 0', 'moderators never change text');
    // The author sees why
    const mine = (await rv.myReview(deps, as(await signIn(deps, mail, 'p0@example.com')))).body.review;
    assert.deepEqual([mine.status, mine.statusReason], ['hidden', 'personal_information']);
});

test('reports: one per reporter, only for published reviews, surface in the queue', async () => {
    const { deps, mail } = setup();
    const admin = await signIn(deps, mail, 'owner@example.com');
    const s = await signIn(deps, mail, 'p@example.com');
    await cloudRun(deps, s);
    const id = (await rv.submitReview(deps, as(s), { rating: 2, text: 'meh' })).body.id;
    assert.equal((await rv.reportReview(deps, anon(), { id, reason: 'spam' })).status, 404, 'pending reviews are not public');
    await rv.moderate(deps, as(admin), { id, decision: 'publish' });
    assert.equal((await rv.reportReview(deps, anon(), { id, reason: 'nope' })).status, 400);
    await rv.reportReview(deps, anon(), { id, reason: 'spam' });
    await rv.reportReview(deps, anon(), { id, reason: 'spam' });
    await rv.reportReview(deps, anon('2.2.2.2'), { id, reason: 'harassment' });
    const q = (await rv.moderationQueue(deps, as(admin), { filter: 'reported' })).body.reviews;
    assert.equal(q[0].reports, 2);
    assert.equal(q[0].status, 'published', 'reports alone never unpublish');
    assert.equal((await rv.reportReview(deps, { ...anon(), clientHeader: null }, { id, reason: 'spam' })).status, 403);
});

test('reviews endpoints refuse to run without the cloud identity secret (Preview)', async () => {
    const { deps } = setup();
    const noSecret = { ...deps, cfg: { ...deps.cfg, secret: '' } };
    assert.equal((await rv.submitReview(noSecret, anon(), { rating: 5 })).status, 503);
    assert.equal((await rv.reportReview(noSecret, anon(), { id: 'x', reason: 'spam' })).status, 503);
});

test('admin reconcile requires an admin session', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'p@example.com');
    assert.equal((await handle(deps, as(s), { method: 'POST', body: { action: 'reconcile' } })).status, 403);
    const admin = await signIn(deps, mail, 'owner@example.com');
    assert.equal((await handle(deps, as(admin), { method: 'POST', body: { action: 'reconcile' } })).status, 200);
});

/* ── Evidence gaps (2026-10-24 review) ──────────────────────────────── */

test('eligibility: an arbitrary or tampered snapshot does not qualify, whatever its meta says', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'forger@example.com');
    // envelope-valid but empty snapshot, meta claiming turn 9
    await cloudRun(deps, s, 9, 'fmcg', { snapshot: { industryId: 'fmcg', saveVersion: 2, turn: 9, snapshot: { state: { turn: 9 } } } });
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).body.error, 'not_eligible', 'meta alone is not evidence');
    // real snapshot with the history tampered (scenario renamed, wrong chapter, non-numeric result, position not past it, foreign scenario, duplicated turn)
    const tamper = [
        (x) => { x.history[0].scenario = 'Made-up crisis'; },
        (x) => { x.history[0].chapter = 3; },
        (x) => { x.history[0].sales = 'lots'; },
        (x) => { x.turn = x.history.at(-1).turn; },
        (x) => { x.shuffledScenarios.demand_forecasting[0] = { id: 'retailer_panic', title: 'x' }; },
        (x) => { x.history.push({ ...x.history[0] }); },
    ];
    for (const t of tamper) {
        const snap = realSnapshot('fmcg', 3);
        t(snap);
        assert.equal(completedQuarterEvidence(snap), null);
        await cloudRun(deps, s, 3, 'fmcg', { snapshot: snap });
    }
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).body.error, 'not_eligible');
    // the industry in the meta must match the evidence
    await cloudRun(deps, s, 2, 'pharma', { snapshot: { ...realSnapshot('fmcg', 2), industryId: 'pharma' } });
    assert.equal((await rv.submitReview(deps, as(s), { rating: 5 })).body.error, 'not_eligible');
    // a genuine campaign with one completed quarter qualifies
    await cloudRun(deps, s, 2, 'electronics');
    const mine = (await rv.myReview(deps, as(s))).body;
    assert.deepEqual([mine.eligible, mine.playedIndustries], [true, ['electronics']]);
});

test('stats: concurrent duplicate deliveries (retries, reloads, two tabs) count once', async () => {
    const { deps } = setup();
    await Promise.all(Array.from({ length: 25 }, (_, i) => recordProgress(deps, anon(`10.0.0.${i}`), ev('r-concurrent', 'steady_seas', 1))));
    await Promise.all(Array.from({ length: 10 }, () => recordProgress(deps, anon(), ev('r-concurrent', 'holiday_approaching', 2))));
    const c = await readCounts(deps.store);
    assert.deepEqual([c.campaigns, c.scenarios], [1, 2]);
});

test('moderation: only configured admins; a verified player gets 403 on every admin operation', async () => {
    const { deps, mail } = setup();
    const p = await signIn(deps, mail, 'player@example.com');
    const admin = await signIn(deps, mail, 'owner@example.com');
    await cloudRun(deps, p);
    const id = (await rv.submitReview(deps, as(p), { rating: 3, text: 'ok' })).body.id;
    for (const req of [
        { method: 'GET', query: { view: 'admin' } },
        { method: 'POST', body: { action: 'moderate', id, decision: 'publish' } },
        { method: 'POST', body: { action: 'moderate', id, decision: 'hide', reason: 'spam' } },
        { method: 'POST', body: { action: 'reconcile' } },
    ]) assert.equal((await handle(deps, as(p), req)).status, 403, JSON.stringify(req));
    assert.equal((await handle(deps, anon(), { method: 'GET', query: { view: 'admin' } })).status, 401);
    assert.equal((await handle({ ...deps, adminEmails: [] }, as(admin), { method: 'GET', query: { view: 'admin' } })).status, 403, 'no admins configured');
    assert.equal((await handle(deps, as(admin, { csrf: 'x' }), { method: 'POST', body: { action: 'moderate', id, decision: 'publish' } })).status, 403, 'admin still needs CSRF');
    assert.equal((await handle(deps, as(admin), { method: 'POST', body: { action: 'moderate', id, decision: 'publish' } })).status, 200);
});

test('aggregates stay consistent through publish, edit, hide, re-publish and delete', async () => {
    const { deps, mail } = setup();
    const admin = await signIn(deps, mail, 'owner@example.com');
    const players = [];
    for (let i = 0; i < 4; i++) { const s = await signIn(deps, mail, `agg${i}@example.com`); await cloudRun(deps, s); players.push(s); }
    const ids = [];
    for (const [i, rating] of [5, 4, 2, 1].entries()) ids.push((await rv.submitReview(deps, as(players[i]), { rating, ...(i % 2 ? {} : { text: `t${i}` }) })).body.id);
    const check = async () => {
        const all = (await rv.moderationQueue(deps, as(admin), { filter: 'all' })).body.reviews.filter(r => r.status === 'published');
        const pub = (await rv.publicReviews(deps)).body;
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        all.forEach(r => { dist[r.rating]++; });
        const avg = all.length ? Math.round(all.reduce((n, r) => n + r.rating, 0) / all.length * 10) / 10 : null;
        assert.deepEqual([pub.aggregate.count, pub.aggregate.average, pub.aggregate.distribution, pub.total], [all.length, avg, dist, all.length]);
        assert.equal(pub.aggregate.written, all.filter(r => r.text).length);
        const stats = (await handle(deps, anon(), { method: 'GET', query: { view: 'stats' } })).body.rating;
        assert.deepEqual(stats, all.length ? { average: avg, count: all.length } : null);
        return pub.aggregate;
    };
    assert.equal((await check()).count, 2, 'rating-only reviews published, written ones pending');
    for (const id of ids) await rv.moderate(deps, as(admin), { id, decision: 'publish' });
    assert.equal((await check()).count, 4);
    await rv.submitReview(deps, as(players[0]), { rating: 1, text: 'changed my mind' });   // text edit → pending again
    assert.equal((await check()).count, 3);
    await rv.moderate(deps, as(admin), { id: ids[1], decision: 'hide', reason: 'other', note: 'internal note XYZ' });
    assert.equal((await check()).count, 2);
    await rv.moderate(deps, as(admin), { id: ids[1], decision: 'publish' });
    await rv.deleteReview(deps, as(players[2]));
    assert.equal((await check()).count, 2);
    const json = JSON.stringify((await rv.publicReviews(deps)).body);
    for (const leak of ['internal note XYZ', 'reasonCode', '"log"', 'agg0@', '"rev"', 'statusReason']) assert.ok(!json.includes(leak), `public response leaks ${leak}`);
});

test('public responses carry only aggregate/public fields', async () => {
    const { deps, mail } = setup();
    const s = await signIn(deps, mail, 'pub@example.com');
    await cloudRun(deps, s);
    await rv.submitReview(deps, as(s), { rating: 4 });
    await recordProgress(deps, anon(), ev('r-pub1'));
    const stats = (await handle(deps, anon(), { method: 'GET', query: { view: 'stats' } })).body;
    assert.deepEqual(Object.keys(stats).sort(), ['available', 'campaigns', 'rating', 'scenarios', 'since']);
    const reviews = (await handle(deps, anon(), { method: 'GET', query: { view: 'reviews' } })).body;
    assert.deepEqual(Object.keys(reviews).sort(), ['aggregate', 'available', 'offset', 'reviews', 'total']);
    assert.deepEqual(Object.keys(reviews.reviews[0]).sort(), ['date', 'displayName', 'id', 'industryId', 'playedScenario', 'rating', 'text']);
    assert.ok(!JSON.stringify(reviews).includes('pub@') && !JSON.stringify(stats).includes('r-pub1'));
});

test('caching: public views are CDN-cached only; personal, admin and mutation responses are never cached', async () => {
    const saved = { ...process.env };
    process.env.SCD_DEV_MEMORY_STORE = '1';
    process.env.CLOUD_SAVE_ID_SECRET = 'cache-test';
    delete process.env.KV_REST_API_URL;
    delete process.env.VERCEL_ENV;
    const call = async (req) => {
        const headers = {};
        let status = 0;
        const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, status: (s) => { status = s; return res; }, json: () => res, end: () => res };
        await communityHandler({ headers: { origin: ORIGIN, 'x-scd-client': '1', 'user-agent': 'Mozilla/5.0' }, socket: {}, ...req }, res);
        return { status, headers };
    };
    try {
        for (const view of ['stats', 'reviews']) {
            const r = await call({ method: 'GET', query: { view } });
            assert.equal(r.headers['cache-control'], 'public, max-age=0, must-revalidate', view);
            assert.match(r.headers['vercel-cdn-cache-control'], /^max-age=\d+, stale-while-revalidate=\d+$/);
        }
        for (const req of [{ method: 'GET', query: { view: 'mine' } }, { method: 'GET', query: { view: 'admin' } },
            { method: 'POST', query: {}, body: { action: 'review', rating: 5 } }, { method: 'POST', query: {}, body: { action: 'progress', ...ev('r-cache1') } }]) {
            const r = await call(req);
            assert.equal(r.headers['cache-control'], 'no-store', JSON.stringify(req));
            assert.equal(r.headers['vercel-cdn-cache-control'], undefined);
        }
    } finally { process.env = saved; }
});
