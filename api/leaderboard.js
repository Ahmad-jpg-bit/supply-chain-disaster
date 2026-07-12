import { kv } from '@vercel/kv';

/**
 * Weekly challenge leaderboard, backed by a Vercel KV sorted set per week.
 *
 *   GET  /api/leaderboard?weekId=2026-W28   → { weekId, entries: [{name, score, industryId, rank}] }
 *   POST /api/leaderboard { weekId, name, score, industryId } → { ok, rank }
 *
 * No-op with empty board when KV isn't configured.
 */

const WEEK_RE = /^\d{4}-W\d{2}$/;
const KEY = (weekId) => `lb:${weekId}`;
const TTL = 60 * 60 * 24 * 21;   // 21 days
const TOP_N = 25;
const MAX_SCORE = 10_000_000;    // sanity cap (honour-system anti-cheat)

const kvOk = () => !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function cleanName(raw) {
    return String(raw || 'Anonymous')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 20) || 'Anonymous';
}

/** Parse a zrange({ withScores:true }) result into [{member, score}]. */
function parsePairs(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
        let member = arr[i];
        try { member = typeof member === 'string' ? JSON.parse(member) : member; } catch { /* keep raw */ }
        out.push({ member, score: Number(arr[i + 1]) });
    }
    return out;
}

export default async function handler(req, res) {
    // ── Read the board ────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const weekId = req.query?.weekId;
        if (!weekId || !WEEK_RE.test(weekId)) {
            return res.status(400).json({ error: 'Valid weekId required.' });
        }
        if (!kvOk()) return res.status(200).json({ weekId, entries: [] });

        try {
            const raw = await kv.zrange(KEY(weekId), 0, TOP_N - 1, { rev: true, withScores: true });
            const entries = parsePairs(raw).map((e, i) => ({
                rank: i + 1,
                name: e.member?.name ?? 'Anonymous',
                industryId: e.member?.industryId ?? null,
                score: e.score,
            }));
            return res.status(200).json({ weekId, entries });
        } catch (err) {
            console.error('[leaderboard] read error:', err);
            return res.status(200).json({ weekId, entries: [] });
        }
    }

    // ── Submit a score ────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const { weekId, name, score, industryId } = req.body || {};
        if (!weekId || !WEEK_RE.test(weekId)) {
            return res.status(400).json({ error: 'Valid weekId required.' });
        }
        const numScore = Number(score);
        if (!Number.isFinite(numScore) || numScore < 0 || numScore > MAX_SCORE) {
            return res.status(400).json({ error: 'Invalid score.' });
        }
        if (!kvOk()) return res.status(200).json({ ok: false, skipped: 'kv-not-configured' });

        const member = JSON.stringify({
            name: cleanName(name),
            industryId: String(industryId || '').slice(0, 20),
            ts: Date.now(),
            r: Math.random().toString(36).slice(2, 8),   // dedupe distinct entries
        });

        try {
            await kv.zadd(KEY(weekId), { score: numScore, member });
            await kv.expire(KEY(weekId), TTL);
            // Rank = number of strictly-higher scores + 1
            const higher = await kv.zcount(KEY(weekId), `(${numScore}`, '+inf');
            return res.status(200).json({ ok: true, rank: (Number(higher) || 0) + 1 });
        } catch (err) {
            console.error('[leaderboard] write error:', err);
            return res.status(500).json({ error: 'Failed to submit score.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
