// POST { code: string }
// Validates a promotional code and returns a time-limited expansion grant.
// Returns: { valid: boolean, tier: 'expansion', expiresAt: number (ms), message?: string }

const PROMO_CODES = {
  SC10DISASTER: {
    tier:         'expansion',
    durationDays: 30,
    description:  '1-month full access',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, message: 'No code provided.' });
  }

  const promo = PROMO_CODES[code.trim().toUpperCase()];
  if (!promo) {
    return res.status(200).json({ valid: false, message: 'Invalid promo code.' });
  }

  const expiresAt = Date.now() + promo.durationDays * 24 * 60 * 60 * 1000;

  return res.status(200).json({
    valid:     true,
    tier:      promo.tier,
    expiresAt,
    message:   promo.description,
  });
}
