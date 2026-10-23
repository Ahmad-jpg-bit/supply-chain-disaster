/**
 * Player ratings and written reviews.
 *
 * Who can review: a verified cloud-save account (email code → session; see
 * lib/cloud) whose cloud campaigns include at least one completed quarter.
 * That cloud record is also what substantiates the public "Played a scenario"
 * label. One current review per account; editing replaces it, deleting erases
 * its text.
 *
 * Moderation policy (also shown to players):
 *   - Rating-only reviews publish immediately (no text to moderate).
 *   - Reviews with text start as "pending" and appear only once published.
 *   - Any edit of a review with text returns it to "pending"; it leaves the
 *     public list and the average until published again. A rating-only edit
 *     stays published and the average updates immediately.
 *   - Moderators can publish, reject or hide, always with a recorded reason,
 *     and can never edit text or rating. Negative sentiment is not a reason.
 *
 * Storage: each review version is an immutable record (rv:item:{id}:{rev});
 * the index (statuses + ratings + the published aggregate) is written last by
 * the same atomic lock+version commit used for cloud saves, so the public
 * list, count, average and distribution always agree.
 */

import crypto from 'crypto';
import { K as CK, keyed, normEmail } from '../cloud/config.js';
import { readSession, checkMutation } from '../cloud/service.js';

export const TEXT_MAX = 1000;
export const NAME_MAX = 40;
export const REASONS = ['spam', 'harassment', 'personal_information', 'irrelevant', 'manipulation', 'other'];
const INDUSTRIES = new Set(['fmcg', 'pharma', 'electronics']);
const LOCK_TTL_S = 10;
const PAGE = 10;
const INDEX_TTL = 60 * 60 * 24 * 365 * 5;   // refreshed on every moderation/review write

export const RK = {
    index: 'rv:index',
    indexVersion: 'rv:indexv',
    lock: 'rv:lock',
    item: (id, rev) => `rv:item:${id}:${rev}`,
    byOwner: (ownerHash) => `rv:owner:${ownerHash}`,
    reports: (id) => `rv:reports:${id}`,
    reportOnce: (id, who) => `rv:rep:${id}:${who}`,
    rate: (name, who) => `rv:rate:${name}:${who}`,
};

const err = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const ok = (body) => ({ status: 200, body });
const ownerHash = (owner) => crypto.createHash('sha256').update(`rv-owner:${owner}`).digest('base64url').slice(0, 24);
const newId = () => crypto.randomBytes(9).toString('base64url');

/** Plain text only: strip control characters (keep newlines), collapse runs of blank lines, trim. */
export function cleanText(s, max) {
    return String(s ?? '').replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
        .replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/** Aggregate of published reviews (ratings include rating-only reviews). */
export function aggregate(items) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0, sum = 0, written = 0;
    for (const e of Object.values(items)) {
        if (e.status !== 'published') continue;
        dist[e.rating] += 1; count += 1; sum += e.rating;
        if (e.hasText) written += 1;
    }
    return { count, written, average: count ? Math.round((sum / count) * 10) / 10 : null, distribution: dist };
}

async function readIndex(store) {
    const [idx, ver] = await Promise.all([store.get(RK.index), store.get(RK.indexVersion)]);
    return { idx: idx && idx.items ? idx : { items: {}, agg: aggregate({}) }, ver: Number(ver || 0) };
}

async function withIndexLock(store, fn) {
    const token = crypto.randomBytes(12).toString('base64url');
    let got = false;
    for (let i = 0; i < 6 && !got; i++) {
        got = Boolean(await store.set(RK.lock, token, { nx: true, ex: LOCK_TTL_S }));
        if (!got) await new Promise(r => setTimeout(r, 60 * (i + 1)));
    }
    if (!got) return err(503, 'busy');
    try { return await fn(token); }
    finally { if ((await store.get(RK.lock)) === token) await store.del(RK.lock); }
}

/** Write the index + recomputed aggregate atomically (lock still held, index unchanged since read). */
async function commit(store, token, ver, items) {
    const value = { items, agg: aggregate(items) };
    const r = await store.commitIfOwner({ lockKey: RK.lock, token, versionKey: RK.indexVersion, expectedVersion: ver, key: RK.index, value, ex: INDEX_TTL });
    return r === 'ok' ? value : null;
}

/** Industries this account has a cloud campaign with ≥1 completed quarter in (server-side record). */
async function playedIndustries(store, owner) {
    const idx = (await store.get(CK.index(owner))) || {};
    const set = new Set();
    for (const e of Object.values(idx)) {
        if (!e || e.deleted || !e.meta) continue;
        if ((Number(e.meta.turn) || 1) >= 2 || (Number(e.meta.chaptersCompleted) || 0) >= 1) set.add(e.meta.industryId);
    }
    return [...set].filter(x => INDUSTRIES.has(x));
}

