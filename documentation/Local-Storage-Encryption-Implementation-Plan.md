# Local Storage Encryption Implementation Plan

Status: Phase 2 implementation planning.
Last reviewed: 2026-06-21.

This plan uses Zam's existing Cloud Sync and recovery model. It does not reopen the product decision around recovery keys, trusted browsers, or Cloud Sync.

## Source Of Truth

The existing model stays in place:

- Signed-in users are protected by Cloud Sync by default.
- Cloud Sync stores encrypted vault data remotely.
- The browser generates the Cloud Sync recovery key.
- Raw recovery-key text is held in memory after generation/import and is not persisted in localStorage.
- Trusted browsers may store a non-extractable AES-GCM WebCrypto key in IndexedDB.
- A trusted browser key can keep syncing after refresh without storing exportable recovery-key text.
- A trusted browser key cannot display the recovery-key text.
- New browsers need the saved recovery key before they can decrypt the synced cloud vault.
- Browser-only/local-only budgets have no recovery support after local browser storage is lost.
- Cloud/browser access tokens and sync-slot tokens are not vault decryption keys.

The local encryption layer should work with that model instead of replacing it.

## Goal

Encrypt persisted local budget data at rest so `bb_data` no longer exposes:

- transactions
- categories
- amounts
- notes
- deleted/tombstoned records
- gift card metadata
- merchant aliases if brought into the local vault later
- CSV/import-created details stored inside transactions

This does not make unlocked in-memory app state secret from app code, browser extensions, XSS, or a compromised device.

## Non-Goals

Do not use this work to:

- change Cloud Sync remote encryption
- change recovery-key copy or recovery promises
- rename `bb_*` keys
- replace Supabase auth
- change billing
- change import/export behavior
- change budget math
- change gift card logic
- change account deletion
- create support-side budget recovery

## Existing Technical Constraint

`state.js` currently exposes synchronous persistence functions:

- `initState()`
- `save()`
- `getSnapshot()`
- `replaceSnapshot()`

`main.js` startup is already async, so `initState()` can become async with a controlled call-site update.

The harder part is `save()`: many UI paths call it synchronously and expect a quick boolean result. Browser encryption through WebCrypto and IndexedDB is async.

Implementation should therefore avoid a broad UI refactor. Preserve the current public State API where possible and isolate async storage work behind a small adapter.

## Proposed Architecture

Add a local vault storage adapter:

```text
js/localVaultStorage.js
```

Responsibilities:

- read plaintext legacy `bb_data`
- read encrypted local vault envelopes
- write encrypted local vault envelopes
- delete local vault data
- manage envelope version metadata
- use only approved key material
- never log plaintext budget data

Preferred envelope key:

```text
bb_data
```

Keep the key name initially for compatibility and migration simplicity. The value changes from readable JSON to an encrypted envelope only after the migration is enabled.

Example encrypted envelope shape:

```json
{
  "kind": "zam_local_budget_vault",
  "version": 1,
  "algorithm": "AES-GCM",
  "createdAt": "2026-06-21T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "iv": "...",
  "ciphertext": "..."
}
```

Envelope metadata may remain plaintext. Budget contents must not.

## Key Material Direction

Use the existing trusted browser/recovery model.

Important implementation boundary:

- The local vault may follow the same trusted-browser product concept, but it must use its own local key-provider boundary.
- Do not directly reuse private Cloud Sync trusted-key internals from `js/cloudSync.js`.
- The local vault key provider stores its own non-extractable AES-GCM WebCrypto key in IndexedDB.
- The local vault key store must remain separate from the Cloud Sync trusted-key store.
- Cloud Sync recovery remains the recovery path for signed-in users when local vault access is missing or lost.
- Local-only users cannot recover the encrypted local budget if browser storage or local vault key material is lost.
- Migration must not run until a local vault key exists and an encrypt/decrypt roundtrip succeeds.

Signed-in Cloud Sync user:

- If this browser has trusted local vault key material, use it for persisted local storage.
- If trusted state is missing, ask for the Cloud Sync recovery key through the existing recovery-key import flow.
- After recovery-key import, rebuild trusted local vault state and write the local encrypted vault.
- If local encrypted data cannot unlock but Cloud Sync can recover, prefer remote encrypted vault restore over pretending support can recover local data.

Local-only user:

- Local-only encrypted budgets may use a browser-local non-extractable key stored in IndexedDB.
- If that browser key is lost, cleared, or unavailable, Zam cannot recover the local-only budget.
- The UI must keep the current browser-only warning: exports and Cloud Sync are the recovery paths.

Hard rule:

- `bb_browser_access_token_<userId>` must never decrypt the local vault.
- `bb_cloud_sync_slot_<userId>` must never decrypt the local vault.
- Supabase session tokens must never decrypt the local vault.
- Cloud Sync trusted-key storage must not be used as the local vault key store.

## Implementation Chunks

### Phase 2A: Adapter Scaffold, No Runtime Switch

Add `js/localVaultStorage.js` with test-only coverage.

Required behavior:

- encrypts/decrypts a sample payload with AES-GCM
- rejects corrupt envelopes
- never returns plaintext from encrypted envelope storage
- supports plaintext detection for migration
- has no effect on app runtime yet

Tests:

- `tests/local-vault-storage.spec.js`

### Phase 2B: Async Init Path

Convert startup to support async local budget load.

Changes:

- add `State.initStateAsync()` or make `initState()` return a promise while preserving existing call safety
- update `main.js` to `await` local state initialization
- keep render paths unchanged after initialization

Tests:

- existing storage lifecycle tests
- mobile/tablet smoke tests
- signed-out write guard

### Phase 2C: Encrypted Write Path Behind Gate

Add a temporary internal feature gate so QA can test without forcing all users through migration immediately.

Requirements:

- current plaintext `bb_data` remains readable until migration is enabled
- encrypted writes happen only when gate is enabled
- `save()` still returns a meaningful boolean to existing UI callers
- write failures do not silently corrupt memory
- Cloud Sync queue behavior stays unchanged

### Phase 2D: Migration

Migration behavior:

1. Detect plaintext `bb_data`.
2. Parse and validate the budget payload.
3. Encrypt into the approved local envelope.
4. Verify decrypt roundtrip.
5. Replace `bb_data` with encrypted envelope.
6. Do not create new plaintext backup keys.
7. Keep original plaintext only until encrypted migration is verified.

Failure behavior:

- If encryption fails, keep existing plaintext `bb_data` and show no false security claim.
- If encrypted write succeeds but verification fails, do not delete readable data.
- If encrypted data exists but cannot unlock, use the existing recovery/trusted-browser model to recover if possible.

### Phase 2E: Flip Guardrail Tests

After migration is enabled and approved, replace the current baseline test:

```text
documents current behavior: real bb_data is readable plaintext until local encryption is approved
```

with:

```text
bb_data does not expose transaction descriptions, amounts, categories, notes, gift card metadata, CSV/import data, or deleted/tombstoned records
```

## QA Matrix

Before enabling encryption broadly:

- existing local budget loads
- new local budget saves
- refresh keeps budget
- signed-out local-only budget behavior is understandable
- signed-in Cloud Sync setup still works
- trusted browser refresh still works
- new browser asks for recovery key
- wrong recovery key fails without overwriting data
- Cloud Sync restore writes a usable local encrypted copy
- factory reset removes encrypted local data
- account owner change clears encrypted local data
- demo mode stays sandboxed in `zam_demo_data`
- CSV import still stores imported transactions correctly
- CSV export still exports correct plaintext CSV after user action
- diagnostics still exclude budget contents and keys
- storage-sensitive-data tests pass after flipping plaintext expectation

## Documentation Updates Required When Encryption Ships

Update:

- `privacypolicy.html`
- `documentation/Storage-Inventory.md`
- `documentation/Cloud-Sync-v1-Production-Checklist.md`
- `documentation/Pre-Launch-Checklist.txt`
- `docs/PRIVACY_REVIEW.md`
- changelog/release notes

Copy must remain honest:

- Local encryption protects persisted browser storage at rest.
- Zam still cannot recover local-only data after browser storage/key loss.
- Data is still decrypted in memory while the app is unlocked.
- XSS and compromised-device risks remain separate security concerns.

## Stop Conditions

Stop and do not continue implementation if:

- app startup can no longer reliably load existing plaintext `bb_data`
- `save()` failures can leave memory and disk inconsistent
- Cloud Sync remote restore starts overwriting good local data unexpectedly
- recovery-key copy would need to overpromise support recovery
- local encryption needs access tokens or sync-slot tokens as decryptors
- tests require broad UI or budget-math changes to pass
