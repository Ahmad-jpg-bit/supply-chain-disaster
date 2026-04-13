import crypto from 'crypto';
import { Resend } from 'resend';

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

/** Map a LS variant ID to a product tier. */
function deriveTier(variantId) {
  const vid = String(variantId ?? '');
  const standardId  = process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID?.trim();
  const expansionId = process.env.LEMONSQUEEZY_EXPANSION_VARIANT_ID?.trim();
  if (expansionId && vid === expansionId) return 'expansion';
  if (standardId  && vid === standardId)  return 'standard';
  return 'standard';
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
                  <strong style="color:#6b7280;">Switching devices?</strong> Open the game, click <strong style="color:#8b8fa8;">Unlock</strong>, then <strong style="color:#8b8fa8;">Restore access</strong>, and enter this email address.
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

function buildStandardEmail(appUrl, orderId) {
  return emailHtml({
    eyebrow:    'Purchase Confirmed',
    heading:    "You're in. Standard Edition unlocked.",
    subheading: 'One-time purchase &mdash; no subscriptions, no expiry.',
    bodyHtml: `
      <p style="margin:0 0 24px;">Welcome to the full game. <strong style="color:#e2e8f0;">All 8 chapters</strong> of Supply Chain Disaster are now unlocked on this device — pick up right where the free chapters left off.</p>

      ${orderIdBlock(orderId)}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(13,16,32,0.8);border:1px solid rgba(108,99,255,0.15);border-radius:10px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px 14px;">
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">What's unlocked</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${featureRow('Full Core Game &mdash; Chapters 1&ndash;8')}
              ${featureRow('All 5 base crisis scenarios')}
              ${featureRow('Lifetime bug &amp; content updates')}
            </table>
          </td>
        </tr>
      </table>
    `,
    ctaUrl:   appUrl,
    ctaLabel: 'Continue Playing &rarr;',
  });
}

function buildExpansionEmail(appUrl, orderId) {
  return emailHtml({
    eyebrow:    'Purchase Confirmed',
    heading:    'Expansion Bundle unlocked. All 10 chapters.',
    subheading: 'One-time purchase &mdash; the complete Supply Chain Disaster experience.',
    bodyHtml: `
      <p style="margin:0 0 24px;">Every chapter is now yours — including the <strong style="color:#e2e8f0;">Global Logistics Expansion</strong>. You have the full arsenal. The board is watching.</p>

      ${orderIdBlock(orderId)}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(13,16,32,0.8);border:1px solid rgba(108,99,255,0.15);border-radius:10px;margin-bottom:20px;">
        <tr>
          <td style="padding:20px 24px 14px;">
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">What's unlocked</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${featureRow('Full Core Game &mdash; Chapters 1&ndash;8')}
              ${featureRow('Global Logistics Expansion &mdash; Chapters 9&ndash;10', '(Early Access)')}
              ${featureRow('Advanced Crisis Scenarios &mdash; Port Strikes &amp; Fuel Hikes')}
              ${featureRow('Digital Strategy Guide (PDF)', '&mdash; unlocks at game end')}
              ${featureRow('Certificate of Completion', '&mdash; unlocks at game end')}
              ${featureRow('Lifetime bug &amp; content updates')}
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:13px;color:#4a5568;line-height:1.7;">The Digital Strategy Guide and Certificate unlock on the game-over screen after completing the full run.</p>
    `,
    ctaUrl:   appUrl,
    ctaLabel: 'Start Playing &rarr;',
  });
}

// ── Webhook handler ──────────────────────────────────────────────────────────

function orderIdBlock(orderId) {
  if (!orderId) return '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(108,99,255,0.06);border:1px solid rgba(108,99,255,0.3);border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 24px;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6c63ff;">Your Order ID — save this</p>
          <p style="margin:0 0 10px;font-size:22px;font-weight:800;color:#f0f2ff;font-family:monospace;letter-spacing:0.06em;">${orderId}</p>
          <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.7;">
            If you clear your browser data, switch devices, or use a different browser, you can restore access by going to <strong style="color:#8b8fa8;">Unlock &rarr; Restore access</strong> in the game and entering your purchase email — or by contacting support with this Order ID.
          </p>
        </td>
      </tr>
    </table>`;
}

async function sendWelcomeEmail({ toEmail, tier, appUrl, resend, orderId }) {
  const isExpansion = tier === 'expansion';
  const subject     = isExpansion
    ? 'Your Expansion Bundle is ready — Supply Chain Disaster'
    : 'Your Standard Edition is ready — Supply Chain Disaster';
  const html = isExpansion
    ? buildExpansionEmail(appUrl, orderId)
    : buildStandardEmail(appUrl, orderId);

  await resend.emails.send({
    from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
    to:      toEmail,
    subject,
    html,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[LemonSqueezy] LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook not configured.' });
  }

  // Read raw body
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Failed to read request body.' });
  }

  // Verify HMAC-SHA256 signature
  const signature = req.headers['x-signature'];
  const expected  = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (!signature || signature !== expected) {
    console.error('[LemonSqueezy] Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed webhook payload.' });
  }

  const eventName = event.meta?.event_name;
  const appUrl    = (process.env.APP_URL || 'https://supplychaindisaster.com').trim();

  switch (eventName) {
    case 'order_created': {
      const attr      = event.data?.attributes ?? {};
      const toEmail   = attr.user_email;
      const variantId = String(attr.first_order_item?.variant_id ?? '');
      const tier      = deriveTier(variantId);
      const orderId   = String(event.data?.id ?? '');

      console.log('[LemonSqueezy] Order created:', orderId, toEmail, '— tier:', tier);

      if (toEmail && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
          await sendWelcomeEmail({ toEmail, tier, appUrl, resend, orderId });
          console.log('[LemonSqueezy] Welcome email sent to', toEmail);
        } catch (err) {
          // Log but don't fail the webhook — LS will retry on non-2xx
          console.error('[LemonSqueezy] Failed to send welcome email:', err?.message);
        }
      }
      break;
    }

    case 'order_refunded':
      console.log('[LemonSqueezy] Order refunded:', event.data?.id);
      // TODO: revoke access in your DB
      break;

    case 'subscription_created':
      console.log('[LemonSqueezy] Subscription created:', event.data?.id);
      break;

    case 'subscription_cancelled':
    case 'subscription_expired':
      console.log('[LemonSqueezy] Subscription ended:', eventName, event.data?.id);
      // TODO: revoke access in your DB
      break;

    default:
      console.log('[LemonSqueezy] Unhandled event:', eventName);
  }

  return res.status(200).json({ received: true });
}
