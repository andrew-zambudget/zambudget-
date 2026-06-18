# Zam CSV Export

## Current Scope

CSV export downloads transaction data from the user's currently available app data. Export does not require Cloud Sync and does not upload transaction data to a server.

Exported CSV files are plaintext after download. Users should store them carefully.

## Export Columns

Zam exports one header row with these columns in this order:

```text
Date,Description,Amount,Category,Account,Notes
```

Column rules:

- Date uses the stored transaction date in `YYYY-MM-DD`.
- Description uses the transaction description.
- Amount uses a plain signed decimal.
- Category uses the transaction category.
- Account uses the payment method/account value.
- Notes uses the transaction notes.

## Amount Format

Expenses export as negative values.

Income/deposits export as positive values.

Examples:

```text
-42.15
2600.00
```

Zam exports should not include currency symbols, thousands separators, or accounting parentheses.

## Filters

Phase 1 export filters:

- Current Month
- Last Month
- Custom Range
- All Time
- Account
- Category

The export count shown in the modal must match the selected filters.

If no transactions match, export is disabled.

## Filename Rules

- Export filenames end in `.csv`.
- Unsafe filename characters are replaced.
- Empty filenames fall back to the default generated name.

Default pattern:

```text
zam-transactions-YYYY-MM-DD.csv
```

## Roundtrip Requirement

Every Zam export should be a valid Zam import.

The required roundtrip:

```text
Export CSV
Reset/delete local test data
Import CSV
Confirm transaction shape survives
```

Roundtrip acceptance criteria:

- Dates remain correct.
- Descriptions remain correct.
- Amounts remain correct.
- Categories remain correct.
- Accounts/payment methods remain correct.
- Notes remain correct.
- CSV escaping survives commas, quotes, and newlines.

## QA Command

```powershell
npx playwright test tests/csv-export-foundation.spec.js
```
