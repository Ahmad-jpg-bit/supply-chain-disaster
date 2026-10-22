/**
 * Cloud saves — account-owned campaign runs.
 *
 * Ownership: a player proves an email with a one-time code; the server then
 * issues an opaque session (HttpOnly cookie) bound to a stable internal owner
 * ID. Every run read/write/delete is scoped to the session's owner. No
 * operation accepts an email or owner ID from the client as authority.
 *
 * Storage: every write puts its snapshot under its own immutable key (named by
 * its writeId). The owner's index (rev, writeId, checkpoint) is the single
 * commit point, written LAST by an atomic compare-and-set that succeeds only
 * if this request still holds the owner lock AND the index version is the one
 * it read. A writer whose lock expired can't commit; its snapshot is simply
 * never referenced (and expires by TTL).
 *
 * Concurrency: each run has a server revision. Writes carry the revision they
 * were based on (expectedRev) and a writeId; a stale write is rejected (409)
 * without touching the stored record, a retried write (same writeId) is
 * acknowledged idempotently, and a deleted run stays deleted (410) so another
 * device's queued write can't silently recreate it. Writes for one owner are
 * serialised with a short KV lock (no Lua needed, works on any KV/Redis).
 *
 * Verifying an email never grants purchase entitlements — that remains the
 * billing restore flow's job.
 *
 * Deps: { store, cfg: cloudConfig(), now?, sendCode(email, code) }
 * Ctx:  { ip, origin, sid, csrf, clientHeader }
 */

import crypto from 'crypto';
import {
    K, keyed, normEmail, maskEmail, EMAIL_RE, SESSION_TTL, RUN_TTL, OWNER_MAP_TTL, LEGACY_COPY_TTL,
    MAX_ACTIVE_RUNS, MAX_SNAPSHOT_BYTES, OTP_TTL, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, LIMITS, PACKAGING_CUTOFF,
} from './config.js';

