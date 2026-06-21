# Zam! Self-Host Installer Entry Point

This folder is the intended public entrypoint for self-hosting.

The eventual production flow should be:

```bash
curl -fsSLO https://<zam-self-host-release-url>/zam-selfhost-v1.tar.gz
tar -xzf zam-selfhost-v1.tar.gz
cd zam-selfhost-v1
bash install.sh
```

For security-conscious users, prefer a downloadable release archive with checksum/signature verification over piping directly into a shell.

## What The Installer Should Do

- Check for Docker and Docker Compose.
- Ask for domain or local-only mode.
- Ask for admin email.
- Ask for SMTP settings for magic links.
- Generate local secrets.
- Write `/opt/zam/.env`.
- Write `/opt/zam/docker-compose.yml`.
- Write static app `config.json`.
- Start containers.
- Run migrations.
- Print the app URL and next steps.

## What The Installer Should Not Do

- Ask for recovery keys.
- Log auth tokens.
- Log magic links.
- Log budget data.
- Send telemetry.
- Require Stripe for personal self-hosting.
- Require users to clone the private app repo.
