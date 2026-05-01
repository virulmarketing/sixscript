-- StrikeScript Database Schema
-- Run this in your Neon SQL editor to create the tables

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_sub_id TEXT,
  sub_status TEXT DEFAULT 'trial',
  trial_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'assistant',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'assistant',
  token TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(team_id, email)
);

CREATE TABLE IF NOT EXISTS saved_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_plans (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  date_key TEXT NOT NULL,
  plan_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_team ON calendar_plans(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_plans_user ON calendar_plans(user_id) WHERE team_id IS NULL;

-- Migrations (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_start TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_cancel_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_code_used TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_access_expires_at TIMESTAMPTZ;
