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
        /** Same contract as kvStore.commitIfOwner (atomic: single synchronous step). */
        async commitIfOwner({ lockKey, token, versionKey, expectedVersion, key, value, ex }) {
            if (alive(lockKey)?.v !== token) return 'lost_lock';
            const ver = Number(alive(versionKey)?.v || 0);
            if (ver !== expectedVersion) return 'version_moved';
            const exp = ex ? Date.now() + ex * 1000 : null;
            m.set(key, { v: JSON.parse(JSON.stringify(value)), exp });
            m.set(versionKey, { v: ver + 1, exp });
            return 'ok';
        },
        _map: m,
    };
}

/**
 * Atomic conditional write (Redis/Upstash EVAL): set `key` only if this caller
 * still holds the lock (value === token) AND the version counter is unchanged,
 * then bump the version. Values are compared exactly as kvStore.set stores
 * them (JSON text).
 */
const COMMIT_IF_OWNER = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'lost_lock' end
local v = tonumber(redis.call('GET', KEYS[2]) or '0')
if v ~= tonumber(ARGV[2]) then return 'version_moved' end
redis.call('SET', KEYS[3], ARGV[3], 'EX', tonumber(ARGV[4]))
redis.call('SET', KEYS[2], tostring(v + 1), 'EX', tonumber(ARGV[4]))
return 'ok'`;

/** Wrap @vercel/kv (values are stored as JSON). */
export function kvStore(kv) {
    // Values are written as JSON text. @upstash/redis already JSON-parses on read
    // and returns the raw string when that fails — so a stored string such as an
    // owner ID or lock token comes back unquoted. Parse again only when possible.
    const parse = (v) => {
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return v; }
    };
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
        async commitIfOwner({ lockKey, token, versionKey, expectedVersion, key, value, ex }) {
            return kv.eval(COMMIT_IF_OWNER, [lockKey, versionKey, key], [JSON.stringify(token), String(expectedVersion), JSON.stringify(value), String(ex || 31536000)]);
        },
    };
}

export const _COMMIT_IF_OWNER_LUA = COMMIT_IF_OWNER;   // exercised by tests

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
