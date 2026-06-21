# Zam Local Vault / Smoke Test Completion Checklist

## Status Summary

Current status:

```text
Local vault storage is enabled by default in config.json.
Automated production smoke is green with local vault enabled.
Runtime app saves now persist real app budget data as encrypted local vault envelopes.
```

This is now a global user enablement after deployment picks up the pushed config.

## Runtime Rollout Gate

Current feature flag:

```text
Browser flag: window.__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__
Config flag: config.json -> localVaultStorageEnabled: true
Default state: enabled in `config.json`
```

Runtime behavior now covered by tests:

```text
- When the config flag is enabled, app startup awaits State.initStateAsync().
- Existing plaintext bb_data migrates to a local vault envelope before render.
- Fresh flag-on writes store an encrypted local vault envelope in bb_data.
- Runtime save callers queue encrypted writes and can be flushed in tests with State.flushLocalVaultSaveQueue().
- Cloud Sync/recovery/auth/session behavior is not redesigned by this rollout gate.
```

## To Call Test Phase Complete With Flag On

### Finish Manual Lane 4

Manual production checks still needed or to be confirmed complete:

```text
- Magic link opens and creates an authenticated session.
- Dashboard loads after login.
- Cloud Sync status is normal.
- Recovery key imports/verifies.
- No console errors while logged in.
- No unexpected trackers while logged in.
```

## Changelog Wording

Use:

```text
Enabled local vault storage by default. Persisted real app budget data now migrates to an encrypted local vault envelope before render, and fresh saves use the encrypted envelope.
```

Do not imply this protects data while the app is open and decrypted in memory.

## Privacy / Legal Wording

Local browser budget storage can be described as encrypted at rest.

Keep or confirm wording that:

```text
Cloud Sync data is encrypted before upload.
```

If browser storage is mentioned, use wording like:

```text
Required site data may include local app data needed to save and load budgets.
```

Keep the limitation: local-only budgets are still unrecoverable if browser storage or local vault key material is lost.

## Jira Status

Use:

```text
Local vault storage enabled. Monitor production behavior and support reports.
```

Avoid wording that suggests Zam can recover local-only encrypted budgets without Cloud Sync or an export.

## Storage Status Note

Current production storage status:

```text
Production storage state is expected / acceptable for flag-on local vault state.

bb_data should be an encrypted local vault envelope after app startup/migration.

No raw recovery key observed in localStorage.

No local vault key observed in localStorage.

Local vault key material should live in IndexedDB, not localStorage.
```

## Internal Rollout / Audit Doc Requirements

For rollout audit and future support, document:

```text
- Feature flag name and location:
  - window.__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__
  - config.json -> localVaultStorageEnabled
- Confirmation that default is on.
- How to verify legacy/plaintext bb_data before startup migration.
- How to verify encrypted-envelope bb_data after startup migration.
- How to confirm sensitive sentinel values are not visible.
- How to verify refresh/decrypt/readback works.
- How to verify State.flushLocalVaultSaveQueue() completes after runtime saves.
- Rollback plan:
  - turn the config flag off for new sessions only as an emergency rollback
  - do not manually edit user storage unless a specific recovery runbook exists
  - if bb_data is already encrypted and the flag is off, app startup must fail safe instead of blanking or overwriting the budget
  - re-enable the flag or use Cloud Sync/recovery flow to recover access
```

## Test Evidence to Attach

Attach or reference:

```text
- Core app smoke: 15 passed
- Auth route guard: 6 passed
- Storage/recovery/local vault guardrails: updated for encrypted bb_data expectations
- Focused local vault rollout suite: 26 passed
- Full automated test suite: 127 passed, 1 skipped
- Production login/demo/magic-link request checks: passed
- Authenticated password smoke: skipped unless BUDGETBUDDY_TEST_EMAIL and BUDGETBUDDY_TEST_PASSWORD are set
- Authenticated magic-link callback/recovery verification: manual pending unless completed
```

## Public Marketing / Legal

Allowed claim:

```text
Persisted real app budget data in browser storage is encrypted at rest.
```

Required limitation:

```text
Local encryption does not protect unlocked in-memory app data and does not make browser-only budgets recoverable if browser storage or local vault key material is lost.
```

## Final Call

Production smoke can be considered complete with the local vault flag on after the remaining manual Lane 4 checks pass.
