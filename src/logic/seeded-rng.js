/**
 * Seeded RNG + weekly challenge config.
 *
 * The weekly challenge is an Endless run where every player that week faces the
 * SAME crisis and demand sequence, so scores are comparable. That requires a
 * deterministic PRNG (seeded from the ISO week) threaded through the engine's
 * random draws, and a fixed industry for the week (draw counts stay identical
 * across players, keeping the stream in sync).
 */

/** mulberry32 — small, fast, deterministic PRNG returning [0,1). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a string hash → uint32. */
function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** ISO-8601 week id, e.g. "2026-W28" (UTC). */
export function isoWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;      // Mon=0 … Sun=6
    d.setUTCDate(d.getUTCDate() - dayNum + 3);    // Thursday of this week
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const ftDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNum + 3);
    const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const INDUSTRY_CYCLE = ['electronics', 'fmcg', 'pharma'];

/**
 * The current week's challenge: a shared week id, seed, and fixed industry.
 * @returns {{ weekId: string, seed: number, industryId: string }}
 */
export function getWeeklyChallenge(date = new Date()) {
    const weekId = isoWeekId(date);
    const seed = hashStr(weekId);
    return { weekId, seed, industryId: INDUSTRY_CYCLE[seed % INDUSTRY_CYCLE.length] };
}
