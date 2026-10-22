/**
 * Cloud-save configuration. Secrets stay server-side; every sub-key is derived
 * from one secret with a distinct label so a leak of one purpose's value
 * can't be replayed for another.
 *
 * Env:
 *   CLOUD_SAVE_SECRET         — optional; defaults to ENTITLEMENT_TOKEN_SECRET
 *   ENTITLEMENT_TOKEN_SECRET  — already required for purchases
 *   APP_URL                   — canonical origin (CSRF origin allowlist)
 *   KV_REST_API_URL / _TOKEN  — storage (cloud saves report "not configured" without them)
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
    const secret = env('CLOUD_SAVE_SECRET') || env('ENTITLEMENT_TOKEN_SECRET');
    const appUrl = env('APP_URL') || 'https://www.supplychaindisaster.com';
    const origins = new Set(['https://www.supplychaindisaster.com', 'https://supplychaindisaster.com']);
    try { origins.add(new URL(appUrl).origin); } catch { /* ignore */ }
    return { secret, origins, devInsecureCookies: env('SCD_DEV_MEMORY_STORE') === '1' };
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
    run:     (owner, runId) => `sv:run:${owner}:${runId}`,
    cp:      (owner, runId) => `sv:cp:${owner}:${runId}`,
    lock:    (owner) => `sv:lock:${owner}`,
    legacy:  (owner) => `sv:legacy:${owner}`,
    legacyOriginal: (email) => `game:${normEmail(email)}`,   // old unauthenticated record (read-only here)
};
