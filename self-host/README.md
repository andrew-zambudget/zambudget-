# Zam! Self-Host Installer Prototype

This is a prototype layout for a future full self-host package. It is not a production installer yet.

The user-facing self-host experience should be a downloaded installer or release bundle, not a requirement to clone the app repo and hand-edit Docker Compose files.

Recommended user flow:

```text
Download Zam self-host installer
  -> run install script
  -> answer setup prompts
  -> installer writes .env and Docker Compose files
  -> installer starts Zam
  -> user opens their domain or local URL
```

Docker Compose still matters, but it should be an implementation detail generated or managed by the installer.

The goal is to prove the shape of the stack without disturbing the hosted Zam app:

```text
Browser
  -> Zam static app container
  -> Supabase-compatible API surface
       - Auth
       - PostgREST
       - Realtime
       - Edge Functions
       - Postgres
       - optional Storage
  -> SMTP provider for magic links
```

## What This Prototype Covers

- A prototype installer entrypoint.
- Ubuntu Server LTS system prep.
- Ansible prompts for domain, SMTP, Cloudflare, Portainer, and backups.
- Basic validation before files are written.
- A static Zam app container using Caddy as the first service.
- A template `config.json` for pointing the app at a self-hosted Supabase-compatible backend.
- A first-pass environment inventory for future generated Docker Compose or Ansible work.
- A recommended local lab flow using the existing `supabase/` migrations and functions in this repo.

## What This Prototype Does Not Cover Yet

- A production-ready Supabase replacement Compose stack.
- VPS hardening.
- Backups.
- Restore testing.
- OAuth provider setup.
- SMTP token provisioning.
- Stripe billing. Personal self-host installs should not need Stripe by default.

## Prototype Lab Flow

Installer-style entrypoint:

```bash
cd self-host
bash install/install-zam-selfhost.sh
```

The prototype installer installs required tooling on Ubuntu, runs Ansible locally, validates the user inputs, and writes deployment files under `/opt/zam`. It is not production-ready.

The first VPS command sequence should eventually look like this:

```bash
sudo apt-get update
sudo apt-get -y upgrade
curl -fsSLO https://<zam-self-host-release-url>/zam-selfhost-v1.tar.gz
tar -xzf zam-selfhost-v1.tar.gz
cd zam-selfhost-v1
bash install/install-zam-selfhost.sh
```

Manual static-app lab flow, for developers only:

From the app repo root:

```powershell
npm install
npm run build
```

Copy a self-host config into the build output:

```powershell
Copy-Item self-host/config/config.selfhost.example.json dist/config.json
```

Start the app container:

```powershell
docker compose --env-file self-host/.env.example -f self-host/docker-compose.yml up
```

That serves the static app at:

```text
http://localhost:8080
```

For the Supabase-compatible backend lab, use the existing repo-owned Supabase project files:

```powershell
npx supabase start
npx supabase db reset
```

Then update `dist/config.json` with the local Supabase API URL and anon key printed by the Supabase CLI.

## Future Release Bundle Shape

The public self-host download should look more like this:

```text
zam-selfhost-v1/
  install.sh
  install.ps1
  templates/
    docker-compose.yml
    Caddyfile
    config.json
    env.example
  scripts/
    backup.sh
    restore.sh
    upgrade.sh
    healthcheck.sh
  docs/
    README.md
    troubleshooting.md
    security.md
```

Most users should only touch:

```text
install.sh
.env
backup/restore commands
```

They should not need to understand every container unless they choose advanced mode.

## Pre-Install Worksheet

Before running the installer, users should gather:

- VPS provider and server IP address.
- Ubuntu Server LTS or Debian version.
- Domain or subdomain, such as `zam.example.com`.
- Cloudflare account access if using the recommended tunnel mode.
- Cloudflare Tunnel token if using token-based install.
- Admin email address.
- SMTP host, port, username, password/token, sender email, sender name.
- Backup choice: local, S3, or Backblaze B2.
- Backup bucket and access keys if using remote backups.
- Whether to install Portainer.
- Optional Portainer hostname.

Recommended beginner stack:

- DigitalOcean Ubuntu Server LTS droplet.
- Cloudflare DNS/Tunnel.
- Docker + Docker Compose.
- Caddy.
- Optional Portainer.

Supported OS targets:

- Ubuntu Server LTS 24.04 first.
- Ubuntu Server LTS 22.04 and 26.04.
- Debian 12 and 13.

Ubuntu Server LTS should remain the beginner guide path. Debian is supported for users who already prefer Debian servers.

## Production Direction

The production self-host package should eventually add:

- A pinned Supabase-compatible Docker Compose stack.
- Schema and RLS migration automation.
- Edge Function deploy/serve automation.
- SMTP setup checks.
- Health checks.
- Encrypted backup scripts.
- Restore scripts.
- Ansible playbooks for a clean VPS install.
- A cutover checklist.

## Licensing / Support Positioning

Self-hosting can be free for users comfortable with infrastructure.

Paid tooling can fairly cover:

- guided installer scripts
- Ansible setup
- hardened defaults
- backup and restore scripts
- upgrade helpers
- priority support

Do not promise that Zam manages or secures a user-owned server unless a managed support product exists.
