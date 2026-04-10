const crypto = require('crypto');
const { sql } = require('./_lib/db');
const { verifyToken, getTokenFromReq } = require('./_lib/auth');
const { getUserTeam, getUserTeams } = require('./_lib/team');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const decoded = verifyToken(getTokenFromReq(req));
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const action = req.query.action;

    if (action === 'create') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Team name required' });

      const users = await sql`SELECT id, name, email FROM users WHERE id = ${decoded.userId}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = users[0];

      const ownedTeams = await sql`SELECT id FROM teams WHERE owner_id = ${user.id}`;
      if (ownedTeams.length >= 2) return res.status(400).json({ error: 'Head coaches can create up to 2 teams' });

      const teamId = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      await sql`INSERT INTO teams (id, owner_id, name) VALUES (${teamId}, ${user.id}, ${name.trim()})`;

      const memberId = 'tm_mem_' + Date.now();
      await sql`
        INSERT INTO team_members (id, team_id, user_id, email, name, role, status)
        VALUES (${memberId}, ${teamId}, ${user.id}, ${user.email}, ${user.name}, 'head', 'active')
      `;

      const teams = await getUserTeams(user.id, sql);
      return res.status(200).json({ team: teams.find(t => t.id === teamId), teams });
    }

    if (action === 'invite') {
      const { email, role, teamId } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const team = await getUserTeam(decoded.userId, sql, teamId);
      if (!team) return res.status(404).json({ error: 'No team found' });

      const inviterRows = await sql`SELECT name FROM users WHERE id = ${decoded.userId}`;
      const inviterName = inviterRows[0]?.name || 'Your coach';

      if (team.members.find(m => m.email === email.trim().toLowerCase())) {
        return res.status(409).json({ error: 'Already on team' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const inviteId = 'inv_' + Date.now();
      const memberEmail = email.trim().toLowerCase();

      await sql`
        INSERT INTO invites (id, team_id, email, role, token, invited_by)
        VALUES (${inviteId}, ${team.id}, ${memberEmail}, ${role || 'assistant'}, ${token}, ${decoded.userId})
        ON CONFLICT (team_id, email) DO UPDATE SET token = ${token}, role = ${role || 'assistant'}, accepted_at = NULL
      `;

      const memberId = 'tmm_' + Date.now();
      await sql`
        INSERT INTO team_members (id, team_id, user_id, email, name, role, status)
        VALUES (${memberId}, ${team.id}, NULL, ${memberEmail}, ${memberEmail}, ${role || 'assistant'}, 'pending')
        ON CONFLICT (team_id, email) DO UPDATE SET role = ${role || 'assistant'}, status = 'pending', user_id = NULL
      `;

      const frontendUrl = process.env.FRONTEND_URL || 'https://strikescript.com';
      const inviteLink = `${frontendUrl}/?accept-invite=${token}`;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'StrikeScript <onboarding@resend.dev>',
            to: [memberEmail],
            subject: `${inviterName} invited you to join ${team.name} on StrikeScript`,
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
                <h2 style="color:#DC2626;">You're invited to StrikeScript</h2>
                <p><strong>${inviterName}</strong> has invited you to join <strong>${team.name}</strong> as a ${role || 'assistant'} coach.</p>
                <p>Click the button below to accept your invite and get started.</p>
                <a href="${inviteLink}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0;">
                  Accept Invite
                </a>
                <p style="color:#888;font-size:12px;">If you weren't expecting this, you can ignore this email.</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
      }

      const updatedTeam = await getUserTeam(decoded.userId, sql);
      return res.status(200).json({ team: updatedTeam });
    }

    if (action === 'accept') {
      const { inviteToken } = req.body;
      if (!inviteToken) return res.status(400).json({ error: 'Invite token required' });

      const users = await sql`SELECT id, name, email FROM users WHERE id = ${decoded.userId}`;
      if (users.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = users[0];

      const { acceptInvite } = require('./_lib/team');
      const team = await acceptInvite(user.id, user.name, user.email, inviteToken, sql);
      if (!team) return res.status(404).json({ error: 'Invite not found or already accepted' });

      return res.status(200).json({ team });
    }

    if (action === 'update') {
      const { primaryColor, secondaryColor, name, teamId } = req.body;

      const team = await getUserTeam(decoded.userId, sql, teamId);
      if (!team) return res.status(404).json({ error: 'No team found' });

      if (primaryColor !== undefined || secondaryColor !== undefined) {
        await sql`
          UPDATE teams SET primary_color = ${primaryColor ?? team.primaryColor}, secondary_color = ${secondaryColor ?? team.secondaryColor}
          WHERE id = ${team.id}
        `;
      }
      if (name !== undefined) {
        await sql`UPDATE teams SET name = ${name} WHERE id = ${team.id}`;
      }

      const updatedTeam = await getUserTeam(decoded.userId, sql, team.id);
      return res.status(200).json({ team: updatedTeam });
    }

    if (action === 'update-member') {
      const { email, role, teamId } = req.body;
      if (!email || !role) return res.status(400).json({ error: 'Email and role required' });

      const team = await getUserTeam(decoded.userId, sql, teamId);
      if (!team) return res.status(404).json({ error: 'No team found' });

      await sql`UPDATE team_members SET role = ${role} WHERE team_id = ${team.id} AND email = ${email.toLowerCase()}`;

      const updatedTeam = await getUserTeam(decoded.userId, sql, team.id);
      return res.status(200).json({ team: updatedTeam });
    }

    if (action === 'remove-member') {
      const { email, teamId } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const team = await getUserTeam(decoded.userId, sql, teamId);
      if (!team) return res.status(404).json({ error: 'No team found' });

      await sql`DELETE FROM team_members WHERE team_id = ${team.id} AND email = ${email.toLowerCase()}`;
      await sql`DELETE FROM invites WHERE team_id = ${team.id} AND email = ${email.toLowerCase()}`;

      const updatedTeam = await getUserTeam(decoded.userId, sql, team.id);
      return res.status(200).json({ team: updatedTeam });
    }

    if (action === 'leave') {
      const { teamId } = req.body;
      const userRows = await sql`SELECT email FROM users WHERE id = ${decoded.userId}`;
      if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
      const userEmail = userRows[0].email;

      const team = await getUserTeam(decoded.userId, sql, teamId);
      if (team) {
        await sql`DELETE FROM team_members WHERE team_id = ${team.id} AND email = ${userEmail}`;
        await sql`DELETE FROM invites WHERE team_id = ${team.id} AND email = ${userEmail}`;
      }

      const remainingTeams = await getUserTeams(decoded.userId, sql);
      if (remainingTeams.length === 0) {
        await sql`UPDATE users SET sub_status = 'incomplete' WHERE id = ${decoded.userId}`;
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Team handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
