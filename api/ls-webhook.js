import { Resend } from 'resend';
import { billingConfig } from '../lib/billing/config.js';
import { defaultStore } from '../lib/billing/store.js';
import { handleWebhook } from '../lib/billing/service.js';
import { PACKAGE } from '../src/data/packages.js';

/*
 * Lemon Squeezy webhook. Signature verification (timing-safe HMAC-SHA256 of
 * the raw body), store / test-mode / variant allowlist checks, idempotency
 * and out-of-order safety all live in lib/billing — see ledger.js.
 * Non-2xx responses make Lemon Squeezy retry (up to 3 times).
 */

// Disable Vercel's body parser — we need the raw body for HMAC verification.
export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Email templates ──────────────────────────────────────────────────────────

function emailHtml({ eyebrow, heading, subheading, bodyHtml, ctaUrl, ctaLabel }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:48px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(108,99,255,0.25);box-shadow:0 0 60px rgba(108,99,255,0.08);">

      <!-- TOP ACCENT BAR -->
      <tr>
        <td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>

      <!-- HEADER -->
      <tr>
        <td style="background:#0d1020;padding:40px 44px 32px;">
          <table cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
            <tr>
              <td style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.35);border-radius:20px;padding:5px 14px;">
                <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89cff;">&#9632; ${eyebrow}</span>
              </td>
            </tr>
          </table>
          <h1 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#f0f2ff;line-height:1.2;letter-spacing:-0.02em;">${heading}</h1>
          <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">${subheading}</p>
        </td>
      </tr>

      <!-- DIVIDER -->
      <tr>
        <td style="background:#0d1020;padding:0 44px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(108,99,255,0.3),transparent);font-size:0;">&nbsp;</div>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#080b14;padding:36px 44px 8px;color:#9ca3af;font-size:14px;line-height:1.75;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" style="background:#080b14;padding:28px 44px 36px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:10px;overflow:hidden;">
                <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.04em;padding:15px 44px;border-radius:10px;">${ctaLabel}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- RESTORE HINT -->
      <tr>
        <td style="background:#0a0d1a;padding:20px 44px;border-top:1px solid rgba(255,255,255,0.05);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:20px;padding-right:12px;vertical-align:top;">
                <p style="margin:0;font-size:14px;color:#6c63ff;">&#9888;</p>
              </td>
              <td>
                <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.7;">
                  <strong style="color:#6b7280;">Switching devices?</strong> Open the game, choose <strong style="color:#8b8fa8;">Core Game Pass &rarr; Restore a purchase</strong>, enter this email address and type the one-time code we send you.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#080b14;padding:20px 44px;border-top:1px solid rgba(255,255,255,0.04);">
          <p style="margin:0;font-size:11px;color:#2d3748;line-height:1.7;text-align:center;">
            Questions? <a href="https://supplychaindisaster.com/contact" style="color:#6c63ff;text-decoration:none;">supplychaindisaster.com/contact</a><br/>
            &copy; NexTrack Systems. All rights reserved.
          </p>
        </td>
      </tr>

      <!-- BOTTOM ACCENT BAR -->
      <tr>
        <td style="background:linear-gradient(90deg,#6c63ff,#4facfe,#6c63ff);height:3px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function featureRow(text, note = '') {
  return `<tr>
    <td style="padding:7px 0;vertical-align:top;width:20px;">
      <div style="width:18px;height:18px;border-radius:50%;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);text-align:center;line-height:18px;">
        <span style="font-size:9px;color:#a89cff;font-weight:700;">&#10003;</span>
      </div>
    </td>
    <td style="padding:7px 0 7px 10px;font-size:13px;color:#c8ccd8;line-height:1.5;">
      ${text}${note ? ` <span style="font-size:11px;color:#6c63ff;font-weight:600;">${note}</span>` : ''}
    </td>
  </tr>`;
}

function orderIdBlock(orderId) {
  if (!orderId) return '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(108,99,255,0.06);border:1px solid rgba(108,99,255,0.3);border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 24px;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">Your Order ID — save this</p>
          <p style="margin:0 0 10px;font-size:22px;font-weight:800;color:#f0f2ff;font-family:monospace;letter-spacing:0.06em;">${orderId}</p>
          <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.7;">
            If you clear your browser data or switch devices, restore access in the game with <strong style="color:#8b8fa8;">Core Game Pass &rarr; Restore a purchase</strong> (we email you a one-time code) — or contact support with this Order ID.
          </p>
        </td>
      </tr>
    </table>`;
}

function buildCoreEmail(appUrl, orderId) {
  return emailHtml({
    eyebrow:    'Purchase Confirmed',
    heading:    'Your Core Game Pass is active.',
    subheading: 'One-time $19.99 purchase &mdash; no subscription and no recurring charge.',
    bodyHtml: `
      <p style="margin:0 0 24px;">The Core Game Pass unlocks the full campaigns for all three industries in the browser where you bought it. Open the game to continue where you left off.</p>
      ${orderIdBlock(orderId)}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(13,16,32,0.8);border:1px solid rgba(108,99,255,0.15);border-radius:10px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px 14px;">
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">Included in the Core Game Pass</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${featureRow('Full 10-chapter campaigns: Fast-Moving Consumer Goods, Pharmaceuticals and Consumer Electronics')}
              ${featureRow('Replay any campaign and start at any chapter')}
              ${featureRow('Endless Survival and the weekly challenge')}
              ${featureRow('Downloadable 5-page Advanced Report (PDF) and Certificate of Completion')}
            </table>
          </td>
        </tr>
      </table>
    `,
    ctaUrl:   `${appUrl}/play`,
    ctaLabel: 'Open the game &rarr;',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Failed to read request body.' });
  }

  const cfg = billingConfig();
  const store = await defaultStore();
  const out = await handleWebhook({ store, cfg }, { rawBody, signature: req.headers['x-signature'] });

  // Welcome email only the first time an order becomes paid (idempotent)
  const paid = out.firstPaid;
  if (paid?.email && paid.package === PACKAGE.CORE && process.env.RESEND_API_KEY) {
    try {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
        to:      paid.email,
        subject: 'Your Core Game Pass is active — Supply Chain Disaster',
        html:    buildCoreEmail(cfg.appUrl, paid.orderId),
      });
    } catch (err) {
      // Access is already granted; never fail the webhook over email
      console.error('[billing] welcome email failed for order', paid.orderId, err?.message);
    }
  }

  return res.status(out.status).json(out.body);
}
