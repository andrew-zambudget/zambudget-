# Zam Local Vault / Smoke Test Completion Checklist

## Status Summary

Current status:

```text
Automated production smoke is green with local vault disabled by default.
Local vault encryption is staged behind a disabled runtime/config flag.
No production/runtime user data has been migrated to encrypted local vault storage.
```

This is not a global user enablement yet.

## Runtime Rollout Gate

Current feature flag:

```text
Browser flag: window.__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__
Config flag: config.json -> localVaultStorageEnabled: true
Default state: absent/false/off
```

Runtime behavior now covered by tests:

```text
- When the config flag is enabled, app startup awaits State.initStateAsync().
- Existing plaintext bb_data migrates to a local vault envelope before render.
- Fresh flag-on writes store an encrypted local vault envelope in bb_data.
- Runtime save callers queue encrypted writes and can be flushed in tests with State.flushLocalVaultSaveQueue().
- Cloud Sync/recovery/auth/session behavior is not redesigned by this rollout gate.
```

## To Call Test Phase Complete With Flag Off

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

## Push Test-Only Commit

Push:

```text
b77d996 Update smoke test expectations
```

Notes:

```text
- No runtime app code changed in this commit.
- This commit updates stale smoke test expectations only.
```

## Changelog Wording

Use:

```text
Added and verified flag-gated local vault encryption test coverage. Default production storage behavior remains unchanged while the feature flag is off.
```

Do not describe local browser storage as encrypted for users yet.

## Privacy / Legal Wording

Do not claim local browser budget storage is encrypted yet.

Keep or confirm wording that:

```text
Cloud Sync data is encrypted before upload.
```

If browser storage is mentioned, use wording like:

```text
Required site data may include local app data needed to save and load budgets.
```

Internal-only note:

```text
Local vault encryption is staged behind a disabled runtime/config flag.
```

## Jira Status

Use:

```text
Foundation complete. Pending controlled production rollout.
```

Do not use:

```text
Local browser storage encryption live for users.
```

## Storage Status Note

Current production storage status:

```text
Production storage state is expected / acceptable for flag-off local vault state.

bb_data remains plaintext JSON while local vault encryption is disabled by default.

No raw recovery key observed in localStorage.

No local vault key observed in localStorage.

Do not manually enable local vault in production UI yet.
```

## Internal Rollout Doc Requirements

Before controlled rollout, document:

```text
- Feature flag name and location:
  - window.__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__
  - config.json -> localVaultStorageEnabled
- Confirmation that default is off.
- How to verify bb_data before enabling.
- How to verify bb_data after enabling.
- How to confirm sensitive sentinel values are not visible.
- How to verify refresh/decrypt/readback works.
- How to verify State.flushLocalVaultSaveQueue() completes after runtime saves.
- Rollback plan:
  - turn the config flag off for new sessions
  - do not manually edit user storage unless a specific recovery runbook exists
  - if bb_data is already encrypted and the flag is off, app startup must fail safe instead of blanking or overwriting the budget
  - re-enable the flag or use Cloud Sync/recovery flow to recover access
```

## Test Evidence to Attach

Attach or reference:

```text
- Core app smoke: 15 passed
- Auth route guard: 6 passed
- Storage/recovery/local vault guardrails: 37 passed
- Focused local vault rollout suite: 26 passed
- Full automated test suite: 127 passed, 1 skipped
- Production login/demo/magic-link request checks: passed
- Authenticated password smoke: skipped unless BUDGETBUDDY_TEST_EMAIL and BUDGETBUDDY_TEST_PASSWORD are set
- Authenticated magic-link callback/recovery verification: manual pending unless completed
```

## Public Marketing

No public marketing claim yet.

Do not add a public feature bullet that implies local browser storage encryption is live until the feature is enabled globally and fully verified.

If mentioned at all, describe it as:

```text
Engineering/security hardening in progress.
```

not as a live user guarantee.

## Final Call

Production smoke can be considered complete with the local vault flag off after the remaining manual Lane 4 checks pass.

Feature readiness for global local-vault enablement requires a separate rollout ticket and a controlled flag-on production smoke using a fresh account and an existing account.