const RUN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const WRITE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const INDUSTRIES = new Set(['fmcg', 'pharma', 'electronics']);
const PHASES = new Set(['PHASE_CHAPTER_INTRO', 'PHASE_STORY', 'PHASE_PROCUREMENT', 'PHASE_CHAPTER_SUMMARY', 'PHASE_GAME_OVER']);
const err = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const ok = (body, extra = {}) => ({ status: 200, body, ...extra });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('base64url');
const safeEqual = (a, b) => {
    const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

function ready(deps) {
    if (deps.cfg?.enabled === false) return err(503, 'disabled');   // CLOUD_SAVES_ENABLED=false (safe fallback)
    if (!deps.store || !deps.cfg?.secret) return err(503, 'not_configured');
    return null;
}

/* ── Request checks ───────────────────────────────────────────────────── */

/**
 * Every state-changing request must come from our own pages: same-origin
 * Origin header (when the browser sends one) plus a custom header, which a
 * cross-site form or simple request can't add without a CORS preflight
 * (that we never allow). Cookie-authenticated mutations also need the
 * session's CSRF token.
 */
export function checkMutation(deps, ctx, session = null) {
    if (ctx.origin && !deps.cfg.origins.has(ctx.origin) && !isLocalOrigin(ctx.origin, deps)) return err(403, 'bad_origin');
    if (ctx.clientHeader !== '1') return err(403, 'bad_request');
    if (session && !safeEqual(ctx.csrf, session.csrf)) return err(403, 'bad_csrf');
    return null;
}

function isLocalOrigin(origin, deps) {
    return deps.cfg.devInsecureCookies && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

async function rateLimit(store, name, who, max) {
    const n = await store.incr(K.rate(name, who), 3600);
    return n > max;
}

/* ── Verification codes ───────────────────────────────────────────────── */

/** Always answers { sent: true } for a valid address — never reveals whether saves exist. */
export async function requestCode(deps, ctx, { email }) {
    const nr = ready(deps); if (nr) return nr;
    const bad = checkMutation(deps, ctx); if (bad) return bad;
    const { store, cfg, now = Date.now() } = deps;
    const e = normEmail(email);
    if (!EMAIL_RE.test(e)) return err(400, 'invalid_email');
    const ek = keyed(cfg.secret, 'email', e);
    const ipk = keyed(cfg.secret, 'ip', ctx.ip || 'unknown');
    if (await rateLimit(store, 'code-ip', ipk, LIMITS.codePerIpHour)) return err(429, 'rate_limited');
    const prev = await store.get(K.otp(ek));
    if (prev && now - (prev.sentAt || 0) < OTP_RESEND_COOLDOWN_MS) return err(429, 'resend_too_soon', { retryAfterMs: OTP_RESEND_COOLDOWN_MS - (now - prev.sentAt) });
    if (await rateLimit(store, 'code-email', ek, LIMITS.codePerEmailHour)) return err(429, 'rate_limited');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await store.set(K.otp(ek), { hash: keyed(cfg.secret, 'otp', `${e}:${code}`), attempts: 0, sentAt: now }, { ex: OTP_TTL });
    await deps.sendCode?.(e, code);
    return ok({ sent: true });
}

/**
 * Single-use, expiring, attempt-limited. On success creates (or finds) the
 * owner for this email and starts a fresh session (new session ID — no fixation).
 * @returns body { signedIn, email (masked), csrf, legacy? } and `setSession` (raw session ID for the cookie)
 */
export async function verifyCode(deps, ctx, { email, code }) {
    const nr = ready(deps); if (nr) return nr;
    const bad = checkMutation(deps, ctx); if (bad) return bad;
    const { store, cfg, now = Date.now() } = deps;
    const e = normEmail(email);
    const ipk = keyed(cfg.secret, 'ip', ctx.ip || 'unknown');
    if (await rateLimit(store, 'verify-ip', ipk, LIMITS.verifyPerIpHour)) return err(429, 'rate_limited');
    if (!EMAIL_RE.test(e)) return err(400, 'invalid_code');
    const ek = keyed(cfg.secret, 'email', e);
    const rec = await store.get(K.otp(ek));
    if (!rec) return err(400, 'invalid_code');
    if (rec.attempts >= OTP_MAX_ATTEMPTS) { await store.del(K.otp(ek)); return err(429, 'too_many_attempts'); }
    if (!safeEqual(keyed(cfg.secret, 'otp', `${e}:${String(code || '').trim()}`), rec.hash)) {
        await store.set(K.otp(ek), { ...rec, attempts: rec.attempts + 1 }, { ex: OTP_TTL });
        return err(400, 'invalid_code');
    }
    await store.del(K.otp(ek)); // single use

    // Stable internal owner ID — runs are namespaced by this, never by the email
    let owner = await findOwner(deps, e, ek);
    if (!owner) {
        const fresh = crypto.randomBytes(16).toString('base64url');
        await store.set(K.owner(ek), fresh, { nx: true, ex: OWNER_MAP_TTL });
        owner = await store.get(K.owner(ek));
    } else {
        await store.set(K.owner(ek), owner, { ex: OWNER_MAP_TTL });
    }
    const acct = (await store.get(K.account(owner))) || { createdAt: now };
    await store.set(K.account(owner), { ...acct, email: maskEmail(e), lastActive: now }, { ex: OWNER_MAP_TTL });

    // Old unauthenticated email backup (game:{email}) — copied for import, original kept
    const legacy = await copyLegacy(deps, owner, e, now);

    const sid = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(24).toString('base64url');
    await store.set(K.session(sha(sid)), { owner, csrf, createdAt: now, refreshedAt: now }, { ex: SESSION_TTL });
    return ok({ signedIn: true, owner: ownerTag(cfg, owner), email: maskEmail(e), csrf, legacy }, { setSession: sid });
}

/**
 * Find the owner for a verified email. Looks up the current identity key, then
 * keys made with former identity secrets (rotation); a hit under an old key is
 * copied to the current key (idempotent — NX, then re-read), leaving the old
 * mapping in place.
 */
async function findOwner(deps, email, currentKey) {
    const { store, cfg } = deps;
    const cur = await store.get(K.owner(currentKey));
    if (cur) return cur;
    for (const old of cfg.previousSecrets || []) {
        const o = await store.get(K.owner(keyed(old, 'email', email)));
        if (!o) continue;
        await store.set(K.owner(currentKey), o, { nx: true, ex: OWNER_MAP_TTL });
        return (await store.get(K.owner(currentKey))) || o;
    }
    return null;
}

/**
 * Opaque per-account tag the browser uses to keep accounts' local copies apart.
 * A plain hash of the random owner ID: stable across any secret rotation, and
 * it doesn't reveal the owner ID itself.
 */
export const ownerTag = (_cfg, owner) => crypto.createHash('sha256').update(`scd-owner-tag:${owner}`).digest('base64url').slice(0, 22);

async function copyLegacy(deps, owner, email, now) {
    const { store } = deps;
    let raw = await store.get(K.legacyOriginal(email));
    if (!raw) return (await legacySummary(store, owner));
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } }
    const gs = raw?.gameState;
    if (!gs?.industryId) return null;
    const savedAt = Number(raw.savedAt) || null;   // written by the server at the time — the only trustworthy field
    const existing = await store.get(K.legacy(owner));
    if (existing?.savedAt === savedAt && existing?.dismissed) return null;
    await store.set(K.legacy(owner), {
        gameState: gs, savedAt, copiedAt: now,
        preLaunch: Boolean(savedAt && savedAt < PACKAGING_CUTOFF),
    }, { ex: LEGACY_COPY_TTL });
    return legacySummary(store, owner);
}

