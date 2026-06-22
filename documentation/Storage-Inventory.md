# Zam Browser Storage Inventory

Status: active storage inventory.
Last reviewed: 2026-06-21.

This document records browser-side storage used by Zam today. It exists so privacy, recovery, Cloud Sync, and local encryption work starts from the actual storage surface instead of guesses.

Any new storage key added in future patches must be added to this inventory before merge.

## Current Product Rule

Real app budget contents must persist through the local vault envelope. Do not rename storage keys or introduce new storage keys without updating this inventory.

Current local-first behavior:

- Real app budgets are stored in `localStorage` under `bb_data` as an encrypted local vault envelope.
- Public demo budgets are stored in `sessionStorage` under `zam_demo_data`.
- Cloud Sync vault uploads are encrypted separately before remote upload.
- Local vault budget keys use IndexedDB non-extractable WebCrypto keys in `zam_local_vault_keys`.
- Trusted Cloud Sync browser keys use IndexedDB non-extractable WebCrypto keys.

## Sensitivity Levels

| Level | Meaning | Examples |
| --- | --- | --- |
| Critical | Budget contents or data that directly exposes financial activity | `bb_data`, `zam_demo_data`, legacy demo backup data |
| Sensitive metadata | Transaction-derived or account-flow metadata | import batches, merchant aliases, source file names |
| Auth or sync helper | Random local helper tokens or status flags | sync slot token, browser access token, recovery-key flags |
| Preference or notice | UI settings or required site-data notice state | theme, accent, warning dismissals, site-data cookie |
| Static cache | Public seed/reference data cached locally | gift card merchant metadata |

## Budget Data

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `bb_data` | localStorage | Critical | Encrypted local vault envelope for transactions, categories, settings, gift cards | Current real budget store. Envelope metadata may be visible, but budget contents should not be readable in localStorage. |
| `bb_local_operational_metadata_v1` | localStorage | Sensitive metadata | Encrypted local metadata envelope for local write timestamp, Cloud Sync verification timestamps, and sync-slot token | Per-browser operational metadata. Runtime values use `zam_local_metadata_vault` and are not uploaded through Cloud Sync. |
| `bb_local_updated_at` | localStorage | Sensitive metadata, legacy | Old last local budget write timestamp | Migrated into `bb_local_operational_metadata_v1` and removed. This key should not remain after migration. |
| `zam_demo_data` | sessionStorage | Critical, demo-only | Sample/demo budget payload | Demo edits are sandboxed and should not contain real financial data. |
| `zam_demo_local_updated_at` | sessionStorage | Sensitive metadata, demo-only | Demo local write timestamp | Cleared with demo/session reset. |
| `bb_demo_backup_bb_data` | localStorage | Critical, legacy | Pre-demo budget backup from older demo flow | Cleanup removes stranded legacy backups when demo is inactive. |
| `bb_transactions` | localStorage | Critical, legacy | Old transaction array | Migrated into `bb_data` when modern data is missing. |
| `bb_categories` | localStorage | Critical, legacy | Old category array | Migrated into `bb_data` when modern data is missing. |
| `bb_custom_categories` | localStorage | Critical, legacy | Old custom category array | Migrated into `bb_data` when modern data is missing. |

## CSV Import And Merchant Cleanup

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `bb_csv_import_batches_v1` | localStorage | Sensitive metadata | Import batch ID, source file name, counts, imported transaction IDs, undo status | Should not store full raw CSV contents or transaction descriptions. |
| `bb_csv_import_mappings_v1` | localStorage | Sensitive metadata | Header signatures and column mapping choices | Can reveal bank/export column structure. |
| `bb_merchant_aliases_v1` | localStorage | Sensitive metadata | User-approved merchant cleanup aliases | Derived from transaction descriptions. Local-only. |
| `bb_dev_import_audit_details` | localStorage | Preference / developer flag | Enables import audit details in dev contexts | Should not contain transaction data itself. |

