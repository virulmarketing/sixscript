const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (userId) {
          await sql`
            UPDATE users SET
              sub_status = 'trialing',
              stripe_customer_id = ${customerId},
              stripe_sub_id = ${subscriptionId}
            WHERE id = ${userId}
          `;
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          const status = sub.cancel_at_period_end ? 'cancelled'
            : sub.status === 'active' ? 'active'
            : sub.status === 'trialing' ? 'trialing'
            : sub.status === 'past_due' ? 'past_due'
            : 'expired';
          await sql`UPDATE users SET sub_status = ${status} WHERE id = ${userId}`;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await sql`UPDATE users SET sub_status = 'expired' WHERE id = ${userId}`;
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          await sql`UPDATE users SET sub_status = 'active' WHERE stripe_sub_id = ${subId}`;
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          await sql`UPDATE users SET sub_status = 'past_due' WHERE stripe_sub_id = ${subId}`;
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook DB error:', err);
  }

  res.status(200).json({ received: true });
};
