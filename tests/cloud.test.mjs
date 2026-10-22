// Cloud saves: ownership, sessions, CSRF, verification codes, revisions/conflicts, deletion, legacy import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../lib/billing/store.js';
import { K, keyed } from '../lib/cloud/config.js';
import * as svc from '../lib/cloud/service.js';

const SECRET = 'test-secret-cloud';
function setup() {
    const mail = [];
    const deps = {
        store: memoryStore(),
        cfg: { secret: SECRET, origins: new Set(['https://www.supplychaindisaster.com']), devInsecureCookies: false },
        sendCode: async (to, code) => { mail.push({ to, code }); },
    };
    return { deps, mail };
}
const ORIGIN = 'https://www.supplychaindisaster.com';
const anon = (ip = '1.1.1.1') => ({ ip, origin: ORIGIN, clientHeader: '1', sid: null, csrf: null });
const as = (s, extra = {}) => ({ ip: '1.1.1.1', origin: ORIGIN, clientHeader: '1', sid: s.sid, csrf: s.csrf, ...extra });

async function signIn(deps, mail, email, ip) {
    assert.equal((await svc.requestCode(deps, anon(ip), { email })).status, 200);
    const code = mail.filter(m => m.to === email.toLowerCase()).at(-1).code;
    const r = await svc.verifyCode(deps, anon(ip), { email, code });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { sid: r.setSession, csrf: r.body.csrf, owner: r.body.owner };
}

const snap = (industryId = 'fmcg', turn = 2) => ({ industryId, saveVersion: 2, turn, chapterIndex: 0, snapshot: { state: { turn, cash: 1000 } } });
const meta = (industryId = 'fmcg', extra = {}) => ({ industryId, chapterNumber: 1, turn: 2, phase: 'PHASE_STORY', status: 'active', ...extra });
const put = (deps, s, runId, expectedRev, writeId, industryId = 'fmcg', turn = 2) =>
    svc.putRun(deps, as(s), { runId, expectedRev, writeId, meta: meta(industryId, { turn }), snapshot: snap(industryId, turn) });

test('request-code answers the same way for any valid email and never reveals saves', async () => {
    const { deps } = setup();
    const a = await svc.requestCode(deps, anon(), { email: 'someone@example.com' });
    const b = await svc.requestCode(deps, anon('2.2.2.2'), { email: 'nobody@example.org' });
    assert.deepEqual(a.body, { sent: true });
    assert.deepEqual(b.body, { sent: true });
    assert.equal((await svc.requestCode(deps, anon(), { email: 'not-an-email' })).status, 400);
});

test('codes: resend cooldown, per-email and per-IP hourly limits', async () => {
    const { deps } = setup();
    let t = 1_000_000;
    deps.now = undefined;
    const at = (ms) => ({ ...deps, now: ms });
    assert.equal((await svc.requestCode(at(t), anon(), { email: 'a@x.io' })).status, 200);
    assert.equal((await svc.requestCode(at(t + 5000), anon(), { email: 'a@x.io' })).body.error, 'resend_too_soon');
    for (let i = 1; i < 5; i++) assert.equal((await svc.requestCode(at(t + i * 31_000), anon(), { email: 'a@x.io' })).status, 200);
    assert.equal((await svc.requestCode(at(t + 9 * 31_000), anon(), { email: 'a@x.io' })).body.error, 'rate_limited', '6th code for one email in an hour');
    for (let i = 0; i < 20; i++) await svc.requestCode(deps, anon('9.9.9.9'), { email: `u${i}@x.io` });
    assert.equal((await svc.requestCode(deps, anon('9.9.9.9'), { email: 'u99@x.io' })).body.error, 'rate_limited', 'per-IP limit');
});

