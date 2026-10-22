// Local run store + cloud sync, end to end through the real API route handlers
// (in-memory KV), with separate storage and cookie jars per simulated device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed, scriptedChoices } from './helpers.mjs';

process.env.SCD_DEV_MEMORY_STORE = '1';
process.env.CLOUD_SAVE_ID_SECRET = 'runs-test-secret';
delete process.env.KV_REST_API_URL;

const { GameEngine, GAME_PHASES } = await import('../src/logic/engine.js');
const { buildSnapshot, LOCAL_SAVE_KEY } = await import('../src/logic/save-game.js');
const RS = await import('../src/logic/run-store.js');
const accountHandler = (await import('../api/cloud-account.js')).default;
const runsHandler = (await import('../api/cloud-runs.js')).default;

/* ── harness ─────────────────────────────────────────────────────────── */

function memStorage(limitChars = Infinity) {
    const m = new Map();
    const size = () => [...m.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => {
            const prev = m.get(k);
            m.set(k, String(v));
            if (size() > limitChars) { prev == null ? m.delete(k) : m.set(k, prev); const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
        _m: m,
    };
}

/** A fake browser: its own storage, cookie jar, online flag and cloud-sync module instance. */
async function device(name) {
    const storage = memStorage();
    const jar = {};
    const dev = { name, storage, online: true, requests: [] };
    const fetchFn = async (url, opts = {}) => {
        if (!dev.online) throw new TypeError('Failed to fetch');
        const u = new URL(url, 'http://localhost');
        const headers = { ...Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), origin: 'http://localhost:3000' };
        const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookie) headers.cookie = cookie;
        const req = { method: opts.method || 'GET', headers, body: opts.body ? JSON.parse(opts.body) : undefined, query: Object.fromEntries(u.searchParams), socket: { remoteAddress: `10.0.0.${name.length}` } };
        let status = 200, body = null;
        const res = {
            setHeader: (k, v) => { if (k.toLowerCase() === 'set-cookie') { const [pair, ...attrs] = v.split(';'); const [ck, cv] = pair.split('='); if (attrs.some(a => a.trim() === 'Max-Age=0')) delete jar[ck]; else jar[ck] = cv; } },
            status: (s) => { status = s; return res; },
            json: (b) => { body = b; return res; },
        };
        dev.requests.push(`${req.method} ${u.pathname}${u.search}`);
        await (u.pathname === '/api/cloud-account' ? accountHandler : runsHandler)(req, res);
        return { status, json: async () => body };
    };
    // Each device gets its own module instance (own session + outbox runtime)
    const CS = await import(`../src/logic/cloud-sync.js?device=${name}`);
    CS._setFetch(fetchFn);
    dev.CS = CS;
    dev.fetchFn = fetchFn;
    /** Another tab in this browser: same storage and cookies, its own sync module instance. */
    dev.tab = async (tabName) => { const T = await import(`../src/logic/cloud-sync.js?device=${name}-${tabName}`); T._setFetch(fetchFn); await T.refreshSession(); return T; };
    dev.use = () => { RS._setStorage(storage); globalThis.localStorage = storage; return dev; };
    dev.signIn = async (email) => {
        dev.use();
        assert.equal((await CS.requestCode(email)).ok, true);
        const code = globalThis.__scdDevMail.filter(m => m.to === email).at(-1).code;
        const r = await CS.verifyCode(email, code);
        assert.equal(r.ok, true, JSON.stringify(r));
    };
    return dev;
}

/** Play a deterministic campaign to the given phase/turn, returning the engine. */
function play(industryId, { untilTurn = 2, phase = GAME_PHASES.STORY } = {}) {
    return withSeed(99, () => {
        const e = new GameEngine();
        e.init(industryId, true, 0);
        let n = 0;
        while (!(e.state.turn >= untilTurn && e.state.phase === phase) && n++ < 500) {
            const p = e.state.phase;
            if (p === GAME_PHASES.CHAPTER_INTRO) e.advanceFromChapterIntro();
            else if (p === GAME_PHASES.STORY) e.makeDecision(0);
            else if (p === GAME_PHASES.PROCUREMENT) { e.prepareTurnCrisis(); e.processTurn(scriptedChoices(e.state.turn)); }
            else if (p === GAME_PHASES.CHAPTER_SUMMARY) e.advanceFromChapterSummary();
            else break;
        }
        return e;
    });
}
const snapAt = (industryId, untilTurn, phase) => JSON.parse(JSON.stringify(buildSnapshot(play(industryId, { untilTurn, phase }))));
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

