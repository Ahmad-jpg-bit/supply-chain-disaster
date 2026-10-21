/**
 * Entitlement ledger. The provider objects (orders, subscriptions) are the
 * source of truth; entitlements are DERIVED from stored records at read time,
 * so a refund or expiry only ever affects the purchase it belongs to and
 * nothing else (saved games and history live elsewhere and are never touched).
 *
 * Safety properties:
 *   · idempotent      — the same event applied twice changes nothing
 *   · order-safe      — an event older than the stored record (provider
 *                       updated_at) is ignored, so a late "created" can't undo a refund
 *   · isolated        — wrong store, wrong test/live mode or a variant outside the
 *                       allowlist is ignored and never grants anything
 */

import { PACKAGE } from '../../src/data/packages.js';
import { keys } from './store.js';

const GRANTING_ORDER_STATUSES = new Set(['paid', 'partial_refund']); // policy: partial refunds keep access
const CLAIM_TTL = 60 * 60 * 24 * 7;
const ts = (iso) => (iso ? Date.parse(iso) || 0 : 0);
const normEmail = (e) => String(e || '').trim().toLowerCase();

/** Validate a provider object against this deployment. Returns { ok, reason, package }. */
export function classify(cfg, attr) {
    if (!attr) return { ok: false, reason: 'missing_attributes' };
    if (!cfg.storeId || String(attr.store_id) !== String(cfg.storeId)) return { ok: false, reason: 'wrong_store' };
    if (Boolean(attr.test_mode) !== cfg.testMode) return { ok: false, reason: 'wrong_mode' };
    const variantId = String(attr.first_order_item?.variant_id ?? attr.variant_id ?? '');
    const pkg = cfg.variantPackages.get(variantId);
    if (!pkg) return { ok: false, reason: 'variant_not_allowlisted', variantId };
    return { ok: true, package: pkg, variantId };
}

async function linkToAccount(store, k, email, field, id) {
    const key = k.account(email);
    const acct = (await store.get(key)) || { email, orders: [], subs: [] };
    if (!acct[field].includes(id)) {
        acct[field].push(id);
        await store.set(key, acct);
    }
}

/**
 * Apply an Order object (from order_created / order_refunded webhooks or an
 * API reconciliation read).
 * @returns {{ result: 'applied'|'duplicate'|'stale'|'ignored', reason?, firstPaid?: boolean, record? }}
 */
export async function applyOrder(store, cfg, order, customData = {}) {
    const attr = order?.attributes;
    const c = classify(cfg, attr);
    if (!c.ok) return { result: 'ignored', reason: c.reason };
    const k = keys(cfg.mode);
    const orderId = String(order.id);
    const prev = await store.get(k.order(orderId));
    const incoming = {
        orderId,
        email: normEmail(attr.user_email),
        package: c.package,
        variantId: c.variantId,
        productId: String(attr.first_order_item?.product_id ?? ''),
        status: attr.status,
        refunded: Boolean(attr.refunded),
        updatedAt: attr.updated_at || attr.created_at || null,
        createdAt: attr.created_at || null,
        receiptUrl: attr.urls?.receipt || null,
        claimId: customData.claim_id || prev?.claimId || null,
    };
    if (prev) {
        if (ts(incoming.updatedAt) < ts(prev.updatedAt)) return { result: 'stale', record: prev };
        if (ts(incoming.updatedAt) === ts(prev.updatedAt) && incoming.status === prev.status) return { result: 'duplicate', record: prev };
    }
    const record = { ...prev, ...incoming };
    await store.set(k.order(orderId), record);
    if (record.email) await linkToAccount(store, k, record.email, 'orders', orderId);

    // Fulfil the buyer's checkout claim (secure guest association)
    if (record.claimId) {
        const claim = await store.get(k.claim(record.claimId));
        if (claim) await store.set(k.claim(record.claimId), { ...claim, orderId, email: record.email }, { ex: CLAIM_TTL });
    }
    const nowGrants = GRANTING_ORDER_STATUSES.has(record.status) && !record.refunded;
    const wasGranting = prev ? GRANTING_ORDER_STATUSES.has(prev.status) && !prev.refunded : false;
    return { result: 'applied', firstPaid: nowGrants && !wasGranting, record };
}

/** Apply a Subscription object (subscription_* webhooks or reconciliation). */
export async function applySubscription(store, cfg, sub, customData = {}) {
    const attr = sub?.attributes;
    const c = classify(cfg, attr);
    if (!c.ok) return { result: 'ignored', reason: c.reason };
    if (c.package !== PACKAGE.MEMBERSHIP) return { result: 'ignored', reason: 'not_a_membership_variant' };
    const k = keys(cfg.mode);
    const subId = String(sub.id);
    const prev = await store.get(k.sub(subId));
    const incoming = {
        subscriptionId: subId,
        email: normEmail(attr.user_email),
        package: PACKAGE.MEMBERSHIP,
        variantId: c.variantId,
        status: attr.status,
        renewsAt: attr.renews_at || null,
        endsAt: attr.ends_at || null,
        updatedAt: attr.updated_at || null,
        portalUrlAvailable: Boolean(attr.urls?.customer_portal),
        claimId: customData.claim_id || prev?.claimId || null,
    };
    if (prev) {
        if (ts(incoming.updatedAt) < ts(prev.updatedAt)) return { result: 'stale', record: prev };
        if (ts(incoming.updatedAt) === ts(prev.updatedAt) && incoming.status === prev.status) return { result: 'duplicate', record: prev };
    }
    const record = { ...prev, ...incoming };
    await store.set(k.sub(subId), record);
    if (record.email) await linkToAccount(store, k, record.email, 'subs', subId);
    if (record.claimId) {
        const claim = await store.get(k.claim(record.claimId));
        if (claim) await store.set(k.claim(record.claimId), { ...claim, subscriptionId: subId, email: record.email }, { ex: CLAIM_TTL });
    }
    return { result: 'applied', record };
}

/** Derive the current entitlement list for an email from stored records. */
export async function entitlementsFor(store, cfg, email) {
    const k = keys(cfg.mode);
    const acct = await store.get(k.account(normEmail(email)));
    if (!acct) return [];
    const out = [];
    for (const id of acct.orders || []) {
        const o = await store.get(k.order(id));
        if (!o) continue;
        const active = GRANTING_ORDER_STATUSES.has(o.status) && !o.refunded;
        out.push({ package: o.package, source: 'order', orderId: o.orderId, status: active ? 'active' : 'revoked' });
    }
    for (const id of acct.subs || []) {
        const s = await store.get(k.sub(id));
        if (!s) continue;
        out.push({ package: s.package, source: 'subscription', subscriptionId: s.subscriptionId, status: s.status, endsAt: s.endsAt, renewsAt: s.renewsAt });
    }
    return out;
}

/** Create a pending checkout claim (held only by the buyer's browser). */
export async function createClaim(store, cfg, claimId, offerKey) {
    await store.set(keys(cfg.mode).claim(claimId), { status: 'pending', offer: offerKey, createdAt: new Date().toISOString() }, { ex: CLAIM_TTL });
}

export async function readClaim(store, cfg, claimId) {
    if (!claimId || typeof claimId !== 'string' || claimId.length > 64) return null;
    return store.get(keys(cfg.mode).claim(claimId));
}
