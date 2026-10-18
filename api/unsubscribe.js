import { kv } from '@vercel/kv';
import { Resend } from 'resend';

/**
 * Two jobs live here, kept in one file to stay under Vercel Hobby's
 * 12-function cap:
 *
 *  GET  /api/unsubscribe?email=x — one-click unsubscribe link (used in
 *       every outbound email). Marks `unsub:{email}` in KV, no expiry;
 *       every sender (recall-cron, the broadcast below) must check it.
 *
 *  POST /api/unsubscribe?broadcast=1 — one-off re-engagement email to
 *       everyone who ever saved progress on the old game, announcing the
 *       rebuild and linking to play.supplychaindisaster.com. NOT a cron —
 *       triggered manually via Bearer CRON_SECRET. Safe to call repeatedly:
 *       each send is recorded in `announced:{email}`, so re-running only
 *       reaches whoever hasn't been sent to yet. `?dry=1` reports counts
 *       without sending.
 */

const MAX_PER_RUN = 150; // safety cap per invocation — call again to continue
const APP_URL = 'https://www.supplychaindisaster.com';
const PLAY_URL = 'https://play.supplychaindisaster.com/levels';

// ── Campaign kill-switch ──────────────────────────────────────────────
// Marketing/campaign email is PAUSED (set false to resume the re-engagement
// broadcast). The GET one-click unsubscribe below is NOT a send and keeps
// working. Transactional email is unaffected. Requested 2026-09-26.
const CAMPAIGNS_PAUSED = true;

export default async function handler(req, res) {
    if (req.method === 'POST' && req.query?.broadcast === '1') {
        if (CAMPAIGNS_PAUSED) {
            return res.status(200).json({ ok: true, paused: true, sent: 0 });
        }
        return handleBroadcast(req, res);
    }
    return handleUnsubscribe(req, res);
}

/* ── GET: unsubscribe link ──────────────────────────────────────── */

async function handleUnsubscribe(req, res) {
    const email = (req.query?.email || '').toString().trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (!valid) {
        return res.status(400).send(page('That link looks broken — no valid email found.', false));
    }

    const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (kvConfigured) {
        try {
            await kv.set(`unsub:${email}`, '1');
        } catch (err) {
            console.error('[unsubscribe] KV error:', err);
            return res.status(500).send(page("Something went wrong on our end — email hello@supplychaindisaster.com and we'll remove you manually.", false));
        }
    }

    return res.status(200).send(page(`${email} won't get any more emails from us.`, true));
}

function page(message, ok) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Unsubscribed — Supply Chain Disaster</title></head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;min-height:100vh;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);">
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background:#0d1020;padding:40px 36px;text-align:center;">
            <p style="margin:0 0 8px;font-size:22px;">${ok ? '✓' : '⚠'}</p>
            <h1 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f0f2ff;">${ok ? "You're unsubscribed" : 'Unsubscribe failed'}</h1>
            <p style="margin:0;font-size:14px;color:#8b8fa8;line-height:1.6;">${message}</p>
          </td>
        </tr>
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── POST ?broadcast=1: the one-off announcement ────────────────── */

function announcementHtml(email) {
    const unsubUrl = `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`;
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);">
        <tr><td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background:#0d1020;padding:36px 44px 8px;">
            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.35);border-radius:20px;padding:5px 14px;">
                <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89cff;">&#9889; A note from the founder</span>
              </td></tr>
            </table>
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#f0f2ff;line-height:1.3;">We rebuilt Supply Chain Disaster.</h1>
            <p style="margin:0 0 16px;font-size:15px;color:#c3c7dc;line-height:1.7;">
              Hey — Ahmad here, the founder. You saved your progress at Supply Chain Disaster a while back, so I wanted to reach out personally: the game's had a serious overhaul since then.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#c3c7dc;line-height:1.7;">What's different:</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
              <tr><td style="padding:0 0 10px;font-size:14px;color:#c3c7dc;line-height:1.6;">
                <span style="color:#8b9aff;">&#8226;</span>&nbsp; All 10 chapters, each now playable at <strong style="color:#f0f2ff;">3 difficulty tiers</strong> — Guided, Normal, Expert — 120 scenarios in total
              </td></tr>
              <tr><td style="padding:0 0 10px;font-size:14px;color:#c3c7dc;line-height:1.6;">
                <span style="color:#8b9aff;">&#8226;</span>&nbsp; A cleaner, faster interface built from scratch
              </td></tr>
              <tr><td style="padding:0 0 10px;font-size:14px;color:#c3c7dc;line-height:1.6;">
                <span style="color:#8b9aff;">&#8226;</span>&nbsp; Real APICS CSCP concepts woven into every chapter, with exam-ready takeaways at the end of each one
              </td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:15px;color:#c3c7dc;line-height:1.7;">
              Chapters 1&ndash;3 are still free, no account required. If you liked the old version, I think you'll like where it's gone.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
              <tr><td style="border-radius:10px;background:linear-gradient(90deg,#6c63ff,#4facfe);">
                <a href="${PLAY_URL}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#080b14;text-decoration:none;">Try the new version &rarr;</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1020;padding:16px 44px 28px;">
            <p style="margin:0;font-size:13px;color:#8b8fa8;line-height:1.6;">
              Thanks for giving it a shot the first time around.<br/>
              &mdash; Ahmad, founder of Supply Chain Disaster
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#080b14;padding:16px 44px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:#3a4256;line-height:1.6;text-align:center;">
              You're getting this because you saved progress at supplychaindisaster.com.
              <a href="${unsubUrl}" style="color:#5a6178;">Unsubscribe</a>
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

async function handleBroadcast(req, res) {
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

    let scanned = 0, eligible = 0, sent = 0;
    const eligibleEmails = [];

    try {
        let cursor = 0;
        const seen = new Set();
        do {
            const [next, keys] = await kv.scan(cursor, { match: 'game:*', count: 100 });
            cursor = Number(next);

            for (const key of keys) {
                if (sent >= MAX_PER_RUN) break;
                scanned++;

                const raw = await kv.get(key);
                if (!raw) continue;
                const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const email = (record?.email || '').toLowerCase();
                if (!email || seen.has(email)) continue;
                seen.add(email);

                if (await kv.get(`unsub:${email}`)) continue;

                const announceKey = `announced:${email}`;
                if (await kv.get(announceKey)) continue;

                eligible++;
                if (dryRun) { eligibleEmails.push(email); continue; }

                try {
                    await resend.emails.send({
                        from:    'Ahmad from Supply Chain Disaster <hello@supplychaindisaster.com>',
                        to:      record.email,
                        subject: 'We rebuilt Supply Chain Disaster — come see what\'s new',
                        html:    announcementHtml(record.email),
                    });
                    await kv.set(announceKey, String(Date.now()));
                    sent++;
                } catch (err) {
                    console.error('[unsubscribe/broadcast] send failed for', email, err?.message);
                }
            }
        } while (cursor !== 0 && sent < MAX_PER_RUN);

        return res.status(200).json({ ok: true, scanned, eligible, sent, dryRun, ...(dryRun ? { eligibleEmails } : {}) });
    } catch (err) {
        console.error('[unsubscribe/broadcast] error:', err);
        return res.status(500).json({ error: 'Broadcast run failed.' });
    }
}
