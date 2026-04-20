// Run: node migrate.js
// Requires .env.production with DATABASE_URL (pull via: vercel env pull --environment=production .env.production)
const fs = require('fs');

const envFile = fs.existsSync('.env.production') ? '.env.production' : '.env.local';
fs.readFileSync(envFile, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Running migrations...');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_start TIMESTAMPTZ`;
  console.log('✓ sub_start');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_cancel_at TIMESTAMPTZ`;
  console.log('✓ sub_cancel_at');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_code_used TEXT`;
  console.log('✓ promo_code_used');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_access_expires_at TIMESTAMPTZ`;
  console.log('✓ enterprise_access_expires_at');
  console.log('\nAll migrations complete.');
}

main().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
