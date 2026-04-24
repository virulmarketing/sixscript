const { createClerkClient, verifyToken } = require('@clerk/backend');

let _clerk;
const getClerk = () => {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
};

const getClerkUserId = async (req) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyToken(auth.slice(7), {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub;
  } catch {
    return null;
  }
};

// Finds existing user by clerk_id, or links by email (migration), or creates new.
const resolveUser = async (clerkUserId, sql) => {
  const rows = await sql`SELECT * FROM users WHERE clerk_id = ${clerkUserId}`;
  if (rows.length > 0) return rows[0];

  const clerkUser = await getClerk().users.getUser(clerkUserId);
  const email = (clerkUser.emailAddresses[0]?.emailAddress || '').toLowerCase();
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

  // Link by email: handles both legacy users (no clerk_id) and dev→prod instance migration
  const existing = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    await sql`UPDATE users SET clerk_id = ${clerkUserId} WHERE id = ${existing[0].id}`;
    return { ...existing[0], clerk_id: clerkUserId };
  }

  const userId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  await sql`
    INSERT INTO users (id, clerk_id, name, email, sub_status, trial_start)
    VALUES (${userId}, ${clerkUserId}, ${name}, ${email}, 'incomplete', NOW())
    ON CONFLICT (clerk_id) DO NOTHING
  `;
  return (await sql`SELECT * FROM users WHERE clerk_id = ${clerkUserId}`)[0];
};

module.exports = { getClerkUserId, resolveUser };