async function legacySummary(store, owner) {
    const l = await store.get(K.legacy(owner));
    if (!l || l.dismissed) return null;
    const gs = l.gameState || {};
    return {
        savedAt: l.savedAt, industryId: gs.industryId, preLaunch: l.preLaunch,
        chapterIndex: Number.isInteger(gs.chapterIndex) ? gs.chapterIndex : null,
        saveVersion: gs.saveVersion || 1, phase: typeof gs.phase === 'string' ? gs.phase : null,
    };
}

/* ── Sessions ─────────────────────────────────────────────────────────── */

export async function readSession(deps, sid) {
    if (!sid || typeof sid !== 'string' || sid.length > 100) return null;
    const { store, now = Date.now() } = deps;
    const s = await store.get(K.session(sha(sid)));
    if (!s?.owner) return null;
    if (now - (s.refreshedAt || 0) > 24 * 3600 * 1000) {   // sliding expiry, at most one write a day
        await store.set(K.session(sha(sid)), { ...s, refreshedAt: now }, { ex: SESSION_TTL });
    }
    return s;
}

export async function sessionStatus(deps, ctx) {
    const nr = ready(deps); if (nr) return ok({ signedIn: false, available: false });
    const s = await readSession(deps, ctx.sid);
    if (!s) return ok({ signedIn: false, available: true });
    const acct = (await deps.store.get(K.account(s.owner))) || {};
    return ok({
        signedIn: true, available: true, owner: ownerTag(deps.cfg, s.owner), email: acct.email || '', csrf: s.csrf,
        legacy: await legacySummary(deps.store, s.owner), retentionDays: RUN_TTL / 86400,
    });
}

export async function signOut(deps, ctx) {
    const nr = ready(deps); if (nr) return nr;
    const s = await readSession(deps, ctx.sid);
    if (s) {
        const bad = checkMutation(deps, ctx, s); if (bad) return bad;
        await deps.store.del(K.session(sha(ctx.sid)));
    }
    return ok({ signedIn: false }, { clearSession: true });
}

/** Resolve the session for an authenticated call (and its CSRF check for mutations). */
async function authed(deps, ctx, mutation) {
    const nr = ready(deps); if (nr) return { fail: nr };
    const s = await readSession(deps, ctx.sid);
    if (!s) return { fail: err(401, 'signed_out') };
    if (mutation) { const bad = checkMutation(deps, ctx, s); if (bad) return { fail: bad }; }
    return { owner: s.owner };
}

/* ── Owner lock ───────────────────────────────────────────────────────── */

const LOCK_TTL_S = 10;

/**
 * Serialise one owner's writes with SET NX EX. fn receives the lock token; the
 * final index write is conditional on still holding it (commitIfOwner), so an
 * expired lock can never let a stale writer replace the index.
 */
async function withOwnerLock(store, owner, fn) {
    const token = crypto.randomBytes(12).toString('base64url');
    let got = false;
    for (let i = 0; i < 6 && !got; i++) {
        got = Boolean(await store.set(K.lock(owner), token, { nx: true, ex: LOCK_TTL_S }));
        if (!got) await new Promise(r => setTimeout(r, 60 * (i + 1)));
    }
    if (!got) return err(503, 'busy');
    try { return await fn(token); }
    finally { if ((await store.get(K.lock(owner))) === token) await store.del(K.lock(owner)); }
}

/** Index entries not written for longer than the retention period have expired (their snapshots have). */
function prune(idx, now) {
    const out = {};
    for (const [id, e] of Object.entries(idx || {})) if ((e.updatedAt || 0) + RUN_TTL * 1000 > now) out[id] = e;
    return out;
}

async function readIndex(store, owner, now) {
    const [idx, ver] = await Promise.all([store.get(K.index(owner)), store.get(K.indexVersion(owner))]);
    return { idx: prune(idx || {}, now), ver: Number(ver || 0) };
}

