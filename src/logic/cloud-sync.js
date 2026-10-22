/**
 * Cloud sync for account-owned runs.
 *
 * Local saving never waits for the network: the run store is written first,
 * and the "outbox" is simply each run's meta (localRev > ackedLocalRev, plus a
 * persisted in-flight marker), so pending work survives reloads. Writes are
 * coalesced per run (one request in flight, debounced; drafts wait longer),
 * retried with capped exponential backoff, and resumed on reconnect, on the
 * tab becoming visible and after signing in again.
 *
 * Conflicts: the server keeps a revision per run. A write based on an older
 * revision is rejected; the cloud version is then kept beside the local one
 * and the player chooses — snapshots are never merged and the
 * farthest-progressed copy is not assumed to be right.
 */

import * as RS from './run-store.js';
import { track } from '../shared/track.js';

const HINT_KEY = 'scd_cloud_hint';            // { owner, email } — display only, no secrets
const DEBOUNCE = { urgent: 1500, draft: 15000 };
const BACKOFF_MS = [2000, 5000, 15000, 45000, 120000, 300000];
const MAX_ATTEMPTS_PER_PAGE = 8;

let fetchFn = (...a) => globalThis.fetch(...a);
/** Tests: inject fetch. */
export function _setFetch(f) { fetchFn = f; }

const session = { known: false, available: true, signedIn: false, owner: null, email: '', csrf: null, legacy: null, retentionDays: 365 };
const runtime = new Map();   // runId → { timer, inflight, attempts, failedOnce, okOnce }
const listeners = new Set();
/** setTimeout that never keeps a non-browser runtime (tests) alive. */
const later = (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; };
const notify = (runId = null) => listeners.forEach(fn => { try { fn(runId); } catch { /* isolated */ } });
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let tabId = null;
/** The game tab's ID: only the tab playing a run syncs it (two tabs of one device never race). */
export function setTabId(id) { tabId = id; }
const ownedByOtherTab = (runId) => { const l = RS.runLock(runId); return Boolean(l && l.tabId !== tabId); };

const readHint = () => { try { return JSON.parse(localStorage.getItem(HINT_KEY) || 'null'); } catch { return null; } };
const writeHint = (h) => { try { h ? localStorage.setItem(HINT_KEY, JSON.stringify(h)) : localStorage.removeItem(HINT_KEY); } catch { /* ignore */ } };

/** Owner tag to use for listing before the session check returns (display only). */
export function ownerTag() { return session.signedIn ? session.owner : (session.known ? null : readHint()?.owner || null); }
export const getSession = () => ({ ...session, hint: readHint() });

