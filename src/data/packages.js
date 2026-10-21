/**
 * Package catalog and entitlement rules — shared by the game (browser) and
 * the billing API (server). Internal package IDs are stable and independent
 * of Lemon Squeezy product/variant IDs (those live in server config only).
 *
 * Access = the UNION of every valid entitlement a player holds.
 *
 * IMPORTANT: CORE_CATALOG is an explicit, frozen list. Publishing a new
 * campaign, chapter or mode does NOT add it to Core — a new catalog version
 * would be needed. Legacy Full Access (sold earlier as "every chapter, every
 * feature, lifetime updates") is the only package defined as "all content".
 */

export const PACKAGE = Object.freeze({
    FREE_INTRO:     'free_intro',
    CORE:           'core',
    MEMBERSHIP:     'challenge_membership',
    LEGACY_FULL:    'legacy_full_access',   // $49.99 Full Access + older Standard/Expansion tiers
    LEGACY_STARTER: 'legacy_starter',       // $19.99 Starter sold on play.supplychaindisaster.com
    PROMO:          'promo_full_access',    // time-limited promo code grant
});

export const FEATURE = Object.freeze({
    REPLAY:          'replay',
    CHAPTER_JUMP:    'chapter_jump',
    ENDLESS:         'endless',
    WEEKLY:          'weekly_challenge',
    ADVANCED_REPORT: 'advanced_report',
    CERTIFICATE:     'certificate',
});

/** The free introductory experience: FMCG, Chapter 1 (4 quarters), replayable. */
export const FREE_INTRO = Object.freeze({
    industryId:     'fmcg',
    chapterId:      'demand_forecasting',
    chapterNumber:  1,
    features:       Object.freeze([FEATURE.REPLAY]),
});

/** Explicit Core Game Pass scope (catalog version core-2026-10). */
export const CORE_CATALOG = Object.freeze({
    version:    'core-2026-10',
    campaigns:  Object.freeze(['fmcg', 'pharma', 'electronics']),   // industry campaign IDs
    chapters:   Object.freeze([                                    // chapter IDs, campaign order
        'demand_forecasting', 'bullwhip_effect', 'jit_safety_stock', 'risk_management',
        'total_cost_strategy', 'logistics_transportation', 'quality_management',
        'sustainability_circular', 'global_crisis_management', 'multi_regional_networks',
    ]),
    features:   Object.freeze([
        FEATURE.REPLAY, FEATURE.CHAPTER_JUMP, FEATURE.ENDLESS, FEATURE.WEEKLY,
        FEATURE.ADVANCED_REPORT, FEATURE.CERTIFICATE,
    ]),
});

/** Public offer facts (prices are what checkout must charge — verified server-side). */
export const OFFERS = Object.freeze({
    core: Object.freeze({
        package: PACKAGE.CORE, name: 'Core Game Pass',
        priceCents: 1999, currency: 'USD', billing: 'one_time',
    }),
    // Prepared, NOT launched — server flag CHALLENGE_MEMBERSHIP_ENABLED gates every path.
    membership_monthly: Object.freeze({
        package: PACKAGE.MEMBERSHIP, name: 'Challenge Membership (monthly)',
        priceCents: 599, currency: 'USD', billing: 'subscription', interval: 'month',
    }),
    membership_annual: Object.freeze({
        package: PACKAGE.MEMBERSHIP, name: 'Challenge Membership (annual)',
        priceCents: 3900, currency: 'USD', billing: 'subscription', interval: 'year',
    }),
});

/**
 * Lemon Squeezy subscription statuses that grant access. `cancelled` keeps
 * access until ends_at (documented grace period); `past_due` keeps access
 * while Lemon Squeezy retries payment (dunning, ~2 weeks). `unpaid`,
 * `expired` and `paused` do not.
 */
const ACTIVE_SUB_STATUSES = new Set(['on_trial', 'active', 'past_due', 'cancelled']);

export function subscriptionGrantsAccess(ent, now = Date.now()) {
    if (!ent || !ACTIVE_SUB_STATUSES.has(ent.status)) return false;
    if (ent.status === 'cancelled') return Boolean(ent.endsAt) && Date.parse(ent.endsAt) > now;
    return true;
}

/** Is a single entitlement record currently valid? */
export function entitlementIsValid(ent, now = Date.now()) {
    if (!ent || ent.status === 'revoked') return false;
    if (ent.package === PACKAGE.MEMBERSHIP) return subscriptionGrantsAccess(ent, now);
    if (ent.expiresAt && Date.parse(ent.expiresAt) <= now) return false;
    return Object.values(PACKAGE).includes(ent.package);
}

/**
 * Resolve the union of entitlements into concrete access.
 * @param {Array} entitlements — [{ package, status?, expiresAt?, endsAt? }]
 * @returns {{ all: boolean, campaigns: Object<string, number>, features: Set<string>, packages: string[] }}
 *   campaigns maps industryId → highest playable chapter NUMBER.
 */
export function resolveAccess(entitlements = [], now = Date.now()) {
    const access = {
        all: false,
        campaigns: { [FREE_INTRO.industryId]: FREE_INTRO.chapterNumber },
        features: new Set(FREE_INTRO.features),
        packages: [PACKAGE.FREE_INTRO],
    };
    const grantCore = () => {
        for (const c of CORE_CATALOG.campaigns) access.campaigns[c] = Math.max(access.campaigns[c] || 0, CORE_CATALOG.chapters.length);
        CORE_CATALOG.features.forEach(f => access.features.add(f));
    };
    for (const ent of entitlements) {
        if (!entitlementIsValid(ent, now)) continue;
        if (!access.packages.includes(ent.package)) access.packages.push(ent.package);
        switch (ent.package) {
            case PACKAGE.CORE:
            case PACKAGE.MEMBERSHIP:
                grantCore();
                break;
            case PACKAGE.LEGACY_FULL:
            case PACKAGE.PROMO:
                // Previously sold/granted as every chapter and every feature
                access.all = true;
                grantCore();
                break;
            case PACKAGE.LEGACY_STARTER:
                // Previously sold as Chapters 1–5
                for (const c of CORE_CATALOG.campaigns) access.campaigns[c] = Math.max(access.campaigns[c] || 0, 5);
                break;
        }
    }
    return access;
}

/** Can this access play the given industry campaign at the given chapter number? */
export function canPlayChapter(access, industryId, chapterNumber) {
    if (access.all) return true;
    return (access.campaigns[industryId] || 0) >= chapterNumber;
}

export function hasFeature(access, feature) {
    return access.all || access.features.has(feature);
}

/** True when access includes anything beyond the free intro. */
export function hasPaidAccess(access) {
    return access.packages.some(p => p !== PACKAGE.FREE_INTRO);
}
