# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build locally
```

There is no test suite in this project.

Backend API functions require Vercel to run locally — use `vercel dev` if you need to test them locally (requires Vercel CLI and environment variables).

## Architecture

SixScript is an American football practice planning SaaS. It is a **React 18 SPA** built with Vite, deployed on Vercel with serverless API functions and a Neon PostgreSQL database.

### Frontend (`/src`)

- **`App.jsx`** — Single monolithic component (~1500+ lines) containing all UI state, views, and drill loading logic. Drills are lazy-loaded from `src/data/drills.json`. All logic — auth, routing, practice building, team management — lives here.
- **`main.jsx`** — React DOM root
- **`storage-polyfill.js`** — localStorage adapter using `sk_` prefix for cross-platform compatibility

The app has no client-side router. Views are controlled by two state variables: `authView` (`"loading"`, `"login"`, `"register"`, `"app"`) and `view` (`"planner"`, `"calendar"`, `"team"`, `"account"`).

The **4-step practice builder** flow: TimeStep → SegmentStep → DrillStep → PreviewStep.

### Backend (`/api`)

Vercel serverless functions (Node.js). Each file handles one domain:

| File | Purpose |
|------|---------|
| `auth-handler.js` | Register/login — query param `?action=register` or `?action=login` |
| `team-handler.js` | Team CRUD (create, invite members, update roles) |
| `profile-handler.js` | User profile updates |
| `plans-handler.js` | Save/list/delete practice plans (stored as JSONB) |
| `support-handler.js` | Support email via Resend |
| `create-checkout-session.js` | Stripe Checkout session creation |
| `webhook.js` | Stripe webhook handler (subscription lifecycle) |

Shared utilities in `api/_lib/`:
- `db.js` — Neon PostgreSQL client using `@neondatabase/serverless` with SQL tagged templates
- `clerkAuth.js` — `getClerkUserId(req)` verifies Clerk session token; `resolveUser(clerkUserId, sql)` finds/creates the DB user record (handles email-based migration for existing users)
- `team.js` — Team lookup helpers

**Protecting endpoints:** Use `getClerkUserId(req)` + `resolveUser(clerkUserId, sql)` from `_lib/clerkAuth.js`. This replaces the old JWT pattern.

### Database

PostgreSQL via Neon (serverless). No ORM — raw SQL via Neon's `sql` tagged template.

Schema file: `schema.sql`. Run it manually in the Neon SQL editor to initialize or migrate.

Tables: `users`, `teams`, `team_members`, `invites`, `saved_plans` (plans stored as JSONB in the `data` column).

`users` table has a `clerk_id VARCHAR(255) UNIQUE` column added by `migrate-clerk.js`. Existing users without a `clerk_id` are auto-linked by email on first Clerk login.

### Payments & Subscriptions

Stripe handles billing ($4.99/month). Subscription status is stored on `users.sub_status` and synced via the webhook handler. The app enforces a 7-day free trial; users with `sub_status = 'incomplete'` or expired trials hit the paywall view.

**Subscription fields on `users` table:**
- `sub_status` — `trial`, `trialing`, `active`, `cancelled`, `past_due`, `expired`, `incomplete`
- `trial_start` — when the trial began
- `sub_start` — when paid subscription began (set by webhook on `customer.subscription.updated`)
- `sub_cancel_at` — Stripe's `current_period_end` timestamp when user cancels (access until this date)
- `stripe_sub_id` — Stripe subscription ID
- `stripe_customer_id` — Stripe customer ID

**Subscription payload** returned by `auth-handler.js` (login + me):
```js
sub: { status, trialStart, subStart, stripeSubId, cancelAt }
```

**`isSubActive` logic** (App.jsx): for `cancelled` status, uses `s.cancelAt` (the actual period end from Stripe) — NOT a fixed 30-day window.

**Webhook (`api/webhook.js`)**: Uses stream-based raw body reading (not `req.body`) to correctly verify Stripe signatures. The `getRawBody` helper reads from the request stream directly.

**Trial abuse prevention**: `create-checkout-session.js` checks if the user has ever had a trial or active sub before granting `trial_period_days: 7`.

**DB migrations**: Run `node migrate.js` (pulls from `.env.production`) to add new columns safely. Use `vercel env pull --environment=production .env.production` first — do NOT use `vercel env pull` alone (pulls dev DB).

## Environment Variables

Backend (set in Vercel dashboard):
```
DATABASE_URL           # Neon PostgreSQL connection string
CLERK_SECRET_KEY       # Clerk secret key (sk_live_... or sk_test_...)
STRIPE_SECRET_KEY      # Stripe secret key
STRIPE_WEBHOOK_SECRET  # Stripe webhook signing secret
STRIPE_PRICE_ID        # Stripe price ID for $4.99/mo plan
FRONTEND_URL           # Frontend domain (for Stripe redirect URLs)
RESEND_API_KEY         # Resend email API key
SUPPORT_EMAIL          # Support inbox address
```

Frontend (in `.env.local`):
```
VITE_STRIPE_PRICE_ID        # Stripe price ID (used in App.jsx for checkout)
VITE_CLERK_PUBLISHABLE_KEY  # Clerk publishable key (pk_live_... or pk_test_...)
```

## New Sport Template Workflow

This repo is a template for sport-specific coaching SaaS products. To spin up a new sport:

1. Use this repo as a GitHub template → clone it
2. Edit **`src/config.js`** — the single file that controls everything sport-specific:
   - `appName`, `logoInitials`, `sport`, `primaryColor`, `ytSearchTerm`
   - Optional: `navColor`, `bgColor`, `accentColor` for a full multi-color palette
   - `categories` and `segmentTemplates` arrays
   - All `copy.*` fields: landing page, onboarding, paywall, auth form, account page
3. Replace **`src/data/drills.json`** with sport-specific drills (`{ id, cat, name, dur, intensity, desc }`)
4. Update **`index.html`** — title, meta description, OG tags, canonical URL, and favicon color
5. Set environment variables in Vercel (new Stripe price ID, new DB, etc.)
6. Deploy

**What Claude should generate per sport:**
- Sport-appropriate categories and segment templates
- All `copy.*` prose (hero, problems, how it works, features, testimonials, onboarding sections)
- 200+ drills in `drills.json` matching the new categories
- Sport-appropriate colors in config

## Key Conventions

- **Adding/editing drills**: The drill database lives in `src/data/drills.json`. Each drill has `{ id, cat, name, dur, intensity, desc }`.
- **Multi-color palette**: `config.js` supports `primaryColor` (CTAs/buttons), `navColor` (navbar/dark backgrounds), `bgColor` (content backgrounds), and `accentColor` (secondary buttons). App.jsx reads `navColor` and `bgColor` to override the brand object `B`. If omitted, defaults to dark/off-white.
- **Brand object**: `B` in App.jsx holds all design tokens. `B.black` and `B.dark` map to `navColor`; `B.offWhite` and `B.surface` map to `bgColor`; `B.red` maps to `primaryColor`.
- **Auth token key**: `'sk-token'` in localStorage.
- **localStorage prefix**: `sk-` for app state, `sk_` in the storage polyfill.
- **API routing**: Vercel rewrites are defined in `vercel.json` — all `/api/*` paths route to the corresponding serverless function.
- **Auth header**: Clients send `Authorization: Bearer <token>`; use `getTokenFromReq(req)` to extract it.
- **Team permissions**: 4 roles — `head`, `assistant`, `coordinator`, `viewer`. Checked server-side in `team-handler.js`.
- **Admin test mode**: A "Skip — Admin Test Mode" button on the login/register form sets a mock user and `sub_status: active` to bypass auth and the paywall entirely. This is frontend-only and does not create a DB record.
- **Subscription gate**: `subActive` (line ~352 in App.jsx) is the single boolean controlling paywall access. It is `true` when sub status is `active`, `trialing`, `cancelled` (access until `cancelAt`), or trial within 7 days — or when the user is not a `head` role on a team.
- **Neon DB prefix**: Vercel's Neon integration creates env vars with a `STORAGE_POSTGRES_` prefix. A separate `DATABASE_URL` env var must be manually added pointing to the same pooled connection string.
- **`apiFetch` tracks HTTP status**: Returns `data.__status = res.status` so the init `me` call can distinguish a real 401 (clear token → login) from a transient 500 (retry after 2s).
- **Cancel flow**: `doCancel` sends auth token, reads `currentPeriodEnd` from API response, stores as `cancelAt` in localStorage and state. Does not use a fixed 30-day offset.
- **Auth on checkout**: Both `doSubscribe` and the post-registration checkout fetch send `Authorization: Bearer <token>` so the server can check for prior trials.