/* ── local store ─────────────────────────────────────────────────────── */

test('separate runs per campaign: a new industry never overwrites another run', async () => {
    const d = (await device('local1')).use();
    const a = RS.createRun({ industryId: 'fmcg' });
    const b = RS.createRun({ industryId: 'pharma' });
    assert.equal(RS.saveRun(a.runId, snapAt('fmcg', 3, GAME_PHASES.PROCUREMENT)).ok, true);
    assert.equal(RS.saveRun(b.runId, snapAt('pharma', 2, GAME_PHASES.STORY)).ok, true);
    const c = RS.createRun({ industryId: 'fmcg' });   // second FMCG campaign
    assert.equal(RS.saveRun(c.runId, snapAt('fmcg', 1, GAME_PHASES.STORY)).ok, true);
    assert.equal(RS.visibleRuns().length, 3);
    assert.equal(RS.loadRun(a.runId).snapshot.snapshot.state.turn, 3);
    assert.equal(RS.loadRun(b.runId).snapshot.industryId, 'pharma');
    assert.equal(RS.saveRun(a.runId, snapAt('pharma', 2, GAME_PHASES.STORY)).reason, 'invalid', 'a run never accepts another industry');
    d.storage.clear();
});

test('corrupt latest snapshot recovers from the previous known-good checkpoint', async () => {
    const d = (await device('local2')).use();
    const r = RS.createRun({ industryId: 'fmcg' });
    RS.saveRun(r.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    RS.saveRun(r.runId, snapAt('fmcg', 3, GAME_PHASES.STORY), { checkpoint: true });
    d.storage.setItem(`scd_run_v3:${r.runId}`, '{"truncated":');
    const loaded = RS.loadRun(r.runId);
    assert.equal(loaded.recovered, true);
    assert.equal(loaded.snapshot.snapshot.state.turn, 2, 'checkpoint = previous good save');
    assert.equal(RS.loadRun(r.runId).recovered, undefined, 'checkpoint promoted to latest');
    // Invalid data never replaces the latest good snapshot
    assert.equal(RS.saveRun(r.runId, { industryId: 'fmcg', saveVersion: 2, snapshot: {} }).reason, 'invalid');
    assert.equal(RS.loadRun(r.runId).snapshot.snapshot.state.turn, 2);
    // Unsupported future schema is reported, not misread
    d.storage.setItem(`scd_run_v3:${r.runId}`, JSON.stringify({ industryId: 'fmcg', saveVersion: 9 }));
    assert.equal(RS.loadRun(r.runId).error, 'unsupported');
    d.storage.clear();
});

test('a second tab cannot silently overwrite: stale tab writes are refused', async () => {
    const d = (await device('local3')).use();
    const r = RS.createRun({ industryId: 'fmcg' });
    const tabA = RS.saveRun(r.runId, snapAt('fmcg', 2, GAME_PHASES.STORY), { tabRev: 0 });
    assert.equal(tabA.ok, true);
    const tabB = RS.saveRun(r.runId, snapAt('fmcg', 3, GAME_PHASES.STORY), { tabRev: tabA.meta.localRev });
    assert.equal(tabB.ok, true);
    const staleA = RS.saveRun(r.runId, snapAt('fmcg', 2, GAME_PHASES.PROCUREMENT), { tabRev: tabA.meta.localRev });
    assert.equal(staleA.reason, 'stale_tab');
    assert.equal(RS.loadRun(r.runId).snapshot.snapshot.state.turn, 3);
    d.storage.clear();
});

test('storage full: recovery copies are evicted first; a real failure is reported and keeps the last save', async () => {
    const big = snapAt('fmcg', 3, GAME_PHASES.STORY);
    const len = JSON.stringify(big).length;
    const storage = memStorage(len * 3 - 2000);
    RS._setStorage(storage); globalThis.localStorage = storage;
    const a = RS.createRun({ industryId: 'fmcg' });
    RS.saveRun(a.runId, big);
    RS.saveRun(a.runId, big, { checkpoint: true });            // latest + checkpoint
    const b = RS.createRun({ industryId: 'fmcg' });
    const okB = RS.saveRun(b.runId, big);
    assert.equal(okB.ok, true, 'evicted run A\'s checkpoint to make room');
    assert.equal(storage.getItem(`scd_run_v3_cp:${a.runId}`), null);
    const c = RS.createRun({ industryId: 'fmcg' });
    const failC = RS.saveRun(c.runId, big);
    assert.equal(failC.ok, false);
    assert.equal(failC.reason, 'quota');
    assert.ok(!RS.loadRun(a.runId).error && !RS.loadRun(b.runId).error, 'existing runs intact');
});

test('legacy single save migrates once, keeps the original until the copy is stored, never duplicates', async () => {
    const d = (await device('mig')).use();
    const gs = snapAt('pharma', 6, GAME_PHASES.PROCUREMENT);
    delete gs.snapshot.state.packagingVersion;   // made before the packaging
    const rec = JSON.stringify({ savedAt: Date.parse('2026-10-20T10:00:00Z'), gameState: gs });
    d.storage.setItem(LOCAL_SAVE_KEY, rec);
    const first = RS.migrateLegacyLocal();
    assert.equal(first.status, 'migrated');
    assert.equal(d.storage.getItem(LOCAL_SAVE_KEY), rec, 'original left intact (rollback can still read it)');
    const meta = RS.getMeta(first.runId);
    assert.equal(meta.legacyGrant, 'local-pre-packaging');
    assert.equal(meta.turn, 6);
    assert.equal(meta.phase, GAME_PHASES.PROCUREMENT);
    // Running again (every page load) → same run, no duplicate — even after the player deletes it
    assert.equal(RS.migrateLegacyLocal().status, 'already');
    assert.equal(RS.visibleRuns().length, 1);
    RS.deleteLocalRun(first.runId);
    assert.equal(RS.migrateLegacyLocal().status, 'already');
    assert.equal(RS.visibleRuns().length, 0, 'a deleted migrated run is not resurrected');
    // Lost marker (e.g. storage partly cleared) → deterministic ID still prevents duplicates
    RS.migrateLegacyLocal();
    d.storage.removeItem('scd_runs_migrated');
    d.storage.setItem(LOCAL_SAVE_KEY, rec);
    const again = RS.migrateLegacyLocal();
    assert.ok(['migrated', 'already'].includes(again.status));
    assert.equal(RS.visibleRuns().length, 1);
    // Unreadable legacy data is left alone
    d.storage.setItem(LOCAL_SAVE_KEY, '{oops');
    assert.equal(RS.migrateLegacyLocal().status, 'unreadable');
    assert.equal(d.storage.getItem(LOCAL_SAVE_KEY), '{oops');
    // An unstamped save dated after the packaging shipped gets no grant (ambiguous, reported)
    d.storage.setItem(LOCAL_SAVE_KEY, JSON.stringify({ savedAt: Date.parse('2026-10-25T10:00:00Z'), gameState: snapAt('fmcg', 3, GAME_PHASES.STORY) }));
    const late = RS.getMeta(RS.migrateLegacyLocal().runId);
    assert.equal(late.legacyGrant ?? null, null);
    assert.equal(late.legacyAmbiguous, true);
    d.storage.clear();
});

test('editing grandfathered flags inside a snapshot does not create an access grant', async () => {
    const d = (await device('grant')).use();
    const r = RS.createRun({ industryId: 'electronics' });
    const gs = snapAt('electronics', 2, GAME_PHASES.STORY);
    gs.snapshot.state.grandfathered = true;
    delete gs.snapshot.state.packagingVersion;
    RS.saveRun(r.runId, gs);
    assert.equal(RS.getMeta(r.runId).legacyGrant, undefined);
    d.storage.clear();
});

/* ── cloud sync ──────────────────────────────────────────────────────── */

test('offline progress stays local and syncs after reconnecting; older acks never clear newer edits', async () => {
    const d = await device('offline');
    await d.signIn('off@x.io');
    d.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: d.CS.getSession().owner });
    d.online = false;
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    await d.CS.flush(run.runId);
    assert.equal(d.CS.statusFor(RS.getMeta(run.runId)).cloud, 'pending');
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 2, 'local save unaffected by the network');
    d.online = true;
    // Start a sync, then save newer progress while it's in flight
    const p = d.CS.flush(run.runId);
    RS.saveRun(run.runId, snapAt('fmcg', 3, GAME_PHASES.STORY));
    await p;
    let m = RS.getMeta(run.runId);
    assert.equal(m.ackedLocalRev, 1, 'only the sent revision is acknowledged');
    assert.equal(RS.isPending(m), true, 'newer edit still pending');
    await d.CS.flush(run.runId);
    m = RS.getMeta(run.runId);
    assert.equal(RS.isPending(m), false);
    assert.equal(d.CS.statusFor(m).cloud, 'synced');
});

