# Zam Release Process

## Purpose

Use this checklist before calling a release candidate complete.

For major changes, also run:

```text
documentation/Major-Change-Release-Gate.md
```

## Local Verification

Run the focused tests for the release area first.

For CSV import/export hardening:

```powershell
npx playwright test tests/csv-import-review.spec.js tests/csv-export-foundation.spec.js
npm run build
```

Run broader tests when the release touches shared startup, state, storage, auth, Cloud Sync, billing, or account flows.

## Import/Export Release Checklist

- Import QA complete.
- Export QA complete.
- Export to import roundtrip complete.
- Privacy/legal review completed.
- Changelog updated if the change is user-visible.
- Known design debt logged if not fixed.
- No blocker bugs remain.
- Scope stayed inside import/export hardening.

## Commit Flow

After verification:

```powershell
git status --short --branch
git add <changed-files>
git commit -m "<short release-focused message>"
git push
git pull
git status --short --branch
```

Do not commit secrets, local credentials, downloaded private exports, or real user CSV files.
