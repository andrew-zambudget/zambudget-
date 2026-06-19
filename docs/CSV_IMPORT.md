# Zam CSV Import

## Current Scope

CSV import is a local browser workflow. Zam parses the selected CSV file in the app, shows a review screen, and imports only the selected importable rows after the user confirms.

Zam does not upload CSV contents for parsing.

## Default Import Behavior

- Ready rows are selected by default.
- Duplicate rows are skipped by default.
- Needs Review rows are not selected by default, but may be selected when the row has enough valid data to import.
- Invalid rows are never imported.

Required fields:

- Date
- Amount

Strongly expected field:

- Description

If description is missing, Zam shows the row as Needs Review and uses `Imported Transaction` only if the user chooses to import that row.

## Supported Amount Formats

Zam import accepts either:

- One signed Amount column
- Debit and Credit columns
- Debit-only rows
- Credit-only rows

Debit and Credit mappings satisfy the required Amount field. A row with both debit and credit values is invalid.

## Import Review Statuses

- Ready: can import.
- Duplicate: exact duplicate detected and skipped by default.
- Needs Review: can potentially import, but Zam wants user confirmation.
- Invalid: cannot import without changing the source CSV or mapping.

Common invalid cases:

- Missing date
- Invalid date
- Missing amount
- Invalid amount
- Both debit and credit provided

## Import Details

Imported transactions keep read-only source details where available. This is used for QA and auditability after edits.

Manual transactions do not show Import Details.

Imported transactions show Import Details when `source_type === "csv_import"`.

## Smart Merchant Cleanup

Smart Merchant Cleanup is Premium cleanup assistance. When Premium is active, Zam can suggest local merchant cleanup for imported CSV rows when the bank description is noisy.

Example:

- Original CSV description: `STARBUCKS STORE #1234`
- Suggested display name: `Starbucks`

Rules:

- CSV import, manual transaction editing, and viewing original import details are not Premium-gated.
- Free users can keep raw descriptions as-is and edit descriptions manually.
- Premium users can review Smart Merchant Cleanup suggestions after import, or skip suggestions for a specific import from Advanced Options.
- Suggestions are generated locally in the browser using built-in rules, accepted local aliases, and the full static `data/merchant-cleanup-seeds.v1.json` seed bundle.
- Zam does not send merchant descriptions to a third-party recognition API.
- Zam does not auto-apply cleanup.
- The user must click Accept before the visible description changes.
- Accepting or ignoring a suggestion keeps the Smart Merchant Cleanup modal open so the user can continue reviewing the batch.
- Ignore keeps the current description and suppresses that suggestion.
- The original CSV description is preserved in `raw_description` / Import Details.
- Accepted aliases are remembered for the same browser/user only in `bb_merchant_aliases_v1`.
- One user's accepted aliases are not used for another user.

## Optional Feedback

After import, Zam shows a small Import complete notification. Feedback is optional.

If the user chooses to send feedback, the email can include safe metadata such as:

- File name
- Rows found
- Rows imported
- Duplicates skipped
- Error count
- Browser/device hints
- Timestamp
- User comment

Zam does not include transaction amounts, transaction descriptions, full CSV contents, account names, recovery keys, or budget exports by default.

## QA Command

```powershell
npx playwright test tests/csv-import-review.spec.js
```