test('a verified player resumes on another device; a lost response is not double-applied', async () => {
    const a = await device('devA');
    await a.signIn('roam@x.io');
    a.use();
    const run = RS.createRun({ industryId: 'pharma', owner: a.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('pharma', 5, GAME_PHASES.PROCUREMENT));
    await a.CS.flush(run.runId);
    const rev1 = RS.getMeta(run.runId).cloudRev;
    // Simulate a write whose response was lost: inflight marker left behind, server already has it
    RS.saveRun(run.runId, snapAt('pharma', 6, GAME_PHASES.STORY));
    const orig = a.online; a.online = true;
    await a.CS.flush(run.runId);
    const m = RS.getMeta(run.runId);
    RS.updateMeta(run.runId, { inflight: { writeId: 'w-never-sent-0', sentLocalRev: m.localRev, expectedRev: m.cloudRev } });
    await a.CS.flush(run.runId);
    assert.equal(RS.getMeta(run.runId).cloudRev, rev1 + 1, 'no extra revision for the retry');
    a.online = orig;

    const b = await device('devB');
    await b.signIn('roam@x.io');
    b.use();
    const { remoteOnly } = await b.CS.reconcile();
    assert.equal(remoteOnly.length, 1);
    const dl = await b.CS.downloadRemote(remoteOnly[0]);
    assert.equal(dl.ok, true);
    const there = RS.loadRun(run.runId);
    assert.equal(there.snapshot.snapshot.state.turn, 6);
    assert.equal(there.snapshot.phase, GAME_PHASES.STORY);
});

test('two devices editing the same run: the stale write is rejected, both versions kept, player chooses', async () => {
    const a = await device('cA');
    const b = await device('cB');
    await a.signIn('two@x.io');
    await b.signIn('two@x.io');
    a.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: a.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    await a.CS.flush(run.runId);
    b.use();
    const { remoteOnly } = await b.CS.reconcile();
    await b.CS.downloadRemote(remoteOnly[0]);
    RS.saveRun(run.runId, snapAt('fmcg', 5, GAME_PHASES.STORY));   // device B plays on
    await b.CS.flush(run.runId);
    a.use();
    RS.saveRun(run.runId, snapAt('fmcg', 3, GAME_PHASES.PROCUREMENT));   // device A plays a different branch
    await a.CS.flush(run.runId);
    const m = RS.getMeta(run.runId);
    assert.ok(m.conflict, 'conflict detected');
    assert.equal(a.CS.statusFor(m).cloud, 'conflict');
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 3, 'device copy untouched');
    assert.equal(RS.readConflictCopy(run.runId).snapshot.snapshot.state.turn, 5, 'cloud copy kept beside it');
    // Choose the cloud version: the device branch survives as a separate copy
    assert.equal(a.CS.resolveConflict(run.runId, 'cloud').ok, true);
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 5);
    const copy = RS.visibleRuns(a.CS.getSession().owner).find(r => r.copyOf === run.runId);
    assert.equal(RS.loadRun(copy.runId).snapshot.snapshot.state.turn, 3);
    assert.equal(copy.owner, 'guest');
});

