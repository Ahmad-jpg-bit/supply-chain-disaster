// Billing: webhook verification, ledger safety, checkout allowlist, claims,
// email-verified restore and entitlement resolution. Fully offline — the
// store is in-memory and the Lemon Squeezy API is a stub. Test-only IDs
// below are fixtures, not real provider IDs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { memoryStore } from '../lib/billing/store.js';
import { billingConfig, offerUnavailableReason } from '../lib/billing/config.js';
import * as svc from '../lib/billing/service.js';
import { verifyToken } from '../lib/billing/tokens.js';
import {
    PACKAGE, FEATURE, OFFERS, CORE_CATALOG, FREE_INTRO, resolveAccess, canPlayChapter, hasFeature,
} from '../src/data/packages.js';
import { CHAPTERS } from '../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../src/data/expansion-chapters.js';
import { INDUSTRIES } from '../src/logic/industries.js';

const FIX = { store: '1001', core: '9001', coreProduct: '8001', legacy: '9002', monthly: '9101', annual: '9102', other: '7777' };
const ENV = {
    LEMONSQUEEZY_STORE_ID: FIX.store, LEMONSQUEEZY_TEST_MODE: 'true',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'whsec_test', ENTITLEMENT_TOKEN_SECRET: 'tok_test', LEMONSQUEEZY_API_KEY: 'key_test',
    LEMONSQUEEZY_CORE_PRODUCT_ID: FIX.coreProduct, LEMONSQUEEZY_CORE_VARIANT_ID: FIX.core,
    LEMONSQUEEZY_CORE_CHECKOUT_URL: 'https://example-store.lemonsqueezy.com/checkout/buy/test-core',
    LEMONSQUEEZY_STANDARD_VARIANT_ID: FIX.legacy,
    LEMONSQUEEZY_MEMBERSHIP_MONTHLY_VARIANT_ID: FIX.monthly, LEMONSQUEEZY_MEMBERSHIP_ANNUAL_VARIANT_ID: FIX.annual,
    LEMONSQUEEZY_MEMBERSHIP_MONTHLY_CHECKOUT_URL: 'https://example-store.lemonsqueezy.com/checkout/buy/test-monthly',
    CHALLENGE_MEMBERSHIP_ENABLED: 'false', APP_URL: 'https://app.test',
};
function withEnv(overrides, fn) {
    const saved = {};
    const all = { ...ENV, ...overrides };
    for (const k of new Set([...Object.keys(ENV), ...Object.keys(overrides)])) { saved[k] = process.env[k]; if (all[k] == null) delete process.env[k]; else process.env[k] = all[k]; }
    try { return fn(billingConfig()); } finally { for (const [k, v] of Object.entries(saved)) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
}
const cfgFor = (o = {}) => withEnv(o, (c) => c);

const order = (id, { status = 'paid', variant = FIX.core, email = 'buyer@example.com', updated = '2026-10-20T10:00:00Z', store = FIX.store, test = true, refunded = false } = {}) => ({
    type: 'orders', id: String(id),
    attributes: { store_id: Number(store), user_email: email, status, refunded, test_mode: test, created_at: '2026-10-20T09:59:00Z', updated_at: updated,
        first_order_item: { product_id: Number(FIX.coreProduct), variant_id: Number(variant), price: 1999 }, urls: { receipt: 'https://example/receipt' } },
});
const sub = (id, { status = 'active', variant = FIX.monthly, endsAt = null, updated = '2026-10-20T10:00:00Z', email = 'buyer@example.com' } = {}) => ({
    type: 'subscriptions', id: String(id),
    attributes: { store_id: Number(FIX.store), variant_id: Number(variant), user_email: email, status, ends_at: endsAt, renews_at: '2026-11-20T10:00:00Z', updated_at: updated, test_mode: true, urls: { customer_portal: 'https://example/portal' } },
});
const signed = (cfg, payload) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return { rawBody: raw, signature: crypto.createHmac('sha256', cfg.webhookSecret).update(raw).digest('hex') };
};
const event = (name, data, custom = {}) => ({ meta: { event_name: name, custom_data: custom }, data });
const send = (deps, name, data, custom) => svc.handleWebhook(deps, signed(deps.cfg, event(name, data, custom)));
const accessOf = async (deps, email = 'buyer@example.com') => {
    const { entitlementsFor } = await import('../lib/billing/ledger.js');
    return resolveAccess(await entitlementsFor(deps.store, deps.cfg, email));
};
const fresh = (o) => ({ store: memoryStore(), cfg: cfgFor(o) });

