// Code emails: a provider rejection must never look like "code sent", and
// nothing sensitive (code, address, API key, provider message) may reach the
// response or the logs. Resend's HTTP API is stubbed at fetch — no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../lib/billing/store.js';
import * as svc from '../lib/cloud/service.js';

const KEY = 're_test_SECRET_KEY_value';
const PROVIDER_MESSAGE = `API key is invalid: ${KEY}`;
const realFetch = globalThis.fetch;
const sentBodies = [];

/** Stub only api.resend.com: 'reject' → 422 validation_error, 'accept' → 200 { id }. */
function stubResend(mode) {
    sentBodies.length = 0;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(typeof input === 'string' ? input : input.url);
        if (!url.startsWith('https://api.resend.com/')) return realFetch(input, init);
        sentBodies.push(JSON.parse(init.body || '{}'));
        const body = mode === 'reject'
            ? { statusCode: 422, name: 'validation_error', message: PROVIDER_MESSAGE }
            : { id: 'email_123' };
        return new Response(JSON.stringify(body), { status: mode === 'reject' ? 422 : 200, headers: { 'content-type': 'application/json' } });
    };
}
function withEnv(vars, fn) {
    const saved = { ...process.env };
    Object.assign(process.env, vars);
    for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
    return Promise.resolve().then(fn).finally(() => { process.env = saved; globalThis.fetch = realFetch; });
}
function captureErrors() {
    const lines = [];
    const orig = console.error;
    console.error = (...a) => { lines.push(a.map(String).join(' ')); };
    return { lines, restore: () => { console.error = orig; } };
}
const leaks = (text, code, email) => [code, email, KEY, PROVIDER_MESSAGE].filter(s => s && text.includes(s));

/* ── Cloud-save sign-in codes (lib/cloud/http.js sendCode via requestCode) ── */

const ORIGIN = 'https://www.supplychaindisaster.com';
const ctx = { ip: '1.1.1.1', origin: ORIGIN, clientHeader: '1', sid: null, csrf: null };
const cloudDeps = async () => {
    const { sendCode } = await (await import('../lib/cloud/http.js')).deps();
    return { store: memoryStore(), cfg: { secret: 'email-test', origins: new Set([ORIGIN]), enabled: true }, sendCode };
};

test('cloud codes: a rejected send is an error, never { sent: true }', () => withEnv({ RESEND_API_KEY: KEY, SCD_DEV_MEMORY_STORE: undefined }, async () => {
    stubResend('reject');
    const deps = await cloudDeps();
    const err = await svc.requestCode(deps, ctx, { email: 'player@example.com' }).then(() => null, e => e);
    assert.ok(err, 'requestCode must reject');
    assert.equal(err.name, 'EmailSendError');
    assert.equal(err.message, 'email send failed: validation_error', 'only the provider error NAME is kept');
    const code = /(\d{6})/.exec(sentBodies[0]?.subject || '')?.[1];
    assert.ok(code, 'the request did reach the provider');
    assert.deepEqual(leaks(`${err.message} ${err.stack}`, code, 'player@example.com'), []);
}));

test('cloud codes: an accepted send follows the normal flow', () => withEnv({ RESEND_API_KEY: KEY, SCD_DEV_MEMORY_STORE: undefined }, async () => {
    stubResend('accept');
    const out = await svc.requestCode(await cloudDeps(), ctx, { email: 'player@example.com' });
    assert.deepEqual([out.status, out.body], [200, { sent: true }]);
    assert.equal(sentBodies.length, 1);
    assert.deepEqual(sentBodies[0].to, 'player@example.com');
}));

test('cloud-account handler: a thrown send error becomes a generic 500 and a name-only log line', async () => {
    // The handler's catch is what users and logs see for any thrown error (EmailSendError included)
    const src = (await import('node:fs')).readFileSync(new URL('../api/cloud-account.js', import.meta.url), 'utf8');
    assert.match(src, /catch \(e\) \{\s*console\.error\('\[cloud-account\] error', e\?\.name \|\| 'Error'\);\s*out = \{ status: 500, body: \{ error: 'server_error' \} \};/);
});

/* ── Purchase-restore codes (api/verify-subscription.js, real handler) ── */

async function restoreRequest() {
    const handler = (await import('../api/verify-subscription.js')).default;
    let status = 0, body = null;
    const res = { status: (s) => { status = s; return res; }, json: (b) => { body = b; return res; }, setHeader() {} };
    await handler({ method: 'POST', headers: {}, body: { action: 'restore-request', email: 'buyer@example.com' } }, res);
    return { status, body };
}
const RESTORE_ENV = { RESEND_API_KEY: KEY, SCD_DEV_MEMORY_STORE: '1', ENTITLEMENT_TOKEN_SECRET: 'email-test-token', VERCEL_ENV: undefined, KV_REST_API_URL: undefined };

test('restore codes: a rejected send answers 500 server_error; logs carry no code, address, key or provider text', () => withEnv(RESTORE_ENV, async () => {
    stubResend('reject');
    const cap = captureErrors();
    let out;
    try { out = await restoreRequest(); } finally { cap.restore(); }
    assert.deepEqual([out.status, out.body], [500, { error: 'server_error' }]);
    const code = /(\d{6})/.exec(sentBodies[0]?.subject || '')?.[1];
    assert.ok(code);
    const logged = cap.lines.join('\n');
    assert.match(logged, /email send failed: validation_error/);
    assert.deepEqual(leaks(logged + JSON.stringify(out.body), code, 'buyer@example.com'), []);
}));

test('restore codes: an accepted send answers { sent: true }', () => withEnv(RESTORE_ENV, async () => {
    stubResend('accept');
    const out = await restoreRequest();
    assert.deepEqual([out.status, out.body], [200, { sent: true }]);
    assert.equal(sentBodies.length, 1);
}));