test('codes are single-use, expire, and lock after 5 wrong attempts', async () => {
    const { deps, mail } = setup();
    await svc.requestCode(deps, anon(), { email: 'p@x.io' });
    const code = mail.at(-1).code;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await svc.verifyCode(deps, anon(), { email: 'p@x.io', code: wrong })).body.error, 'invalid_code');
    assert.equal((await svc.verifyCode(deps, anon(), { email: 'p@x.io', code })).body.error, 'too_many_attempts', 'right code after 5 misses still fails');

    const { deps: d2, mail: m2 } = setup();
    await svc.requestCode(d2, anon(), { email: 'q@x.io' });
    const c2 = m2.at(-1).code;
    assert.equal((await svc.verifyCode(d2, anon(), { email: 'q@x.io', code: c2 })).status, 200);
    assert.equal((await svc.verifyCode(d2, anon(), { email: 'q@x.io', code: c2 })).body.error, 'invalid_code', 'single use');

    const { deps: d3, mail: m3 } = setup();
    await svc.requestCode({ ...d3, now: 0 }, anon(), { email: 'r@x.io' });
    d3.store._map.get(K.otp(keyed(SECRET, 'email', 'r@x.io'))).exp = Date.now() - 1;   // TTL elapsed
    assert.equal((await svc.verifyCode(d3, anon(), { email: 'r@x.io', code: m3.at(-1).code })).body.error, 'invalid_code', 'expired');
});

test('verification starts a session only: no purchase token or access is issued', async () => {
    const { deps, mail } = setup();
    await svc.requestCode(deps, anon(), { email: 'buyer@x.io' });
    const r = await svc.verifyCode(deps, anon(), { email: 'buyer@x.io', code: mail.at(-1).code });
    assert.ok(r.setSession && r.body.csrf);
    assert.equal(r.body.token, undefined);
    assert.equal(r.body.access, undefined);
    assert.ok(!JSON.stringify(r.body).includes('buyer@x.io'), 'email is only returned masked');
});

test('without a session nothing can be read or written — an email string is not authority', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'alice@x.io');
    assert.equal((await put(deps, a, 'run-alice-1', 0, 'w-000001')).status, 200);
    const noSession = { ip: '3.3.3.3', origin: ORIGIN, clientHeader: '1', sid: null, csrf: null };
    assert.equal((await svc.listRuns(deps, noSession)).status, 401);
    assert.equal((await svc.getRun(deps, noSession, { runId: 'run-alice-1' })).status, 401);
    assert.equal((await svc.putRun(deps, noSession, { runId: 'run-alice-1', expectedRev: 1, writeId: 'w-evil-01', meta: meta(), snapshot: snap(), email: 'alice@x.io' })).status, 401);
    assert.equal((await svc.deleteRun(deps, { ...noSession, sid: 'forged-session-id' }, { runId: 'run-alice-1' })).status, 401);
    assert.equal((await svc.getRun(deps, as(a), { runId: 'run-alice-1' })).body.rev, 1, 'record untouched');
});

test('user A cannot see or change user B runs, even with B\'s run ID', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'a@x.io', '4.4.4.4');
    const b = await signIn(deps, mail, 'b@x.io', '5.5.5.5');
    assert.notEqual(a.owner, b.owner);
    assert.equal((await put(deps, b, 'run-bob-0001', 0, 'w-bob-0001')).status, 200);
    assert.equal((await svc.listRuns(deps, as(a))).body.runs.length, 0);
    assert.equal((await svc.getRun(deps, as(a), { runId: 'run-bob-0001' })).status, 404);
    assert.equal((await svc.deleteRun(deps, as(a), { runId: 'run-bob-0001' })).body.rev, 0, 'deleting in A\'s namespace is a no-op');
    assert.equal((await put(deps, a, 'run-bob-0001', 0, 'w-alice-01')).status, 200, 'same ID in A\'s namespace is A\'s own run');
    const bRun = await svc.getRun(deps, as(b), { runId: 'run-bob-0001' });
    assert.equal(bRun.body.rev, 1);
    assert.equal(bRun.body.snapshot.industryId, 'fmcg');
});

test('mutations need the session CSRF token, our custom header and an allowed origin', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'c@x.io');
    assert.equal((await svc.putRun(deps, as(a, { csrf: 'wrong' }), { runId: 'run-csrf-01', expectedRev: 0, writeId: 'w-csrf-01', meta: meta(), snapshot: snap() })).body.error, 'bad_csrf');
    assert.equal((await svc.putRun(deps, as(a, { clientHeader: null }), { runId: 'run-csrf-01', expectedRev: 0, writeId: 'w-csrf-01', meta: meta(), snapshot: snap() })).body.error, 'bad_request');
    assert.equal((await svc.putRun(deps, as(a, { origin: 'https://evil.example' }), { runId: 'run-csrf-01', expectedRev: 0, writeId: 'w-csrf-01', meta: meta(), snapshot: snap() })).body.error, 'bad_origin');
    assert.equal((await svc.verifyCode(deps, { ...anon(), origin: 'https://evil.example' }, { email: 'c@x.io', code: '123456' })).body.error, 'bad_origin', 'no login CSRF');
    assert.equal((await svc.listRuns(deps, as(a, { csrf: null, clientHeader: null }))).status, 200, 'reads need the session only');
});

