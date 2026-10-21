/**
 * Access tokens: an HMAC-SHA256-signed statement of which entitlements an
 * email held when the server issued it. The browser can't forge one without
 * ENTITLEMENT_TOKEN_SECRET; the server re-checks the ledger on refresh, so
 * refunds and expiries take effect even for previously issued tokens.
 */

import crypto from 'crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, secret, ttlSec = 60 * 60 * 24 * 30) {
    const body = { ...payload, iat: Date.now(), exp: Date.now() + ttlSec * 1000 };
    const data = b64(JSON.stringify(body));
    const sig = b64(crypto.createHmac('sha256', secret).update(data).digest());
    return `${data}.${sig}`;
}

/** @returns {Object|null} payload if the signature is valid and the token isn't expired */
export function verifyToken(token, secret, now = Date.now()) {
    if (typeof token !== 'string' || !secret) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = b64(crypto.createHmac('sha256', secret).update(data).digest());
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (!payload.exp || payload.exp <= now) return null;
        return payload;
    } catch {
        return null;
    }
}

/** Timing-safe check of a Lemon Squeezy X-Signature header against the raw body. */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
    if (!secret || typeof signatureHeader !== 'string' || !signatureHeader) return false;
    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signatureHeader, 'utf8');
    const b = Buffer.from(digest, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const randomId = (bytes = 16) => crypto.randomBytes(bytes).toString('base64url');
