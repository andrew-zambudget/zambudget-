# Zam! Full Self-Host Prototype

## Purpose

This is the first-pass design for letting someone run Zam on their own hardware without using the hosted Zam infrastructure.

The hosted product remains separate. This prototype is about a self-host path.

## Product Direction

The self-host product should be installer-first.

Users should download a script or release bundle and run it. They should not be expected to clone the app repo, understand the internal folder layout, or hand-edit Docker Compose as the normal path.

Preferred user-facing flow:

```text
Download Zam self-host bundle
Run installer
Answer setup prompts
Installer writes config and Compose files
Installer starts Zam
User opens Zam
```

Docker Compose remains the underlying deployment format, but it should be generated and managed by the installer.

## Recommended Beginner Stack

The guided installer should be opinionated so support remains possible:

- VPS: DigitalOcean first.
- Also reasonable: Linode / Akamai Cloud, OVHcloud, Contabo.
- OS: Ubuntu Server LTS first, Debian also supported.
- DNS / edge: Cloudflare recommended.
- Reverse proxy: Caddy.
- Container management: Docker Compose.
- Optional Docker GUI: Portainer.
- Email: user-provided SMTP.
- Backups: local plus S3-compatible or Backblaze B2 later.

Cloudflare should be recommended because it makes DNS, TLS, and tunnel-based self-hosting easier for beginners.

## User Prompt Inventory

The installer should gather:

- access mode: `cloudflare_tunnel`, `direct_caddy`, or `local_only`
- Zam hostname
- admin email
- timezone
- internal app port
- whether to install Portainer
- optional Portainer hostname
- Cloudflare Tunnel token, if tunnel mode
- SMTP host
- SMTP port
- SMTP username
- SMTP password/token
- SMTP sender email
- SMTP sender name
- backup mode: `none`, `local`, `s3`, or `b2`
- backup path
- backup bucket and credentials when using remote backups

The installer should generate secrets automatically. Users should not hand-write Postgres passwords, JWT secrets, anon keys, or service-role keys.

## Supported Linux Targets

Official beginner path:

- Ubuntu Server 24.04 LTS

Supported targets:

- Ubuntu Server 22.04 LTS
- Ubuntu Server 24.04 LTS
- Ubuntu Server 26.04 LTS
- Debian 12
- Debian 13

Ubuntu should remain the screenshot/documentation path because it is easiest for beginners on DigitalOcean and similar VPS providers. Debian support should be kept clean and practical for self-host users who already prefer Debian.

## Recommended First Target

Build a Supabase-compatible self-host package before attempting a custom backend rewrite.

Reason:

- Zam already uses the Supabase client SDK.
- Existing migrations define the important database/RLS shape.
- Existing Edge Functions define billing/account server behavior.
- Cloud Sync is already designed as encrypted client-side data stored in backend rows.

## Required Moving Parts

### Installer

The public entrypoint should eventually:

- check Docker availability
- create an install directory
- generate local secrets
- ask for domain/local URL
- ask for SMTP settings
- write `.env`
- write `docker-compose.yml`
- write app `config.json`
- start containers
- run migrations
- print the final URL and backup instructions

The prototype installer lives at:

```text
self-host/install/install-zam-selfhost.sh
```

### Static App

Serves the built Zam app files from `dist/`.

Current prototype:

```text
self-host/docker-compose.yml
self-host/caddy/Caddyfile
self-host/config/config.selfhost.example.json
```

### Supabase-Compatible Backend

Needs these API surfaces:

- Auth for magic link sign-in.
- PostgREST for database access.
- Realtime for Cloud Sync/device refresh behavior.
- Edge Functions for account/billing-style server actions.
- Postgres with Zam migrations and RLS policies.
- Storage only if future Zam features require it.

### SMTP

Required for magic links.

Self-host users must bring their own SMTP provider/token.

### Billing

Stripe is not required for personal self-hosting.

Default self-host mode should disable billing:

```json
{
  "billingEnabled": false,
  "billingMode": "self-host-disabled"
}
```

Stripe only becomes relevant if a third party is operating Zam as a hosted commercial service.

## Current Zam Backend Inventory

### Migrations

Located in:

```text
supabase/migrations/
```

Important areas:

- `billing_profiles`
- `buddy_cloud_vaults`
- `buddy_cloud_vault_snapshots`
- `buddy_cloud_sync_slots`
- `buddy_cloud_browser_access`
- profile/account deletion hardening
- RLS policy hardening

### Edge Functions

Located in:

```text
supabase/functions/
```

Current functions:

- `account-delete`
- `billing-create-checkout`
- `billing-create-portal`
- `billing-status`
- `stripe-webhook`

Self-host v1 can disable or stub billing functions if billing remains off.

`account-delete` still matters because self-host users need a clean account/data deletion path.

### Frontend Runtime Config

The app reads:

```text
config.json
```

Self-host installs should generate this file from environment values instead of editing app source code.

## Lab Acceptance Criteria

A prototype self-host lab is useful when it can prove:

- Static app serves locally.
- `config.json` points at local/self-host backend.
- Magic link request can be sent through configured SMTP.
- Auth callback creates a session.
- Cloud Sync vault can be created.
- Encrypted vault can be saved and loaded.
- Recovery key behavior remains unchanged.
- Browser/device rows refresh if Realtime is enabled.
- Account deletion removes self-hosted rows.
- Backups can be created and restored.

## Production Acceptance Criteria

Before calling self-host production-ready:

- Secrets are generated, not checked in.
- Compose images are pinned.
- HTTPS is documented.
- SMTP setup is validated.
- OAuth setup is optional and documented.
- Migrations are idempotent or clearly sequenced.
- Backups are encrypted before leaving the server.
- Restore has been tested on a clean machine.
- Upgrade procedure is documented.
- Logs do not include recovery keys, budget data, transaction data, auth tokens, or full magic links.

## Suggested Next Step

Keep this as a prototype branch until we decide whether to:

1. build a full pinned Docker Compose stack generated by the installer, or
2. use the Supabase CLI stack for local labs and ship Ansible around a known deployment recipe.
