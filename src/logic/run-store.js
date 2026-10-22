/**
 * Run store — every campaign is its own run, saved in this browser.
 *
 * Replaces the single overwritten save (scd_local_save_v1). Storage choice:
 * localStorage, measured: a v2 snapshot is ~76 KB after Chapter 1 and ~154 KB
 * at the end of a 40-quarter campaign, and a synchronous write takes a few
 * milliseconds — small enough to write at every committed decision and to
 * flush synchronously when the page is hidden (IndexedDB's async commits are
 * less dependable at that moment). The budget is managed explicitly: latest
 * snapshot + one known-good checkpoint per run, with quota-aware eviction of
 * recovery copies before anything is reported as failed.
 *
 * Keys
 *   scd_runs_v3                index { version, runs: { [runId]: meta } }
 *   scd_run_v3:{runId}         latest snapshot (JSON)
 *   scd_run_v3_cp:{runId}      previous known-good checkpoint { snapshot, localRev, savedAt }
 *   scd_run_v3_conflict:{id}   the cloud version held while the player chooses
 *   scd_runs_migrated          migration markers
 *
 * Ownership: meta.owner is 'guest' (this browser only) or an opaque account
 * tag. Account-owned runs are only listed/synced while that account is signed in.
 */

import { isSnapshot, SAVE_VERSION, LOCAL_SAVE_KEY } from './save-game.js';
import { GAME_PHASES } from './engine.js';

export const RUN_SCHEMA = 3;
const INDEX_KEY = 'scd_runs_v3';
const MIGRATED_KEY = 'scd_runs_migrated';
const runKey = (id) => `scd_run_v3:${id}`;
const cpKey = (id) => `scd_run_v3_cp:${id}`;
const conflictKey = (id) => `scd_run_v3_conflict:${id}`;
const lockKey = (id) => `scd_run_lock:${id}`;
/** Saves stamped before the free-intro / Core packaging shipped (2026-10-21 deploy). */
export const PACKAGING_CUTOFF = Date.parse('2026-10-21T18:00:00Z');
export const TOTAL_CHAPTERS = 10;

let storage = () => globalThis.localStorage;
/** Tests: swap the storage backend. */
export function _setStorage(s) { storage = () => s; }

let channel = null;
try { channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('scd-runs') : null; channel?.unref?.(); } catch { channel = null; }
export const runsChannel = channel;

const now = () => Date.now();
export function newId(prefix = 'r') {
    const c = globalThis.crypto;
    if (c?.randomUUID) return `${prefix}-${c.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    return `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 26);
}

/** Small stable hash (FNV-1a) for deterministic migration IDs. */
function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
}

function read(key) {
    try { return storage().getItem(key); } catch { return null; }
}
function parse(raw) {
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return undefined; }   // undefined = present but corrupt
}

/** Write a string; returns null on success or an error category. */
function write(key, value) {
    try { storage().setItem(key, value); return null; }
    catch (e) { return isQuota(e) ? 'quota' : 'blocked'; }
}
const isQuota = (e) => e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));

/* ── Index ────────────────────────────────────────────────────────────── */

function readIndex() {
    const idx = parse(read(INDEX_KEY));
    if (!idx || typeof idx !== 'object' || !idx.runs) return { version: RUN_SCHEMA, runs: {} };
    return idx;
}
function writeIndex(idx) { return write(INDEX_KEY, JSON.stringify(idx)); }

export function getMeta(runId) { return readIndex().runs[runId] || null; }
export function allMetas() { return Object.values(readIndex().runs); }

