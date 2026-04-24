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
    const { successUrl, cancelUrl, promoCode } = req.body;

    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });
    const dbUser = await resolveUser(clerkUserId, sql);
    const userId = dbUser.id;
    const email = dbUser.email;

    const hadPriorTrial = ['active','trialing','cancelled','past_due','expired'].includes(dbUser.sub_status) || !!(dbUser.stripe_sub_id);

    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email, metadata: { userId } });
    }

    let discounts = undefined;
    let paymentMethodCollection = 'always';

    if (promoCode) {
      const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
      if (promoCodes.data.length > 0) {
        discounts = [{ promotion_code: promoCodes.data[0].id }];
        paymentMethodCollection = 'if_required';
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: (successUrl || `${process.env.FRONTEND_URL}?stripe=success`) + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}?stripe=cancel`,
      subscription_data: {
        metadata: { userId },
        ...(hadPriorTrial ? {} : { trial_period_days: 7 }),
      },
      ...(discounts ? { discounts } : {}),
      payment_method_collection: paymentMethodCollection,
      metadata: { userId },
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