test('revisions: stale writes are rejected without overwriting; retries are idempotent', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'd@x.io');
    assert.equal((await put(deps, a, 'run-rev-0001', 0, 'w-dev1-001', 'fmcg', 2)).body.rev, 1);
    // Device 2 based on rev 1 writes rev 2
    assert.equal((await put(deps, a, 'run-rev-0001', 1, 'w-dev2-001', 'fmcg', 5)).body.rev, 2);
    // Device 1 still thinks rev 1 → conflict, record keeps device 2's turn
    const stale = await put(deps, a, 'run-rev-0001', 1, 'w-dev1-002', 'fmcg', 3);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.rev, 2);
    assert.equal((await svc.getRun(deps, as(a), { runId: 'run-rev-0001' })).body.snapshot.turn, 5);
    // Retrying device 2's last write (lost response) is acknowledged, not duplicated
    const retry = await put(deps, a, 'run-rev-0001', 1, 'w-dev2-001', 'fmcg', 5);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.rev, 2);
    assert.equal((await svc.getRun(deps, as(a), { runId: 'run-rev-0001', headOnly: true })).body.writeId, 'w-dev2-001');
});

test('deleted runs stay deleted: a queued write from another device gets 410', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'e@x.io');
    await put(deps, a, 'run-del-0001', 0, 'w-del-0001');
    assert.equal((await svc.deleteRun(deps, as(a), { runId: 'run-del-0001', expectedRev: 1 })).body.deleted, true);
    const late = await put(deps, a, 'run-del-0001', 1, 'w-del-0002');
    assert.equal(late.status, 410);
    const fresh = await put(deps, a, 'run-del-0001', 0, 'w-del-0003');
    assert.equal(fresh.status, 410, 'not recreated from rev 0 either');
    const list = (await svc.listRuns(deps, as(a))).body.runs;
    assert.equal(list.find(r => r.runId === 'run-del-0001').deleted, true);
});

test('bad envelopes, oversized snapshots and the per-account run limit are refused', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'f@x.io');
    assert.equal((await svc.putRun(deps, as(a), { runId: 'run-bad-0001', expectedRev: 0, writeId: 'w-bad-0001', meta: meta('pharma'), snapshot: snap('fmcg') })).body.error, 'bad_snapshot');
    const big = snap(); big.snapshot.state.blob = 'x'.repeat(700_000);
    assert.equal((await svc.putRun(deps, as(a), { runId: 'run-big-0001', expectedRev: 0, writeId: 'w-big-0001', meta: meta(), snapshot: big })).status, 413);
    for (let i = 0; i < 20; i++) assert.equal((await put(deps, a, `run-lim-${String(i).padStart(4, '0')}`, 0, `w-lim-${String(i).padStart(4, '0')}`)).status, 200);
    assert.equal((await put(deps, a, 'run-lim-9999', 0, 'w-lim-9999')).body.error, 'run_limit');
});

test('a recovery checkpoint is kept when the chapter changes', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'g@x.io');
    await put(deps, a, 'run-cp-00001', 0, 'w-cp-00001', 'fmcg', 4);
    const r2 = await svc.putRun(deps, as(a), { runId: 'run-cp-00001', expectedRev: 1, writeId: 'w-cp-00002', meta: meta('fmcg', { chapterNumber: 2, turn: 5 }), snapshot: snap('fmcg', 5) });
    assert.equal(r2.body.rev, 2);
    const cp = await svc.getCheckpoint(deps, as(a), { runId: 'run-cp-00001' });
    assert.equal(cp.body.rev, 1);
    assert.equal(cp.body.snapshot.turn, 4);
});

test('sign-out ends the session; a new sign-in issues a new session ID', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'h@x.io');
    assert.equal((await svc.signOut(deps, as(a))).status, 200);
    assert.equal((await svc.listRuns(deps, as(a))).status, 401);
    const again = await signIn(deps, mail, 'h@x.io', '6.6.6.6');
    assert.notEqual(again.sid, a.sid);
    assert.equal(again.owner, a.owner, 'same email → same owner');
});