test('account switching never uploads one account\'s runs under another', async () => {
    const d = await device('switch');
    await d.signIn('first@x.io');
    d.use();
    const ownerA = d.CS.getSession().owner;
    const run = RS.createRun({ industryId: 'fmcg', owner: ownerA });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    d.online = false; await d.CS.flush(run.runId); d.online = true;   // pending for A
    await d.signIn('second@x.io');
    d.use();
    const ownerB = d.CS.getSession().owner;
    assert.notEqual(ownerA, ownerB);
    d.requests.length = 0;
    d.CS.flushAll();
    await tick(10);
    assert.ok(!d.requests.some(r => r.startsWith('PUT')), 'A\'s pending run not sent with B\'s session');
    assert.equal(RS.visibleRuns(ownerB).some(r => r.runId === run.runId), false, 'A\'s run hidden while B is signed in');
    assert.equal(d.CS.statusFor(RS.getMeta(run.runId)).cloud, 'signin');
});

test('deleting everywhere: another device\'s queued write cannot recreate the run', async () => {
    const a = await device('dA');
    const b = await device('dB');
    await a.signIn('del@x.io');
    await b.signIn('del@x.io');
    a.use();
    const run = RS.createRun({ industryId: 'pharma', owner: a.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('pharma', 2, GAME_PHASES.STORY));
    await a.CS.flush(run.runId);
    b.use();
    await b.CS.downloadRemote((await b.CS.reconcile()).remoteOnly[0]);
    a.use();
    assert.equal((await a.CS.deleteEverywhere(run.runId)).ok, true);
    assert.equal(RS.getMeta(run.runId), null);
    b.use();
    RS.saveRun(run.runId, snapAt('pharma', 3, GAME_PHASES.STORY));
    await b.CS.flush(run.runId);
    const m = RS.getMeta(run.runId);
    assert.equal(m.cloudDeleted, true);
    assert.equal(b.CS.statusFor(m).cloud, 'deleted');
    a.use();
    assert.equal((await a.CS.reconcile()).remoteOnly.length, 0, 'not recreated in the cloud');
});

test('an unverified browser cannot read or overwrite any account\'s cloud saves', async () => {
    const owner = await device('own');
    await owner.signIn('victim@x.io');
    owner.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: owner.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 4, GAME_PHASES.STORY));
    await owner.CS.flush(run.runId);
    const attacker = await device('anon');
    attacker.use();
    await attacker.CS.refreshSession();
    assert.equal(attacker.CS.getSession().signedIn, false);
    assert.deepEqual((await attacker.CS.reconcile()).remoteOnly, []);
    // Old endpoints are gone; the new ones need a session
    const r = await runsHandlerCall({ method: 'GET', query: { id: run.runId } });
    assert.equal(r.status, 401);
    const w = await runsHandlerCall({ method: 'PUT', headers: { 'x-scd-client': '1' }, body: { runId: run.runId, expectedRev: 1, writeId: 'w-attack-01', meta: { industryId: 'fmcg' }, snapshot: snapAt('fmcg', 1, GAME_PHASES.STORY), email: 'victim@x.io' } });
    assert.equal(w.status, 401);
    owner.use();
    await owner.CS.reconcile();
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 4);
});