CSV-imported transaction details are stored inside `bb_data`, including import metadata and raw merchant descriptions where applicable. That is part of the critical local budget payload.

## Gift Cards

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `settings.giftCards` inside `bb_data` | localStorage | Critical | Gift card merchant/name, balance, last four, reloadable flag, notes | Full gift card/account numbers are intentionally out of scope for MVP storage. |
| `zam_gift_card_merchant_metadata_v1` | localStorage | Static cache | Public merchant metadata seed/cache | Does not store user budget data. |
| `bb_gift_card_merchant_metadata_v1` | localStorage | Static cache, legacy | Previous merchant metadata cache | Migrated or removed in UI startup paths. |

## Cloud Sync And Recovery State

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `bb_cloud_sync_enabled` | localStorage | Auth or sync helper | Opaque Cloud Sync enabled marker | Account-scoped local state. Legacy `true` values are migrated to an opaque marker. |
| `bb_sync_history` | localStorage | Sensitive metadata | Encrypted local metadata envelope for the last five sanitized sync messages | Legacy plaintext history is sanitized and migrated at startup. Runtime writes use `zam_local_metadata_vault` and do not upload through Cloud Sync. |
| `bb_cloud_last_pushed_at` | localStorage | Sensitive metadata, legacy | Old last local push timestamp | Migrated into `bb_local_operational_metadata_v1` and removed. This key should not remain after migration. |
| `bb_cloud_last_remote_at` | localStorage | Sensitive metadata, legacy | Old last remote timestamp | Migrated into `bb_local_operational_metadata_v1` and removed. This key should not remain after migration. |
| `bb_cloud_last_error` | localStorage | Sensitive metadata | Last sync error text | Must not include secrets or budget details. |
| `bb_cloud_conflict_remote_at` | localStorage | Sensitive metadata | Conflict remote timestamp | Conflict helper state. |
| `bb_cloud_conflict_local_at` | localStorage | Sensitive metadata | Conflict local timestamp | Conflict helper state. |
| `bb_cloud_conflict_last_synced_at` | localStorage | Sensitive metadata | Last synced timestamp for conflict logic | Conflict helper state. |
| `bb_cloud_conflict_remote_summary` | localStorage | Sensitive metadata | Sanitized remote summary | Should remain privacy-safe summary only. |
| `bb_cloud_conflict_local_summary` | localStorage | Sensitive metadata | Sanitized local summary | Should remain privacy-safe summary only. |
| `bb_cloud_sync_slot_v1` | localStorage | Auth or sync helper, legacy | Old random sync-slot token | Migrated into `bb_local_operational_metadata_v1` and removed. Not a budget decryptor. This key should not remain after migration. |
| `bb_cloud_sync_slot_<userId>` | localStorage | Auth or sync helper, legacy | Old random sync-slot token pattern | Migrated into `bb_local_operational_metadata_v1` and removed. This key should not remain after migration. |
| `bb_browser_access_tokens_v1` | localStorage | Auth or sync helper | Encrypted local metadata envelope for random browser access tokens | Not a budget decryptor. Used for browser-access registry hashing. Payload is encrypted and the visible key name does not include the user ID. |
| `bb_browser_access_token_<userId>` | localStorage | Auth or sync helper, legacy | Old plaintext browser access token pattern | Legacy tokens are migrated into `bb_browser_access_tokens_v1` and removed on browser-access registry refresh. This key should not remain after migration. |
| `bb_cloud_force_pull_after_sign_in_<userId>` | localStorage | Auth or sync helper | Force-pull marker | Used after sign-in recovery paths. |
| `bb_cloud_recent_restore_<userId>` | localStorage | Auth or sync helper | Recent restore marker | Used by Cloud Sync restore flow. |
| `bb_cloud_manual_sync_at_<userId>` | localStorage | Auth or sync helper | Manual sync throttling timestamp | Used to avoid repeated manual sync actions. |
| `bb_cloud_recovery_key_saved_v1` | localStorage | Auth or sync helper | Opaque recovery-key saved marker | Status marker only. Does not store the key text. Visible key name does not include the user ID. Legacy `true` values are migrated to an opaque marker. |
| `bb_cloud_recovery_key_backed_up_v1` | localStorage | Auth or sync helper | Opaque recovery-key backup verified marker | Status marker only. Does not store the key text. Visible key name does not include the user ID. Legacy `true` values are migrated to an opaque marker. |
| `bb_cloud_recovery_key_saved_<userId>` | localStorage | Auth or sync helper, legacy | Old recovery-key saved status flag pattern | Legacy flags are migrated into `bb_cloud_recovery_key_saved_v1` and removed. This key should not remain after migration. |
| `bb_cloud_recovery_key_backed_up_<userId>` | localStorage | Auth or sync helper, legacy | Old recovery-key backup status flag pattern | Legacy flags are migrated into `bb_cloud_recovery_key_backed_up_v1` and removed. This key should not remain after migration. |
| `bb_cloud_recovery_key_grace_started_<userId>` | localStorage | Auth or sync helper | Grace-period timestamp | Status timestamp only. Does not store the key text. |
| `bb_cloud_recovery_key_unlocked_until_<userId>` | sessionStorage | Auth or sync helper | Short recovery-key view unlock timestamp | Session-only UI unlock marker. |
| `bb_cloud_default_setup_attempted_<userId>` | localStorage | Auth or sync helper | Default setup attempt marker | Setup helper flag. |
| `bb_cloud_key_<userId>` | localStorage | Critical, legacy forbidden | Old raw recovery-key storage pattern | Current cleanup removes these keys. Do not reintroduce. |
| `zam_local_vault_keys` | IndexedDB | Auth or sync helper | Non-extractable AES-GCM CryptoKey records for local vault storage | Encrypts and decrypts persisted local `bb_data` envelopes and local metadata envelopes such as `bb_sync_history` and `bb_browser_access_tokens_v1`. Local-only. Not uploaded to Zam!. |
| `budgetbuddy_buddy_cloud_keys` | IndexedDB | Auth or sync helper | Non-extractable AES-GCM CryptoKey | Lets trusted browser sync after refresh without storing raw recovery-key text in localStorage. |