async function api(method, path, body) {
    const headers = { 'x-scd-client': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (session.csrf) headers['x-scd-csrf'] = session.csrf;
    let res;
    try {
        res = await fetchFn(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        return { status: 0, body: { error: 'network' } };
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
}

/* ── Session ──────────────────────────────────────────────────────────── */

export async function refreshSession() {
    const r = await api('GET', '/api/cloud-account');
    if (r.status === 0) { session.known = false; notify(); return session; }   // offline: keep hint
    if (r.status !== 200) {
        Object.assign(session, { known: true, available: false, signedIn: false, csrf: null });
        notify(); return session;
    }
    const b = r.body;
    Object.assign(session, {
        known: true, available: b.available !== false, signedIn: Boolean(b.signedIn), owner: b.owner || null,
        email: b.email || '', csrf: b.csrf || null, legacy: b.legacy || null, retentionDays: b.retentionDays || 365,
    });
    if (session.signedIn) writeHint({ owner: session.owner, email: session.email });
    notify();
    if (session.signedIn) flushAll();
    return session;
}

export async function requestCode(email) {
    const r = await api('POST', '/api/cloud-account', { action: 'request-code', email });
    return r.status === 200 ? { ok: true } : { ok: false, error: r.body.error || 'network', retryAfterMs: r.body.retryAfterMs };
}

/**
 * Verify the emailed code. On success the account's session starts; the run
 * the player is in (if a guest run) becomes account-owned so it can sync.
 * Never grants purchases.
 */
export async function verifyCode(email, code, { adoptRunId = null, source = 'panel' } = {}) {
    const r = await api('POST', '/api/cloud-account', { action: 'verify-code', email, code });
    if (r.status !== 200) return { ok: false, error: r.body.error || 'network' };
    const prevHint = readHint();
    Object.assign(session, {
        known: true, available: true, signedIn: true, owner: r.body.owner, email: r.body.email,
        csrf: r.body.csrf, legacy: r.body.legacy || null,
    });
    writeHint({ owner: session.owner, email: session.email });
    // Account switch on this browser: the previous account's local copies stay hidden and unsynced
    if (prevHint?.owner && prevHint.owner !== session.owner) track('cloud_account_switched', {});
    if (adoptRunId) adoptRun(adoptRunId);
    track('cloud_save_verification_completed', { source });
    notify();
    flushAll();
    return { ok: true };
}

/** Make a guest run account-owned (the player chose to sync it). */
export function adoptRun(runId) {
    const m = RS.getMeta(runId);
    if (!m || !session.signedIn || m.owner !== 'guest') return false;
    RS.updateMeta(runId, { owner: session.owner, cloud: true, cloudRev: 0, ackedLocalRev: 0 });
    schedule(runId, 'urgent');
    return true;
}

/** @returns {{ pendingRuns: Array }} runs of this account with changes not yet synced */
export function unsyncedForSignOut() {
    return RS.allMetas().filter(m => m.owner === session.owner && RS.isPending(m));
}

/**
 * Sign out: ends the session and removes this account's runs from this browser
 * (they're in the cloud; unsynced changes were shown to the player first).
 */
export async function signOut() {
    const owner = session.owner;
    await api('POST', '/api/cloud-account', { action: 'sign-out' });
    for (const [id, rt] of runtime) clearTimeout(rt.timer), runtime.delete(id);
    if (owner) RS.removeOwnerRuns(owner);
    Object.assign(session, { known: true, signedIn: false, owner: null, email: '', csrf: null, legacy: null });
    writeHint(null);
    notify();
}

/* ── Status ───────────────────────────────────────────────────────────── */

/**
 * @returns {{ local: 'saved'|'failed'|'none', cloud: 'device'|'syncing'|'synced'|'pending'|'signin'|'conflict'|'deleted'|'unavailable', text: string }}
 */
export function statusFor(meta) {
    if (!meta) return { local: 'none', cloud: 'device', text: '' };
    const local = meta.localError ? 'failed' : (meta.localRev > 0 ? 'saved' : 'none');
    let cloud = 'device';
    if (meta.cloud) {
        const rt = runtime.get(meta.runId);
        if (meta.conflict) cloud = 'conflict';
        else if (meta.cloudDeleted) cloud = 'deleted';
        else if (!session.signedIn || session.owner !== meta.owner) cloud = 'signin';
        else if (rt?.inflight) cloud = 'syncing';
        else if (RS.isPending(meta)) cloud = 'pending';
        else cloud = 'synced';
    }
    return { local, cloud, text: statusText(local, cloud) };
}

export function statusText(local, cloud) {
    if (local === 'failed') {
        return cloud === 'synced' ? 'Could not save on this device. Your last cloud copy is safe.' : 'Could not save on this device (storage is full or blocked).';
    }
    switch (cloud) {
        case 'syncing': return 'Saved on this device · syncing…';
        case 'synced': return 'Saved on this device · synced to the cloud.';
        case 'pending': return 'Saved on this device; cloud sync pending.';
        case 'signin': return 'Saved on this device. Sign in again to sync.';
        case 'conflict': return 'Saved on this device. This campaign also changed on another device — choose a version.';
        case 'deleted': return 'Saved on this device. This campaign was deleted from the cloud on another device.';
        default: return local === 'saved' ? 'Saved on this device.' : '';
    }
}

/* ── Outbox ───────────────────────────────────────────────────────────── */

const rt = (runId) => { if (!runtime.has(runId)) runtime.set(runId, { timer: null, inflight: false, attempts: 0 }); return runtime.get(runId); };

/** Queue a sync for a run after a local save (urgent = committed choice / resolved turn / phase change). */
export function schedule(runId, kind = 'urgent') {
    const m = RS.getMeta(runId);
    if (!m?.cloud || !session.signedIn || m.owner !== session.owner || m.conflict || m.cloudDeleted) { notify(runId); return; }
    const r = rt(runId);
    const delay = DEBOUNCE[kind] ?? DEBOUNCE.urgent;
    // Coalesce: an earlier pending timer wins if it fires sooner
    if (r.timer && r.due && r.due <= Date.now() + delay) return;
    clearTimeout(r.timer);
    r.due = Date.now() + delay;
    r.timer = later(() => { r.timer = null; flush(runId); }, delay);
    notify(runId);
}

/** Retry everything pending for the signed-in account (reconnect, visible again, signed in). */
export function flushAll() {
    if (!session.signedIn) return;
    for (const m of RS.allMetas()) {
        if (m.owner === session.owner && (RS.isPending(m) || m.inflight)) {
            const r = rt(m.runId);
            if (r.attempts >= MAX_ATTEMPTS_PER_PAGE) r.attempts = 0;   // a new trigger gets a fresh budget
            flush(m.runId);
        }
    }
}

export async function flush(runId) {
    const r = rt(runId);
    if (r.inflight) { r.again = true; return; }
    let m = RS.getMeta(runId);
    if (!m?.cloud || !session.signedIn || m.owner !== session.owner || m.conflict || m.cloudDeleted) return;
    if (ownedByOtherTab(runId)) return;   // that tab syncs it
    r.inflight = true; notify(runId);
    try {
        // A previous attempt whose outcome is unknown (lost response / closed tab): did it land?
        if (m.inflight?.writeId) {
            const head = await api('GET', `/api/cloud-runs?id=${encodeURIComponent(runId)}&head=1`);
            if (head.status === 200 && head.body.writeId === m.inflight.writeId) {
                m = RS.ackSync(runId, { sentLocalRev: m.inflight.sentLocalRev, rev: head.body.rev, updatedAt: head.body.updatedAt });
            } else if (head.status === 0) { return backoff(runId, 'network'); }
            else m = RS.updateMeta(runId, { inflight: null });
        }
        if (!RS.isPending(m)) { okOnce(runId); return; }

        const loaded = RS.loadRun(runId);
        if (loaded.error) return failOnce(runId, 'local_unreadable');
        const sentLocalRev = loaded.meta.localRev;
        const writeId = RS.newId('w');
        RS.updateMeta(runId, { inflight: { writeId, sentLocalRev, expectedRev: m.cloudRev || 0 } });
        const res = await api('PUT', '/api/cloud-runs', {
            runId, expectedRev: m.cloudRev || 0, writeId,
            meta: { ...pickMeta(loaded.meta), schema: RS.RUN_SCHEMA },
            snapshot: loaded.snapshot,
        });
        if (res.status === 200) {
            RS.ackSync(runId, { sentLocalRev, rev: res.body.rev, updatedAt: res.body.updatedAt });
            r.attempts = 0;
            okOnce(runId);
            if (RS.isPending(RS.getMeta(runId))) schedule(runId, 'urgent');   // newer edits arrived meanwhile
            return;
        }
        RS.updateMeta(runId, { inflight: null });
        if (res.status === 409 && res.body.error === 'conflict') return captureConflict(runId, res.body);
        if (res.status === 410) {
            RS.updateMeta(runId, { cloudDeleted: true });
            track('cloud_sync_failed', { reason: 'deleted_elsewhere' }, `deleted:${runId}`);
            return;
        }
        if (res.status === 401) { session.signedIn = false; session.csrf = null; failOnce(runId, 'signed_out'); return; }
        if (res.status === 409 && res.body.error === 'run_limit') { RS.updateMeta(runId, { syncError: 'run_limit' }); failOnce(runId, 'run_limit'); return; }
        if (res.status === 413) { RS.updateMeta(runId, { syncError: 'too_large' }); failOnce(runId, 'too_large'); return; }
        return backoff(runId, res.status === 0 ? 'network' : `http_${res.status}`);
    } finally {
        r.inflight = false;
        notify(runId);
        if (r.again) { r.again = false; schedule(runId, 'urgent'); }
    }
}

const pickMeta = (m) => ({
    industryId: m.industryId, createdAt: m.createdAt, chapterNumber: m.chapterNumber, turn: m.turn, phase: m.phase,
    chaptersCompleted: m.chaptersCompleted, totalChapters: m.totalChapters, status: m.status, cash: m.cash, contentVersion: m.contentVersion || null,
});

function backoff(runId, reason) {
    const r = rt(runId);
    r.attempts += 1;
    failOnce(runId, reason);
    if (r.attempts >= MAX_ATTEMPTS_PER_PAGE) return;   // stays pending; resumes on the next trigger
    clearTimeout(r.timer);
    const delay = BACKOFF_MS[Math.min(r.attempts - 1, BACKOFF_MS.length - 1)];
    r.due = Date.now() + delay;
    r.timer = later(() => { r.timer = null; flush(runId); }, delay);
}

// High-volume events are sampled down to the first success / first failure per run per page
function okOnce(runId) { track('cloud_sync_succeeded', {}, `ok:${runId}`); }
function failOnce(runId, reason) { track('cloud_sync_failed', { reason }, `fail:${runId}:${reason}`); }

/* ── Conflicts ────────────────────────────────────────────────────────── */

async function captureConflict(runId, info) {
    const remote = await api('GET', `/api/cloud-runs?id=${encodeURIComponent(runId)}`);
    if (remote.status !== 200 || !remote.body.snapshot) { backoff(runId, 'conflict_fetch'); return; }
    RS.saveConflictCopy(runId, { snapshot: remote.body.snapshot, rev: remote.body.rev, updatedAt: remote.body.updatedAt, meta: remote.body.meta });
    RS.updateMeta(runId, { conflict: { rev: remote.body.rev, updatedAt: remote.body.updatedAt, meta: remote.body.meta || info.meta || null } });
    const m = RS.getMeta(runId);
    if (RS.markOnce(runId, `conflict:${remote.body.rev}`)) {
        track('save_conflict_detected', { run_id: runId, industry_id: m?.industryId, chapter: m?.chapterNumber, cloud_chapter: remote.body.meta?.chapterNumber ?? null });
    }
}

/**
 * The player picks which version to continue. The other is kept as a separate
 * device-only copy so nothing is lost.
 * @param {'device'|'cloud'} choice
 */
export function resolveConflict(runId, choice) {
    const m = RS.getMeta(runId);
    const remote = RS.readConflictCopy(runId);
    const local = RS.loadRun(runId);
    if (!m || !remote || local.error) return { ok: false };
    const keepCopy = (gs, label) => {
        const copy = RS.createRun({ industryId: m.industryId, owner: 'guest', extra: { copyOf: runId, copyLabel: label, legacyGrant: m.legacyGrant || null } });
        if (copy) RS.replaceRun(copy.runId, gs, { localRev: 1 });
        return copy?.runId;
    };
    if (choice === 'device') {
        keepCopy(remote.snapshot, 'cloud');
        // Continue the device version: next write is based on the cloud's current revision
        RS.updateMeta(runId, { conflict: null, cloudRev: remote.rev, ackedLocalRev: 0 });
    } else {
        keepCopy(local.snapshot, 'device');
        const res = RS.replaceRun(runId, remote.snapshot, { conflict: null, cloudRev: remote.rev });
        if (!res.ok) return { ok: false };
        const now = RS.getMeta(runId);
        RS.updateMeta(runId, { localRev: (now.localRev || 0) + 1, ackedLocalRev: (now.localRev || 0) + 1, lastSyncedAt: remote.updatedAt });
    }
    RS.clearConflictCopy(runId);
    track('save_conflict_resolved', { choice });
    schedule(runId, 'urgent');
    notify(runId);
    return { ok: true };
}

/* ── Other devices' runs ──────────────────────────────────────────────── */

/**
 * Compare the account's cloud runs with this browser:
 *  - cloud runs missing here are listed for download
 *  - local copies with no pending edits are fast-forwarded to a newer cloud revision
 *  - local copies with pending edits and a newer cloud revision become conflicts
 *  - runs deleted elsewhere are flagged (never silently removed or recreated)
 * @returns {Promise<{ remoteOnly: Array, error?: string }>}
 */
export async function reconcile() {
    if (!session.signedIn) return { remoteOnly: [] };
    const r = await api('GET', '/api/cloud-runs');
    if (r.status !== 200) return { remoteOnly: [], error: r.status === 0 ? 'network' : `http_${r.status}` };
    const remoteOnly = [];
    for (const c of r.body.runs || []) {
        const m = RS.getMeta(c.runId);
        if (!m) { if (!c.deleted) remoteOnly.push(c); continue; }
        if (m.owner !== session.owner) continue;
        if (c.deleted) { if (!m.cloudDeleted) RS.updateMeta(c.runId, { cloudDeleted: true }); continue; }
        if (c.rev > (m.cloudRev || 0) && !m.conflict) {
            if (RS.isPending(m)) await captureConflict(c.runId, c);
            else await downloadInto(c.runId);
        }
    }
    notify();
    return { remoteOnly };
}

async function downloadInto(runId) {
    const full = await api('GET', `/api/cloud-runs?id=${encodeURIComponent(runId)}`);
    if (full.status !== 200 || !full.body.snapshot) return { ok: false };
    const m = RS.getMeta(runId);
    const res = RS.replaceRun(runId, full.body.snapshot, { cloudRev: full.body.rev, lastSyncedAt: full.body.updatedAt, updatedAt: full.body.updatedAt });
    if (!res.ok) return { ok: false };
    const lr = (m.localRev || 0) + 1;
    RS.updateMeta(runId, { localRev: lr, ackedLocalRev: lr });
    return { ok: true };
}

/** Bring a run that only exists in the cloud to this browser. */
export async function downloadRemote(c) {
    const full = await api('GET', `/api/cloud-runs?id=${encodeURIComponent(c.runId)}`);
    if (full.status !== 200 || !full.body.snapshot) return { ok: false, error: full.body.error || 'network' };
    const meta = RS.createRun({ industryId: full.body.snapshot.industryId, owner: session.owner, runId: c.runId, extra: { createdAt: c.meta?.createdAt || Date.now() } });
    if (!meta) return { ok: false, error: 'storage' };
    const res = RS.replaceRun(c.runId, full.body.snapshot, { cloudRev: full.body.rev, lastSyncedAt: full.body.updatedAt, updatedAt: full.body.updatedAt, localRev: 1, ackedLocalRev: 1 });
    return res.ok ? { ok: true, runId: c.runId } : { ok: false, error: res.reason };
}

/** Delete a run here and (if it's synced) in the cloud. */
export async function deleteEverywhere(runId) {
    const m = RS.getMeta(runId);
    if (m?.cloud && m.cloudRev > 0 && session.signedIn && m.owner === session.owner) {
        const r = await api('DELETE', `/api/cloud-runs?id=${encodeURIComponent(runId)}&expectedRev=${m.conflict ? m.conflict.rev : m.cloudRev}`);
        if (r.status === 409) return { ok: false, error: 'changed_elsewhere' };
        if (r.status !== 200) return { ok: false, error: r.status === 0 ? 'network' : 'server' };
    }
    RS.deleteLocalRun(runId);
    notify();
    return { ok: true };
}

/** Delete a cloud-only run (not present on this device). */
export async function deleteRemote(runId, rev) {
    const r = await api('DELETE', `/api/cloud-runs?id=${encodeURIComponent(runId)}&expectedRev=${rev}`);
    return r.status === 200 ? { ok: true } : { ok: false, error: r.status === 409 ? 'changed_elsewhere' : 'network' };
}

/* ── Old email backup ─────────────────────────────────────────────────── */

/**
 * Import the old email backup (verified email only) as an account run. The
 * copy is untrusted game data; a pre-packaging grant is recorded only when the
 * server's own timestamp predates the packaging.
 */
export async function importLegacy() {
    const r = await api('POST', '/api/cloud-account', { action: 'legacy' });
    if (r.status !== 200) return { ok: false, error: r.body.error || 'network' };
    const res = RS.importRun({
        gameState: r.body.gameState, owner: session.owner,
        sourceKey: `${session.owner}:${r.body.savedAt}:${r.body.gameState?.industryId}`,
        legacyGrant: r.body.preLaunch ? 'cloud-pre-packaging' : null,
    });
    if (!res.ok) return res;
    await api('POST', '/api/cloud-account', { action: 'legacy-dismiss' });
    session.legacy = null;
    schedule(res.runId, 'urgent');
    notify();
    return res;
}

export async function dismissLegacy() {
    await api('POST', '/api/cloud-account', { action: 'legacy-dismiss' });
    session.legacy = null;
    notify();
}

/* ── Lifecycle ────────────────────────────────────────────────────────── */

let started = false;
export function start() {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('online', () => flushAll());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { if (session.signedIn) flushAll(); else if (readHint()) refreshSession(); }
    });
    refreshSession();
}