async function session(deps, ctx, mutation) {
    if (!deps.store || !deps.cfg?.secret || deps.cfg.enabled === false) return { fail: err(503, 'not_configured') };
    const s = await readSession(deps, ctx.sid);
    if (!s) return { fail: err(401, 'signed_out') };
    if (mutation) { const bad = checkMutation(deps, ctx, s); if (bad) return { fail: bad }; }
    return { owner: s.owner, csrf: s.csrf };
}

/** Is this session an admin (REVIEW_ADMIN_EMAILS, matched through the verified email → owner mapping)? */
export async function isAdmin(deps, owner) {
    for (const email of deps.adminEmails || []) {
        const mapped = await deps.store.get(CK.owner(keyed(deps.cfg.secret, 'email', normEmail(email))));
        if (mapped && mapped === owner) return true;
    }
    return false;
}

const publicView = (e, item) => ({
    id: e.id, rating: e.rating, text: item?.text || '', displayName: item?.displayName || 'Anonymous',
    industryId: item?.industryId || null, playedScenario: Boolean(item?.playedScenario),
    date: e.publishedAt || e.updatedAt,
});

/* ── Public ─────────────────────────────────────────────────────────── */

export async function publicReviews(deps, { offset = 0 } = {}) {
    if (!deps.store) return ok({ available: false });
    const { idx } = await readIndex(deps.store);
    const published = Object.values(idx.items).filter(e => e.status === 'published')
        .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const o = Math.max(0, Math.min(Number(offset) || 0, published.length));
    const page = published.slice(o, o + PAGE);
    const items = await Promise.all(page.map(e => deps.store.get(RK.item(e.id, e.rev))));
    return ok({ available: true, aggregate: idx.agg, total: published.length, offset: o, reviews: page.map((e, i) => publicView(e, items[i])) });
}

/* ── Player ─────────────────────────────────────────────────────────── */

export async function myReview(deps, ctx) {
    const a = await session(deps, ctx, false); if (a.fail) return a.fail;
    const industries = await playedIndustries(deps.store, a.owner);
    const id = await deps.store.get(RK.byOwner(ownerHash(a.owner)));
    const { idx } = await readIndex(deps.store);
    const e = id ? idx.items[id] : null;
    const base = { eligible: industries.length > 0, playedIndustries: industries, admin: await isAdmin(deps, a.owner) };
    if (!e || e.status === 'deleted') return ok({ ...base, review: null });
    const item = await deps.store.get(RK.item(e.id, e.rev));
    return ok({ ...base, review: { ...publicView(e, item), status: e.status, statusReason: e.status === 'rejected' || e.status === 'hidden' ? e.reasonCode : null } });
}

export async function submitReview(deps, ctx, body) {
    const a = await session(deps, ctx, true); if (a.fail) return a.fail;
    const { store, now = Date.now() } = deps;
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return err(400, 'bad_rating');
    // Rejected, never truncated: a stored review is exactly what the player wrote (minus control characters)
    const text = cleanText(body?.text, Infinity);
    if (text.length > TEXT_MAX) return err(400, 'too_long');
    const name = cleanText(body?.displayName, Infinity).replace(/\s+/g, ' ');
    if (name.length > NAME_MAX) return err(400, 'name_too_long');
    const displayName = name || 'Anonymous';
    const industries = await playedIndustries(store, a.owner);
    if (!industries.length) return err(403, 'not_eligible');
    const industryId = industries.includes(body?.industryId) ? body.industryId : null;
    if (await rateLimited(store, 'submit', ownerHash(a.owner), 10)) return err(429, 'rate_limited');

    return withIndexLock(store, async (token) => {
        const { idx, ver } = await readIndex(store);
        const oh = ownerHash(a.owner);
        const existingId = await store.get(RK.byOwner(oh));
        const prev = existingId ? idx.items[existingId] : null;
        const id = prev && prev.status !== 'deleted' ? prev.id : (existingId || newId());
        const rev = (prev?.rev || 0) + 1;
        const status = text ? 'pending' : 'published';
        const prevItem = prev?.rev ? await store.get(RK.item(id, prev.rev)) : null;
        const log = [...(prevItem?.log || []), { at: now, action: prev && prev.status !== 'deleted' ? 'edited' : 'submitted', by: 'author', status }];
        await store.set(RK.item(id, rev), { text, displayName, industryId, playedScenario: true, log }, {});
        const items = { ...idx.items, [id]: {
            id, rev, rating, hasText: Boolean(text), status, createdAt: prev?.createdAt && prev.status !== 'deleted' ? prev.createdAt : now,
            updatedAt: now, publishedAt: status === 'published' ? now : null, reasonCode: null,
        } };
        const committed = await commit(store, token, ver, items);
        if (!committed) return err(503, 'busy');
        await store.set(RK.byOwner(oh), id, {});
        if (prev?.rev && prev.rev !== rev) await store.del(RK.item(id, prev.rev));
        return ok({ id, status, aggregate: committed.agg });
    });
}

