const bcrypt = require('bcryptjs');
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

  const action = req.query.action;

  if (action === 'update') {
    try {
      const { name, email } = req.body;
      if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

      const newEmail = email.trim().toLowerCase();
      const existing = await sql`SELECT id FROM users WHERE email = ${newEmail} AND id != ${decoded.userId}`;
      if (existing.length > 0) return res.status(409).json({ error: 'Email already in use' });

      await sql`UPDATE users SET name = ${name.trim()}, email = ${newEmail} WHERE id = ${decoded.userId}`;
      await sql`UPDATE team_members SET name = ${name.trim()}, email = ${newEmail} WHERE user_id = ${decoded.userId}`;

      return res.status(200).json({ user: { id: decoded.userId, name: name.trim(), email: newEmail } });
    } catch (err) {
      console.error('Update profile error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'password') {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
      if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

      const users = await sql`SELECT password_hash FROM users WHERE id = ${decoded.userId}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });

      const match = await bcrypt.compare(oldPassword, users[0].password_hash);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${decoded.userId}`;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
