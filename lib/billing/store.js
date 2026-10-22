/**
 * Minimal key-value store used by the billing ledger: Vercel KV in
 * production, an in-memory map in tests. Every key is namespaced by provider
 * mode (live/test) so test purchases can never grant live access.
 */

export function memoryStore() {
    const m = new Map();
    const alive = (k) => {
        const e = m.get(k);
        if (!e) return null;
        if (e.exp && e.exp <= Date.now()) { m.delete(k); return null; }
        return e;
    };
    return {
        async get(k) { return alive(k)?.v ?? null; },
        async set(k, v, opts = {}) {
            if (opts.nx && alive(k)) return null;
            m.set(k, { v: JSON.parse(JSON.stringify(v)), exp: opts.ex ? Date.now() + opts.ex * 1000 : null });
            return 'OK';
        },
        async del(k) { m.delete(k); },
        async incr(k, ttlSec) {
            const e = alive(k);
            const n = (e ? Number(e.v) : 0) + 1;
            m.set(k, { v: n, exp: e?.exp ?? (ttlSec ? Date.now() + ttlSec * 1000 : null) });
            return n;
        },
        _map: m,
    };
}

/** Wrap @vercel/kv (values are stored as JSON). */
export function kvStore(kv) {
    const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    return {
        async get(k) { const v = await kv.get(k); return v == null ? null : parse(v); },
        async set(k, v, opts = {}) {
            const o = {};
            if (opts.ex) o.ex = opts.ex;
            if (opts.nx) o.nx = true;
            return kv.set(k, JSON.stringify(v), o);
        },
        async del(k) { return kv.del(k); },
        async incr(k, ttlSec) {
            const n = await kv.incr(k);
            if (n === 1 && ttlSec) await kv.expire(k, ttlSec);
            return n;
        },
    };
}

let _default = null;
/** The production store, or null when KV isn't configured (billing then reports not_configured). */
export async function defaultStore() {
    if (_default) return _default;
    if (!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) {
        // Local test harness only (never on Vercel production): in-memory storage
        if (process.env.SCD_DEV_MEMORY_STORE === '1' && process.env.VERCEL_ENV !== 'production') return (_default = memoryStore());
        return null;
    }
    const { kv } = await import('@vercel/kv');
    _default = kvStore(kv);
    return _default;
}

export const keys = (mode) => ({
    order:   (id) => `${mode}:bill:order:${id}`,
    sub:     (id) => `${mode}:bill:sub:${id}`,
    account: (email) => `${mode}:bill:acct:${String(email).toLowerCase()}`,
    claim:   (id) => `${mode}:bill:claim:${id}`,
    otp:     (email) => `${mode}:bill:otp:${String(email).toLowerCase()}`,
    rate:    (name, who) => `${mode}:bill:rate:${name}:${String(who).toLowerCase()}`,
});
