import { Resend } from 'resend';

const INDUSTRY_LABELS = {
    electronics: 'Electronics',
    fmcg:        'Consumer Goods',
    pharma:      'Pharmaceuticals',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, chapter, industry } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email required.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Email service not configured.' });
    }

    const resend        = new Resend(apiKey);
    const chapterNum    = parseInt(chapter, 10) || 1;
    const industryLabel = INDUSTRY_LABELS[industry] || 'Unknown';

    const progressBars = Array.from({ length: 10 }, (_, i) => {
        const filled = i < chapterNum;
        return `<td style="padding:0 2px;">
          <div style="width:18px;height:6px;border-radius:3px;background:${filled ? 'linear-gradient(90deg,#6c63ff,#4facfe)' : 'rgba(255,255,255,0.08)'};"></div>
        </td>`;
    }).join('');

    try {
        // ── Confirmation email to the player ─────────────────────────────────
        await resend.emails.send({
            from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
            to:      email,
            subject: `[SCM Disaster] Operational Data Secured — Chapter ${chapterNum}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Operational Data Secured</title>
</head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);box-shadow:0 0 60px rgba(108,99,255,0.08);">

        <!-- ░░ TOP ACCENT BAR -->
        <tr>
          <td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ░░ HEADER -->
        <tr>
          <td style="background:#0d1020;padding:36px 44px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <!-- Eyebrow -->
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                    <tr>
                      <td style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.35);border-radius:20px;padding:5px 14px;">
                        <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89cff;">&#9632; OPERATIONAL DATA SECURED</span>
                      </td>
                    </tr>
                  </table>
                  <!-- Headline -->
                  <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#f0f2ff;line-height:1.25;letter-spacing:-0.02em;">
                    Your progress is<br/>locked in.
                  </h1>
                  <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
                    ${industryLabel} division &mdash; Chapter ${chapterNum} of 10
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ░░ DIVIDER -->
        <tr>
          <td style="background:#0d1020;padding:0 44px;">
            <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(108,99,255,0.3),transparent);font-size:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- ░░ PROGRESS TRACKER -->
        <tr>
          <td style="background:#0d1020;padding:24px 44px 28px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4a5568;">Chapter Progress</p>
            <table cellpadding="0" cellspacing="0">
              <tr>${progressBars}</tr>
            </table>
            <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">${chapterNum} of 10 chapters completed</p>
          </td>
        </tr>

        <!-- ░░ STATS ROW -->
        <tr>
          <td style="background:#080b14;padding:0 44px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
              <tr>
                <td width="33%" style="padding:18px 20px;border-right:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 5px;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#4a5568;">Industry</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">${industryLabel}</p>
                </td>
                <td width="33%" style="padding:18px 20px;border-right:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 5px;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#4a5568;">Checkpoint</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">Chapter ${chapterNum}</p>
                </td>
                <td width="33%" style="padding:18px 20px;">
                  <p style="margin:0 0 5px;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#4a5568;">Status</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#34d399;">&#9679; Active</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ░░ BODY COPY -->
        <tr>
          <td style="background:#080b14;padding:0 44px 32px;">
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.75;">
              Use this email address to restore your session from any device. Every decision you've made has been logged — the board is still watching, and the crisis isn't over yet.
            </p>
          </td>
        </tr>

        <!-- ░░ CTA -->
        <tr>
          <td align="center" style="background:#080b14;padding:0 44px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:10px;overflow:hidden;">
                  <a href="https://supplychaindisaster.com"
                     style="display:inline-block;background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.04em;padding:15px 40px;border-radius:10px;">
                    Return to Command Center &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ░░ RESTORE HINT -->
        <tr>
          <td style="background:#0a0d1a;padding:20px 44px;border-top:1px solid rgba(255,255,255,0.05);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;width:20px;vertical-align:top;">
                  <p style="margin:0;font-size:14px;color:#6c63ff;">&#9888;</p>
                </td>
                <td>
                  <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.7;">
                    <strong style="color:#6b7280;">Switching devices?</strong> Open the game, click <strong style="color:#8b8fa8;">Unlock</strong>, then <strong style="color:#8b8fa8;">Restore access</strong>, and enter this email address.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ░░ FOOTER -->
        <tr>
          <td style="background:#080b14;padding:20px 44px;border-top:1px solid rgba(255,255,255,0.04);">
            <p style="margin:0;font-size:11px;color:#2d3748;line-height:1.7;text-align:center;">
              Supply Chain Disaster &mdash; NexTrack Global Logistics Corp.<br/>
              <a href="https://supplychaindisaster.com" style="color:#6c63ff;text-decoration:none;">supplychaindisaster.com</a>
            </p>
          </td>
        </tr>

        <!-- ░░ BOTTOM ACCENT BAR -->
        <tr>
          <td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`,
        });

        // ── Internal notification ─────────────────────────────────────────────
        await resend.emails.send({
            from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
            to:      'ahmad.faruqi1211@gmail.com',
            subject: `[SCM Disaster] Progress Save — ${email}`,
            text:    `New progress save captured.\n\nEmail: ${email}\nChapter: ${chapterNum}\nIndustry: ${industryLabel}`,
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('save-progress Resend error:', err);
        return res.status(500).json({ error: 'Failed to save progress. Please try again.' });
    }
}
