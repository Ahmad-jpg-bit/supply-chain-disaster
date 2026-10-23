// Community API: public play statistics + player ratings and reviews.
// One function on purpose (Vercel Hobby caps the project at 12).
//
// GET ?view=stats                → { campaigns, scenarios, since, rating } aggregates only (CDN-cached)
// GET ?view=reviews[&offset=N]   → published reviews, newest first, + aggregate (CDN-cached)
// GET ?view=mine                 → this account's review + eligibility (signed in)
// GET ?view=admin[&filter=…]     → moderation queue (REVIEW_ADMIN_EMAILS only)
// POST { action: 'progress', runId, industryId, chapterId, scenarioId, turn }  → count one completed quarter
// POST { action: 'review', rating, text?, displayName?, industryId? }          → create/replace own review
// POST { action: 'delete-review' }                                              → erase own review
// POST { action: 'report', id, reason }                                         → report a published review
// POST { action: 'moderate', id, decision, reason?, note? }                     → admin
// POST { action: 'reconcile' }                                                  → admin: recount stats from records
//
// Definitions, exclusions and limitations: docs/community-metrics.md

import { context, deps as makeDeps, send } from '../lib/cloud/http.js';
import { recordProgress, readCounts, reconcile } from '../lib/community/stats.js';
import {
    publicReviews, myReview, submitReview, deleteReview, reportReview, moderationQueue, moderate, isAdmin,
} from '../lib/community/reviews.js';
import { readSession, checkMutation } from '../lib/cloud/service.js';

const env = (n) => (process.env[n] ?? '').trim();

export function communityDeps(base) {
    return {
        ...base,
        // Only real production traffic is counted (never Preview, local or tests)
        countingEnabled: env('VERCEL_ENV') === 'production' && env('COMMUNITY_STATS_ENABLED').toLowerCase() !== 'false'
            || (env('SCD_DEV_MEMORY_STORE') === '1' && env('SCD_DEV_COUNT_STATS') === '1' && env('VERCEL_ENV') !== 'production'),
        adminEmails: env('REVIEW_ADMIN_EMAILS').split(',').map(x => x.trim()).filter(Boolean),
    };
}

export async function handle(deps, ctx, req) {
    const q = req.query || {};
    if (req.method === 'GET') {
        if (q.view === 'stats') {
            if (!deps.store) return { status: 200, body: { available: false }, cache: 60 };
            const [counts, reviews] = await Promise.all([readCounts(deps.store), publicReviews(deps, { offset: 0 })]);
            const agg = reviews.body.aggregate;
            return { status: 200, body: { available: true, ...counts, rating: agg?.count ? { average: agg.average, count: agg.count } : null }, cache: 300 };
        }
        if (q.view === 'reviews') { const r = await publicReviews(deps, { offset: q.offset }); return { ...r, cache: 60 }; }
        if (q.view === 'mine') return myReview(deps, ctx);
        if (q.view === 'admin') return moderationQueue(deps, ctx, { filter: ['pending', 'published', 'rejected', 'hidden', 'reported', 'all'].includes(q.filter) ? q.filter : 'pending' });
        return { status: 400, body: { error: 'unknown_view' } };
    }
    if (req.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };
    const b = req.body || {};
    switch (b.action) {
        case 'progress': {
            if (!deps.store) return { status: 202, body: { counted: false } };
            const bad = checkMutation(deps, ctx); if (bad) return bad;
            return recordProgress({ store: deps.store, countingEnabled: deps.countingEnabled, secret: deps.cfg.secret, now: deps.now }, ctx, b);
        }
        case 'review': return submitReview(deps, ctx, b);
        case 'delete-review': return deleteReview(deps, ctx);
        case 'report': return reportReview(deps, ctx, b);
        case 'moderate': return moderate(deps, ctx, b);
        case 'reconcile': {
            const s = deps.store && deps.cfg.secret ? await readSession(deps, ctx.sid) : null;
            if (!s) return { status: 401, body: { error: 'signed_out' } };
            const bad = checkMutation(deps, ctx, s); if (bad) return bad;
            if (!(await isAdmin(deps, s.owner))) return { status: 403, body: { error: 'not_admin' } };
            return { status: 200, body: await reconcile(deps.store) };
        }
        default: return { status: 400, body: { error: 'unknown_action' } };
    }
}

export default async function handler(req, res) {
    const deps = communityDeps(await makeDeps());
    const ctx = { ...context(req), userAgent: req.headers?.['user-agent'] || '' };
    let out;
    try { out = await handle(deps, ctx, req); }
    catch (e) {
        console.error('[community] error', e?.name || 'Error');
        out = { status: 500, body: { error: 'server_error' } };
    }
    if (out.cache && out.status === 200) {
        // Public aggregates only: cached by Vercel's CDN, never by the browser
        // (a browser-side stale-while-revalidate would show a player stale data after their own change)
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('Vercel-CDN-Cache-Control', `max-age=${out.cache}, stale-while-revalidate=${out.cache * 4}`);
        return res.status(out.status).json(out.body);
    }
    return send(res, out, deps.cfg);
}
