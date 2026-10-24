#!/usr/bin/env node
/**
 * Reviews / moderation / stats smoke test against a DEPLOYED PREVIEW with its
 * own isolated KV and real email (companion to cloud-preview-smoke.mjs).
 *
 *   BASE_URL=https://<preview>.vercel.app PLAYER_EMAIL=<test inbox> ADMIN_EMAIL=<REVIEW_ADMIN_EMAILS address> \
 *     [BYPASS=<deployment-protection bypass secret>] node scripts/community-preview-smoke.mjs
 *
 * Asks for each emailed code on stdin. Uploads a genuine engine snapshot (one
 * completed quarter) so review eligibility is exercised for real. Cleans up
 * the review and run it creates. Refuses to run against the production hosts.
 */
import readline from 'node:readline/promises';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { buildSnapshot } from '../src/logic/save-game.js';
import { scriptedChoices } from '../tests/helpers.mjs';

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const PLAYER = process.env.PLAYER_EMAIL || '', ADMIN = process.env.ADMIN_EMAIL || '';
if (!BASE || !PLAYER || !ADMIN) { console.error('Set BASE_URL, PLAYER_EMAIL and ADMIN_EMAIL.'); process.exit(2); }
if (/^(www\.)?supplychaindisaster\.com$/i.test(new URL(BASE).host)) { console.error('Refusing to run against production.'); process.exit(2); }
const origin = new URL(BASE).origin;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

function client() {
    const c = { cookie: '', csrf: null };
    c.call = async (method, path, body, { auth = true, headers = {} } = {}) => {
        const h = { 'x-scd-client': '1', origin, ...(process.env.BYPASS ? { 'x-vercel-protection-bypass': process.env.BYPASS } : {}) };
        if (body !== undefined) h['content-type'] = 'application/json';
        if (auth && c.cookie) h.cookie = c.cookie;
        if (auth && c.csrf) h['x-scd-csrf'] = c.csrf;
        Object.assign(h, headers);
        const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
        const set = r.headers.get('set-cookie');
        if (set && /scd_sess=/.test(set)) c.cookie = set.split(';')[0];
        return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
    };
    c.signIn = async (email, label) => {
        const req = await c.call('POST', '/api/cloud-account', { action: 'request-code', email }, { auth: false });
        check(`${label}: code requested`, req.status === 200, `status ${req.status}`);
        const code = (await rl.question(`Enter the code emailed to ${label} (${email}): `)).trim();
        const v = await c.call('POST', '/api/cloud-account', { action: 'verify-code', email, code }, { auth: false });
        check(`${label}: verified (real email delivery)`, v.status === 200 && v.body?.signedIn === true, `status ${v.status}`);
        c.csrf = v.body?.csrf || null;
    };
    return c;
}

function realSnapshot() {
    const e = new GameEngine();
    e.init('fmcg', true, 0);
    for (let n = 0; !(e.state.turn >= 2 && e.state.phase === GAME_PHASES.STORY) && n < 200; n++) {
        const p = e.state.phase;
        if (p === GAME_PHASES.CHAPTER_INTRO) e.advanceFromChapterIntro();
        else if (p === GAME_PHASES.STORY) e.makeDecision(0);
        else if (p === GAME_PHASES.PROCUREMENT) { e.prepareTurnCrisis(); e.processTurn(scriptedChoices(e.state.turn)); }
        else break;
    }
    return JSON.parse(JSON.stringify(buildSnapshot(e)));
}
const view = (c, v, auth = true) => c.call('GET', `/api/community?view=${v}`, undefined, { auth });
const agg = async (c) => (await view(c, 'reviews', false)).body?.aggregate;

