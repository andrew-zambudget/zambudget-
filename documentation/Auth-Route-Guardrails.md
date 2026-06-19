# Auth Route Guardrails

Last updated: June 19, 2026

## Purpose

Zam redirects unauthenticated visitors away from the protected app shell before rendering the dashboard. This is a user-experience and privacy guardrail, not the final security boundary.

## Public Routes

- `/login`
- `/auth/callback`
- `/demo`
- `/privacy`
- `/terms`
- `/site-data`

## Protected Routes

- `/app`
- `/app/settings`
- `/app/import`
- `/app/export`
- `/app/cloud-sync`
- `/app/billing`
- `/app/account`
- `/app/recovery`
- `/app/premium`
- any future `/app/*` route that can read, write, sync, export, delete, or modify user data

## Boot Flow

1. `index.html` starts with the app shell hidden behind a small "Checking sign-in..." state.
2. `js/main.js` initializes the Supabase client from `config.json`.
3. `js/authRouteGuard.js` checks the current Supabase session before state or UI render.
4. Logged-out protected routes redirect to `/login`.
5. Signed-in `/` and `/login` routes redirect to `/app`.
6. `/demo` remains public and uses local sample data only.
7. Protected app UI renders only after the route guard allows it.

## Security Boundary

Do not treat front-end redirects as the security boundary. Browser users can bypass JavaScript, modify local state, or call functions manually.

The real security boundary remains:

- Supabase authenticated session
- stable internal `user_id`
- Supabase row-level security policies using `auth.uid()`
- Supabase Edge Function `requireUser()` checks for billing and account deletion
- server-confirmed billing/customer records for server-backed Premium actions
- no service-role or admin API keys in browser code

## Current Backend Evidence

- Browser code uses the public Supabase anon key from `config.json`.
- `SUPABASE_SERVICE_ROLE_KEY` is referenced only in Supabase Edge Function/shared server code and setup documentation.
- `buddy_cloud_vaults`, `buddy_cloud_vault_snapshots`, `buddy_cloud_browser_access`, and `billing_profiles` migrations enable RLS and bind access to `auth.uid()`.
- Billing and account-deletion Edge Functions call `requireUser()` before account-specific work.
- Cloud Sync reads and writes include the signed-in `user_id` and are also protected by RLS.

## Premium Guardrail

Client-side Premium flags are only UX hints. Server-backed Premium actions must keep checking entitlement through authenticated Edge Functions or owner-protected rows. Browser-only features shipped to the client can only be casually gated.

## Demo Boundary

`/demo` does not create a real authenticated session. It uses local sample data and should not access Cloud Sync, billing, recovery, trusted-browser state, or account-management actions.
