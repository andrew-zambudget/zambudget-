# App Rebuild Runbook

Last updated: 2026-06-16

Goal: rebuild the private Zam! app surface from GitLab plus external secret storage.

## Inputs Required

From GitLab:

- private app repo: `zambudget-app` once the GitLab path is confirmed
- public website/docs repo: `zambudget-website`

From secret storage/provider dashboards:

- Cloudflare API token
- Supabase access token and project access
- Stripe secret key
- Stripe webhook secret
- OAuth provider secrets
- domain registrar access
- Proton Mail admin access

Do not paste secret values into GitLab files, issues, docs, or support chats.

## Local Rebuild

```powershell
git clone <private-zam-app-repo-url> zambudget-app
cd zambudget-app
npm install
npm run build
npm run test:e2e:safety
```

Current note: this local checkout may still use the legacy GitLab remote URL until the renamed `zambudget-app` path is reachable. Confirm `git remote -v` before copying clone commands into a public or recovery checklist.

Run the full suite before broad releases:

```powershell
npm test
```

## Static App Build

The app builds static Cloudflare assets into:

```text
dist/
```

Build script:

```powershell
npm run build
```

Deployment target:

```text
zambudget-app
```

Custom domain:

```text
app.zambudget.com
```

## Supabase Restore/Verify

Project ref:

```text
cmfnmhqyeipgtjktbouk
```

Required function inventory:

- `account-delete`
- `billing-create-checkout`
- `billing-create-portal`
- `billing-status`
- `stripe-webhook`

Required migration inventory:

- `202606100001_billing_profiles.sql`
- `202606100002_buddy_cloud_vaults.sql`
- `202606100003_remove_buddy_cloud_device_id.sql`
- `202606100004_buddy_cloud_sync_slots.sql`
- `202606100005_buddy_cloud_browser_access.sql`
- `202606100006_buddy_cloud_vault_snapshots.sql`
- `202606100007_buddy_cloud_two_free_sync_slots.sql`
- `202606120001_buddy_cloud_browser_access_realtime.sql`
- `202606120002_buddy_cloud_vaults_realtime.sql`
- `202606120003_buddy_cloud_browser_access_sync_slot_hash.sql`
- `202606130001_profiles_delete_cascade.sql`
- `202606130002_harden_public_rls_policy_roles.sql`

Verify before launch/cutover:

- RLS is enabled where required.
- Auth users can access only their own records.
- Edge Functions are deployed to the production project.
- Billing functions fail closed when unauthenticated.
- Account deletion requires recent verification.
- Auth, SMTP, email templates, and OAuth redirect URLs pass `documentation/Auth-Cutover-Checklist.md`.

## Billing Restore/Verify

Billing is live only when `config.json` has:

```json
"billingEnabled": true
```

Stripe secret values must be restored outside Git. Use `documentation/Billing-Setup.md` and `scripts/deploy-supabase-billing.ps1` only after Stripe work is in scope.

## App Smoke Checks

Minimum after deploy:

- app loads at `https://app.zambudget.com`
- app pages remain `noindex,follow`
- login opens and returns to the app
- Cloud Sync status renders
- wrong recovery key fails without overwriting cloud data
- export/import still works
- account deletion safety copy and checks still render
- billing entry points match the current billing mode

## Stop Conditions

Stop before deploy/cutover if:

- a secret cannot be restored from a trusted source
- Supabase migration state is uncertain
- OAuth redirect URLs are stale
- Stripe webhook state is unknown while billing is enabled
- app pages become indexable
- legal/marketing copy no longer matches real behavior
