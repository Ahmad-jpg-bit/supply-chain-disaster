// POST { orderId } → verify a Lemon Squeezy order by its ID (post-payment redirect).
// POST { email }   → look up all paid orders for an email address (restore access).
//
// Returns (success): { active: true, orderId, email, customerId, tier: 'standard'|'expansion' }
// Returns (failure): { active: false, code: 'ORDER_NOT_FOUND'|'ORDER_REFUNDED'|'RATE_LIMITED' }

const LS_API = 'https://api.lemonsqueezy.com/v1';

function lsHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
  };
}

/** Map a LS variant ID to a product tier. */
function deriveTier(variantId) {
  const vid = String(variantId ?? '');
  const standardId  = process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID?.trim();
  const expansionId = process.env.LEMONSQUEEZY_EXPANSION_VARIANT_ID?.trim();
  if (expansionId && vid === expansionId) return 'expansion';
  if (standardId  && vid === standardId)  return 'standard';
  return 'standard'; // fallback — any paid order grants at least standard access
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Payment service is not configured.' });
  }

  const { orderId, email } = req.body || {};

  try {
    // ── Path 1: verify by order ID (post-payment redirect) ─────────────────
    if (orderId) {
      const r = await fetch(`${LS_API}/orders/${orderId}`, {
        headers: lsHeaders(apiKey),
      });

      if (r.status === 429) return res.status(200).json({ active: false, code: 'RATE_LIMITED' });
      if (!r.ok)            return res.status(200).json({ active: false, code: 'ORDER_NOT_FOUND' });

      const json = await r.json();
      const attr = json.data?.attributes;

      if (!attr)          return res.status(200).json({ active: false, code: 'ORDER_NOT_FOUND' });
      if (attr.refunded)  return res.status(200).json({ active: false, code: 'ORDER_REFUNDED' });
      if (attr.status !== 'paid') return res.status(200).json({ active: false, code: 'ORDER_NOT_FOUND' });

      const variantId = String(attr.first_order_item?.variant_id ?? '');
      return res.status(200).json({
        active:     true,
        orderId:    String(json.data.id),
        email:      attr.user_email,
        customerId: String(json.data.id),
        tier:       deriveTier(variantId),
      });
    }

    // ── Path 2: restore access by email ────────────────────────────────────
    if (email) {
      const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
      const params  = new URLSearchParams({
        'filter[user_email]': email,
        'filter[status]':     'paid',
      });
      if (storeId) params.set('filter[store_id]', storeId);

      const r = await fetch(`${LS_API}/orders?${params}`, {
        headers: lsHeaders(apiKey),
      });

      if (r.status === 429) return res.status(200).json({ active: false, code: 'RATE_LIMITED' });
      if (!r.ok)            return res.status(200).json({ active: false, code: 'ORDER_NOT_FOUND' });

      const json   = await r.json();
      const orders = (json.data ?? []).filter(o => !o.attributes?.refunded);

      if (orders.length === 0) return res.status(200).json({ active: false, code: 'ORDER_NOT_FOUND' });

      // If the user has both tiers, prefer expansion.
      let bestOrder = null;
      let bestTier  = 'standard';
      for (const order of orders) {
        const variantId = String(order.attributes?.first_order_item?.variant_id ?? '');
        const tier      = deriveTier(variantId);
        if (tier === 'expansion') { bestOrder = order; bestTier = 'expansion'; break; }
        if (!bestOrder)           { bestOrder = order; }
      }

      return res.status(200).json({
        active:     true,
        orderId:    String(bestOrder.id),
        email:      bestOrder.attributes.user_email ?? email,
        customerId: String(bestOrder.id),
        tier:       bestTier,
      });
    }

    return res.status(400).json({ error: 'Provide orderId or email.' });
  } catch (err) {
    console.error('[LemonSqueezy] Verification error:', err);
    return res.status(500).json({ error: 'Verification failed.' });
  }
}
