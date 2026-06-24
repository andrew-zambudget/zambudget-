# Recovery Key Verification Hotfix Log

Date: 2026-06-23

Status: Local patch prepared. Pending commit, push, deploy, and production QA.

## Summary

The app can have a usable trusted Cloud Sync key for the current browser while still lacking the local "recovery key backup verified" flag.

That state is intentional enough to warn the user, but it became risky because the Recovery Help import path used the broader Cloud Sync enable flow. Importing a recovery key from the reminder should only verify the key and clear the reminder state. It should not rerun source-choice, push, pull, or other Cloud Sync enable behavior.

## User-Facing Symptom

An established signed-in account can show:

```text
Recovery key reminder
Recovery key not verified. This browser can sync, but the key cannot be viewed after refresh.
Save or verify your key within 72 hours, or reset Cloud Sync before relying on this backup.
```

This warning means:

- The browser may still be able to sync using a trusted browser key.
- Zam has not recorded that the user has verified or saved the recovery key.
- If the browser/storage/device is lost or cleared and no saved recovery key exists, Zam cannot recover the encrypted Cloud Sync budget.

## Risk

Immediate local budget loss is not expected while the browser remains usable and Cloud Sync can decrypt.

The real risk is false confidence:

- The user may believe the recovery key was saved or verified.
- The app may continue warning because the verified-backup flag was missing.
- If the user clears this browser or loses the device before verifying the key, recovery may be impossible.

## Root Cause

`runRecoveryKeyImportFlow()` called:

```js
completeBuddyCloudEnableFlow({ recoveryKey })
```

That function is the general Cloud Sync setup/enable flow. It can enter broader sync behavior such as remote/local choice handling. Recovery Help's "Import Key" action does not need that behavior.

For this path, the safer operation is:

```js
BuddyCloud.importRecoveryKey(recoveryKey)
```

That validates the recovery key against the encrypted Cloud Sync vault, stores trusted local key material, and records Cloud Sync as enabled without asking the user to choose a sync source.

## Fix

Updated `runRecoveryKeyImportFlow()` in `js/ui.js` so that Recovery Help key import:

- asks for the recovery key
- calls `window.BuddyCloud.importRecoveryKey(recoveryKey)`
- fails safely if the key is invalid
- does not mark the backup verified on failure
- marks the recovery key backed up only after import succeeds
- refreshes Cloud Sync and account recovery UI
- shows a small success toast

The import path no longer uses the broad Cloud Sync enable flow.

## Regression Test

Added a regression test in `tests/recovery-key-guardrails.spec.js`:

```text
recovery help import verifies saved key without rerunning sync choice flow
```

The test verifies:

- fresh setup can enter the 72-hour reminder state
- reload restores a trusted key that can sync but is not exportable
- Recovery Help shows Import Key, not Save Key
- importing the saved key verifies the backup flag
- grace-period storage is cleared
- the key becomes exportable for this browser session
- the flow does not open the Cloud Sync source-choice modal

## Verification Run

Focused recovery tests:

```powershell
node --check js\ui.js
npx playwright test tests/recovery-key-guardrails.spec.js --workers=1
```

Result:

```text
5 passed
```

Adjacent data-loss guardrails:

```powershell
npx playwright test tests/logout-safety.spec.js tests/buddy-cloud-conflict.spec.js --workers=1
```

Result:

```text
8 passed
```

Diff check:

```powershell
git diff --check
```

Result:

```text
No whitespace errors. CRLF warnings only.
```

## Production QA Checklist

After deploy:

1. Sign in to an existing account with Cloud Sync enabled.
2. If the recovery warning appears, open Recovery Help.
3. Choose Import Key.
4. Paste the correct recovery key.
5. Confirm the warning disappears.
6. Confirm Cloud Sync status remains normal.
7. Refresh the app.
8. Confirm the budget still loads.
9. Confirm `bb_cloud_recovery_key_backed_up_v1` and `bb_cloud_recovery_key_saved_v1` are present with `zrk:v1:` values.
10. Confirm no user-id recovery-key flag names are recreated.

Expected storage check after successful verification:

```js
({
  saved: localStorage.getItem('bb_cloud_recovery_key_saved_v1'),
  backedUp: localStorage.getItem('bb_cloud_recovery_key_backed_up_v1'),
  graceKeys: Object.keys(localStorage).filter(k => k.includes('recovery_key_grace_started'))
})
```

Expected result:

```text
saved starts with zrk:v1:
backedUp starts with zrk:v1:
graceKeys is empty for the current user
```

## Non-Goals

This hotfix does not change:

- Cloud Sync encryption
- recovery-key generation
- trusted-browser key storage
- local budget encryption
- import/export
- budget math
- logout semantics
- account deletion

## Follow-Up

If a user still sees the warning after a successful Import Key action:

- treat it as a bug
- check whether `BuddyCloud.importRecoveryKey()` failed silently
- check whether `markRecoveryKeyBackedUp()` ran
- check whether storage is blocked or stale site data is present
- do not advise clearing browser/site data until the recovery key has been verified offline
