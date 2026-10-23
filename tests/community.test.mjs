// Community: play statistics (dedupe, exclusions, reconcile) and reviews
// (eligibility, one per account, edit/delete, moderation, aggregates, auth).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../lib/billing/store.js';
import { K } from '../lib/cloud/config.js';
import * as svc from '../lib/cloud/service.js';
import { recordProgress, readCounts, reconcile, validateProgress, SK, MAX_SCENARIOS_PER_RUN } from '../lib/community/stats.js';
import * as rv from '../lib/community/reviews.js';
import { handle, communityDeps } from '../api/community.js';

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
/** A cloud campaign with `turn` = next quarter to play (2 = one quarter completed). */
async function cloudRun(deps, s, turn = 2, industryId = 'fmcg', runId = 'r-' + Math.random().toString(36).slice(2, 12)) {
    const r = await svc.putRun(deps, as(s), {
        runId: runId.padEnd(10, 'x'), expectedRev: 0, writeId: 'w' + Math.random().toString(36).slice(2, 12),
        meta: { industryId, chapterNumber: 1, turn, phase: 'PHASE_STORY', status: 'active' },
        snapshot: { industryId, saveVersion: 2, turn, chapterIndex: 0, snapshot: { state: { turn } } },
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
