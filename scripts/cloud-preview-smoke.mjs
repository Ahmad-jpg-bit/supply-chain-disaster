#!/usr/bin/env node
/**
 * Cloud-save smoke test against a DEPLOYED PREVIEW with real KV + real email.
 *
 *   BASE_URL=https://<preview>.vercel.app TEST_EMAIL=<developer-controlled address> \
 *     node scripts/cloud-preview-smoke.mjs
 *
 * Prerequisites (see CLAUDE.md "Saves & cloud saves"):
 *   - The preview's KV database is ISOLATED from production (its own Upstash/KV
 *     store connected to the Preview environment only). Never run this against a
 *     preview that shares production KV.
 *   - RESEND_API_KEY and CLOUD_SAVE_ID_SECRET are set for Preview.
 *   - TEST_EMAIL is an address you control and have designated for testing.
 *
 * It asks for the emailed code on stdin. Nothing here deletes anything except
 * the test runs it creates. Refuses to run against the production hosts.
 */
import readline from 'node:readline/promises';

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const EMAIL = process.env.TEST_EMAIL || '';
if (!BASE || !EMAIL) { console.error('Set BASE_URL and TEST_EMAIL.'); process.exit(2); }
const host = new URL(BASE).host;
if (/^(www\.)?supplychaindisaster\.com$/i.test(host)) { console.error('Refusing to run against production.'); process.exit(2); }

const origin = new URL(BASE).origin;
let cookie = '';
let csrf = null;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

async function call(method, path, body, { auth = true, extraHeaders = {} } = {}) {
    const headers = { 'x-scd-client': '1', origin };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth && cookie) headers.cookie = cookie;
    if (auth && csrf) headers['x-scd-csrf'] = csrf;
    Object.assign(headers, extraHeaders);   // tests may override (e.g. a wrong CSRF token)
    const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const set = r.headers.get('set-cookie');
    if (set && /scd_sess=/.test(set)) cookie = set.split(';')[0];
    return { status: r.status, body: await r.json().catch(() => null), setCookie: set };
}

const snap = (turn) => ({ industryId: 'fmcg', saveVersion: 2, chapterIndex: 0, turn, maxTurns: 40, phase: 'PHASE_STORY', history: [], snapshot: { state: { turn, cash: 1000 + turn } } });
const meta = (turn) => ({ industryId: 'fmcg', chapterNumber: 1, turn, phase: 'PHASE_STORY', status: 'active' });

// 1. Sign in with a real emailed code
check('request code', (await call('POST', '/api/cloud-account', { action: 'request-code', email: EMAIL }, { auth: false })).status === 200);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question(`Code emailed to ${EMAIL}: `)).trim();
rl.close();
const v = await call('POST', '/api/cloud-account', { action: 'verify-code', email: EMAIL, code }, { auth: false });
check('verify code', v.status === 200 && v.body?.signedIn === true, `status ${v.status}`);
csrf = v.body?.csrf;
const sc = v.setCookie || '';
check('session cookie flags (HttpOnly, Secure, SameSite=Lax, Path=/api)', /HttpOnly/i.test(sc) && /Secure/i.test(sc) && /SameSite=Lax/i.test(sc) && /Path=\/api/i.test(sc), sc.replace(/scd_sess=[^;]+/, 'scd_sess=…'));
check('verification grants no purchase token', v.body && v.body.token === undefined && v.body.access === undefined);

// 2. CSRF + ownership
const runId = `smoke-${Date.now().toString(36)}`;
const noCsrf = await call('PUT', '/api/cloud-runs', { runId, expectedRev: 0, writeId: `w-${runId}-x`, meta: meta(1), snapshot: snap(1) }, { extraHeaders: { 'x-scd-csrf': 'wrong' } });
check('mutation without the CSRF token is refused', noCsrf.status === 403);
const anon = await fetch(`${BASE}/api/cloud-runs`, { headers: { origin } });
check('no session → 401', anon.status === 401);

// 3. Persistence across serverless invocations
const w1 = await call('PUT', '/api/cloud-runs', { runId, expectedRev: 0, writeId: `w-${runId}-1`, meta: meta(1), snapshot: snap(1) });
check('first write', w1.status === 200 && w1.body?.rev === 1, `status ${w1.status}`);
const g1 = await call('GET', `/api/cloud-runs?id=${runId}`);
check('read back from a separate invocation', g1.status === 200 && g1.body?.snapshot?.turn === 1 && g1.body?.rev === 1);

// 4. Atomic revision checks under concurrency (real KV)
const racers = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    call('PUT', '/api/cloud-runs', { runId, expectedRev: 1, writeId: `w-${runId}-r${i}`, meta: meta(10 + i), snapshot: snap(10 + i) })));
const winners = racers.filter(r => r.status === 200);
check('exactly one concurrent write wins', winners.length === 1, `statuses ${racers.map(r => r.status).join(',')}`);
const after = await call('GET', `/api/cloud-runs?id=${runId}`);
check('stored revision = 2 and matches the winner', after.body?.rev === 2 && after.body?.snapshot?.turn === 10 + racers.findIndex(r => r.status === 200));
const retry = await call('PUT', '/api/cloud-runs', { runId, expectedRev: 1, writeId: winners[0] ? `w-${runId}-r${racers.findIndex(r => r.status === 200)}` : 'none', meta: meta(0), snapshot: snap(0) });
check('retrying the winning write is idempotent', retry.status === 200 && retry.body?.duplicate === true && retry.body?.rev === 2);

// 5. Delete leaves a tombstone; late writes can't recreate it
const del = await call('DELETE', `/api/cloud-runs?id=${runId}&expectedRev=2`);
check('delete', del.status === 200 && del.body?.deleted === true);
const late = await call('PUT', '/api/cloud-runs', { runId, expectedRev: 2, writeId: `w-${runId}-late`, meta: meta(3), snapshot: snap(3) });
check('late write after delete → 410', late.status === 410);

// 6. Sign out
const so = await call('POST', '/api/cloud-account', { action: 'sign-out' });
check('sign out', so.status === 200);
check('session gone', (await call('GET', '/api/cloud-runs')).status === 401);

console.log('\nRetention (manual, needs the PREVIEW KV credentials): TTL of sv:idx:* and sv:run:* keys ≈ 31536000 s; sv:sess:* ≈ 2592000 s.');
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
