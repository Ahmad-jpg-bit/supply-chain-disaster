/**
 * Billing service — every operation the billing API exposes, with its
 * dependencies injected ({ store, cfg, fetchFn, sendEmail, now }) so the full
 * checkout → webhook → access flow is testable offline.
 *
 * Nothing here trusts the browser for prices, product IDs, ownership or
 * payment success: checkout targets come from the server allowlist, access
 * comes only from verified provider events or authenticated provider reads,
 * and email-based recovery requires a one-time code sent to that inbox.
 */

import crypto from 'crypto';
import { resolveAccess } from '../../src/data/packages.js';
import { offerUnavailableReason } from './config.js';
import { keys } from './store.js';
import { applyOrder, applySubscription, entitlementsFor, createClaim, readClaim } from './ledger.js';
import { signToken, verifyToken, verifyWebhookSignature, randomId } from './tokens.js';

const LS_API = 'https://api.lemonsqueezy.com/v1';
const OTP_TTL = 10 * 60;
const OTP_MAX_SENDS_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e) => String(e || '').trim().toLowerCase();
const log = (...a) => console.log('[billing]', ...a);

/** Public summary of access (never includes provider IDs beyond the order ID the buyer already has). */
function summarize(ents, now) {
    const access = resolveAccess(ents, now);
    return {
        packages: access.packages,
        all: access.all,
        campaigns: access.campaigns,
        features: [...access.features],
    };
}

async function issue(deps, email) {
    const { store, cfg, now = Date.now() } = deps;
    const ents = await entitlementsFor(store, cfg, email);
    const token = signToken({ sub: norm(email), mode: cfg.mode, ents }, cfg.tokenSecret);
    return { token, access: summarize(ents, now) };
}

/* ── Webhook ─────────────────────────────────────────────────────────── */

/**
 * @returns {{ status: number, body: Object, firstPaid?: Object }} — firstPaid
 *   is set the first time an order becomes paid (send the welcome email then).
 */
export async function handleWebhook(deps, { rawBody, signature }) {
    const { store, cfg } = deps;
    if (!cfg.webhookSecret) return { status: 500, body: { error: 'not_configured' } };
    if (!verifyWebhookSignature(rawBody, signature, cfg.webhookSecret)) {
        log('rejected webhook: bad signature');
        return { status: 401, body: { error: 'invalid_signature' } };
    }
    if (!store) return { status: 503, body: { error: 'store_unavailable' } }; // non-2xx → provider retries
    let event;
    try { event = JSON.parse(Buffer.from(rawBody).toString('utf8')); }
    catch { return { status: 400, body: { error: 'malformed' } }; }

    const name = event?.meta?.event_name || '';
    const custom = event?.meta?.custom_data || {};
    const data = event?.data;
    let outcome;
    if (name === 'order_created' || name === 'order_refunded') {
        outcome = await applyOrder(store, cfg, data, custom);
    } else if (/^subscription_(created|updated|cancelled|resumed|expired|paused|unpaused)$/.test(name)) {
        outcome = await applySubscription(store, cfg, data, custom);
    } else {
        // Payment-invoice events: access follows the subscription object, which
        // Lemon Squeezy sends separately via subscription_updated.
        outcome = { result: 'ignored', reason: 'event_not_used' };
    }
    log('webhook', name, 'id', data?.id ?? '-', '→', outcome.result, outcome.reason || '');
    const body = { received: true, result: outcome.result };
    return outcome.firstPaid ? { status: 200, body, firstPaid: outcome.record } : { status: 200, body };
}

/* ── Checkout ────────────────────────────────────────────────────────── */

export async function createCheckout(deps, { offer, returnPath = '/play' }) {
    const { store, cfg } = deps;
    const offerKey = typeof offer === 'string' ? offer : '';
    const reason = offerUnavailableReason(cfg, offerKey);
    if (reason) return { status: reason === 'unknown_offer' ? 400 : 403, body: { error: reason } };
    if (!store) return { status: 503, body: { error: 'not_configured' } };

    const claimId = randomId(18);
    await createClaim(store, cfg, claimId, offerKey);
    const safeReturn = /^\/[a-zA-Z0-9/_-]*$/.test(returnPath) ? returnPath : '/play';
    const redirect = `${cfg.appUrl}/success?return=${encodeURIComponent(safeReturn)}`;
    const url = new URL(cfg.offers[offerKey].checkoutUrl);
    url.searchParams.set('checkout[custom][claim_id]', claimId);
    url.searchParams.set('checkout[redirect_url]', redirect);
    return { status: 200, body: { url: url.toString(), claimId, offer: offerKey } };
}

/** Is a checkout claim fulfilled by a verified purchase yet? */
export async function claimStatus(deps, { claimId }) {
    const { store, cfg } = deps;
    if (!store || !cfg.tokenSecret) return { status: 503, body: { error: 'not_configured' } };
    const claim = await readClaim(store, cfg, claimId);
    if (!claim) return { status: 404, body: { state: 'unknown' } };
    if (!claim.email) return { status: 200, body: { state: 'pending' } };
    const { token, access } = await issue(deps, claim.email);
    const granted = access.packages.length > 1;
    return { status: 200, body: { state: granted ? 'active' : 'not_active', token, access, orderId: claim.orderId || null } };
}