## Account, Billing, And Login Helpers

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `zam_supabase_auth_session_v1` | localStorage | Auth or sync helper | Encrypted local metadata envelope for the Supabase auth session | Contains the SDK session payload only after decryption by the Supabase auth storage adapter. Not a budget decryptor. If missing or corrupt, the user must sign in again. |
| `sb-<project-ref>-auth-token` | localStorage | Auth or sync helper, legacy | Old Supabase SDK plaintext auth session key | Legacy values are migrated into `zam_supabase_auth_session_v1` and removed. This key can contain access tokens, refresh tokens, user ID, email, and OAuth metadata, so it should not remain after migration. |
| `bb_signed_in_owner_hash_v1` | localStorage | Auth or sync helper | Hash of the last signed-in user ID | Used to clear stale account-scoped budget state on account changes. Visible value does not include the raw user ID. |
| `bb_signed_in_owner_id` | localStorage | Auth or sync helper, legacy | Old raw signed-in user ID marker | Legacy values are migrated into `bb_signed_in_owner_hash_v1` and removed. This key should not remain after migration. |
| `bb_premium_active` | localStorage | Auth or sync helper | Opaque premium status marker | Convenience/status flag. Legacy `true` / `false` values are replaced on the next billing status update. |
| `bb_pro_status` | localStorage | Auth or sync helper | Opaque legacy/parallel premium status marker | Convenience/status flag. Legacy `true` / `false` values are replaced on the next billing status update. |
| `bb_stripe_checkout_session_id` | localStorage | Sensitive metadata | Stripe checkout session ID | Billing flow helper. |
| `bb_premium_activated_at` | localStorage | Sensitive metadata | Premium activation timestamp | Billing flow helper. |
| `bb_stripe_redirect_acknowledged` | localStorage | Preference | Redirect notice acknowledgement | UI helper. |
| `zam_auth_return_to` | sessionStorage | Auth helper | Return path after auth | Login page helper. |
| `zam_magic_link_cooldown_until` | sessionStorage | Auth helper | Magic-link cooldown timestamp | Login page helper. |