/* ── Packaging rules ───────────────────────────────────────────────── */

test('free intro: FMCG Chapter 1 only, replayable, nothing else', () => {
    const a = resolveAccess([]);
    assert.equal(canPlayChapter(a, 'fmcg', 1), true);
    assert.equal(canPlayChapter(a, 'fmcg', 2), false);
    assert.equal(canPlayChapter(a, 'pharma', 1), false);
    assert.equal(canPlayChapter(a, 'electronics', 1), false);
    assert.equal(hasFeature(a, FEATURE.REPLAY), true);
    for (const f of [FEATURE.ENDLESS, FEATURE.WEEKLY, FEATURE.CHAPTER_JUMP, FEATURE.ADVANCED_REPORT, FEATURE.CERTIFICATE]) assert.equal(hasFeature(a, f), false, f);
    assert.equal(FREE_INTRO.chapterId, CHAPTERS[0].id);
});

test('Core catalog is explicit and matches the published campaigns and chapters', () => {
    assert.deepEqual([...CORE_CATALOG.campaigns].sort(), Object.values(INDUSTRIES).map(i => i.id).sort());
    assert.deepEqual([...CORE_CATALOG.chapters], [...CHAPTERS, ...EXPANSION_CHAPTERS].map(c => c.id));
    const a = resolveAccess([{ package: PACKAGE.CORE, status: 'active' }]);
    for (const c of CORE_CATALOG.campaigns) assert.equal(canPlayChapter(a, c, 10), true);
    assert.equal(canPlayChapter(a, 'fmcg', 11), false, 'a future chapter is not silently added to Core');
    assert.equal(a.all, false);
    for (const f of CORE_CATALOG.features) assert.equal(hasFeature(a, f), true);
});

test('Core offer is $19.99 USD one-time; membership is $5.99/month and $39/year', () => {
    assert.deepEqual({ ...OFFERS.core }, { package: 'core', name: 'Core Game Pass', priceCents: 1999, currency: 'USD', billing: 'one_time' });
    assert.equal(OFFERS.membership_monthly.priceCents, 599);
    assert.equal(OFFERS.membership_monthly.interval, 'month');
    assert.equal(OFFERS.membership_annual.priceCents, 3900);
    assert.equal(OFFERS.membership_annual.interval, 'year');
});

test('legacy purchases keep everything previously promised (incl. future content); Starter keeps Ch 1–5', () => {
    const full = resolveAccess([{ package: PACKAGE.LEGACY_FULL, status: 'active' }]);
    assert.equal(full.all, true);
    assert.equal(canPlayChapter(full, 'pharma', 99), true);
    const starter = resolveAccess([{ package: PACKAGE.LEGACY_STARTER, status: 'active' }]);
    assert.equal(canPlayChapter(starter, 'electronics', 5), true);
    assert.equal(canPlayChapter(starter, 'electronics', 6), false);
});

/* ── Webhooks ──────────────────────────────────────────────────────── */

test('invalid or missing webhook signatures are rejected and grant nothing', async () => {
    const deps = fresh();
    const payload = event('order_created', order(1));
    const raw = Buffer.from(JSON.stringify(payload));
    for (const signature of [undefined, '', 'deadbeef', crypto.createHmac('sha256', 'wrong').update(raw).digest('hex')]) {
        const out = await svc.handleWebhook(deps, { rawBody: raw, signature });
        assert.equal(out.status, 401);
    }
    assert.equal((await accessOf(deps)).packages.includes(PACKAGE.CORE), false);
});