async function runsHandlerCall({ method, query = {}, headers = {}, body }) {
    let status = 200, out = null;
    const res = { setHeader() {}, status: (s) => { status = s; return res; }, json: (b) => { out = b; return res; } };
    await runsHandler({ method, query, headers: { origin: 'http://localhost:3000', ...headers }, body, socket: {} }, res);
    return { status, body: out };
}

test('only the tab playing a run syncs it — two tabs of one device never race into a false conflict', async () => {
    const d = await device('tabs');
    await d.signIn('tabs@x.io');
    d.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: d.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    d.CS.setTabId('tab-here');
    RS.claimRun(run.runId, 'tab-other');      // another tab is playing it
    d.requests.length = 0;
    await d.CS.flush(run.runId);
    assert.ok(!d.requests.some(r => r.startsWith('PUT')), 'this tab leaves the sync to the playing tab');
    RS.releaseRun(run.runId, 'tab-other');    // that tab closed
    await d.CS.flush(run.runId);
    assert.ok(d.requests.some(r => r.startsWith('PUT')));
    assert.equal(RS.isPending(RS.getMeta(run.runId)), false);
    d.CS.setTabId(null);
});

test('saving an unchanged snapshot is not a new revision (no phantom pending sync)', async () => {
    const d = (await device('noop')).use();
    const r = RS.createRun({ industryId: 'fmcg' });
    const gs = snapAt('fmcg', 2, GAME_PHASES.STORY);
    const first = RS.saveRun(r.runId, gs);
    const again = RS.saveRun(r.runId, JSON.parse(JSON.stringify(gs)), { tabRev: first.meta.localRev });
    assert.equal(again.ok, true);
    assert.equal(again.unchanged, true);
    assert.equal(RS.getMeta(r.runId).localRev, first.meta.localRev);
    d.storage.clear();
});