const player = client(), admin = client(), anon = client();
try {
    // Preview must not count statistics (production-only gate), for anyone
    const ev = { action: 'progress', runId: 'r-previewsmoke', industryId: 'fmcg', chapterId: 'demand_forecasting', scenarioId: 'steady_seas', turn: 1 };
    const p0 = await anon.call('POST', '/api/community', ev);
    check('preview: progress events are not counted', p0.status === 202 && p0.body?.counted === false && p0.body?.reason === 'not_counted_here', JSON.stringify(p0.body));
    const s0 = await view(anon, 'stats', false);
    check('preview: public stats readable', s0.status === 200 && s0.body?.available === true, JSON.stringify(s0.body));

    await player.signIn(PLAYER, 'player');
    if (process.env.PROD_URL) {
        // Isolation: a session created on Preview must not exist in Production storage (read-only request)
        const r = await fetch(`${process.env.PROD_URL}/api/cloud-account`, { headers: { cookie: player.cookie } });
        const b = await r.json().catch(() => null);
        check('isolation: the Preview session is unknown to Production', r.status === 200 && b?.signedIn === false, JSON.stringify(b));
    }
    const runId = `r-smoke${Date.now().toString(36)}`;
    const snap = realSnapshot();
    const put = await player.call('PUT', '/api/cloud-runs', { runId, expectedRev: 0, writeId: `w-${Date.now().toString(36)}`, meta: { industryId: 'fmcg', chapterNumber: 1, turn: snap.turn, phase: 'PHASE_STORY', status: 'active' }, snapshot: snap });
    check('player: genuine campaign saved to the cloud', put.status === 200, `status ${put.status}`);

    const mine0 = await view(player, 'mine');
    check('player: eligible from the stored snapshot', mine0.body?.eligible === true && mine0.body?.admin === false, JSON.stringify({ eligible: mine0.body?.eligible, admin: mine0.body?.admin }));
    check('private view is no-store and not CDN-cached', mine0.headers.get('cache-control') === 'no-store' && !mine0.headers.get('vercel-cdn-cache-control'));

    const csrfLess = await player.call('POST', '/api/community', { action: 'review', rating: 4, text: 'x' }, { headers: { 'x-scd-csrf': 'wrong' } });
    check('review without the CSRF token is refused', csrfLess.status === 403);
    const sub = await player.call('POST', '/api/community', { action: 'review', rating: 4, text: 'Preview smoke test review — please ignore.', displayName: 'Smoke Test' });
    check('player: written review submitted as pending', sub.status === 200 && sub.body?.status === 'pending', JSON.stringify(sub.body));
    check('pending review not public', (await agg(anon))?.count === 0);

    for (const [name, c, expect] of [['player', player, 403], ['signed-out', anon, 401]]) {
        check(`${name}: admin queue refused`, (await view(c, 'admin')).status === expect);
        check(`${name}: moderation refused`, (await c.call('POST', '/api/community', { action: 'moderate', id: sub.body?.id, decision: 'publish' })).status === expect);
    }

    await admin.signIn(ADMIN, 'admin');
    const q = await view(admin, 'admin');
    check('admin: queue lists the pending review (no-store)', q.status === 200 && q.body?.reviews?.some(r => r.id === sub.body?.id) && q.headers.get('cache-control') === 'no-store');
    const pub = await admin.call('POST', '/api/community', { action: 'moderate', id: sub.body?.id, decision: 'publish' });
    check('admin: publish', pub.status === 200 && pub.body?.status === 'published');
    // Vercel consumes Vercel-CDN-Cache-Control at the edge (clients never see it): check the behaviour instead
    const listed = [];
    for (let i = 0; i < 3; i++) { listed.push(await view(anon, 'reviews', false)); await new Promise(r => setTimeout(r, 700)); }
    const edge = listed.map(r => r.headers.get('x-vercel-cache'));
    check('public list: browsers revalidate, the CDN serves it from cache', listed.every(r => r.headers.get('cache-control') === 'public, max-age=0, must-revalidate') && edge.slice(1).some(x => x === 'HIT' || x === 'STALE'), `x-vercel-cache ${edge.join(',')}`);
    const priv = [await view(player, 'mine'), await view(player, 'mine')].map(r => r.headers.get('x-vercel-cache'));
    check('private view never served from the CDN cache', priv.every(x => x !== 'HIT' && x !== 'STALE'), `x-vercel-cache ${priv.join(',')}`);
    const aPub = (await admin.call('GET', '/api/community?view=admin&filter=all')).body?.aggregate;
    check('aggregate after publish: 1 rating, average 4', aPub?.count === 1 && aPub?.average === 4, JSON.stringify(aPub));
    const pAdmin = await admin.call('POST', '/api/community', ev);
    check('admin play is not counted in preview', pAdmin.status === 202 && pAdmin.body?.counted === false, JSON.stringify(pAdmin.body));

    const edit = await player.call('POST', '/api/community', { action: 'review', rating: 2, text: 'Edited during the preview smoke test.' });
    check('player: edit returns the review to pending', edit.body?.status === 'pending' && edit.body?.aggregate?.count === 0, JSON.stringify(edit.body?.aggregate));
    await admin.call('POST', '/api/community', { action: 'moderate', id: sub.body?.id, decision: 'publish' });
    const a2 = (await admin.call('GET', '/api/community?view=admin&filter=all')).body?.aggregate;
    check('re-published: aggregate reflects the edited rating', a2?.count === 1 && a2?.average === 2, JSON.stringify(a2));
    const del = await player.call('POST', '/api/community', { action: 'delete-review' });
    const a3 = (await admin.call('GET', '/api/community?view=admin&filter=all')).body?.aggregate;
    check('player: delete removes it from the aggregate', del.status === 200 && a3?.count === 0, JSON.stringify(a3));
    check('player: own review gone', (await view(player, 'mine')).body?.review === null);

    const rm = await player.call('GET', '/api/cloud-runs');
    const run = rm.body?.runs?.find(r => r.runId === runId);
    if (run) await player.call('DELETE', `/api/cloud-runs?id=${runId}&expectedRev=${run.rev}`);
    for (const c of [player, admin]) await c.call('POST', '/api/cloud-account', { action: 'sign-out' });
} catch (e) {
    check('no exception', false, String(e?.stack || e));
} finally {
    rl.close();
    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
}
