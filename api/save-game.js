import { kv } from '@vercel/kv';
import { Resend } from 'resend';

const INDUSTRY_LABELS = {
    electronics: 'Electronics',
    fmcg:        'Consumer Goods',
    pharma:      'Pharmaceuticals',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, gameState, sendEmail = false } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email required.' });
    }

    const key    = `game:${email.toLowerCase()}`;
    const record = { email, savedAt: Date.now(), version: 1, gameState: gameState || null };

    // Persist to Vercel KV (180-day TTL, refreshed on each save)
    const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (kvConfigured) {
        try {
            await kv.set(key, JSON.stringify(record), { ex: 60 * 60 * 24 * 180 });
        } catch (err) {
            console.error('[save-game] KV error:', err);
            return res.status(500).json({ error: 'Failed to save progress.' });
        }
    }

    // Confirmation email — only on explicit saves (not silent auto-saves)
    if (sendEmail && process.env.RESEND_API_KEY) {
        const resend      = new Resend(process.env.RESEND_API_KEY);
        const chapterNum  = gameState ? (gameState.chapterIndex || 0) + 1 : 1;
        const industryLabel = INDUSTRY_LABELS[gameState?.industryId] || 'Unknown';

        const progressBars = Array.from({ length: 10 }, (_, i) => {
            const filled = i < chapterNum;
            return `<td style="padding:0 2px;"><div style="width:18px;height:6px;border-radius:3px;background:${
                filled ? 'linear-gradient(90deg,#6c63ff,#4facfe)' : 'rgba(255,255,255,0.08)'
            };"></div></td>`;
        }).join('');

        try {
            await resend.emails.send({
                from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
                to:      email,
                subject: `[SCM Disaster] Progress saved — Chapter ${chapterNum}`,
                html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);">
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background:#0d1020;padding:36px 44px 28px;">
            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.35);border-radius:20px;padding:5px 14px;">
                <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89cff;">&#9632; PROGRESS SAVED</span>
              </td></tr>
            </table>
            <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#f0f2ff;line-height:1.25;">Your progress is<br/>locked in.</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;">${industryLabel} division &mdash; Chapter ${chapterNum} of 10</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1020;padding:24px 44px 28px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4a5568;">Chapter Progress</p>
            <table cellpadding="0" cellspacing="0"><tr>${progressBars}</tr></table>
            <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">${chapterNum} of 10 chapters completed</p>
          </td>
        </tr>
        <tr>
          <td style="background:#080b14;padding:0 44px 32px;">
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.75;">
              To resume from any device, open the game, scroll to the <strong style="color:#8b8fa8;">Save &amp; Resume</strong> section, and enter this email address.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#080b14;padding:0 44px 40px;">
            <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;overflow:hidden;">
              <a href="https://supplychaindisaster.com"
                 style="display:inline-block;background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:15px 40px;border-radius:10px;">
                Return to Command Center &rarr;
              </a>
            </td></tr></table>
          </td>
        </tr>
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
            });

            await resend.emails.send({
                from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
                to:      'ahmad.faruqi1211@gmail.com',
                subject: `[SCM Disaster] Progress Save — ${email}`,
                text:    `Progress save captured.\n\nEmail: ${email}\nChapter: ${chapterNum}\nIndustry: ${industryLabel}\nKV stored: ${kvConfigured}`,
            });
        } catch { /* non-fatal */ }
    }

    return res.status(200).json({ success: true, kvStored: kvConfigured });
}