/* ── Release-readiness regressions (2026-10-22) ──────────────────────── */

test('crashed tab: its claim stops blocking other tabs within the stale window; a fresh claim still does', async () => {
    const d = await device('crash');
    await d.signIn('crash@x.io');
    d.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: d.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    d.CS.setTabId('tab-new');
    // The playing tab crashed 2 minutes ago (no release, no heartbeat since)
    d.storage.setItem(`scd_run_lock:${run.runId}`, JSON.stringify({ tabId: 'tab-dead', at: Date.now() - 120_000 }));
    d.requests.length = 0;
    await d.CS.flush(run.runId);
    assert.ok(d.requests.some(r => r.startsWith('PUT')), 'pending progress synced without waiting');
    assert.equal(RS.isPending(RS.getMeta(run.runId)), false);
    // A live tab (fresh heartbeat) keeps ownership of syncing
    RS.saveRun(run.runId, snapAt('fmcg', 3, GAME_PHASES.STORY));
    d.storage.setItem(`scd_run_lock:${run.runId}`, JSON.stringify({ tabId: 'tab-live', at: Date.now() - 5_000 }));
    d.requests.length = 0;
    await d.CS.flush(run.runId);
    assert.ok(!d.requests.some(r => r.startsWith('PUT')));
    d.CS.setTabId(null);
});

test('suspended tab: after another tab takes over, its heartbeat and writes are refused even if that claim is stale', async () => {
    const d = (await device('suspend')).use();
    const run = RS.createRun({ industryId: 'fmcg' });
    const first = RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY), { tabRev: 0 });
    RS.claimRun(run.runId, 'tab-A');
    assert.equal(RS.touchRun(run.runId, 'tab-A'), true);
    // Tab A is suspended; tab B continues the run and saves, then goes quiet (its claim goes stale)
    RS.claimRun(run.runId, 'tab-B');
    RS.saveRun(run.runId, snapAt('fmcg', 3, GAME_PHASES.STORY), { tabRev: first.meta.localRev });
    d.storage.setItem(`scd_run_lock:${run.runId}`, JSON.stringify({ tabId: 'tab-B', at: Date.now() - 600_000 }));
    // Tab A wakes: heartbeat says "not yours", the pre-write ownership check (raw claim) agrees,
    // and the revision guard refuses its stale write
    assert.equal(RS.touchRun(run.runId, 'tab-A'), false);
    assert.equal(RS.rawLock(run.runId).tabId, 'tab-B');
    assert.equal(RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.PROCUREMENT), { tabRev: first.meta.localRev }).reason, 'stale_tab');
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 3, 'tab B progress kept');
    d.storage.clear();
});

