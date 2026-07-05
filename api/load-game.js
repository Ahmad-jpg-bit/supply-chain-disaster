import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email required.' });
    }

    const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (!kvConfigured) return res.status(200).json({ found: false });

    try {
        const key = `game:${email.toLowerCase()}`;
        const raw = await kv.get(key);

        if (!raw) return res.status(200).json({ found: false });

        const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return res.status(200).json({ found: true, ...record });
    } catch (err) {
        console.error('[load-game] KV error:', err);
        return res.status(200).json({ found: false });
    }
}
