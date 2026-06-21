# Zam Local Vault / Smoke Test Completion Checklist

## Status Summary

Current status:

```text
Automated production smoke is green with local vault disabled by default.
Local vault encryption is staged behind a disabled feature flag.
No production/runtime user data has been migrated to encrypted local vault storage.
```

This is not a global user enablement yet.

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
Local vault encryption is staged behind a disabled feature flag.
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
- Feature flag name and location.
- Confirmation that default is off.
- How to verify bb_data before enabling.
- How to verify bb_data after enabling.
- How to confirm sensitive sentinel values are not visible.
- How to verify refresh/decrypt/readback works.
- Rollback plan: turn flag off; do not manually edit user storage unless a specific recovery runbook exists.
```

## Test Evidence to Attach

Attach or reference:

```text
- Core app smoke: 15 passed
- Auth route guard: 6 passed
- Storage/recovery/local vault guardrails: 37 passed
- Production login/demo/magic-link request checks: passed
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

Feature readiness for global local-vault enablement requires a separate rollout ticket.
