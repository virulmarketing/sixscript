const { sql } = require('./_lib/db');
const { getClerkUserId, resolveUser } = require('./_lib/clerkAuth');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clerkUserId = await getClerkUserId(req);
  if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });
  const dbUser = await resolveUser(clerkUserId, sql);

  if (req.query.action === 'update') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });

      await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${dbUser.id}`;
      await sql`UPDATE team_members SET name = ${name.trim()} WHERE user_id = ${dbUser.id}`;

      return res.status(200).json({ user: { id: dbUser.id, name: name.trim(), email: dbUser.email } });
    } catch (err) {
      console.error('Update profile error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
