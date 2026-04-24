const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Adding clerk_id column to users table...');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE`;
  console.log('Done. Run: UPDATE users SET clerk_id = NULL WHERE clerk_id IS NULL; -- no-op but safe');
  console.log('Migration complete. Existing users will be linked by email on first Clerk login.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
