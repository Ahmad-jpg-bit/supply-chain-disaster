/**
 * Server-side billing configuration. Provider IDs come ONLY from environment
 * variables (never from the client) and are mapped to stable internal
 * package IDs through an explicit allowlist.
 *
 * Env (see .env.example):
 *   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_WEBHOOK_SECRET   — secrets
 *   LEMONSQUEEZY_STORE_ID                               — store every event/order must belong to
 *   LEMONSQUEEZY_TEST_MODE=true|false                   — which provider environment this deployment accepts
 *   LEMONSQUEEZY_CORE_PRODUCT_ID / _VARIANT_ID / _CHECKOUT_URL
 *   LEMONSQUEEZY_MEMBERSHIP_PRODUCT_ID / _MONTHLY_VARIANT_ID / _ANNUAL_VARIANT_ID / _MONTHLY_CHECKOUT_URL / _ANNUAL_CHECKOUT_URL
 *   CHALLENGE_MEMBERSHIP_ENABLED=false                  — membership kill switch (server-enforced)
 *   LEMONSQUEEZY_STANDARD_VARIANT_ID, LEMONSQUEEZY_EXPANSION_VARIANT_ID — legacy Full Access (honoured)
 *   LEMONSQUEEZY_LEGACY_STARTER_VARIANT_ID              — legacy $19.99 Starter (honoured)
 *   ENTITLEMENT_TOKEN_SECRET                            — signs access tokens
 *   ENTITLEMENT_TOKEN_SECRET_PREVIOUS                   — former values, accepted during rotation
 */

import { PACKAGE, OFFERS } from '../../src/data/packages.js';

const env = (name) => (process.env[name] ?? '').trim();

export function billingConfig() {
    const testMode = env('LEMONSQUEEZY_TEST_MODE') === 'true';
    const variantPackages = new Map();
    const add = (id, pkg) => { if (id) variantPackages.set(String(id), pkg); };
    add(env('LEMONSQUEEZY_CORE_VARIANT_ID'), PACKAGE.CORE);
    add(env('LEMONSQUEEZY_STANDARD_VARIANT_ID'), PACKAGE.LEGACY_FULL);
    add(env('LEMONSQUEEZY_EXPANSION_VARIANT_ID'), PACKAGE.LEGACY_FULL);
    add(env('LEMONSQUEEZY_LEGACY_STARTER_VARIANT_ID'), PACKAGE.LEGACY_STARTER);
    add(env('LEMONSQUEEZY_MEMBERSHIP_MONTHLY_VARIANT_ID'), PACKAGE.MEMBERSHIP);
    add(env('LEMONSQUEEZY_MEMBERSHIP_ANNUAL_VARIANT_ID'), PACKAGE.MEMBERSHIP);

    return {
        mode: testMode ? 'test' : 'live',
        testMode,
        storeId: env('LEMONSQUEEZY_STORE_ID'),
        apiKey: env('LEMONSQUEEZY_API_KEY'),
        webhookSecret: env('LEMONSQUEEZY_WEBHOOK_SECRET'),
        tokenSecret: env('ENTITLEMENT_TOKEN_SECRET'),
        // Rotation grace: tokens signed with these still verify; refresh re-issues them with the current secret
        tokenSecretsPrevious: env('ENTITLEMENT_TOKEN_SECRET_PREVIOUS').split(',').map(x => x.trim()).filter(Boolean),
        appUrl: env('APP_URL') || 'https://www.supplychaindisaster.com',
        membershipEnabled: env('CHALLENGE_MEMBERSHIP_ENABLED') === 'true',
        variantPackages,
        // Purchasable offers → the only checkout targets the API will ever open
        offers: {
            core: {
                ...OFFERS.core,
                productId: env('LEMONSQUEEZY_CORE_PRODUCT_ID'),
                variantId: env('LEMONSQUEEZY_CORE_VARIANT_ID'),
                checkoutUrl: env('LEMONSQUEEZY_CORE_CHECKOUT_URL'),
            },
            membership_monthly: {
                ...OFFERS.membership_monthly,
                productId: env('LEMONSQUEEZY_MEMBERSHIP_PRODUCT_ID'),
                variantId: env('LEMONSQUEEZY_MEMBERSHIP_MONTHLY_VARIANT_ID'),
                checkoutUrl: env('LEMONSQUEEZY_MEMBERSHIP_MONTHLY_CHECKOUT_URL'),
            },
            membership_annual: {
                ...OFFERS.membership_annual,
                productId: env('LEMONSQUEEZY_MEMBERSHIP_PRODUCT_ID'),
                variantId: env('LEMONSQUEEZY_MEMBERSHIP_ANNUAL_VARIANT_ID'),
                checkoutUrl: env('LEMONSQUEEZY_MEMBERSHIP_ANNUAL_CHECKOUT_URL'),
            },
        },
    };
}

/** A hosted checkout URL is only usable if it is an https Lemon Squeezy buy link. */
export function isValidCheckoutUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && /\.lemonsqueezy\.com$/.test(u.hostname) && u.pathname.startsWith('/checkout/buy/');
    } catch {
        return false;
    }
}

/** Why an offer can't be sold right now (null = sellable). Never exposes IDs. */
export function offerUnavailableReason(cfg, offerKey) {
    const offer = cfg.offers[offerKey];
    if (!offer) return 'unknown_offer';
    if (offer.package === PACKAGE.MEMBERSHIP && !cfg.membershipEnabled) return 'membership_disabled';
    if (!cfg.storeId || !offer.variantId || !isValidCheckoutUrl(offer.checkoutUrl)) return 'not_configured';
    if (!cfg.webhookSecret || !cfg.tokenSecret) return 'not_configured';
    return null;
}