## Preferences, Notices, And UI State

| Key | Storage | Classification | Contents | Notes |
| --- | --- | --- | --- | --- |
| `zam_site_data_notice` | cookie | Preference or notice | `required` | First-party host-only required site-data notice cookie. |
| `bb_theme_mode` | localStorage | Preference or notice | Theme mode | Shared by app and marketing/static pages. |
| `bb_accent_color` | localStorage | Preference or notice | Saved accent palette | UI preference. |
| `bb_session_accent_color` | sessionStorage | Preference or notice | Session-random accent palette | UI preference. |
| `bb_skip_cat_warn` | localStorage | Preference or notice | Category warning dismissal | UI preference. |
| `bb_skip_income_warn` | localStorage | Preference or notice | Income warning dismissal | UI preference. |
| `bb_skip_tx_warn` | localStorage | Preference or notice | Transaction warning dismissal | UI preference. |
| `bb_income_celebration_hidden` | localStorage | Preference or notice | Income celebration collapse state | UI preference. |
| `bb_income_total_last_selection` | localStorage | Preference or notice | Last income total edit selection | UI convenience state. |
| `bb_demo_tutorial_skipped` | sessionStorage | Preference or notice | Demo tutorial skipped flag | Demo UI helper. |
| `bb_demo_banner_minimized` | sessionStorage | Preference or notice | Demo banner minimized flag | Demo UI helper. |
| `bb_demo_ended_notice` | sessionStorage | Preference or notice | Demo ended reason | Demo UI helper. |
| `bb_demo_account_prompt_dismissed` | sessionStorage | Preference or notice | Demo signup prompt dismissed flag | Demo UI helper. |
| `zam_demo_active` | sessionStorage | Demo control | Demo active marker | Routes budget writes to `zam_demo_data`. |
| `zam_demo_started_at` | sessionStorage | Demo control | Demo start timestamp | Demo lifecycle state. |
| `zam_demo_expires_at` | sessionStorage | Demo control | Demo expiration timestamp | Demo lifecycle state. |
| `bb_changelog_state` | localStorage | Preference or notice | Static changelog expanded/collapsed state | Marketing/static page preference. |

## Active Guardrails

- Signed-out users cannot write real budget data unless demo mode is active.
- Demo mode writes to `zam_demo_data` and does not overwrite `bb_data`.
- Account owner changes clear stale account-scoped local budget and sync state.
- `bb_cloud_key_*` raw recovery-key remnants are removed by privacy cleanup.
- Diagnostics are generated locally and exclude budget contents, recovery keys, local vault keys, and access tokens.
- Factory reset removes `bb_` and `zam_` namespace keys.

## Local Vault Guardrail Status

Local vault storage is enabled by default for real app budget persistence.

The implementation must preserve:

1. trusted browser behavior through non-extractable WebCrypto keys where applicable.
2. recovery-key fallback for signed-in Cloud Sync users.
3. no recovery support for local-only budgets after local storage/key loss.
4. account/session tokens separated from vault decryption material.
5. honest privacy/security copy as storage behavior changes.

Cloud/browser access tokens must not be used as local vault encryption keys. Session credentials, browser access tokens, sync-slot tokens, and vault decryption material must remain separate.

If legacy `bb_browser_access_token_<userId>` values, `bb_browser_access_tokens_v1`, `bb_local_operational_metadata_v1`, legacy `bb_cloud_sync_slot_v1`, or legacy `bb_cloud_sync_slot_<userId>` values leak, rotate or revoke them as auth/sync helper material. Do not treat them as vault decryption material.

Local storage encryption protects persisted browser storage at rest. It does not fully protect data while the app is unlocked and decrypted in memory, and it does not eliminate XSS risk.
