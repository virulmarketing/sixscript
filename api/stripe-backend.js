// ============================================================
// StrikeScript — Stripe Backend API
// ============================================================
// Deploy as Vercel serverless functions (or adapt to Express/Next.js)
//
// SETUP:
// 1. Create a Stripe account at https://stripe.com
// 2. Get your API keys from https://dashboard.stripe.com/apikeys
// 3. Create a product + price in Stripe Dashboard:
//    - Product: "StrikeScript Monthly"
//    - Price: $4.99/month recurring
//    - Copy the price_id (starts with "price_")
// 4. Set environment variables:
//    - STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
//    - STRIPE_WEBHOOK_SECRET=whsec_...
//    - STRIPE_PRICE_ID=price_...
//    - FRONTEND_URL=https://your-app-url.com
// 5. Set up webhook in Stripe Dashboard:
//    - URL: https://your-backend.vercel.app/api/webhook
//    - Events: checkout.session.completed, customer.subscription.updated,
//              customer.subscription.deleted, invoice.payment_succeeded
//
// FILE STRUCTURE (Vercel):
//   /api/create-checkout-session.js
//   /api/create-portal-session.js
//   /api/cancel-subscription.js
//   /api/webhook.js
// ============================================================


// ─── /api/create-checkout-session.js ────────────────────────
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, email, successUrl, cancelUrl } = req.body;

    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      success_url: successUrl || `${process.env.FRONTEND_URL}?stripe=success`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}?stripe=cancel`,
      subscription_data: {
        metadata: { userId },
        trial_period_days: 7,
      },
      metadata: { userId },
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};


// ─── /api/create-portal-session.js ──────────────────────────
// Stripe Customer Portal — lets users manage billing, update card, view invoices
const stripe2 = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { stripeCustomerId } = req.body;

    // NOTE: Enable Customer Portal in Stripe Dashboard first:
    // https://dashboard.stripe.com/settings/billing/portal
    const session = await stripe2.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: process.env.FRONTEND_URL,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: err.message });
  }
};


// ─── /api/cancel-subscription.js ────────────────────────────
const stripe3 = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { stripeSubId } = req.body;

    // Cancel at period end (user keeps access until billing period ends)
    const subscription = await stripe3.subscriptions.update(stripeSubId, {
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


// ─── /api/webhook.js ────────────────────────────────────────
// Handles Stripe webhook events to keep subscription status in sync
const stripe4 = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe4.webhooks.constructEvent(
      req.body, // raw body needed — see note below
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      console.log(`Checkout completed for user ${userId}, customer ${customerId}, sub ${subscriptionId}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      console.log(`Subscription updated for user ${userId}: status=${subscription.status}, cancel_at_period_end=${subscription.cancel_at_period_end}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      console.log(`Subscription deleted for user ${userId}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`Payment succeeded: $${invoice.amount_paid / 100} for customer ${invoice.customer}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`Payment failed for customer ${invoice.customer}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};


// ============================================================
// VERCEL CONFIG — vercel.json
// ============================================================
// Add this to your project root:
/*
{
  "functions": {
    "api/webhook.js": {
      "maxDuration": 10
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "methods": ["POST", "OPTIONS"],
      "dest": "/api/$1"
    }
  ]
}
*/


// ============================================================
// IMPORTANT NOTES
// ============================================================
//
// 1. WEBHOOK RAW BODY:
//    Vercel passes parsed body by default. For webhook signature
//    verification, you need the raw body. Add this to your
//    vercel.json or use a middleware:
//
//    export const config = { api: { bodyParser: false } };
//
//    Then use a buffer to read raw body:
//    const buf = await buffer(req);
//    event = stripe.webhooks.constructEvent(buf, sig, secret);
//
// 2. TESTING:
//    - Use Stripe CLI for local webhook testing:
//      stripe listen --forward-to localhost:3000/api/webhook
//    - Use test card: 4242 4242 4242 4242, any future date, any CVC
//    - Test mode keys start with sk_test_ and pk_test_
//
// 3. CUSTOMER PORTAL:
//    Enable at https://dashboard.stripe.com/settings/billing/portal
//    Configure: allow cancel, update payment method, view invoices
//
// 4. GOING LIVE:
//    - Switch from sk_test_ to sk_live_ keys
//    - Update webhook endpoint URL
//    - Update FRONTEND_URL environment variable
//    - Test the full flow with a real card
//
// 5. ENVIRONMENT VARIABLES NEEDED:
//    STRIPE_SECRET_KEY=sk_test_...
//    STRIPE_WEBHOOK_SECRET=whsec_...
//    STRIPE_PRICE_ID=price_...
//    FRONTEND_URL=https://strikescript.com
