# Infrastructure Inventory

Last updated: 2026-06-18

This is a private app-repo inventory. It may name internal app systems and migration/function filenames, but it must still never contain secret values.

## Domains

- Marketing/public docs: `zambudget.com`
- Marketing redirect: `www.zambudget.com`
- App: `app.zambudget.com`

## Cloudflare

- Website Worker: `zambudget-website`
- App Worker: `zambudget-app`
- App build output: `dist/`
- App Wrangler config: `wrangler.jsonc`

Keep website and app routes separated.

## Supabase

- Project ref: `cmfnmhqyeipgtjktbouk`
- Public project URL is in `config.json`.
- Public anon/publishable key is in `config.json`.
- Service-role key stays in Supabase/provider secret storage only.
- Browser client: `@supabase/supabase-js` is a runtime dependency and is served from `js/vendor/supabase.js`.
- Do not switch the browser client back to a third-party CDN without a privacy/legal review. The local vendor file intentionally avoids a third-party network request on every app load.

Edge Functions:

- `account-delete`
- `billing-create-checkout`
- `billing-create-portal`
- `billing-status`
- `stripe-webhook`

## Stripe

Public client config:

- publishable key in `config.json`
- Premium price ID in `config.json`

Secret config:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `APP_URL`

Secret values must be set through Supabase secrets or provider dashboards, not Git.

## GitLab CI/CD

Current authenticated test variable names are legacy names:

- `BUDGETBUDDY_TEST_EMAIL`
- `BUDGETBUDDY_TEST_PASSWORD`

Do not rename these until tests and CI are updated together.

## Cloud Sync Storage Model

- Local app data is stored under `bb_` browser storage keys.
- Cloud Sync stores encrypted vault data in Supabase.
- Raw recovery-key text is not persisted by the current Cloud Sync implementation.
- Trusted browsers may store a non-extractable AES-GCM CryptoKey in IndexedDB.
- Legacy internal names such as `bb`, `buddy`, and `budgetbuddy_buddy_cloud_keys` may remain as technical identifiers.

## Backups To Confirm Before VPS Cutover

- Supabase backup/restore plan and retention
- restore drill date against a non-production target
- GitLab owner recovery
- Cloudflare owner recovery
- Stripe owner recovery
- Proton Mail owner recovery
- domain registrar recovery
- CI/CD variable restore procedure
