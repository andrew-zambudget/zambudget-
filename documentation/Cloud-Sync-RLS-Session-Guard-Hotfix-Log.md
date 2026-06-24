# Cloud Sync RLS Session Guard Hotfix Log

Date: 2026-06-24

## Issue

Production showed a Cloud Sync history error:

```text
new row violates row-level security policy for table "buddy_cloud_vaults"
```

The account still had local-first budget data, so no local data loss was observed. The risk was that Cloud Sync could not write the encrypted vault and the recovery-key reminder stayed active.

## Why This Matters

`buddy_cloud_vaults` is protected by Supabase RLS. The policy correctly allows only the signed-in owner to insert or update their own encrypted Cloud Sync vault.

The app must not treat an auth/session problem as "no remote vault exists." If a stale or missing Supabase session makes the remote vault unreadable, the app must stop before attempting a new upload.

## Fix

Cloud Sync now verifies that the active Supabase session exists and belongs to the same user as `window.currentUser` before Cloud Sync reads or writes remote vault data.

Guarded paths include:

- remote vault lookup
- version-history lookup
- version-history snapshot writes
- sync-slot claims and updates
- Cloud Sync vault uploads

If the session is missing or belongs to a different account, Cloud Sync fails safe with this user-facing message:

```text
Cloud Sync needs a fresh sign-in session before it can back up this budget. Your budget is still saved locally. Sign out and sign in again, then retry sync.
```

## Intentional Non-Changes

This hotfix does not change:

- Supabase RLS policies
- Cloud Sync encryption
- recovery-key cryptography
- local budget storage
- import/export behavior
- budget math
- account ownership rules

## Regression Coverage

Added a regression test proving that after Cloud Sync is already configured, a missing Supabase session stops a later Cloud Sync upload before any vault upsert is attempted.

## Verification

Passed:

```text
node --check js/cloudSync.js
npx playwright test tests/buddy-cloud-conflict.spec.js --workers=1
npx playwright test tests/recovery-key-guardrails.spec.js --workers=1
npx playwright test tests/sync-status.spec.js --workers=1
npx playwright test tests/supabase-auth-storage.spec.js --workers=1
```

## Production QA Notes

After deployment:

1. Sign out and sign back in on the affected production account.
2. Confirm the Cloud Sync status no longer shows the RLS error after a successful sync attempt.
3. If the recovery key was previously saved, import it through Recovery Help to verify the backup flag.
4. Confirm the recovery-key reminder clears only after successful verification.
5. Confirm local budget data remains present before and after refresh.

