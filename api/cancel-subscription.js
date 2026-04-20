const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');
const { verifyToken, getTokenFromReq } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(getTokenFromReq(req));
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { stripeSubId } = req.body;

    const subscription = await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });

    const cancelAt = new Date(subscription.current_period_end * 1000).toISOString();
    await sql`UPDATE users SET sub_status = 'cancelled', sub_cancel_at = ${cancelAt} WHERE id = ${decoded.userId}`;

    res.status(200).json({
      status: 'cancelled',
      cancelAt: subscription.cancel_at,
      currentPeriodEnd: subscription.current_period_end,
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: err.message });
  }
};
