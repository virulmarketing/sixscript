const bcrypt = require('bcryptjs');
const { sql } = require('./_lib/db');
const { signToken, verifyToken, getTokenFromReq } = require('./_lib/auth');
const { getUserTeam, getUserTeams, acceptInvite } = require('./_lib/team');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  if (action === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { name, email, password, inviteToken } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

      const existing = await sql`SELECT id FROM users WHERE email = ${email.trim().toLowerCase()}`;
      if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const userEmail = email.trim().toLowerCase();
      const userName = name.trim();

      await sql`
        INSERT INTO users (id, name, email, password_hash, sub_status, trial_start)
        VALUES (${userId}, ${userName}, ${userEmail}, ${passwordHash}, ${inviteToken ? 'trial' : 'incomplete'}, NOW())
      `;

      if (inviteToken) await acceptInvite(userId, userName, userEmail, inviteToken, sql);
      const teams = await getUserTeams(userId, sql);

      const token = signToken(userId);
      return res.status(200).json({
        token,
        user: { id: userId, name: userName, email: userEmail },
        team: teams[0] || null,
        teams,
        sub: { status: 'trial', trialStart: new Date().toISOString() },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { email, password, inviteToken } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const users = await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`;
      if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

      const user = users[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid email or password' });

      if (inviteToken) await acceptInvite(user.id, user.name, user.email, inviteToken, sql);
      const teams = await getUserTeams(user.id, sql);

      let subStatus = user.sub_status;
      if (subStatus === 'trial' && teams.length === 0) {
        subStatus = 'incomplete';
        await sql`UPDATE users SET sub_status = 'incomplete' WHERE id = ${user.id}`;
      }

      const token = signToken(user.id);
      return res.status(200).json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
        team: teams[0] || null,
        teams,
        sub: { status: subStatus, trialStart: user.trial_start },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'me') {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    try {
      const users = await sql`SELECT id, name, email, sub_status, trial_start FROM users WHERE id = ${decoded.userId}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = users[0];
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
        sub: { status: subStatus, trialStart: user.trial_start },
      });
    } catch (err) {
      console.error('Me error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
