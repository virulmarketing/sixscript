const { sql } = require('./_lib/db');
const { getClerkUserId, resolveUser } = require('./_lib/clerkAuth');
const { getUserTeams, acceptInvite } = require('./_lib/team');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.action === 'me') {
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { inviteToken } = req.body || {};
      const user = await resolveUser(clerkUserId, sql);

      if (inviteToken) await acceptInvite(user.id, user.name, user.email, inviteToken, sql);

      const teams = await getUserTeams(user.id, sql);

      let subStatus = user.sub_status;
      if (subStatus === 'trial' && teams.length === 0) {
        subStatus = 'incomplete';
        await sql`UPDATE users SET sub_status = 'incomplete' WHERE id = ${user.id}`;
      }

      return res.status(200).json({
        user: { id: user.id, name: user.name, email: user.email },
        team: teams[0] || null,
        teams,
        sub: { status: subStatus, trialStart: user.trial_start, subStart: user.sub_start, stripeSubId: user.stripe_sub_id, cancelAt: user.sub_cancel_at },
      });
    } catch (err) {
      console.error('Me error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
