// Fetch all teams a user is an active member of, with members
const getUserTeams = async (userId, sql) => {
  const rows = await sql`
    SELECT t.id, t.name, t.owner_id, t.primary_color, t.secondary_color
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ${userId} AND tm.status = 'active'
    ORDER BY t.id ASC
  `;
  if (rows.length === 0) return [];
  const teams = await Promise.all(rows.map(async t => {
    const members = await sql`SELECT user_id, name, email, role, status FROM team_members WHERE team_id = ${t.id}`;
    return {
      id: t.id,
      name: t.name,
      ownerId: t.owner_id,
      primaryColor: t.primary_color,
      secondaryColor: t.secondary_color,
      members: members.map(m => ({ userId: m.user_id, name: m.name, email: m.email, role: m.role, status: m.status })),
    };
  }));
  return teams;
};

// Fetch a single team by ID (must be a team the user is an active member of)
const getUserTeam = async (userId, sql, teamId = null) => {
  const teams = await getUserTeams(userId, sql);
  if (teams.length === 0) return null;
  if (teamId) return teams.find(t => t.id === teamId) || teams[0];
  return teams[0];
};

// Accept an invite by token and link it to a newly-authed user
const acceptInvite = async (userId, userName, userEmail, inviteToken, sql) => {
  const invites = await sql`
    SELECT i.*, t.id as tid, t.name as tname, t.owner_id, t.primary_color, t.secondary_color
    FROM invites i JOIN teams t ON t.id = i.team_id
    WHERE i.token = ${inviteToken} AND i.accepted_at IS NULL
  `;
  if (invites.length === 0) return null;
  const inv = invites[0];

  await sql`
    UPDATE team_members SET user_id = ${userId}, name = ${userName}, status = 'active'
    WHERE team_id = ${inv.tid} AND email = ${userEmail}
  `;
  await sql`UPDATE invites SET accepted_at = NOW() WHERE token = ${inviteToken}`;

  return getUserTeam(userId, sql);
};

module.exports = { getUserTeam, getUserTeams, acceptInvite };
