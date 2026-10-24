// Access (entitlement) API — kept at this path to stay within Vercel's
// 12-function limit. Replaces the old order-ID / unverified-email lookups.
//
// POST { action: 'claim',          claimId }        → { state: 'pending'|'active'|'not_active', token?, access?, orderId? }
// POST { action: 'refresh',        token }          → { token, access }   (re-checked against the ledger)
// POST { action: 'restore-request', email }         → { sent: true }      (emails a 6-digit code)
// POST { action: 'restore-verify', email, code }    → { token, access }   (reconciles with Lemon Squeezy first)
//
// Access is granted only from verified provider data: a signed webhook, or an
// authenticated Lemon Squeezy API read after the buyer proves inbox ownership.

import { Resend } from 'resend';
import { billingConfig } from '../lib/billing/config.js';
import { defaultStore } from '../lib/billing/store.js';
import { claimStatus, refresh, requestRestoreCode, verifyRestoreCode } from '../lib/billing/service.js';

async function sendCode(email, code) {
  if (!process.env.RESEND_API_KEY) throw new Error('email not configured');
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from:    'Supply Chain Disaster <hello@supplychaindisaster.com>',
    to:      email,
    subject: `${code} is your Supply Chain Disaster code`,
    html:    `<p>Your code to restore your Supply Chain Disaster purchase is:</p>
              <p style="font-size:28px;font-weight:700;letter-spacing:0.15em;">${code}</p>
              <p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  });
  // Resend returns { error } instead of throwing — a rejected send must not look like success
  if (error) throw Object.assign(new Error(`email send failed: ${error.name}`), { name: 'EmailSendError' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, claimId, token, email, code } = req.body || {};
  const deps = { cfg: billingConfig(), store: await defaultStore(), sendEmail: sendCode };

  let out;
  try {
    if (action === 'claim')                out = await claimStatus(deps, { claimId });
    else if (action === 'refresh')         out = await refresh(deps, { token });
    else if (action === 'restore-request') out = await requestRestoreCode(deps, { email });
    else if (action === 'restore-verify')  out = await verifyRestoreCode(deps, { email, code });
    else                                   out = { status: 400, body: { error: 'unknown_action' } };
  } catch (err) {
    console.error('[billing] access API error:', action, err?.message);
    out = { status: 500, body: { error: 'server_error' } };
  }
  return res.status(out.status).json(out.body);
}