test('old email backups are reachable only after verifying that email, and the original is preserved', async () => {
    const { deps, mail } = setup();
    const original = { email: 'old@x.io', savedAt: Date.parse('2026-09-01T00:00:00Z'), version: 1, gameState: { industryId: 'pharma', chapterIndex: 1, turn: 9 } };
    await deps.store.set('game:old@x.io', original);
    // Someone else signed in cannot fetch it
    const other = await signIn(deps, mail, 'intruder@x.io', '7.7.7.7');
    assert.equal((await svc.getLegacy(deps, as(other))).status, 404);
    // The owner of that inbox can
    const me = await signIn(deps, mail, 'old@x.io', '8.8.8.8');
    const status = await svc.sessionStatus(deps, as(me));
    assert.equal(status.body.legacy.industryId, 'pharma');
    assert.equal(status.body.legacy.preLaunch, true, 'server-side savedAt predates the packaging');
    const leg = await svc.getLegacy(deps, as(me));
    assert.equal(leg.body.gameState.chapterIndex, 1);
    await svc.dismissLegacy(deps, as(me));
    assert.equal((await svc.getLegacy(deps, as(me))).status, 404);
    assert.deepEqual(await deps.store.get('game:old@x.io'), original, 'original record untouched');
});

test('cloud saves report not_configured without storage or secret', async () => {
    const r = await svc.listRuns({ store: null, cfg: { secret: '' } }, anon());
    assert.equal(r.status, 503);
    const s = await svc.sessionStatus({ store: null, cfg: { secret: '' } }, anon());
    assert.deepEqual(s.body, { signedIn: false, available: false });
});

/* ── Secret rotation never loses saves ──────────────────────────────── */

test('identity secret rotation: with PREVIOUS set, re-verifying finds the same account and its saves (idempotent, old mapping kept)', async () => {
    const store = memoryStore();
    const mail = [];
    const mk = (secret, previousSecrets = []) => ({ store, sendCode: async (to, code) => { mail.push({ to, code }); }, cfg: { secret, previousSecrets, origins: new Set([ORIGIN]), devInsecureCookies: false } });
    // A save made under the checkpoint configuration, where the identity key used the token secret
    const before = mk('token-secret-T');
    const a = await signIn(before, mail, 'keep@x.io', '20.0.0.1');
    assert.equal((await put(before, a, 'run-keep-001', 0, 'w-keep-0001')).status, 200);

    // Proposed configuration: dedicated identity secret, old value kept as PREVIOUS
    const after = mk('identity-secret-S', ['token-secret-T']);
    assert.equal((await svc.listRuns(after, as(a))).body.runs.length, 1, 'sessions do not depend on any secret');
    const again = await signIn(after, mail, 'keep@x.io', '20.0.0.2');
    assert.equal(again.owner, a.owner, 'same account (same owner tag)');
    assert.equal((await svc.getRun(after, as(again), { runId: 'run-keep-001' })).body.snapshot.industryId, 'fmcg');
    assert.ok(await store.get(K.owner(keyed('identity-secret-S', 'email', 'keep@x.io'))), 'mapping copied to the new key');
    assert.ok(await store.get(K.owner(keyed('token-secret-T', 'email', 'keep@x.io'))), 'old mapping left intact');
    const third = await signIn(after, mail, 'keep@x.io', '20.0.0.3');
    assert.equal(third.owner, a.owner, 'repeat verification is idempotent');

    // Once migrated, PREVIOUS can be removed without losing the account
    const later = mk('identity-secret-S');
    const fourth = await signIn(later, mail, 'keep@x.io', '20.0.0.4');
    assert.equal(fourth.owner, a.owner);
});

test('identity secret rotation WITHOUT the previous value would orphan saves — why the config order matters', async () => {
    const store = memoryStore();
    const mail = [];
    const mk = (secret) => ({ store, sendCode: async (to, code) => { mail.push({ to, code }); }, cfg: { secret, previousSecrets: [], origins: new Set([ORIGIN]), devInsecureCookies: false } });
    const a = await signIn(mk('v1'), mail, 'lost@x.io', '21.0.0.1');
    await put(mk('v1'), a, 'run-lost-001', 0, 'w-lost-0001');
    const b = await signIn(mk('v2'), mail, 'lost@x.io', '21.0.0.2');
    assert.notEqual(b.owner, a.owner, 'a different (empty) account — the old runs still exist but are unreachable');
    assert.equal((await svc.listRuns(mk('v2'), as(b))).body.runs.length, 0);
});

