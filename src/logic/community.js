/**
 * Client side of /api/community: play statistics, reviews, the review draft
 * and the review prompt's dismissals.
 *
 * Progress events are operational counts (no personal data, no cookies,
 * separate from GA4). They're skipped for automated browsers and for anyone
 * who opted out with ?stats=off (the owner's and testers' own play);
 * ?stats=on clears that. The server only counts real production traffic.
 */

import * as CS from './cloud-sync.js';

const OPTOUT_KEY = 'scd_stats_optout';
const DRAFT_KEY = 'scd_review_draft';
const PROMPT_KEY = 'scd_review_prompt';
const API = '/api/community';

let fetchFn = (...a) => globalThis.fetch(...a);
/** Tests: inject fetch. */
export function _setFetch(f) { fetchFn = f; }

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

async function call(method, { query = '', body } = {}) {
    const headers = { 'x-scd-client': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const csrf = CS.getSession().csrf;
    if (csrf) headers['x-scd-csrf'] = csrf;
    try {
        const res = await fetchFn(`${API}${query}`, { method, headers, credentials: 'same-origin', keepalive: body?.action === 'progress', body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    } catch {
        return { status: 0, body: { error: 'network' } };
    }
}

/* ── Statistics ─────────────────────────────────────────────────────── */

/** Apply ?stats=off / ?stats=on (call once on page load). */
export function applyStatsParam(search = globalThis.location?.search || '') {
    const v = new URLSearchParams(search).get('stats');
    if (v === 'off') write(OPTOUT_KEY, true);
    if (v === 'on') write(OPTOUT_KEY, null);
}

export const statsOptedOut = () => read(OPTOUT_KEY, false) === true;

/** Report one completed quarter of a campaign (fire and forget). */
export function recordQuarter({ runId, industryId, chapterId, scenarioId, turn }) {
    if (!runId || !scenarioId || statsOptedOut() || globalThis.navigator?.webdriver) return null;
    return call('POST', { body: { action: 'progress', runId, industryId, chapterId, scenarioId, turn } });
}

let statsPromise = null;
/** Public aggregates (cached per page load; never throws). null when unavailable. */
export function fetchStats() {
    statsPromise ||= call('GET', { query: '?view=stats' }).then(r => (r.status === 200 && r.body.available ? r.body : null));
    return statsPromise;
}

/* ── Reviews ────────────────────────────────────────────────────────── */

export async function fetchReviews(offset = 0) {
    const r = await call('GET', { query: `?view=reviews&offset=${Number(offset) || 0}` });
    return r.status === 200 && r.body.available ? r.body : null;
}

/** This account's review + eligibility, or { signedIn: false }. */
export async function fetchMine() {
    if (!CS.getSession().signedIn) return { signedIn: false };
    const r = await call('GET', { query: '?view=mine' });
    if (r.status === 401) return { signedIn: false };
    if (r.status !== 200) return { error: r.body.error || 'network' };
    return { signedIn: true, ...r.body };
}

export async function submitReview({ rating, text, displayName, industryId }) {
    const r = await call('POST', { body: { action: 'review', rating, text, displayName, industryId } });
    if (r.status === 200) { clearDraft(); markReviewed(); statsPromise = null; }
    return r.status === 200 ? { ok: true, ...r.body } : { ok: false, error: r.body.error || 'network' };
}

export async function deleteReview() {
    const r = await call('POST', { body: { action: 'delete-review' } });
    if (r.status === 200) statsPromise = null;
    return r.status === 200 ? { ok: true } : { ok: false, error: r.body.error || 'network' };
}

export async function reportReview(id, reason) {
    const r = await call('POST', { body: { action: 'report', id, reason } });
    return r.status === 200 ? { ok: true } : { ok: false, error: r.body.error || 'network' };
}

/** Admin only (server checks): moderation queue, decisions, stats recount. */
export const admin = {
    queue: (filter) => call('GET', { query: `?view=admin&filter=${encodeURIComponent(filter)}` }),
    moderate: (id, decision, reason, note) => call('POST', { body: { action: 'moderate', id, decision, reason, note } }),
    reconcile: () => call('POST', { body: { action: 'reconcile' } }),
};

/* ── Draft (kept on this device until posted, so it survives email verification) ── */

export const loadDraft = () => read(DRAFT_KEY, null);
export function saveDraft(d) { return write(DRAFT_KEY, { rating: d.rating || null, text: d.text || '', displayName: d.displayName || '', industryId: d.industryId || null, savedAt: Date.now() }); }
export function clearDraft() { write(DRAFT_KEY, null); }

/* ── Prompt state ───────────────────────────────────────────────────── */

/**
 * Show the review prompt at a milestone (free intro complete, campaign
 * complete) unless this run already showed it and the player chose "Not now",
 * or they've already posted a review from this browser.
 */
export function shouldPrompt(runId) {
    const p = read(PROMPT_KEY, {});
    if (p.reviewed) return false;
    return !(p.dismissedRuns || []).includes(runId);
}
export function dismissPrompt(runId) {
    const p = read(PROMPT_KEY, {});
    write(PROMPT_KEY, { ...p, dismissedRuns: [...new Set([...(p.dismissedRuns || []), runId])].slice(-50) });
}
function markReviewed() { write(PROMPT_KEY, { ...read(PROMPT_KEY, {}), reviewed: true }); }
