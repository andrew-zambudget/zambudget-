# Start Here

This is the private Zam! app repository.

Use this file as the first stop for a new maintainer, a new Codex chat, or recovery work. This repo contains private product code. Do not make it public unless that product decision is explicitly changed later.

## Current Surfaces

- App: `https://app.zambudget.com`
- Marketing/public docs: `https://zambudget.com`
- App Worker: `zambudget-app`
- Website Worker: `zambudget-website`
- Supabase project ref: `cmfnmhqyeipgtjktbouk`
- GitLab app repo path: use the current private `origin` until the renamed `zambudget-app` path is reachable

## First Commands

Run these before editing:

```powershell
git status --short --branch
git pull --ff-only
npm install
```

For app-sensitive changes, run:

```powershell
npm run build
npm run test:e2e:safety
```

For broad app changes, run:

```powershell
npm test
```

## Repo Map

- `index.html`: main app shell
- `login.html`: sign-in surface
- `js/`: app behavior, Cloud Sync, state, UI, billing UI, local storage
- `css/`: app styling
- `data/`: static app data bundles
- `supabase/migrations/`: database migrations
- `supabase/functions/`: Edge Functions
- `documentation/`: private app runbooks and checklists
- `tests/`: Playwright tests
- `scripts/build-cloudflare.js`: builds static app assets into `dist/`

## Docs To Read Next

- `README.md`
- `documentation/App-Rebuild-Runbook.md`
- `documentation/Infrastructure-Inventory.md`
- `documentation/Cloud-Sync-v1-Production-Checklist.md`
- `documentation/Billing-Setup.md`
- `documentation/Major-Change-Release-Gate.md`
- `documentation/Testing.md`

## Current Security Notes

- Budget data is stored locally in browser storage and can sync through encrypted Cloud Sync.
- Cloud Sync vault contents are encrypted client-side before upload.
- Raw Cloud Sync recovery-key text is memory-only after import/generation.
- Trusted browsers may persist a non-extractable AES-GCM WebCrypto key in IndexedDB so refreshes can keep working.
- Zam! cannot decrypt a synced budget without the user's recovery key or trusted local browser key.
- Browser-only budgets have no recovery support after local browser storage is lost.

## Secret Rules

Do not commit:

- Supabase service-role keys
- database passwords
- Stripe secret keys
- Stripe webhook secrets
- Cloudflare API tokens
- OAuth client secrets
- real user data
- support exports
- recovery keys

Environment variable names are okay to document. Secret values belong in GitLab CI/CD variables, provider dashboards, or a password manager.

## Change Gate

Before major changes, review `documentation/Major-Change-Release-Gate.md`.

If the change affects storage, Cloud Sync, billing, account deletion, login, provider behavior, tracking/telemetry, or public promises, also check the marketing repo legal/docs/changelog pages.

## Handoff Prompt

Use this when starting a fresh chat:

```text
We are working in the private Zam! app repo. App domain is https://app.zambudget.com. Marketing/public docs are in the zambudget-website repo at https://zambudget.com. Start by reading START_HERE.md, README.md, documentation/App-Rebuild-Runbook.md, documentation/Infrastructure-Inventory.md, documentation/Cloud-Sync-v1-Production-Checklist.md, and documentation/Major-Change-Release-Gate.md. Check git status first. Do not commit secrets. For app changes, run npm run build and the relevant Playwright tests, then commit, push, and pull.
```