test('two tabs of one device syncing the same run at once never produce a false conflict', async () => {
    const d = await device('twotabs');
    await d.signIn('twotabs@x.io');
    d.use();
    const run = RS.createRun({ industryId: 'pharma', owner: d.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('pharma', 2, GAME_PHASES.STORY));
    await d.CS.flush(run.runId);
    const other = await d.tab('t2');
    RS.saveRun(run.runId, snapAt('pharma', 3, GAME_PHASES.STORY));
    await Promise.all([d.CS.flush(run.runId), other.flush(run.runId)]);
    await d.CS.flush(run.runId);
    await other.flush(run.runId);
    const m = RS.getMeta(run.runId);
    assert.equal(Boolean(m.conflict), false, 'no conflict between tabs of the same device');
    assert.equal(RS.isPending(m), false);
    assert.equal(RS.readConflictCopy(run.runId), null);
});

test('delete everywhere while another device is offline with edits: the run is not resurrected; progress can be kept as a NEW run', async () => {
    const A = await device('delA');
    const B = await device('delB');
    await A.signIn('gone@x.io');
    await B.signIn('gone@x.io');
    A.use();
    const run = RS.createRun({ industryId: 'fmcg', owner: A.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    await A.CS.flush(run.runId);
    B.use();
    await B.CS.downloadRemote((await B.CS.reconcile()).remoteOnly[0]);
    // B goes offline and keeps playing (pending upload, possibly a request in flight)
    B.online = false;
    RS.saveRun(run.runId, snapAt('fmcg', 4, GAME_PHASES.PROCUREMENT));
    await B.CS.flush(run.runId);
    const inflight = RS.getMeta(run.runId).inflight;
    // A deletes everywhere
    A.use();
    assert.equal((await A.CS.deleteEverywhere(run.runId)).ok, true);
    // B reconnects
    B.use();
    B.online = true;
    await B.CS.flush(run.runId);
    const mb = RS.getMeta(run.runId);
    assert.equal(mb.cloudDeleted, true, 'B learns the run was deleted');
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 4, 'B progress still on B');
    B.requests.length = 0;
    await B.CS.flush(run.runId);
    assert.ok(!B.requests.some(r => r.startsWith('PUT')), 'B stops sending writes for the deleted run');
    // Requests that arrive late (sent before the delete, or retried after it) also fail
    const base = { runId: run.runId, meta: { industryId: 'fmcg' }, snapshot: snapAt('fmcg', 4, GAME_PHASES.PROCUREMENT) };
    assert.equal((await runsHandlerCallAs(B, { method: 'PUT', body: { ...base, expectedRev: mb.cloudRev, writeId: 'w-late-00001' } })).status, 410, 'delayed write');
    assert.equal((await runsHandlerCallAs(B, { method: 'PUT', body: { ...base, expectedRev: 0, writeId: 'w-late-00002' } })).status, 410, 'write as if new');
    if (inflight) assert.equal((await runsHandlerCallAs(B, { method: 'PUT', body: { ...base, expectedRev: inflight.expectedRev, writeId: inflight.writeId } })).status, 410, 'retry of the original request');
    A.use();
    assert.equal((await A.CS.reconcile()).remoteOnly.length, 0, 'not recreated');
    // B deliberately keeps its progress — as a new cloud run with a new ID
    B.use();
    const rec = B.CS.recoverDeleted(run.runId, { toCloud: true });
    assert.equal(rec.ok, true);
    assert.notEqual(rec.runId, run.runId);
    assert.equal(RS.getMeta(run.runId), null);
    await B.CS.flush(rec.runId);
    assert.equal(RS.isPending(RS.getMeta(rec.runId)), false);
    A.use();
    const seen = (await A.CS.reconcile()).remoteOnly.map(r => r.runId);
    assert.deepEqual(seen, [rec.runId], 'only the new run exists; the deleted one stays deleted');
});

test('old email backup: imported once per source (repeat = no duplicate), pre-packaging grant only from the server timestamp', async () => {
    const { defaultStore } = await import('../lib/billing/store.js');
    const store = await defaultStore();
    const savedAt = Date.parse('2026-09-30T12:00:00Z');
    await store.set('game:legacy@x.io', { email: 'legacy@x.io', savedAt, version: 1, gameState: { industryId: 'pharma', chapterIndex: 2, turn: 13, maxTurns: 40, cash: 4321, inventory: 10, backlog: 0, inTransit: [] } });
    const d = await device('legacyimp');
    await d.signIn('legacy@x.io');
    d.use();
    assert.equal(d.CS.getSession().legacy.preLaunch, true);
    const r1 = await d.CS.importLegacy();
    assert.equal(r1.ok, true);
    const m = RS.getMeta(r1.runId);
    assert.equal(m.legacyGrant, 'cloud-pre-packaging');
    assert.equal(m.format, 'v1-chapter-end', 'kept as a chapter-end save (resumes at the next chapter)');
    const again = RS.importRun({ gameState: RS.loadRun(r1.runId).snapshot, owner: m.owner, sourceKey: `${d.CS.getSession().owner}:${savedAt}:pharma` });
    assert.equal(again.existed, true, 'same source gives the same run');
    assert.equal(RS.visibleRuns(d.CS.getSession().owner).filter(x => x.importedFrom === 'cloud-legacy').length, 1);
    assert.equal((await d.CS.importLegacy()).ok, false, 'copy dismissed after import, nothing to import twice');
    assert.ok(await store.get('game:legacy@x.io'), 'original record intact');
});

test('attaching a guest campaign to an account adds a run; it never replaces an existing cloud run', async () => {
    const A = await device('attachA');
    await A.signIn('attach@x.io');
    A.use();
    const existing = RS.createRun({ industryId: 'fmcg', owner: A.CS.getSession().owner });
    RS.saveRun(existing.runId, snapAt('fmcg', 5, GAME_PHASES.STORY));
    await A.CS.flush(existing.runId);
    const B = await device('attachB');
    B.use();
    const guest = RS.createRun({ industryId: 'fmcg' });
    RS.saveRun(guest.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    await B.signIn('attach@x.io');
    B.use();
    assert.equal(B.CS.adoptRun(guest.runId), true);
    await B.CS.flush(guest.runId);
    const runs = (await B.CS.reconcile()).remoteOnly.map(r => r.runId);
    assert.deepEqual(runs, [existing.runId], 'the existing cloud run is still there (and new to this device)');
    A.use();
    const fromA = (await A.CS.reconcile()).remoteOnly.map(r => r.runId);
    assert.deepEqual(fromA, [guest.runId]);
    assert.equal(RS.loadRun(existing.runId).snapshot.snapshot.state.turn, 5);
});

test('storage provider failure: the API reports an error, the player sees pending, local progress is safe, then it syncs', async () => {
    const d = await device('kvdown');
    await d.signIn('kvdown@x.io');
    d.use();
    const { defaultStore } = await import('../lib/billing/store.js');
    const store = await defaultStore();
    const run = RS.createRun({ industryId: 'fmcg', owner: d.CS.getSession().owner });
    RS.saveRun(run.runId, snapAt('fmcg', 2, GAME_PHASES.STORY));
    const realSet = store.set;
    store.set = async () => { throw new Error('ETIMEDOUT'); };
    try { await d.CS.flush(run.runId); } finally { store.set = realSet; }
    assert.equal(d.CS.statusFor(RS.getMeta(run.runId)).cloud, 'pending');
    assert.equal(RS.loadRun(run.runId).snapshot.snapshot.state.turn, 2);
    await d.CS.flush(run.runId);
    assert.equal(d.CS.statusFor(RS.getMeta(run.runId)).cloud, 'synced');
});

async function runsHandlerCallAs(dev, { method, body }) {
    const r = await dev.fetchFn('/api/cloud-runs', { method, headers: { 'x-scd-client': '1', 'Content-Type': 'application/json', 'x-scd-csrf': dev.CS.getSession().csrf }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
}
