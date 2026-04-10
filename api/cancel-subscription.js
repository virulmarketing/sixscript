const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { stripeSubId } = req.body;

    const subscription = await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });

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