export async function deleteReview(deps, ctx) {
    const a = await session(deps, ctx, true); if (a.fail) return a.fail;
    const { store, now = Date.now() } = deps;
    return withIndexLock(store, async (token) => {
        const { idx, ver } = await readIndex(store);
        const id = await store.get(RK.byOwner(ownerHash(a.owner)));
        const e = id ? idx.items[id] : null;
        if (!e || e.status === 'deleted') return ok({ deleted: true });
        const items = { ...idx.items, [id]: { id, rev: e.rev, rating: e.rating, hasText: false, status: 'deleted', createdAt: e.createdAt, updatedAt: now, publishedAt: null, reasonCode: null } };
        const committed = await commit(store, token, ver, items);
        if (!committed) return err(503, 'busy');
        await store.del(RK.item(id, e.rev));          // the text is erased, not just hidden
        return ok({ deleted: true, aggregate: committed.agg });
    });
}

/* ── Reports (anyone) ───────────────────────────────────────────────── */

export async function reportReview(deps, ctx, { id, reason }) {
    if (!deps.store || !deps.cfg?.secret) return err(503, 'not_configured');
    const bad = checkMutation(deps, ctx); if (bad) return bad;
    if (!REASONS.includes(reason)) return err(400, 'bad_reason');
    const { idx } = await readIndex(deps.store);
    if (!idx.items[id] || idx.items[id].status !== 'published') return err(404, 'not_found');
    const who = keyed(deps.cfg.secret, 'report-ip', ctx.ip || 'unknown').slice(0, 24);
    if (await rateLimited(deps.store, 'report', who, 20)) return err(429, 'rate_limited');
    if (await deps.store.set(RK.reportOnce(id, who), reason, { nx: true, ex: 60 * 60 * 24 * 90 })) {
        await deps.store.incr(`${RK.reports(id)}:${reason}`);
        await deps.store.incr(RK.reports(id));
    }
    return ok({ reported: true });   // same answer for repeats (no signal to abusers)
}

/* ── Moderation (admins) ────────────────────────────────────────────── */

export async function moderationQueue(deps, ctx, { filter = 'pending' } = {}) {
    const a = await session(deps, ctx, false); if (a.fail) return a.fail;
    if (!(await isAdmin(deps, a.owner))) return err(403, 'not_admin');
    const { idx } = await readIndex(deps.store);
    const all = Object.values(idx.items).filter(e => e.status !== 'deleted');
    const withReports = await Promise.all(all.map(async e => ({ e, reports: Number(await deps.store.get(RK.reports(e.id)) || 0) })));
    const pick = withReports.filter(({ e, reports }) => filter === 'all' || (filter === 'reported' ? reports > 0 : e.status === filter))
        .sort((x, y) => (y.reports - x.reports) || (y.e.updatedAt - x.e.updatedAt)).slice(0, 100);
    const items = await Promise.all(pick.map(({ e }) => deps.store.get(RK.item(e.id, e.rev))));
    return ok({
        aggregate: idx.agg,
        reviews: pick.map(({ e, reports }, i) => ({ ...publicView(e, items[i]), status: e.status, reasonCode: e.reasonCode || null, reports, log: items[i]?.log || [], updatedAt: e.updatedAt })),
    });
}

export async function moderate(deps, ctx, { id, decision, reason, note }) {
    const a = await session(deps, ctx, true); if (a.fail) return a.fail;
    if (!(await isAdmin(deps, a.owner))) return err(403, 'not_admin');
    if (!['publish', 'reject', 'hide'].includes(decision)) return err(400, 'bad_decision');
    if (decision !== 'publish' && !REASONS.includes(reason)) return err(400, 'reason_required');
    const { store, now = Date.now() } = deps;
    return withIndexLock(store, async (token) => {
        const { idx, ver } = await readIndex(store);
        const e = idx.items[id];
        if (!e || e.status === 'deleted') return err(404, 'not_found');
        const status = decision === 'publish' ? 'published' : decision === 'reject' ? 'rejected' : 'hidden';
        const item = await store.get(RK.item(id, e.rev));
        // Audit log lives with the review version (same text and rating — moderators never edit them)
        const log = [...(item?.log || []), { at: now, action: decision, by: 'moderator', reason: reason || null, note: cleanText(note, 300) || null }];
        const rev = e.rev + 1;
        await store.set(RK.item(id, rev), { ...item, log }, {});
        const items = { ...idx.items, [id]: { ...e, rev, status, reasonCode: status === 'published' ? null : reason, updatedAt: now, publishedAt: status === 'published' ? (e.publishedAt || now) : null } };
        const committed = await commit(store, token, ver, items);
        if (!committed) return err(503, 'busy');
        await store.del(RK.item(id, e.rev));
        if (status !== 'published') await store.set(RK.reports(id), 0, {});
        return ok({ id, status, aggregate: committed.agg });
    });
}

async function rateLimited(store, name, who, perHour) {
    return (await store.incr(RK.rate(name, who), 3600)) > perHour;
}
