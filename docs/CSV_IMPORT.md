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
