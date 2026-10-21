/**
 * Client access state.
 *
 * Sources (union):
 *   · a server-signed access token (from a verified purchase claim, an
 *     email-verified restore, or a refresh) — cached with its access summary
 *   · legacy local records written by earlier versions (scd_premium: paid Full
 *     Access or a time-limited promo) — honoured exactly as before
 *
 * LIMITATION (stated honestly): the game's content ships in the browser, so
 * these checks gate the UI, not the files. The server enforces access where a
 * protected action exists (leaderboard submission, token issuance) and
 * re-validates cached tokens so refunds and expiries take effect.
 */

import { PACKAGE, resolveAccess, canPlayChapter, hasFeature, hasPaidAccess, FREE_INTRO } from '../data/packages.js';

const CACHE_KEY   = 'scd_access_v1';      // { token, access, checkedAt }
const CLAIM_KEY   = 'scd_checkout_claim'; // { claimId, offer, startedAt, returnPath }
const LEGACY_KEY  = 'scd_premium';
const REFRESH_MS  = 6 * 60 * 60 * 1000;

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** Entitlements implied by records earlier versions of the game wrote locally. */
function legacyLocalEntitlements(now) {
    const p = read(LEGACY_KEY);
    if (!p?.active) return [];
    if (p.expiresAt) return p.expiresAt > now ? [{ package: PACKAGE.PROMO, status: 'active', expiresAt: new Date(p.expiresAt).toISOString() }] : [];
    return [{ package: PACKAGE.LEGACY_FULL, status: 'active', source: 'local' }];
}

/** Entitlement list from the cached server summary. */
function cachedEntitlements() {
    const c = read(CACHE_KEY);
    return (c?.access?.packages || []).filter(p => p !== PACKAGE.FREE_INTRO).map(p => ({ package: p, status: 'active' }));
}

const listeners = new Set();
const notify = () => listeners.forEach(fn => { try { fn(); } catch { /* listener errors are isolated */ } });

export const Entitlements = {
    /** Current access (synchronous, from cache + legacy records). */
    access(now = Date.now()) {
        return resolveAccess([...cachedEntitlements(), ...legacyLocalEntitlements(now)], now);
    },
    canPlay(industryId, chapterNumber) { return canPlayChapter(this.access(), industryId, chapterNumber); },
    has(feature) { return hasFeature(this.access(), feature); },
    hasPaid() { return hasPaidAccess(this.access()); },
    ownsCore() { const a = this.access(); return a.all || a.packages.includes(PACKAGE.CORE) || a.packages.includes(PACKAGE.MEMBERSHIP); },
    token() { return read(CACHE_KEY)?.token || null; },
    isFreeIntro(industryId, chapterNumber) { return industryId === FREE_INTRO.industryId && chapterNumber === FREE_INTRO.chapterNumber; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Store a server response { token, access }. */
    save({ token, access }) {
        if (!token) return;
        write(CACHE_KEY, { token, access, checkedAt: Date.now() });
        notify();
    },

    /** Re-validate the cached token with the server (refunds/expiry), at most every few hours. */
    async refresh({ force = false } = {}) {
        const c = read(CACHE_KEY);
        if (!c?.token || (!force && Date.now() - (c.checkedAt || 0) < REFRESH_MS)) return;
        try {
            const res = await post('/api/verify-subscription', { action: 'refresh', token: c.token });
            if (res.ok) this.save(await res.json());
            else if (res.status === 401) { write(CACHE_KEY, null); notify(); }   // invalid/expired token
        } catch { /* offline: keep cached access */ }
    },

    /* ── Purchase ─────────────────────────────────────────────── */

    /** Which offers can be bought right now ({ core, membership }). */
    async offerStatus() {
        try {
            const res = await fetch('/api/create-checkout');
            return res.ok ? await res.json() : { core: 'unavailable', membership: 'disabled' };
        } catch { return { core: 'unavailable', membership: 'disabled' }; }
    },

    /**
     * Ask the server for a checkout for an allowlisted offer key.
     * @returns {{ url } | { error }}
     */
    async startCheckout(offer = 'core', returnPath = '/play') {
        try {
            const res = await post('/api/create-checkout', { offer, returnPath });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) return { error: body.error || 'unavailable' };
            write(CLAIM_KEY, { claimId: body.claimId, offer, startedAt: Date.now(), returnPath });
            return { url: body.url };
        } catch {
            return { error: 'network' };
        }
    },

    pendingClaim() { return read(CLAIM_KEY); },
    clearClaim() { write(CLAIM_KEY, null); },

    /** Ask whether the pending checkout has been confirmed by a verified provider event. */
    async checkClaim() {
        const claim = read(CLAIM_KEY);
        if (!claim?.claimId) return { state: 'none' };
        try {
            const res = await post('/api/verify-subscription', { action: 'claim', claimId: claim.claimId });
            const body = await res.json().catch(() => ({}));
            if (res.status === 404) return { state: 'unknown' };
            if (!res.ok) return { state: 'error' };
            if (body.token) this.save(body);
            return body;
        } catch {
            return { state: 'error' };
        }
    },

    /* ── Restore (email-verified) ─────────────────────────────── */

    async requestCode(email) {
        const res = await post('/api/verify-subscription', { action: 'restore-request', email });
        return { ok: res.ok, error: res.ok ? null : (await res.json().catch(() => ({}))).error || 'error' };
    },

    async verifyCode(email, code) {
        const res = await post('/api/verify-subscription', { action: 'restore-verify', email, code });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: body.error || 'error' };
        this.save(body);
        return { ok: true, access: body.access };
    },
};

function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