/** Runs this player may see: this browser's guest runs + the signed-in account's runs. */
export function visibleRuns(ownerTag = null) {
    return allMetas()
        .filter(m => m.owner === 'guest' || (ownerTag && m.owner === ownerTag))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function updateMeta(runId, patch) {
    const idx = readIndex();
    if (!idx.runs[runId]) return null;
    idx.runs[runId] = { ...idx.runs[runId], ...patch };
    const err = writeIndex(idx);
    return err ? null : idx.runs[runId];
}

/* ── Derived progress (from the snapshot itself) ──────────────────────── */

const isCompletedPhase = (phase) => phase === GAME_PHASES.GAME_OVER;

/** Progress summary stored with the run (stable IDs only, no translated names). */
export function summarize(gs) {
    const st = gs?.snapshot?.state || {};
    const phase = gs?.phase || null;
    const chapterIndex = Number.isInteger(gs?.chapterIndex) ? gs.chapterIndex : 0;
    const totalTurns = gs?.maxTurns || 40;
    const completed = isCompletedPhase(phase) || (st.turn ?? gs?.turn ?? 1) > totalTurns;
    let chaptersCompleted = chapterIndex;
    if (phase === GAME_PHASES.CHAPTER_SUMMARY) chaptersCompleted = chapterIndex + 1;
    if (!isSnapshot(gs)) chaptersCompleted = chapterIndex + 1;   // legacy chapter-end save
    if (completed) chaptersCompleted = TOTAL_CHAPTERS;
    const scores = gs?.snapshot?.mastery?.scores || {};
    return {
        industryId: gs?.industryId || null,
        chapterNumber: chapterIndex + 1,
        turn: Number(st.turn ?? gs?.turn ?? 1),
        phase,
        chaptersCompleted: Math.min(TOTAL_CHAPTERS, chaptersCompleted),
        totalChapters: TOTAL_CHAPTERS,
        conceptsMastered: Object.values(scores).filter(s => Number(s) >= 60).length,
        status: completed ? 'completed' : 'active',
        cash: Number(st.cash ?? gs?.cash ?? 0),
        format: isSnapshot(gs) ? 'v2' : 'v1-chapter-end',
    };
}

/** Structural validation before a snapshot may replace the latest good one. */
export function validSnapshot(gs, industryId = null) {
    if (!gs || typeof gs !== 'object' || !gs.industryId) return false;
    if (industryId && gs.industryId !== industryId) return false;
    if (isSnapshot(gs)) return Boolean(gs.snapshot.state && typeof gs.snapshot.state === 'object' && Array.isArray(gs.history));
    // legacy chapter-end format
    return Number.isInteger(gs.chapterIndex) && gs.saveVersion === undefined;
}

/* ── Create / save / load ─────────────────────────────────────────────── */

/**
 * @returns {Object} meta of the new run (not yet written anywhere but the index)
 */
export function createRun({ industryId, owner = 'guest', runId = newId(), extra = {} }) {
    const idx = readIndex();
    const t = now();
    const meta = {
        runId, owner, industryId, mode: 'story', schema: RUN_SCHEMA, snapshotVersion: SAVE_VERSION,
        createdAt: t, updatedAt: t, localRev: 0, ackedLocalRev: 0, cloudRev: 0,
        cloud: owner !== 'guest', status: 'active', chapterNumber: 1, turn: 1, phase: null,
        chaptersCompleted: 0, totalChapters: TOTAL_CHAPTERS, conceptsMastered: 0, sent: [],
        ...extra,
    };
    idx.runs[runId] = meta;
    const err = writeIndex(idx);
    if (err) return null;
    return meta;
}

function evictFor(runId) {
    // Free space without touching any run's latest snapshot: recovery copies first
    const metas = allMetas();
    for (const m of metas) if (m.runId !== runId && read(cpKey(m.runId)) != null) { try { storage().removeItem(cpKey(m.runId)); } catch { /* ignore */ } return true; }
    for (const m of metas) if (m.runId !== runId && read(conflictKey(m.runId)) != null && !m.conflict) { try { storage().removeItem(conflictKey(m.runId)); } catch { /* ignore */ } return true; }
    return false;
}

function writeWithEviction(runId, key, value) {
    let err = write(key, value);
    let guard = 0;
    while (err === 'quota' && guard++ < 20 && evictFor(runId)) err = write(key, value);
    return err;
}

/**
 * Save a snapshot as the run's latest. Fails (without replacing the latest
 * good snapshot) when the data is invalid, storage is full/blocked, or another
 * tab has written this run since this tab last did (opts.tabRev mismatch).
 * @param {Object} opts { tabRev?: number, checkpoint?: boolean }
 * @returns {{ ok: true, meta } | { ok: false, reason: 'invalid'|'missing'|'stale_tab'|'quota'|'blocked', meta? }}
 */
export function saveRun(runId, gs, opts = {}) {
    const meta = getMeta(runId);
    if (!meta) return { ok: false, reason: 'missing' };
    if (opts.tabRev !== undefined && meta.localRev !== opts.tabRev) return { ok: false, reason: 'stale_tab', meta };
    if (!validSnapshot(gs, meta.industryId)) return { ok: false, reason: 'invalid' };
    let json;
    try { json = JSON.stringify(gs); JSON.parse(json); } catch { return { ok: false, reason: 'invalid' }; }

    const cur = read(runKey(runId));
    // Nothing changed (e.g. the save when a page is hidden right after a save):
    // don't create a new revision — it would look like unsynced progress
    if (cur === json && !meta.localError) return { ok: true, meta, unchanged: true };

    if (opts.checkpoint) {
        const parsed = parse(cur);
        // Keep the previous version as a recovery point only if it was itself valid
        if (parsed && validSnapshot(parsed, meta.industryId)) {
            const cpErr = write(cpKey(runId), JSON.stringify({ snapshot: parsed, localRev: meta.localRev, savedAt: meta.updatedAt }));
            if (cpErr) { try { storage().removeItem(cpKey(runId)); } catch { /* ignore */ } }   // a missing checkpoint is better than a stale one
        }
    }
    const err = writeWithEviction(runId, runKey(runId), json);
    if (err) return { ok: false, reason: err, meta };

    const next = { ...meta, ...summarize(gs), localRev: meta.localRev + 1, updatedAt: now(), localError: null };
    const idx = readIndex();
    idx.runs[runId] = next;
    const ierr = writeIndex(idx);
    if (ierr) return { ok: false, reason: ierr, meta };
    channel?.postMessage({ type: 'written', runId, localRev: next.localRev });
    return { ok: true, meta: next };
}

/**
 * Load a run's latest snapshot; falls back to the checkpoint when the latest
 * is missing, corrupt or fails validation.
 * @returns {{ snapshot, meta, recovered?: boolean } | { error: 'missing'|'corrupt'|'unsupported', meta }}
 */
export function loadRun(runId) {
    const meta = getMeta(runId);
    if (!meta) return { error: 'missing', meta: null };
    const latest = parse(read(runKey(runId)));
    if (latest && latest.saveVersion > SAVE_VERSION) return { error: 'unsupported', meta };
    if (latest && validSnapshot(latest, meta.industryId)) return { snapshot: latest, meta };
    const cp = parse(read(cpKey(runId)));
    if (cp?.snapshot && validSnapshot(cp.snapshot, meta.industryId)) {
        // Promote the checkpoint so the next save builds on known-good data
        write(runKey(runId), JSON.stringify(cp.snapshot));
        return { snapshot: cp.snapshot, meta, recovered: true, recoveredFrom: cp.savedAt || null };
    }
    return { error: latest === null ? 'missing' : 'corrupt', meta };
}

/** Write a snapshot received from elsewhere (cloud, import, conflict choice) as this run's latest. */
export function replaceRun(runId, gs, patch = {}) {
    const meta = getMeta(runId);
    if (!meta || !validSnapshot(gs, meta.industryId)) return { ok: false, reason: 'invalid' };
    const err = writeWithEviction(runId, runKey(runId), JSON.stringify(gs));
    if (err) return { ok: false, reason: err };
    const next = updateMeta(runId, { ...summarize(gs), ...patch, updatedAt: patch.updatedAt ?? now() });
    channel?.postMessage({ type: 'written', runId, localRev: next?.localRev });
    return next ? { ok: true, meta: next } : { ok: false, reason: 'blocked' };
}

export function deleteLocalRun(runId) {
    const idx = readIndex();
    delete idx.runs[runId];
    writeIndex(idx);
    for (const k of [runKey(runId), cpKey(runId), conflictKey(runId), lockKey(runId)]) { try { storage().removeItem(k); } catch { /* ignore */ } }
    channel?.postMessage({ type: 'deleted', runId });
}

/** Remove an account's runs from this browser (sign-out). */
export function removeOwnerRuns(ownerTag) {
    for (const m of allMetas()) if (m.owner === ownerTag) deleteLocalRun(m.runId);
}

/* ── Cloud bookkeeping ────────────────────────────────────────────────── */

/** Local changes not yet acknowledged by the cloud. */
export const isPending = (m) => Boolean(m?.cloud && !m.cloudDeleted && (m.localRev || 0) > (m.ackedLocalRev || 0));

/**
 * Record a cloud acknowledgement. Only the local revision that was actually
 * sent is marked synced — edits made while the request was in flight stay pending.
 */
export function ackSync(runId, { sentLocalRev, rev, updatedAt }) {
    const m = getMeta(runId);
    if (!m) return null;
    const acked = Math.max(m.ackedLocalRev || 0, Math.min(sentLocalRev, m.localRev || 0));
    return updateMeta(runId, { cloudRev: rev, ackedLocalRev: acked, lastSyncedAt: updatedAt || now(), inflight: null, syncError: null });
}

export function saveConflictCopy(runId, remote) {
    return write(conflictKey(runId), JSON.stringify(remote));
}
export function readConflictCopy(runId) { return parse(read(conflictKey(runId))) || null; }
export function clearConflictCopy(runId) { try { storage().removeItem(conflictKey(runId)); } catch { /* ignore */ } }

/* ── Analytics de-duplication (survives reloads) ──────────────────────── */

/** @returns {boolean} true the first time `key` is marked for this run */
export function markOnce(runId, key) {
    const m = getMeta(runId);
    if (!m) return false;
    const sent = m.sent || [];
    if (sent.includes(key)) return false;
    updateMeta(runId, { sent: [...sent, key].slice(-120) });
    return true;
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */

/** Announce that this tab is now playing the run; other tabs playing it should stand down. */
export function claimRun(runId, tabId) {
    write(lockKey(runId), JSON.stringify({ tabId, at: now() }));
    channel?.postMessage({ type: 'claimed', runId, tabId });
}
/** The tab currently playing a run ({ tabId, at }), if any. Claims older than 6 h are stale. */
export function runLock(runId) {
    const l = parse(read(lockKey(runId)));
    return l && now() - (l.at || 0) < 6 * 3600 * 1000 ? l : null;
}

export function releaseRun(runId, tabId) {
    const cur = parse(read(lockKey(runId)));
    if (cur?.tabId === tabId) { try { storage().removeItem(lockKey(runId)); } catch { /* ignore */ } }
}

/* ── Migration from the single-save format ────────────────────────────── */

function legacyGrantFor(gs, savedAt) {
    const st = gs?.snapshot?.state;
    const stamped = Number(st?.packagingVersion) >= 2;
    if (stamped) return { grant: null, ambiguous: false };
    // Unstamped saves are pre-packaging only if they were made before the packaging shipped.
    // savedAt is a client timestamp: recorded for transparency, never trusted server-side.
    if (savedAt && savedAt < PACKAGING_CUTOFF) return { grant: 'local-pre-packaging', ambiguous: false };
    return { grant: null, ambiguous: true };
}

/**
 * Move scd_local_save_v1 into the run collection. Idempotent: the run ID is
 * derived from the save itself, and the original is removed only after the
 * replacement has been written and read back.
 * @returns {{ status: 'none'|'migrated'|'already'|'unreadable'|'failed', runId? }}
 */
export function migrateLegacyLocal() {
    const raw = read(LOCAL_SAVE_KEY);
    if (raw == null) return { status: 'none' };
    const rec = parse(raw);
    const gs = rec?.gameState;
    if (!gs || !validSnapshot(gs)) return { status: 'unreadable' };   // original kept untouched
    const runId = `lv1-${hash(`${rec.savedAt}|${gs.industryId}|${gs.snapshot?.state?.turn ?? gs.turn}|${gs.phase}`)}`;
    const markers = parse(read(MIGRATED_KEY)) || {};
    if (getMeta(runId)) {
        const check = loadRun(runId);
        if (!check.error) { try { storage().removeItem(LOCAL_SAVE_KEY); } catch { /* ignore */ } }
        return { status: 'already', runId };
    }
    const { grant, ambiguous } = legacyGrantFor(gs, rec.savedAt);
    const meta = createRun({
        industryId: gs.industryId, runId,
        extra: { createdAt: rec.savedAt || now(), importedFrom: 'local-v1', legacyGrant: grant, legacyAmbiguous: ambiguous || undefined },
    });
    if (!meta) return { status: 'failed' };
    const err = writeWithEviction(runId, runKey(runId), JSON.stringify(gs));
    if (err) { deleteLocalRun(runId); return { status: 'failed' }; }
    updateMeta(runId, { ...summarize(gs), localRev: 1, updatedAt: rec.savedAt || now() });
    const back = loadRun(runId);
    if (back.error) return { status: 'failed', runId };
    write(MIGRATED_KEY, JSON.stringify({ ...markers, localV1: runId, at: now() }));
    try { storage().removeItem(LOCAL_SAVE_KEY); } catch { /* ignore */ }
    return { status: 'migrated', runId };
}

/**
 * Import a run from an untrusted source (old email backup). Idempotent by source key.
 * @returns {{ ok, runId, existed? }}
 */
export function importRun({ gameState, owner, sourceKey, legacyGrant = null }) {
    if (!validSnapshot(gameState)) return { ok: false, reason: 'invalid' };
    const runId = `imp-${hash(sourceKey)}`;
    if (getMeta(runId)) return { ok: true, runId, existed: true };
    const meta = createRun({ industryId: gameState.industryId, owner, runId, extra: { importedFrom: 'cloud-legacy', legacyGrant, untrustedImport: true } });
    if (!meta) return { ok: false, reason: 'blocked' };
    const err = writeWithEviction(runId, runKey(runId), JSON.stringify(gameState));
    if (err) { deleteLocalRun(runId); return { ok: false, reason: err }; }
    updateMeta(runId, { ...summarize(gameState), localRev: 1 });
    return { ok: true, runId };
}
