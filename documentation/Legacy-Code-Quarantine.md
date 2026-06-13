# Legacy Code Quarantine

Date tagged: 2026-06-13

This file tracks code that looks removable but is intentionally kept during beta to protect availability. Do not delete these paths until the test gate passes and a manual beta smoke window confirms the fallback warnings stay silent.

## Active quarantine tag

`LEGACY_STORAGE_QUARANTINE_2026_06`

The app now routes legacy `bb_transactions`, `bb_categories`, and `bb_custom_categories` fallback reads/writes through quarantine wrappers in `js/ui.js`. If a fallback path is still reachable, the browser console logs a one-time non-sensitive warning naming the code path. The warning does not include budget data.

## Tagged candidates

- Old Recent tab filters: `legacyFilterRecentTransactionsV1`, `legacyFilterTransactionsV1`, `legacyFilterRecentTransactionsV2`, `legacyFilterTransactionsV2`
- Old Recent tab renderers: `legacyRenderRecentTransactionsV2`, `legacyRenderRecentTransactionsV3`, `legacyRenderRecentTransactionsV4`
- First `window.openUpgradeModal` definition, which is overwritten immediately by the refined Premium modal
- State API fallback reads/writes for legacy localStorage arrays in transaction delete, transaction save, bulk delete, bulk move, savings render, and savings card generation

## Not deletion candidates yet

- `privacyStorageCleanup.js` legacy migration/cleanup paths. These protect beta users who still have pre-`bb_data` browser storage.
- Diagnostic presence checks for old storage keys. They report whether legacy stores exist without reading budget content into the report.
- Browser-access legacy database select fallback. It protects old deployments while the Supabase schema settles.

## Deletion criteria

Before deletion:

1. `npm test` passes.
2. `npm run build` passes.
3. Manual signed-in smoke passes with a real beta account.
4. Demo start/exit smoke passes.
5. No `LEGACY_STORAGE_QUARANTINE_2026_06` console warnings are observed during normal app flows.
6. One verified beta window completes without reports tied to old inline handlers or legacy storage fallback behavior.

After deletion, run the same gate again before deploy.
