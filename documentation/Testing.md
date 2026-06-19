# Zam! Testing

## Default test gate

Run the local gate before deploy-sensitive changes:

```powershell
npm ci --cache .npm --prefer-offline
npx playwright install chromium
npm test
npm run build
```

`npm test` runs the Playwright workbench. The authenticated smoke test is included, but it skips automatically until a dedicated test account is configured.

GitLab separates the always-on storage lifecycle suite from the optional authenticated smoke suite. The authenticated job appears only when both test-account variables exist. A separate magic-link production canary can run after deploys or on a schedule when its mailbox hook is configured.

## Authenticated smoke account

Use a disposable Supabase user created only for automated testing. Do not use a personal account or a real customer account.

The test signs in with the real Supabase browser client, loads `index.html`, verifies the signed-in app shell, checks that Cloud Sync status is readable, then signs out and clears the isolated Playwright browser context. Loading the app can create or update normal account records for that test user, including private browser access and Cloud Sync setup state. It does not add, edit, or delete budget transactions.

Required environment variables. These names are legacy CI variable names; do not rename them until tests and CI are updated together.

```powershell
$env:BUDGETBUDDY_TEST_EMAIL='test-user@example.com'
$env:BUDGETBUDDY_TEST_PASSWORD='replace-with-test-password'
npm run test:e2e:auth
```

For GitLab, add these as masked CI/CD variables:

```text
BUDGETBUDDY_TEST_EMAIL
BUDGETBUDDY_TEST_PASSWORD
```

If Supabase password sign-in is disabled for the project, leave these variables unset and use the magic-link canary instead.

## Magic-link canary

Use the production canary when auth templates, Supabase redirect URLs, SMTP routing, or production deploy behavior changes:

```powershell
$env:AUTH_SMOKE_EMAIL='auth-smoke@zambudget.com'
$env:AUTH_SMOKE_MAGIC_LINK_FILE='C:\temp\zam-auth-link.txt'
npm run auth:smoke
```

For automated GitLab runs, configure `AUTH_SMOKE_LINK_COMMAND` as a masked/protected CI/CD variable so the canary can retrieve the latest magic-link email without committing mailbox credentials.

Read `documentation/Auth-Magic-Link-Monitoring.md` before enabling scheduled runs or alert webhooks.

## CSV import/export hardening

For Zam 1.4 import/export hardening, run the focused CSV gate before broader tests:

```powershell
npx playwright test tests/csv-import-review.spec.js tests/csv-export-foundation.spec.js
npm run build
```

These tests cover safe import row selection, duplicate and invalid row handling, strict date validation, imported transaction details, export filters, plaintext CSV formatting, filename cleanup, and Zam export-to-import roundtrip behavior.
