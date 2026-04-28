const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');
const { getClerkUserId, resolveUser } = require('./_lib/clerkAuth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });
    const dbUser = await resolveUser(clerkUserId, sql);

    if (!dbUser.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripe_customer_id,
      return_url: process.env.FRONTEND_URL,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: err.message });
  }
};
