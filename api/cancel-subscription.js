const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');
const { getClerkUserId, resolveUser } = require('./_lib/clerkAuth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clerkUserId = await getClerkUserId(req);
  if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });
  const dbUser = await resolveUser(clerkUserId, sql);

  try {
    // Find the user's *live* subscription. We can't trust the stored stripe_sub_id /
    // stripe_customer_id alone — repeated checkouts can leave them pointing at an old,
    // already-canceled sub (which would make us compute a past period-end and lock the
    // user out). So search every customer linked to this user (stored id + email match)
    // and prefer a live sub whose metadata.userId matches this user.
    const LIVE = ['active', 'trialing', 'past_due'];
    const customerIds = [];
    if (dbUser.stripe_customer_id) customerIds.push(dbUser.stripe_customer_id);
    try {
      const byEmail = await stripe.customers.list({ email: dbUser.email, limit: 5 });
      for (const c of byEmail.data) if (!customerIds.includes(c.id)) customerIds.push(c.id);
    } catch (e) { /* ignore email lookup failures */ }

    let subscription = null;
    for (const cid of customerIds) {
      const subs = await stripe.subscriptions.list({ customer: cid, status: 'all', limit: 20 });
      const live = subs.data.filter((s) => LIVE.includes(s.status));
      const match = live.find((s) => s.metadata?.userId === dbUser.id) || live[0];
      if (match) { subscription = match; break; }
    }

    // Last resort: the explicitly stored / client-supplied id.
    if (!subscription) {
      const storedSubId = dbUser.stripe_sub_id || req.body?.stripeSubId;
      if (storedSubId) {
        try { subscription = await stripe.subscriptions.retrieve(storedSubId); } catch (e) { /* stale id */ }
      }
    }

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found to cancel.' });
    }

    // Idempotent: only call update if it isn't already canceling/canceled.
    if (subscription.status !== 'canceled' && !subscription.cancel_at_period_end) {
      subscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
    }

    // `current_period_end` moved onto the subscription item in newer Stripe API
    // versions, so read it from there first and fall back gracefully.
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      subscription.current_period_end ??
      subscription.cancel_at ??
      null;
    const cancelAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    await sql`UPDATE users SET sub_status = 'cancelled', stripe_sub_id = ${subscription.id}, stripe_customer_id = ${subscription.customer}, sub_cancel_at = ${cancelAt} WHERE id = ${dbUser.id}`;

    res.status(200).json({
      status: 'cancelled',
      cancelAt: subscription.cancel_at ?? periodEnd,
      currentPeriodEnd: periodEnd,
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: err.message });
  }
};
