// Checkout creation for allowlisted offers only.
//
// GET  → { core: 'available'|'unavailable', membership: 'enabled'|'disabled', mode }
// POST { offer: 'core' | 'membership_monthly' | 'membership_annual', returnPath? }
//      → { url, claimId, offer }  (membership is refused unless CHALLENGE_MEMBERSHIP_ENABLED=true)
//
// The checkout URL, product and variant come only from server configuration;
// the client can name an offer key and nothing else. A one-time claim ID is
// attached as Lemon Squeezy custom data so the verified order can be tied
// back to the buyer's browser without trusting the success redirect.

import { billingConfig } from '../lib/billing/config.js';
import { defaultStore } from '../lib/billing/store.js';
import { createCheckout, offerStatus } from '../lib/billing/service.js';

export default async function handler(req, res) {
  const cfg = billingConfig();
  if (req.method === 'GET') return res.status(200).json(offerStatus(cfg));
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { offer, returnPath } = req.body || {};
  const store = await defaultStore();
  const out = await createCheckout({ store, cfg }, { offer, returnPath });
  if (out.status !== 200) console.warn('[billing] checkout refused:', offer, out.body.error);
  return res.status(out.status).json(out.body);
}