test('a verified Core order unlocks exactly the Core catalog', async () => {
    const deps = fresh();
    const out = await send(deps, 'order_created', order(10));
    assert.equal(out.status, 200);
    assert.equal(out.firstPaid.orderId, '10');
    const a = await accessOf(deps);
    assert.equal(canPlayChapter(a, 'pharma', 10), true);
    assert.equal(a.all, false);
});

test('duplicate webhooks are idempotent (one entitlement, one welcome email)', async () => {
    const deps = fresh();
    const first = await send(deps, 'order_created', order(11));
    const second = await send(deps, 'order_created', order(11));
    assert.ok(first.firstPaid);
    assert.equal(second.firstPaid, undefined);
    assert.equal(second.body.result, 'duplicate');
    const acct = await deps.store.get('test:bill:acct:buyer@example.com');
    assert.deepEqual(acct.orders, ['11']);
});

test('refund revokes only that purchase; out-of-order created-after-refund cannot re-grant', async () => {
    const deps = fresh();
    await send(deps, 'order_created', order(12));
    await send(deps, 'order_refunded', order(12, { status: 'refunded', refunded: true, updated: '2026-10-21T10:00:00Z' }));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 2), false);
    const late = await send(deps, 'order_created', order(12));          // stale (older updated_at)
    assert.equal(late.body.result, 'stale');
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 2), false);

    // Refund arriving BEFORE created (delayed delivery) — still revoked
    const d2 = fresh();
    await send(d2, 'order_refunded', order(13, { status: 'refunded', refunded: true, updated: '2026-10-21T10:00:00Z' }));
    await send(d2, 'order_created', order(13));
    assert.equal(canPlayChapter(await accessOf(d2), 'pharma', 2), false);
});

test('a refund of one purchase does not remove another valid purchase', async () => {
    const deps = fresh();
    await send(deps, 'order_created', order(14));
    await send(deps, 'order_created', order(15, { variant: FIX.legacy }));
    await send(deps, 'order_refunded', order(14, { status: 'refunded', refunded: true, updated: '2026-10-22T00:00:00Z' }));
    const a = await accessOf(deps);
    assert.equal(a.all, true, 'legacy Full Access remains');
});

test('wrong store, wrong test/live mode and non-allowlisted variants never grant access', async () => {
    const deps = fresh();
    assert.equal((await send(deps, 'order_created', order(20, { store: '2002' }))).body.result, 'ignored');
    assert.equal((await send(deps, 'order_created', order(21, { test: false }))).body.result, 'ignored');
    assert.equal((await send(deps, 'order_created', order(22, { variant: FIX.other }))).body.result, 'ignored');
    assert.equal((await accessOf(deps)).packages.length, 1);
});

/* ── Checkout + claims ─────────────────────────────────────────────── */

test('checkout uses only the server-configured Core URL and attaches a claim', async () => {
    const deps = fresh();
    const out = await svc.createCheckout(deps, { offer: 'core' });
    assert.equal(out.status, 200);
    const u = new URL(out.body.url);
    assert.equal(u.origin + u.pathname, ENV.LEMONSQUEEZY_CORE_CHECKOUT_URL);
    assert.equal(u.searchParams.get('checkout[custom][claim_id]'), out.body.claimId);
    assert.ok(u.searchParams.get('checkout[redirect_url]').startsWith('https://app.test/success'));
    assert.equal((await svc.createCheckout(deps, { offer: '9001' })).status, 400, 'raw variant IDs are not accepted');
    assert.equal((await svc.createCheckout(deps, { offer: 'core', price: 1 })).body.url.includes('price'), false);
});

