# Cloud Sync v1 Production Checklist

Cloud Sync v1 is the default protection path for signed-in users. The app still supports browser-only use before sign-in, but signed-in budgets should be protected by encrypted Cloud Sync backup by default.

## Required Supabase Setup

- Apply `supabase/migrations/202606100001_billing_profiles.sql` if billing is enabled.
- Apply `supabase/migrations/202606100002_buddy_cloud_vaults.sql`.
- Apply `supabase/migrations/202606100003_remove_buddy_cloud_device_id.sql`.
- Apply `supabase/migrations/202606100004_buddy_cloud_sync_slots.sql`.
- Apply `supabase/migrations/202606100005_buddy_cloud_browser_access.sql`.
- Apply `supabase/migrations/202606100006_buddy_cloud_vault_snapshots.sql`.
- Apply `supabase/migrations/202606100007_buddy_cloud_two_free_sync_slots.sql`.
- Apply `supabase/migrations/202606130001_profiles_delete_cascade.sql` if the production project has a legacy `public.profiles` table.
- Confirm RLS is enabled on `public.buddy_cloud_vaults`.
- Confirm authenticated users can only read, insert, update, and delete rows where `auth.uid() = user_id`.
- Confirm `account-delete` Edge Function is deployed for Cloud Sync reset and full account deletion.
- Confirm `billing-*` and `stripe-webhook` Edge Functions are deployed only when billing is enabled.
- Confirm `config.json` points at the production Supabase project.
- Confirm Supabase Auth redirect URLs include the production domain and local development URL.
- For beta with billing disabled, confirm `config.json` has `"billingEnabled": false` and checkout/portal actions show the beta-disabled message.

## Security Model

- Budget data is stored locally in `bb_data`.
- Cloud data is stored as one encrypted vault row per user in `buddy_cloud_vaults`.
- The encrypted vault includes transactions, balances, budgets, categories, descriptions, notes, and amounts; the backend cannot read those fields.
- Cloud Sync v1 does not store device names, user agents, IP-derived location, or persistent device identifiers in the app database.
- The browser generates a Cloud Sync recovery key.
- The recovery key is stored only on the user's device in localStorage.
- Another device must import the recovery key before it can decrypt the cloud vault.
- Billing status is intentionally excluded from the cloud vault payload.
- Local-only budgets have no recovery support after browser/device storage is lost. Cloud Sync and exports are the supported recovery paths.

## Product Mission

- BudgetBuddy should be usable by anyone.
- Core budgeting features should remain available without paywalls.
- Cloud Sync should make backup/sync safer and more seamless without weakening the privacy promise.

## Manual Test Matrix

- Signed-out user can keep using the app locally.
- Signed-in user is guided into Cloud Sync protection and receives a recovery key.
- First signed-in Cloud Sync setup uploads the local budget as an encrypted vault.
- Editing transactions/categories after enable queues and completes a cloud upload.
- Reloading the same device keeps sync enabled.
- Second device with no key asks for the recovery key before syncing.
- Second device with the correct key can download the cloud budget.
- Free Tier allows two active synced browsers and shows Paused, not Offline, when the limit blocks a third browser.
- Sign Out All Devices clears Cloud Sync slots before Supabase global sign-out.
- Wrong recovery key fails without overwriting cloud data.
- Offline edits remain local and upload after reconnect/manual upload.
- Manual Sync Now is rate-limited and uses the same push/pull/conflict logic as startup sync.
- Manual Cloud Sync Version saves the local copy as an encrypted safety snapshot before replacing local data.
- Lost Recovery Key opens the guided reset path and creates a fresh encrypted vault on next setup.
- Diagnostics export is local-only, opt-in, and excludes budget contents, recovery keys, tokens, email, and transaction counts.
- Browser-only/local budgets have no support commitment after local storage is lost.
- Factory reset removes local cloud settings and local recovery keys.
- Reset Cloud Sync deletes encrypted vault data and encrypted snapshots without deleting the auth account.
- Delete Account removes encrypted vault data, encrypted snapshots, browser access records, inactive billing profile records, legacy profile rows if present, and the Supabase auth identity, then clears the local browser session.
- Delete Account requires a fresh login verification before the permanent deletion request runs.
- Delete Account is blocked while Stripe subscription status is active or past_due.
- Delete Account copy explains that deleted Cloud Sync data, deleted snapshots, deleted account identities, and lost recovery keys cannot be recovered, and that Stripe may retain billing records required for payments, tax, legal, or dispute handling.
- Delete Account shows a post-deletion confirmation screen and redirects to `https://zambudget.com/?accountDeleted=true`. Email confirmation is deferred until transactional support email is configured.

## Live Beta Gate

- Beta can start with `billingEnabled` set to `false`.
- If billing is disabled, Upgrade/Premium entry points must not redirect to Stripe.
- If billing is enabled, complete Stripe Checkout, Billing Portal, webhook, and refund/cancel tests with a real low-value or Stripe test configuration before inviting users.
- Confirm Privacy Policy and Terms match current Cloud Sync behavior.
- Confirm no analytics, advertising pixels, third-party tracking scripts, or fingerprinting scripts are loaded by the app.
- Confirm support paths exist for lost recovery key, device limit / Paused sync, and version conflict review.
- Keep PIN/passkey-protected local recovery-key storage as the top v1.1 security priority.

## Live Launch Gate

- Run the migration in production before shipping the UI.
- Complete the test matrix against the production Supabase project with a non-admin account.
- Complete the full account deletion flow in staging/test with a disposable account before enabling it for real users.
- Verify privacy policy copy says signing in uses Cloud Sync as the default encrypted protection path.
- Verify privacy policy discloses that infrastructure/payment providers may be subject to lawful requests, while synced budget contents remain encrypted without BudgetBuddy-held recovery keys.
- Legal review later: confirm the privacy policy clearly distinguishes encrypted budget contents from operational metadata such as account/auth records, sync timestamps, schema/encryption version, checksums, and billing records if applicable.
- Verify no Cloud Sync path requires Stripe Premium.
- Flip `config.json` to `"billingEnabled": true` only after live billing is intentionally ready.
