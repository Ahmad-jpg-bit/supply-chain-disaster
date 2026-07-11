import { kv } from '@vercel/kv';
import { Resend } from 'resend';

/**
 * Spaced-recall email cron.
 *
 * Runs daily (see vercel.json crons). Finds players who saved progress ~3 and
 * ~10 days ago and sends each a single supply-chain scenario question that
 * pulls them back into the game — spaced retrieval, the same mechanic the
 * in-game board question uses. Each reminder is sent at most once (tracked in
 * a `recall:{email}` key).
 *
 * Dormant until Vercel KV is configured: with no store there are no saved
 * players to reach, so the handler is a clean no-op.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 80;           // safety cap
const APP_URL = 'https://www.supplychaindisaster.com';

// Reminder windows (days since save). Wider than a day to tolerate cron timing.
const WINDOWS = [
    { id: 'r3',  min: 3,  max: 5  },
    { id: 'r10', min: 10, max: 12 },
];

// Email-shaped recall questions, keyed loosely by the concept a player has met.
// r3 leans on early concepts; r10 on deeper ones.
const QUESTIONS = {
    r3: [
        {
            q: 'Retail demand nudged up 5%, but your factory orders swung 40%. What just happened — and what fixes it?',
            a: 'The bullwhip effect: each tier reacts to orders, not real demand, and pads its own buffer. The cure is sharing the true demand signal downstream-to-upstream.',
        },
        {
            q: 'Your forecast ran a 20% MAPE last quarter. In plain terms, what did that cost you?',
            a: 'On average every fifth unit was planned wrong — either cash frozen in excess stock or a missed sale. Lower MAPE, tighter inventory.',
        },
    ],
    r10: [
        {
            q: 'A supplier quotes 20% below the incumbent. Under Total Cost of Ownership, when is the cheaper quote the worse deal?',
            a: 'When defects, expedited freight, inspection, and longer lead times cost more than the 20% saved. A cheap unit price can carry 35–50% higher total cost.',
        },
        {
            q: 'Daily demand averages 100 units, lead time is 10 days, and you hold 50 units of safety stock. Where is your reorder point?',
            a: 'ROP = (demand × lead time) + safety stock = (100 × 10) + 50 = 1,050 units. Order there and the replenishment lands as the buffer is reached.',
        },
    ],
};

function pickQuestion(windowId, record) {
    const pool = QUESTIONS[windowId] || QUESTIONS.r3;
    // Vary by a stable hash of the email so the same person gets a consistent pick
    const email = (record.email || '').toLowerCase();
    let h = 0;
    for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
}

function recallEmailHtml({ question, resumeChapter }) {
    const resumeLine = resumeChapter
        ? `Your operation is paused at <strong style="color:#8b8fa8;">Chapter ${resumeChapter}</strong>. Enter your email in Save &amp; Resume to pick up exactly where you left off.`
        : `Jump back in — no account needed.`;
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);">
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background:#0d1020;padding:36px 44px 24px;">
            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.35);border-radius:20px;padding:5px 14px;">
                <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89cff;">&#9632; QUARTERLY DRILL</span>
              </td></tr>
            </table>
            <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#f0f2ff;line-height:1.3;">One question from the floor.</h1>
            <p style="margin:0;font-size:15px;color:#c8ccd8;line-height:1.7;">${question.q}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#080b14;padding:22px 44px 8px;">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">The answer</p>
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.7;">${question.a}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#080b14;padding:20px 44px 8px;">
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">${resumeLine}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#080b14;padding:22px 44px 36px;">
            <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;overflow:hidden;">
              <a href="${APP_URL}/play" style="display:inline-block;background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:15px 40px;border-radius:10px;">Run the Next Quarter &rarr;</a>
            </td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#080b14;padding:16px 44px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:#3a4256;line-height:1.6;text-align:center;">
              You're getting this because you saved progress at supplychaindisaster.com.
              Prefer not to receive drills? <a href="${APP_URL}/contact" style="color:#5a6178;">Let us know</a> and we'll stop.
            </p>
          </td>
        </tr>
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
    // Only allow the scheduled invocation (Vercel sends the CRON_SECRET bearer).
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const auth = req.headers['authorization'] || '';
        if (auth !== `Bearer ${secret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (!kvConfigured) {
        return res.status(200).json({ ok: true, skipped: 'kv-not-configured', sent: 0 });
    }
    if (!process.env.RESEND_API_KEY) {
        return res.status(200).json({ ok: true, skipped: 'resend-not-configured', sent: 0 });
    }

    const dryRun = req.query?.dry === '1';
    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = Date.now();

    let scanned = 0, eligible = 0, sent = 0;

    try {
        // Iterate saved-game records. kv.scan avoids loading every key at once.
        let cursor = 0;
        do {
            const [next, keys] = await kv.scan(cursor, { match: 'game:*', count: 100 });
            cursor = Number(next);

            for (const key of keys) {
                if (sent >= MAX_PER_RUN) break;
                scanned++;

                const raw = await kv.get(key);
                if (!raw) continue;
                const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!record?.email || !record?.savedAt) continue;

                const days = (now - record.savedAt) / DAY;
                const windowMatch = WINDOWS.find(w => days >= w.min && days < w.max);
                if (!windowMatch) continue;

                // Skip if this reminder already went out
                const recallKey = `recall:${record.email.toLowerCase()}`;
                const rawSent = await kv.get(recallKey);
                const sentMap = rawSent ? (typeof rawSent === 'string' ? JSON.parse(rawSent) : rawSent) : {};
                if (sentMap[windowMatch.id]) continue;

                eligible++;
                if (dryRun) continue;

                const question = pickQuestion(windowMatch.id, record);
                const resumeChapter = record.gameState ? (record.gameState.chapterIndex || 0) + 1 : null;

                try {
                    await resend.emails.send({
                        from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
                        to:      record.email,
                        subject: windowMatch.id === 'r3'
                            ? 'A quick supply chain drill — pick up where you left off'
                            : 'Still on the shelf? One question before you forget',
                        html: recallEmailHtml({ question, resumeChapter }),
                    });
                    sentMap[windowMatch.id] = now;
                    await kv.set(recallKey, JSON.stringify(sentMap), { ex: 60 * 60 * 24 * 200 });
                    sent++;
                } catch (err) {
                    console.error('[recall-cron] send failed for', record.email, err?.message);
                }
            }
        } while (cursor !== 0 && sent < MAX_PER_RUN);

        return res.status(200).json({ ok: true, scanned, eligible, sent, dryRun });
    } catch (err) {
        console.error('[recall-cron] error:', err);
        return res.status(500).json({ error: 'Cron run failed.' });
    }
}