test('membership checkout is blocked while disabled, even by direct request', async () => {
    const deps = fresh();
    for (const offer of ['membership_monthly', 'membership_annual']) {
        const out = await svc.createCheckout(deps, { offer });
        assert.equal(out.status, 403);
        assert.equal(out.body.error, 'membership_disabled');
    }
    assert.equal(svc.offerStatus(deps.cfg).membership, 'disabled');
    // Even with the flag on, an unconfigured annual plan stays unavailable
    const on = fresh({ CHALLENGE_MEMBERSHIP_ENABLED: 'true' });
    assert.equal((await svc.createCheckout(on, { offer: 'membership_monthly' })).status, 200);
    assert.equal(offerUnavailableReason(on.cfg, 'membership_annual'), 'not_configured');
});

test('missing Core configuration disables purchase gracefully', async () => {
    const deps = fresh({ LEMONSQUEEZY_CORE_VARIANT_ID: '', LEMONSQUEEZY_CORE_CHECKOUT_URL: '' });
    const out = await svc.createCheckout(deps, { offer: 'core' });
    assert.equal(out.status, 403);
    assert.equal(out.body.error, 'not_configured');
    assert.equal(svc.offerStatus(deps.cfg).core, 'unavailable');
});

test('a forged success visit / unknown claim never unlocks; delayed webhook stays pending, then activates', async () => {
    const deps = fresh();
    assert.equal((await svc.claimStatus(deps, { claimId: 'forged-claim' })).status, 404);
    const { body } = await svc.createCheckout(deps, { offer: 'core' });
    assert.equal((await svc.claimStatus(deps, { claimId: body.claimId })).body.state, 'pending', 'returning from checkout alone grants nothing');
    await send(deps, 'order_created', order(30, { email: 'Buyer@Example.com' }), { claim_id: body.claimId });
    const done = await svc.claimStatus(deps, { claimId: body.claimId });
    assert.equal(done.body.state, 'active');
    assert.equal(done.body.orderId, '30');
    const payload = verifyToken(done.body.token, deps.cfg.tokenSecret);
    assert.equal(payload.sub, 'buyer@example.com');
});

test('tokens: forged/expired tokens are refused; refresh picks up a refund', async () => {
    const deps = fresh();
    const { body } = await svc.createCheckout(deps, { offer: 'core' });
    await send(deps, 'order_created', order(31), { claim_id: body.claimId });
    const { token } = (await svc.claimStatus(deps, { claimId: body.claimId })).body;
    assert.equal((await svc.refresh(deps, { token: token.slice(0, -2) + 'xx' })).status, 401);
    assert.equal((await svc.refresh({ ...deps, now: Date.now() + 40 * 86400e3 }, { token })).status, 401);
    await send(deps, 'order_refunded', order(31, { status: 'refunded', refunded: true, updated: '2026-10-23T00:00:00Z' }));
    const r = await svc.refresh(deps, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.access.packages.includes('core'), false);
    // test-mode tokens are rejected by a live deployment
    const live = { ...deps, cfg: cfgFor({ LEMONSQUEEZY_TEST_MODE: 'false' }) };
    assert.equal((await svc.refresh(live, { token })).status, 401);
});

/* ── Email-verified restore (no unverified email unlocks) ──────────── */

test('restore requires the emailed code; reconciles with Lemon Squeezy (pre-ledger purchases)', async () => {
    const sent = [];
    const fetchFn = async (url) => ({
        ok: true, status: 200,
        json: async () => ({ data: url.includes('/orders') ? [order(40, { variant: FIX.legacy, email: 'old@example.com' })] : [] }),
    });
    const deps = { ...fresh(), fetchFn, sendEmail: async (e, code) => sent.push({ e, code }) };
    assert.equal((await svc.requestRestoreCode(deps, { email: 'old@example.com' })).status, 200);
    assert.equal(sent.length, 1);
    const wrong = await svc.verifyRestoreCode(deps, { email: 'old@example.com', code: sent[0].code === '000000' ? '111111' : '000000' });
    assert.equal(wrong.status, 400);
    const ok = await svc.verifyRestoreCode(deps, { email: 'old@example.com', code: sent[0].code });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.access.all, true, 'legacy Full Access restored');
    assert.equal((await svc.verifyRestoreCode(deps, { email: 'old@example.com', code: sent[0].code })).status, 400, 'codes are single-use');
});

