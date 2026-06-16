# Zam! App

Private product repository for the Zam! budgeting app.

This repo contains the app shell, client-side budgeting workflows, Cloud Sync client logic, billing UI integration, tests, and deployment configuration for the app surface.

## Repository Naming

Planned GitLab project path:

```text
https://gitlab.com/andrews.agent949/zambudget-app
```

Keep the local `origin` remote on the existing project path until the GitLab project is renamed in GitLab. After the rename, update the local remote:

```powershell
git remote set-url origin https://gitlab.com/andrews.agent949/zambudget-app.git
git pull --ff-only
```

## Status

Zam! is in beta. This app repository is private product code unless a future release decision explicitly changes that posture.

The public marketing/docs repository is separate and should use the `zambudget-website` name.

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

## Deployment Naming

The app Wrangler worker name is `zambudget-app`.

The marketing/docs Wrangler worker name is `zambudget-website`.
