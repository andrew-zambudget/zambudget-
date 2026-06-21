# Local Storage Encryption Checklist

Status: active local vault guardrail.
Last reviewed: 2026-06-21.

This checklist records the guardrails for Zam's local vault storage rollout. Local encryption changes core persistence, Cloud Sync, recovery-key UX, demo behavior, import/export, diagnostics, and account cleanup, so future changes must preserve the boundaries below.

## Current Production Behavior

- `bb_data` stores an encrypted local vault envelope for real app budget data.
- plaintext legacy `bb_data` is migrated after the local vault key provider verifies an encrypt/decrypt roundtrip.
- local vault keys are non-extractable WebCrypto keys stored in IndexedDB under `zam_local_vault_keys`.
- demo data remains session-only in `zam_demo_data`.
- Cloud Sync encryption, recovery-key behavior, import/export, budget math, and auth/session behavior remain separate systems.

## Do Not Regress

- rename `bb_*` keys
- change Cloud Sync encryption
- change recovery-key behavior
- change import/export behavior
- change budget math
- change gift card state behavior
- change auth/session behavior

## Completed Implementation Checkpoints

- storage-sensitive-data tests now assert real `bb_data` does not expose budget sentinels.
- local vault adapter, key provider, migration, runtime wiring, and rollout smoke tests are present.
- recovery keys, master keys, and vault keys are not persisted in plaintext localStorage.
- localStorage, sessionStorage, IndexedDB, and cookie keys are inventoried in `documentation/Storage-Inventory.md`.

## Existing Product Model

Zam already has an approved Cloud Sync and recovery model. The local encryption layer should work with that model rather than replacing it:

- signed-in users use Cloud Sync as the default protection path
- Cloud Sync remote vaults are encrypted client-side
- recovery keys are required on new browsers/devices
- trusted browsers may use non-extractable WebCrypto keys in IndexedDB
- raw recovery-key text is not stored in localStorage
- browser-only/local-only budgets remain unrecoverable if local storage/key material is lost

The local encryption adapter uses its own local key-provider boundary without weakening the existing trusted-browser/recovery model.

## Key Separation Rule

Cloud/browser access tokens must not be used as local vault encryption keys.

A trusted browser/device unlock model may exist later, but session credentials, browser access tokens, sync-slot tokens, and vault decryption material must remain separate.

## Remaining Design Answers To Keep Reviewed

- Should CSV import batch metadata and merchant aliases later move inside the local vault?
- What additional user-facing copy is needed if a local vault key is missing or corrupted?
- Should local-only users get any optional export/reminder flow before clearing storage?
- How should support triage a user with encrypted local `bb_data` but missing browser key material?

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

Examples that should not remain plaintext:

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

1. Keep encrypted storage adapter isolated from UI and budget math.
2. Keep envelope format versioned.
3. Preserve one-way migration from plaintext `bb_data`.
4. Avoid creating new plaintext backup keys during migration.
5. Preserve rollback if migration fails before replacing readable data.
6. Keep tests that prove old plaintext sentinel values disappear after migration.
7. Keep tests that prove corrupt encrypted envelopes do not overwrite memory.
8. Keep tests that prove Cloud Sync restore still works.
9. Add/maintain tests for understandable unlock/recovery states as UI evolves.

Rollback safety means the original plaintext value may remain only until encrypted migration is verified. Do not create new plaintext backup keys. After verified migration, remove the original plaintext payload.

## Release Gate

Any PR that changes encryption, migration, key handling, recovery behavior, or storage adapter behavior must be blocked until this checklist is reviewed and product approval is recorded.

See `documentation/Local-Storage-Encryption-Implementation-Plan.md` for the implementation path.

## Current Storage-Sensitive Test

```text
bb_data does not expose transaction descriptions, amounts, categories, notes, gift card metadata, or deleted transaction tombstones
```

Do not weaken that test without product/security review.