test('restore codes are rate limited', async () => {
    const deps = { ...fresh(), sendEmail: async () => {} };
    let last;
    for (let i = 0; i < 6; i++) last = await svc.requestRestoreCode(deps, { email: 'x@example.com' });
    assert.equal(last.status, 429);
});

/* ── Membership lifecycle (prepared, disabled) ─────────────────────── */

test('membership: cancelled keeps access until ends_at; expiry ends it; past_due keeps it during dunning', async () => {
    const deps = fresh();
    await send(deps, 'subscription_created', sub(50));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 3), true);
    const future = new Date(Date.now() + 5 * 86400e3).toISOString();
    await send(deps, 'subscription_cancelled', sub(50, { status: 'cancelled', endsAt: future, updated: '2026-10-21T00:00:00Z' }));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 3), true, 'cancellation is not immediate expiry');
    await send(deps, 'subscription_updated', sub(50, { status: 'past_due', updated: '2026-10-22T00:00:00Z' }));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 3), true);
    await send(deps, 'subscription_expired', sub(50, { status: 'expired', endsAt: '2026-10-23T00:00:00Z', updated: '2026-10-23T00:00:00Z' }));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 3), false);
    await send(deps, 'subscription_updated', sub(50, { status: 'active', updated: '2026-10-22T12:00:00Z' }));
    assert.equal(canPlayChapter(await accessOf(deps), 'pharma', 3), false, 'an older event cannot resurrect it');
});

test('membership expiry does not remove separately purchased Core', async () => {
    const deps = fresh();
    await send(deps, 'order_created', order(60));
    await send(deps, 'subscription_created', sub(61));
    await send(deps, 'subscription_expired', sub(61, { status: 'expired', endsAt: '2026-10-21T00:00:00Z', updated: '2026-10-21T00:00:00Z' }));
    const a = await accessOf(deps);
    assert.equal(canPlayChapter(a, 'electronics', 10), true);
    assert.ok(a.packages.includes(PACKAGE.CORE));
    assert.ok(!a.packages.includes(PACKAGE.MEMBERSHIP));
});

test('rotating ENTITLEMENT_TOKEN_SECRET: with the old value as PREVIOUS, existing tokens keep working and refresh re-issues them', async () => {
    const deps = fresh();
    const { body } = await svc.createCheckout(deps, { offer: 'core' });
    await send(deps, 'order_created', order(40), { claim_id: body.claimId });
    const { token } = (await svc.claimStatus(deps, { claimId: body.claimId })).body;
    // New secret, old one kept for the grace period
    const rotated = { ...deps, cfg: cfgFor({ ENTITLEMENT_TOKEN_SECRET: 'tok_new', ENTITLEMENT_TOKEN_SECRET_PREVIOUS: 'tok_test' }) };
    assert.ok(hasFeature(svc.accessFromToken(rotated.cfg, token), FEATURE.WEEKLY), 'old token accepted during grace');
    const r = await svc.refresh(rotated, { token });
    assert.equal(r.status, 200);
    assert.ok(verifyToken(r.body.token, 'tok_new'), 're-issued with the new secret');
    assert.equal(verifyToken(r.body.token, 'tok_test'), null);
    // After the grace period (PREVIOUS removed) only new tokens verify; purchases themselves are untouched
    const after = { ...deps, cfg: cfgFor({ ENTITLEMENT_TOKEN_SECRET: 'tok_new' }) };
    assert.equal((await svc.refresh(after, { token })).status, 401, 'old token now needs a restore');
    assert.equal((await svc.refresh(after, { token: r.body.token })).status, 200);
    assert.equal((await accessOf(after)).packages.includes('core'), true, 'ledger unaffected by rotation');
});