/** Verify with the current secret, then any former ones (rotation grace period). */
function verifyAnyToken(cfg, token, now) {
    for (const secret of [cfg.tokenSecret, ...(cfg.tokenSecretsPrevious || [])]) {
        const payload = verifyToken(token, secret, now);
        if (payload) return payload;
    }
    return null;
}

/** Re-validate a token against the ledger (picks up refunds/expiry) and re-issue it with the current secret. */
export async function refresh(deps, { token }) {
    const { store, cfg } = deps;
    if (!store || !cfg.tokenSecret) return { status: 503, body: { error: 'not_configured' } };
    const payload = verifyAnyToken(cfg, token, deps.now);
    if (!payload || payload.mode !== cfg.mode) return { status: 401, body: { error: 'invalid_token' } };
    return { status: 200, body: await issue(deps, payload.sub) };
}

/** Verify a token and resolve its access (for server-side checks such as the leaderboard). */
export function accessFromToken(cfg, token, now = Date.now()) {
    const payload = verifyAnyToken(cfg, token, now);
    if (!payload || payload.mode !== cfg.mode) return null;
    return resolveAccess(payload.ents || [], now);
}

/* ── Email-verified restore ──────────────────────────────────────────── */

export async function requestRestoreCode(deps, { email }) {
    const { store, cfg, sendEmail } = deps;
    if (!store || !cfg.tokenSecret) return { status: 503, body: { error: 'not_configured' } };
    const e = norm(email);
    if (!EMAIL_RE.test(e)) return { status: 400, body: { error: 'invalid_email' } };
    const k = keys(cfg.mode);
    const sends = await store.incr(k.rate('otp', e), 3600);
    if (sends > OTP_MAX_SENDS_PER_HOUR) return { status: 429, body: { error: 'rate_limited' } };
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const hash = crypto.createHash('sha256').update(`${e}:${code}`).digest('hex');
    await store.set(k.otp(e), { hash, attempts: 0 }, { ex: OTP_TTL });
    await sendEmail?.(e, code);
    // Same response whether or not a purchase exists (no account enumeration)
    return { status: 200, body: { sent: true } };
}

export async function verifyRestoreCode(deps, { email, code }) {
    const { store, cfg } = deps;
    if (!store || !cfg.tokenSecret) return { status: 503, body: { error: 'not_configured' } };
    const e = norm(email);
    const k = keys(cfg.mode);
    const rec = await store.get(k.otp(e));
    if (!rec) return { status: 400, body: { error: 'code_expired' } };
    if (rec.attempts >= OTP_MAX_ATTEMPTS) { await store.del(k.otp(e)); return { status: 429, body: { error: 'too_many_attempts' } }; }
    const hash = crypto.createHash('sha256').update(`${e}:${String(code || '').trim()}`).digest('hex');
    if (hash !== rec.hash) {
        await store.set(k.otp(e), { ...rec, attempts: rec.attempts + 1 }, { ex: OTP_TTL });
        return { status: 400, body: { error: 'wrong_code' } };
    }
    await store.del(k.otp(e));
    const reconciled = await reconcileEmail(deps, e);
    const out = await issue(deps, e);
    return { status: 200, body: { ...out, reconciled } };
}

/**
 * Reconcile an email's purchases with Lemon Squeezy (authoritative provider
 * state). Covers purchases made before the ledger existed and missed webhooks.
 * @returns {'ok'|'unavailable'}
 */
export async function reconcileEmail(deps, email) {
    const { store, cfg, fetchFn = fetch } = deps;
    if (!cfg.apiKey || !cfg.storeId) return 'unavailable';
    const headers = { Authorization: `Bearer ${cfg.apiKey}`, Accept: 'application/vnd.api+json' };
    const q = (path) => `${LS_API}${path}${path.includes('?') ? '&' : '?'}filter[store_id]=${encodeURIComponent(cfg.storeId)}&filter[user_email]=${encodeURIComponent(email)}`;
    try {
        const [orders, subs] = await Promise.all([
            fetchFn(q('/orders?page[size]=100'), { headers }),
            fetchFn(q('/subscriptions?page[size]=100'), { headers }),
        ]);
        if (!orders.ok) { log('reconcile orders failed', orders.status); return 'unavailable'; }
        for (const o of (await orders.json()).data || []) await applyOrder(store, cfg, o);
        if (subs.ok) for (const s of (await subs.json()).data || []) await applySubscription(store, cfg, s);
        return 'ok';
    } catch (err) {
        log('reconcile error', err?.message);
        return 'unavailable';
    }
}

/** Public, non-secret status of what can be bought right now. */
export function offerStatus(cfg) {
    return {
        core: offerUnavailableReason(cfg, 'core') ? 'unavailable' : 'available',
        membership: cfg.membershipEnabled ? 'enabled' : 'disabled',
        mode: cfg.mode,
    };
}