/** Atomic commit of the index; 'ok' | 'lost_lock' | 'version_moved'. */
function commitIndex(store, owner, token, ver, idx) {
    return store.commitIfOwner({ lockKey: K.lock(owner), token, versionKey: K.indexVersion(owner), expectedVersion: ver, key: K.index(owner), value: idx, ex: RUN_TTL });
}

/** Only these meta fields are stored/listed (no free-form client data). */
function cleanMeta(m = {}) {
    const n = (v, max) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.trunc(Number(v)))) : null);
    return {
        industryId: INDUSTRIES.has(m.industryId) ? m.industryId : null,
        mode: 'story',
        schema: n(m.schema, 99),
        contentVersion: typeof m.contentVersion === 'string' ? m.contentVersion.slice(0, 32) : null,
        createdAt: n(m.createdAt, 9e15),
        chapterNumber: n(m.chapterNumber, 20),
        turn: n(m.turn, 100),
        phase: PHASES.has(m.phase) ? m.phase : null,
        chaptersCompleted: n(m.chaptersCompleted, 20),
        totalChapters: n(m.totalChapters, 20),
        status: m.status === 'completed' ? 'completed' : 'active',
        cash: Number.isFinite(Number(m.cash)) ? Math.round(Number(m.cash)) : null,
    };
}

export async function listRuns(deps, ctx) {
    const a = await authed(deps, ctx, false); if (a.fail) return a.fail;
    const { idx } = await readIndex(deps.store, a.owner, deps.now ?? Date.now());
    const runs = Object.entries(idx).map(([runId, e]) => ({
        runId, rev: e.rev, deleted: Boolean(e.deleted), updatedAt: e.updatedAt, meta: e.deleted ? null : e.meta,
    }));
    return ok({ runs, retentionDays: RUN_TTL / 86400 });
}

export async function getRun(deps, ctx, { runId, headOnly = false }) {
    const a = await authed(deps, ctx, false); if (a.fail) return a.fail;
    if (!RUN_ID_RE.test(String(runId || ''))) return err(400, 'bad_run');
    const { idx } = await readIndex(deps.store, a.owner, deps.now ?? Date.now());
    const e = idx[runId];
    if (!e) return err(404, 'not_found');
    const head = { runId, rev: e.rev, writeId: e.writeId || null, deleted: Boolean(e.deleted), updatedAt: e.updatedAt, meta: e.deleted ? null : e.meta };
    if (headOnly || e.deleted) return ok(head);
    const rec = await deps.store.get(K.snapshot(a.owner, runId, e.writeId));
    if (!rec) return err(404, 'not_found');
    return ok({ ...head, snapshot: rec.snapshot });
}

export async function putRun(deps, ctx, body) {
    const a = await authed(deps, ctx, true); if (a.fail) return a.fail;
    const { store, now = Date.now() } = deps;
    const { runId, expectedRev, writeId, meta, snapshot } = body || {};
    if (!RUN_ID_RE.test(String(runId || ''))) return err(400, 'bad_run');
    if (!WRITE_ID_RE.test(String(writeId || ''))) return err(400, 'bad_write');
    if (!Number.isInteger(expectedRev) || expectedRev < 0) return err(400, 'bad_rev');
    const m = cleanMeta(meta);
    // The server stores the snapshot as opaque, untrusted game data; only its envelope is checked
    if (!snapshot || typeof snapshot !== 'object' || snapshot.saveVersion !== 2 || !snapshot.snapshot?.state
        || snapshot.industryId !== m.industryId) return err(400, 'bad_snapshot');
    if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_BYTES) return err(413, 'too_large');

    return withOwnerLock(store, a.owner, async (token) => {
        const { idx, ver } = await readIndex(store, a.owner, now);
        const cur = idx[runId];
        if (cur && cur.writeId === writeId) return ok({ runId, rev: cur.rev, updatedAt: cur.updatedAt, duplicate: true });
        if (cur?.deleted) return err(410, 'deleted', { rev: cur.rev, updatedAt: cur.updatedAt });
        const curRev = cur?.rev || 0;
        if (curRev !== expectedRev) return err(409, 'conflict', { rev: curRev, updatedAt: cur?.updatedAt || null, meta: cur?.meta || null });
        if (!cur && Object.values(idx).filter(x => !x.deleted).length >= MAX_ACTIVE_RUNS) return err(409, 'run_limit', { max: MAX_ACTIVE_RUNS });

        const rev = curRev + 1;
        // Immutable snapshot for THIS write (never overwrites anything the index references)
        await store.set(K.snapshot(a.owner, runId, writeId), { snapshot, meta: m, savedAt: now }, { ex: RUN_TTL });
        // Bounded recovery history: the previous version becomes the checkpoint when the
        // chapter changes or every 10th revision; otherwise the existing checkpoint is kept
        const promote = Boolean(cur && (cur.meta?.chapterNumber !== m.chapterNumber || rev % 10 === 0));
        const next = {
            rev, writeId, meta: m, updatedAt: now, deleted: false,
            cpRev: promote ? curRev : (cur?.cpRev ?? null),
            cpWriteId: promote ? cur.writeId : (cur?.cpWriteId ?? null),
            cpAt: promote ? cur.updatedAt : (cur?.cpAt ?? null),
        };
        const committed = await commitIndex(store, a.owner, token, ver, { ...idx, [runId]: next });
        if (committed !== 'ok') return err(503, 'busy');   // nothing committed; the client retries
        // Remove snapshots nothing references any more (best effort; TTL covers failures)
        if (cur && !promote) await store.del(K.snapshot(a.owner, runId, cur.writeId));
        if (promote && cur?.cpWriteId) await store.del(K.snapshot(a.owner, runId, cur.cpWriteId));
        return ok({ runId, rev, updatedAt: now });
    });
}

