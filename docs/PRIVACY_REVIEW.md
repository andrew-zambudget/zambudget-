# Zam Privacy Review Notes

## CSV Import

Current behavior:

- CSV parsing runs in the browser.
- CSV contents are not uploaded for parsing.
- Import preview is local to the browser session.
- Import Details are stored only for transactions the user actually imports.
- Optional import feedback does not include transaction amounts, transaction descriptions, full CSV contents, account names, recovery keys, or budget exports by default.

Review result for v1.4 hardening:

No Privacy Policy change is expected if this behavior remains true.

## CSV Export

Current behavior:

- Export uses the user's currently available app data.
- Export does not upload transaction data to a server.
- Exported CSV files are plaintext after download.
- The app shows a plaintext export warning before download.

Review result for v1.4 hardening:

Privacy Policy already discloses plaintext CSV exports. No additional policy change is expected unless export behavior changes.

## Legal / Marketing Gate

Run the major-change release gate before calling v1.4 complete:

```text
documentation/Major-Change-Release-Gate.md
```

Expected outcome for v1.4:

- Legal/marketing checked: no policy change needed.
- Reason: import preview remains local, export remains local, no parser upload was added, and support feedback remains opt-in without transaction data by default.

## Red Lines

Do not add these without a new privacy review:

- Uploading CSV contents for parsing.
- Sending transaction rows to support by default.
- Adding analytics that capture row values, descriptions, amounts, account names, categories, notes, or merchant names.
- Adding cloud export destinations.
- Adding provider-side import processing.

## Required Site Data

Current behavior:

- Zam uses required first-party site data on `app.zambudget.com`.
- `zam_site_data_notice=required` is a first-party, host-only cookie set by `app.zambudget.com`.
- The cookie keeps required app site data visible in browser cookie controls and is not used for advertising, analytics, retargeting, or cross-site tracking.
- Privacy and Cookie Policy disclosures, footer/login links, and the storage-blocked guard are the disclosure surfaces.
- LocalStorage, sessionStorage, and IndexedDB remain required for browser budgets, preferences, sign-in state, Cloud Sync trusted browser unlocks, and security-related flows.
- Merchant Recognition Lite stores accepted merchant aliases locally in `bb_merchant_aliases_v1` so future CSV imports can suggest the same cleanup for the same browser/user. Merchant descriptions are not sent to a third-party recognition API.

Privacy/legal requirement:

- Do not add advertising, analytics, or tracking cookies without a new privacy/legal review.
- Do not set `Domain=.zambudget.com` for the required site-data cookie. It must remain host-only for `app.zambudget.com`.
- Do not add a fake Accept all / Reject all consent flow while Zam only uses required first-party app storage.
- If required site data is blocked, Zam should warn the user instead of pretending the app can save or load normally.
