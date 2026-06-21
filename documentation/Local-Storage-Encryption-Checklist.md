# Local Storage Encryption Checklist

Status: future implementation gate.
Last reviewed: 2026-06-21.

This checklist blocks premature local-storage encryption work. Local encryption changes core persistence, Cloud Sync, recovery-key UX, demo behavior, import/export, diagnostics, and account cleanup. Do not implement encryption until the unlock model is approved.

## Not In Current Patch

The Phase 1 guardrail patch must not:

- encrypt `bb_data`
- rename `bb_*` keys
- change Cloud Sync encryption
- change recovery-key behavior
- change import/export behavior
- change budget math
- change gift card state behavior
- change auth/session behavior

## Phase 1 Allowed Work

Phase 1 may:

- add storage-sensitive-data tests
- document current plaintext behavior
- add TODO-marked future encryption assertions
- verify recovery keys, master keys, and vault keys are not persisted in plaintext
- inventory localStorage, sessionStorage, IndexedDB, and cookie keys
- add guardrail documentation, checklists, and review gates

## Existing Product Model

Zam already has an approved Cloud Sync and recovery model. The local encryption layer should work with that model rather than replacing it:

- signed-in users use Cloud Sync as the default protection path
- Cloud Sync remote vaults are encrypted client-side
- recovery keys are required on new browsers/devices
- trusted browsers may use non-extractable WebCrypto keys in IndexedDB
- raw recovery-key text is not stored in localStorage
- browser-only/local-only budgets remain unrecoverable if local storage/key material is lost

The remaining decision is implementation-specific: how the local encryption adapter uses the existing trusted-browser/recovery model without weakening it.

## Key Separation Rule

Cloud/browser access tokens must not be used as local vault encryption keys.

A trusted browser/device unlock model may exist later, but session credentials, browser access tokens, sync-slot tokens, and vault decryption material must remain separate.

## Required Design Answers

- What unlock secret protects local `bb_data`?
- Can Zam recover local encrypted data if the user loses the unlock secret?
- Does local encryption apply to demo data?
- Does local encryption apply to CSV import batch metadata?
- Does local encryption apply to merchant aliases?
- Does local encryption apply to gift card metadata?
- What remains intentionally plaintext?
- How does a signed-out user unlock a local-only budget?
- How does logout interact with encrypted local data?
- How does factory reset remove encrypted data?
- How does account-owner change cleanup work?
- How does Cloud Sync restore write encrypted local data?
- How does export/import avoid accidental encryption lock-in?
- How are stale plaintext `bb_data` payloads migrated and removed?

## Intentional Plaintext Boundary

Examples that may remain plaintext only if approved:

- app version
- migration version
- feature flags
- theme/accent preference if not account-sensitive
- encrypted envelope metadata
- non-sensitive timestamps
- demo-mode flag
- recovery-key-backed-up boolean UX flag

Examples that should not remain plaintext after local encryption lands:

- transactions
- categories
- amounts
- notes
- deleted/tombstoned records
- gift card metadata
- merchant aliases
- CSV import rows
- budget structure
- recovery key
- vault key
- master key

## Security Limitation

Local storage encryption protects persisted browser storage at rest.

It does not fully protect data while the app is unlocked and decrypted in memory. It also does not eliminate XSS risk. XSS prevention, CSP, dependency hygiene, clipboard hardening, and token storage hardening remain separate security requirements.

## Required Engineering Plan

1. Add encrypted storage adapter.
2. Keep adapter isolated from UI and budget math.
3. Add envelope format with explicit version.
4. Add one-way migration from plaintext `bb_data`.
5. Avoid creating new plaintext backup keys during migration.
6. Preserve rollback if migration fails before deleting readable data.
7. Add tests that prove old plaintext sentinel values disappear after migration.
8. Add tests that prove corrupt encrypted envelopes do not overwrite memory.
9. Add tests that prove Cloud Sync restore still works.
10. Add tests that prove local-only users get understandable unlock/recovery states.

Rollback safety means the original plaintext value may remain only until encrypted migration is verified. Do not create new plaintext backup keys. After verified migration, remove the original plaintext payload.

## Release Gate

Any PR that implements encryption, migration, key handling, recovery changes, or storage adapter changes must be blocked until this checklist is satisfied and product approval is recorded.

See `documentation/Local-Storage-Encryption-Implementation-Plan.md` for the implementation path.

## Future Test Flip

Current Phase 1 test:

```text
documents current behavior: real bb_data is readable plaintext until local encryption is approved
```

Future encryption test after implementation:

```text
bb_data does not expose transaction descriptions, amounts, categories, notes, gift card metadata, or deleted transaction tombstones
```

Do not flip that test until migration and unlock behavior are product-approved and implemented.
