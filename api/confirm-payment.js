const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sql } = require('./_lib/db');
const { verifyToken, getTokenFromReq } = require('./_lib/auth');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(getTokenFromReq(req));
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      await sql`
        UPDATE users SET
          sub_status = 'trialing',
          stripe_customer_id = ${session.customer},
          stripe_sub_id = ${session.subscription}
        WHERE id = ${decoded.userId}
      `;
      return res.status(200).json({ sub: { status: 'trialing', trialStart: new Date().toISOString() } });
    }

    return res.status(200).json({ sub: { status: session.status } });
  } catch (err) {
    console.error('Confirm payment error:', err);
    return res.status(500).json({ error: err.message });
  }
};
