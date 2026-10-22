/**
 * Cloud-save configuration. Secrets stay server-side.
 *
 * What depends on what (see CLAUDE.md "Saves & cloud saves"):
 *   · Sessions are random IDs stored (hashed) in KV — no secret involved, so no
 *     secret rotation signs anyone out or affects saves.
 *   · Saved runs live under a random internal owner ID; the browser's owner tag
 *     is a plain hash of that ID — neither depends on a secret.
 *   · Only the email → owner LOOKUP key is keyed (so KV never holds raw emails
 *     or an unkeyed, dictionary-reversible hash). That key uses
 *     CLOUD_SAVE_ID_SECRET — an identity secret that is NOT routinely rotated
 *     and is independent of ENTITLEMENT_TOKEN_SECRET (purchase tokens).
 *     To rotate it anyway, keep the old value(s) in CLOUD_SAVE_ID_SECRET_PREVIOUS:
 *     verification finds the account under an old key and copies the mapping to
 *     the new key (idempotent; old mapping left intact).
 *   · One-time-code hashes and IP rate-limit keys also use it; rotating only
 *     invalidates codes that are in flight (10-minute life).
 *
 * Env:
 *   CLOUD_SAVE_ID_SECRET           — required for cloud saves (long random value; set once)
 *   CLOUD_SAVE_ID_SECRET_PREVIOUS  — optional, comma-separated former values (rotation only)
 *   CLOUD_SAVES_ENABLED            — optional; "false" switches cloud saves off (fallback; data kept)
 *   APP_URL                        — canonical origin (CSRF origin allowlist)
 *   KV_REST_API_URL / _TOKEN       — storage (cloud saves report "not configured" without them)
 */

import crypto from 'crypto';

export const SESSION_TTL      = 60 * 60 * 24 * 30;   // 30 days, sliding
export const RUN_TTL          = 60 * 60 * 24 * 365;  // each cloud campaign: 12 months after its last sync
export const OWNER_MAP_TTL    = 60 * 60 * 24 * 400;  // email→owner mapping, refreshed on sign-in
export const LEGACY_COPY_TTL  = 60 * 60 * 24 * 30;   // imported old email-backup copy
export const MAX_ACTIVE_RUNS  = 20;                  // storage budget per account
export const MAX_SNAPSHOT_BYTES = 600_000;
export const OTP_TTL          = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30_000;
export const LIMITS = { codePerEmailHour: 5, codePerIpHour: 20, verifyPerIpHour: 30 };
/** Saves stored before this instant predate the free-intro / Core packaging (deploy of 2026-10-21). */
export const PACKAGING_CUTOFF = Date.parse('2026-10-21T18:00:00Z');

const env = (n) => (process.env[n] ?? '').trim();

export function cloudConfig() {
    const secret = env('CLOUD_SAVE_ID_SECRET');
    const previousSecrets = env('CLOUD_SAVE_ID_SECRET_PREVIOUS').split(',').map(x => x.trim()).filter(x => x && x !== secret);
    const appUrl = env('APP_URL') || 'https://www.supplychaindisaster.com';
    const origins = new Set(['https://www.supplychaindisaster.com', 'https://supplychaindisaster.com']);
    try { origins.add(new URL(appUrl).origin); } catch { /* ignore */ }
    // Safe fallback switch: CLOUD_SAVES_ENABLED=false turns every cloud endpoint off
    // (503 "disabled"); device saves keep working and no stored data is touched.
    const enabled = env('CLOUD_SAVES_ENABLED').toLowerCase() !== 'false';
    return { secret, previousSecrets, enabled, origins, devInsecureCookies: env('SCD_DEV_MEMORY_STORE') === '1' };
}

/** HMAC with a purpose label — used for email/IP lookup keys and code hashes. */
export function keyed(secret, label, value) {
    return crypto.createHmac('sha256', secret).update(`${label}\u0000${value}`).digest('base64url');
}

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export function maskEmail(email) {
    const [user, domain] = normEmail(email).split('@');
    if (!domain) return '';
    return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`;
}

export const K = {
    owner:   (emailKey) => `sv:own:${emailKey}`,
    account: (owner) => `sv:acct:${owner}`,
    session: (sidHash) => `sv:sess:${sidHash}`,
    otp:     (emailKey) => `sv:otp:${emailKey}`,
    rate:    (name, who) => `sv:rate:${name}:${who}`,
    index:   (owner) => `sv:idx:${owner}`,
    // Immutable snapshot per write; the index entry says which one is current (and which is the checkpoint)
    snapshot: (owner, runId, writeId) => `sv:run:${owner}:${runId}:${writeId}`,
    indexVersion: (owner) => `sv:idxv:${owner}`,
    lock:    (owner) => `sv:lock:${owner}`,
    legacy:  (owner) => `sv:legacy:${owner}`,
    legacyOriginal: (email) => `game:${normEmail(email)}`,   // old unauthenticated record (read-only here)
};