/* ── Concurrency against a slow store, retention timers ─────────────── */

/** memoryStore with random latency on every call (SET NX stays atomic, as in Redis). */
function slowStore() {
    const s = memoryStore();
    const lag = () => new Promise(r => setTimeout(r, Math.random() * 6));
    return {
        get: async (k) => { await lag(); return s.get(k); },
        set: async (k, v, o) => { await lag(); return s.set(k, v, o); },
        del: async (k) => { await lag(); return s.del(k); },
        incr: async (k, t) => { await lag(); return s.incr(k, t); },
        _map: s._map,
    };
}

test('concurrent writes with the same base revision: exactly one wins, the record matches it', async () => {
    const { deps, mail } = setup();
    deps.store = slowStore();
    const a = await signIn(deps, mail, 'race@x.io');
    await put(deps, a, 'run-race-001', 0, 'w-race-base');
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
        svc.putRun(deps, as(a), { runId: 'run-race-001', expectedRev: 1, writeId: `w-race-${String(i).padStart(4, '0')}`, meta: meta('fmcg', { turn: 10 + i }), snapshot: snap('fmcg', 10 + i) })));
    const winners = results.filter(r => r.status === 200);
    assert.equal(winners.length, 1, `statuses: ${results.map(r => r.status).join(',')}`);
    assert.ok(results.every(r => [200, 409, 503].includes(r.status)));
    const rec = await svc.getRun(deps, as(a), { runId: 'run-race-001' });
    assert.equal(rec.body.rev, 2);
    assert.equal(rec.body.snapshot.turn, 10 + results.findIndex(r => r.status === 200), 'stored snapshot is the winner');
});

test('concurrent writes to different runs of one account never lose index entries', async () => {
    const { deps, mail } = setup();
    deps.store = slowStore();
    const a = await signIn(deps, mail, 'many@x.io');
    const ids = Array.from({ length: 8 }, (_, i) => `run-many-${String(i).padStart(4, '0')}`);
    const attempt = async (id, n = 0) => {
        const r = await put(deps, a, id, 0, `w-${id}`);
        return r.status === 503 && n < 20 ? attempt(id, n + 1) : r;
    };
    const rs = await Promise.all(ids.map(id => attempt(id)));
    assert.ok(rs.every(r => r.status === 200), rs.map(r => r.status).join(','));
    assert.equal((await svc.listRuns(deps, as(a))).body.runs.length, 8);
});

test('retention: snapshots and index expire 12 months after the last sync; sessions after 30 days', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'ttl@x.io');
    await put(deps, a, 'run-ttl-0001', 0, 'w-ttl-00001');
    const year = 365 * 86400 * 1000, month = 30 * 86400 * 1000;
    const near = (exp, ms) => Math.abs(exp - (Date.now() + ms)) < 60_000;
    const entries = [...deps.store._map.entries()];
    const blob = entries.find(([k]) => k.startsWith('sv:run:') && k.endsWith(':run-ttl-0001:1'));
    const index = entries.find(([k]) => k.startsWith('sv:idx:'));
    const session = entries.find(([k]) => k.startsWith('sv:sess:'));
    assert.ok(blob && near(blob[1].exp, year), 'snapshot: 12 months');
    assert.ok(index && near(index[1].exp, year), 'index: 12 months');
    assert.ok(session && near(session[1].exp, month), 'session: 30 days');
});

test('superseded snapshots are cleaned up; only the current revision and one checkpoint remain', async () => {
    const { deps, mail } = setup();
    const a = await signIn(deps, mail, 'gc@x.io');
    for (let rev = 0; rev < 6; rev++) {
        const chapter = rev < 3 ? 1 : 2;
        const r = await svc.putRun(deps, as(a), { runId: 'run-gc-00001', expectedRev: rev, writeId: `w-gc-${String(rev).padStart(5, '0')}`, meta: meta('fmcg', { chapterNumber: chapter, turn: rev + 1 }), snapshot: snap('fmcg', rev + 1) });
        assert.equal(r.status, 200);
    }
    const blobs = [...deps.store._map.keys()].filter(k => k.includes(':run-gc-00001:'));
    assert.equal(blobs.length, 2, blobs.join(' '));
    const cp = await svc.getCheckpoint(deps, as(a), { runId: 'run-gc-00001' });
    assert.equal(cp.body.rev, 3, 'checkpoint = last revision of Chapter 1');
});
