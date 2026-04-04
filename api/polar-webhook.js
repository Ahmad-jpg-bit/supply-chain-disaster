// This endpoint has been replaced by /api/ls-webhook (Lemon Squeezy).
// Update your payment provider's webhook URL accordingly.
export default function handler(_req, res) {
  return res.status(410).json({ error: 'This endpoint is no longer in use. See /api/ls-webhook.' });
}
