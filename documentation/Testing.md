# BudgetBuddy Testing

## Default test gate

Run the local gate before deploy-sensitive changes:

```powershell
npm ci --cache .npm --prefer-offline
npx playwright install chromium
npm test
npm run build
```

`npm test` runs the Playwright workbench. The authenticated smoke test is included, but it skips automatically until a dedicated test account is configured.

GitLab separates the always-on storage lifecycle suite from the optional authenticated smoke suite. The authenticated job appears only when both test-account variables exist.

## Authenticated smoke account

Use a disposable Supabase user created only for automated testing. Do not use a personal account or a real customer account.

The test signs in with the real Supabase browser client, loads `index.html`, verifies the signed-in app shell, checks that Cloud Sync status is readable, then signs out and clears the isolated Playwright browser context. Loading the app can create or update normal account records for that test user, including private browser access and Cloud Sync setup state. It does not add, edit, or delete budget transactions.

Required environment variables:

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

If Supabase password sign-in is disabled for the project, leave these variables unset until a disposable automated auth path exists. Magic-link and OAuth sign-in are still the right human-facing login paths, but they are not reliable CI smoke-test mechanisms.
