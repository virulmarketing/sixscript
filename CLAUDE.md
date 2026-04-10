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

StrikeScript is a soccer practice planning SaaS. It is a **React 18 SPA** built with Vite, deployed on Vercel with serverless API functions and a Neon PostgreSQL database.

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
- `auth.js` — `signToken(userId)` and `verifyToken(token)` using JWT (30-day expiry)
- `team.js` — Team lookup helpers

**Protecting endpoints:** Use `verifyToken(getTokenFromReq(req))` from `_lib/auth.js`.

### Database

PostgreSQL via Neon (serverless). No ORM — raw SQL via Neon's `sql` tagged template.

Schema file: `schema.sql`. Run it manually in the Neon SQL editor to initialize or migrate.

Tables: `users`, `teams`, `team_members`, `invites`, `saved_plans` (plans stored as JSONB in the `data` column).

### Payments & Subscriptions

Stripe handles billing ($4.99/month). Subscription status is stored on `users.sub_status` and synced via the webhook handler. The app enforces a 7-day free trial; users with `sub_status = 'incomplete'` or expired trials hit the paywall view.

## Environment Variables

Backend (set in Vercel dashboard):
```
DATABASE_URL           # Neon PostgreSQL connection string
JWT_SECRET             # JWT signing secret
STRIPE_SECRET_KEY      # Stripe secret key
STRIPE_WEBHOOK_SECRET  # Stripe webhook signing secret
STRIPE_PRICE_ID        # Stripe price ID for $4.99/mo plan
FRONTEND_URL           # Frontend domain (for Stripe redirect URLs)
RESEND_API_KEY         # Resend email API key
SUPPORT_EMAIL          # Support inbox address
```

Frontend (in `.env.local`):
```
VITE_STRIPE_PRICE_ID   # Stripe price ID (used in App.jsx for checkout)
```

## New Sport Template Workflow

This repo is a template for sport-specific coaching SaaS products. To spin up a new sport:

1. Use this repo as a GitHub template → clone it
2. Edit **`src/config.js`** — the single file that controls everything sport-specific:
   - `appName`, `logoInitials`, `sport`, `primaryColor`, `ytSearchTerm`
   - `categories` and `segmentTemplates` arrays
   - All `copy.*` fields: landing page, onboarding, paywall, auth form, account page
3. Replace **`src/data/drills.json`** with sport-specific drills (`{ id, cat, name, dur, intensity, desc }`)
4. Set environment variables in Vercel (new Stripe price ID, new DB, etc.)
5. Deploy

**What Claude should generate per sport when given `src/config.js` to edit:**
- Sport-appropriate categories and segment templates
- All `copy.*` prose (hero, problems, how it works, features, testimonials, onboarding sections)
- 200+ drills in `drills.json` matching the new categories
- A sport-appropriate `primaryColor`

`App.jsx` requires **no changes** between sports — only `config.js` and `drills.json` change.

## Key Conventions

- **Adding/editing drills**: The drill database lives in `src/data/drills.json`. Each drill has `{ id, cat, name, dur, intensity, desc }`. Categories are defined in the `CATEGORIES` array in `App.jsx`.
- **Brand color**: Primary red is `#DC2626`. The brand object `B` in App.jsx holds all design tokens.
- **Auth token key**: `'sk-token'` in localStorage.
- **localStorage prefix**: `sk-` for app state, `sk_` in the storage polyfill.
- **API routing**: Vercel rewrites are defined in `vercel.json` — all `/api/*` paths route to the corresponding serverless function.
- **Auth header**: Clients send `Authorization: Bearer <token>`; use `getTokenFromReq(req)` to extract it.
- **Team permissions**: 4 roles — `head`, `assistant`, `coordinator`, `viewer`. Checked server-side in `team-handler.js`.
- **Admin test mode**: A "Skip — Admin Test Mode" button on the login/register form sets a mock user and `sub_status: active` to bypass auth and the paywall entirely. This is frontend-only and does not create a DB record.
- **Subscription gate**: `subActive` (line ~352 in App.jsx) is the single boolean controlling paywall access. It is `true` when sub status is `active`, `trialing`, `cancelled` within 30 days, or trial within 7 days — or when the user is not a `head` role on a team.
- **Neon DB prefix**: Vercel's Neon integration creates env vars with a `STORAGE_POSTGRES_` prefix. A separate `DATABASE_URL` env var must be manually added pointing to the same pooled connection string.
