# Zam! App

Private product repository for the Zam! budgeting app.

This repo contains the app shell, client-side budgeting workflows, Cloud Sync client logic, billing UI integration, tests, and deployment configuration for the app surface.

## Repository Naming

Intended GitLab project path after the rename is reachable:

```text
https://gitlab.com/andrews.agent949/zambudget-app
```

Keep the local `origin` remote on the existing project path until the renamed GitLab project URL is reachable from this machine. After verifying access, update the local remote:

```powershell
git remote set-url origin https://gitlab.com/andrews.agent949/zambudget-app.git
git pull --ff-only
```

## Status

Zam! is in beta. This app repository is private product code unless a future release decision explicitly changes that posture.

The public marketing/docs repository is separate and should use the `zambudget-website` name.

## Current Release Plan

- Zam 1.2 RC (current): CSV transaction import foundation (mapping, duplicate detection, invalid row reporting, previews, summaries).
- Zam 1.3: Google Drive import.
- Zam 1.4: Dropbox import.
- Zam 1.5: Import reconciliation.
- Zam 1.6: Statement balancing.

## Local Checks

Build the Cloudflare static output:

```powershell
npm run build
```

Run the full Playwright suite:

```powershell
npm test
```

Run the higher-risk safety suite:

```powershell
npm run test:e2e:safety
```

## Start Here

New maintainers and new Codex chats should begin with `START_HERE.md`, then read:

- `documentation/App-Rebuild-Runbook.md`
- `documentation/Infrastructure-Inventory.md`
- `documentation/Auth-Magic-Link-Monitoring.md`
- `documentation/Cloud-Sync-v1-Production-Checklist.md`
- `documentation/Major-Change-Release-Gate.md`
- `documentation/Testing.md`

## Deployment Naming

The app Wrangler worker name is `zambudget-app`.

The marketing/docs Wrangler worker name is `zambudget-website`.