export async function deleteRun(deps, ctx, { runId, expectedRev }) {
    const a = await authed(deps, ctx, true); if (a.fail) return a.fail;
    const { store, now = Date.now() } = deps;
    if (!RUN_ID_RE.test(String(runId || ''))) return err(400, 'bad_run');
    return withOwnerLock(store, a.owner, async (token) => {
        const { idx, ver } = await readIndex(store, a.owner, now);
        const cur = idx[runId];
        if (!cur || cur.deleted) return ok({ runId, deleted: true, rev: cur?.rev || 0 });
        if (Number.isInteger(expectedRev) && expectedRev !== cur.rev) return err(409, 'conflict', { rev: cur.rev, updatedAt: cur.updatedAt, meta: cur.meta });
        // Tombstone: a stale write from another device gets 410 instead of recreating the run
        const committed = await commitIndex(store, a.owner, token, ver, { ...idx, [runId]: { rev: cur.rev + 1, deleted: true, updatedAt: now, writeId: null } });
        if (committed !== 'ok') return err(503, 'busy');
        await store.del(K.snapshot(a.owner, runId, cur.writeId));
        if (cur.cpWriteId) await store.del(K.snapshot(a.owner, runId, cur.cpWriteId));
        return ok({ runId, deleted: true, rev: cur.rev + 1 });
    });
}

/** Previous server checkpoint for recovery (bounded: one per run). */
export async function getCheckpoint(deps, ctx, { runId }) {
    const a = await authed(deps, ctx, false); if (a.fail) return a.fail;
    if (!RUN_ID_RE.test(String(runId || ''))) return err(400, 'bad_run');
    const { idx } = await readIndex(deps.store, a.owner, deps.now ?? Date.now());
    const e = idx[runId];
    const cp = e && !e.deleted && e.cpWriteId ? await deps.store.get(K.snapshot(a.owner, runId, e.cpWriteId)) : null;
    return cp ? ok({ runId, rev: e.cpRev, savedAt: cp.savedAt || e.cpAt || null, meta: cp.meta, snapshot: cp.snapshot }) : err(404, 'not_found');
}

/* ── Old email backup (import) ────────────────────────────────────────── */

export async function getLegacy(deps, ctx) {
    const a = await authed(deps, ctx, false); if (a.fail) return a.fail;
    const l = await deps.store.get(K.legacy(a.owner));
    if (!l || l.dismissed) return err(404, 'not_found');
    return ok({ savedAt: l.savedAt, preLaunch: l.preLaunch, gameState: l.gameState });
}

/** Hide the imported copy (after import, or "not mine"). The original record is not touched. */
export async function dismissLegacy(deps, ctx) {
    const a = await authed(deps, ctx, true); if (a.fail) return a.fail;
    const l = await deps.store.get(K.legacy(a.owner));
    if (l) await deps.store.set(K.legacy(a.owner), { savedAt: l.savedAt, dismissed: true }, { ex: LEGACY_COPY_TTL });
    return ok({ dismissed: true });
}
