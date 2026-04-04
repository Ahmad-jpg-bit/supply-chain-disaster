// Constructs a Lemon Squeezy hosted-checkout URL for the requested tier.
// The client can also build this URL directly from the variant checkout link;
// this endpoint is useful if you need to inject a dynamic redirect URL server-side.
//
// POST { tier: 'standard'|'expansion' }
// Returns: { url: string }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tier = 'standard' } = req.body || {};
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').trim();

  const variantId = tier === 'expansion'
    ? process.env.LEMONSQUEEZY_EXPANSION_VARIANT_ID?.trim()
    : process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID?.trim();

  const storeSlug = process.env.LEMONSQUEEZY_STORE_SLUG?.trim();

  if (!variantId || !storeSlug) {
    return res.status(500).json({ error: 'Checkout not configured for this tier.' });
  }

  const redirectUrl  = `${appUrl}/success.html`;
  const checkoutUrl  = `https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}`
    + `?checkout[redirect_url]=${encodeURIComponent(redirectUrl)}`;

  return res.status(200).json({ url: checkoutUrl });
}
