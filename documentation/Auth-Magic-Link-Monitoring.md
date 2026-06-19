# Auth Magic-Link Monitoring

Last updated: 2026-06-18

## Purpose

Use this monitor to catch Zam auth regressions quickly after deploys and during scheduled production checks.

The canary requests a real magic link for the dedicated test account, retrieves the link through an external mailbox hook, opens the link, verifies the dashboard session, checks for auth/recovery/Cloud Sync errors, writes safe JSONL events, and exits nonzero on failure.

## Test Account

```text
auth-smoke@zambudget.com
```

Use this account only for automated auth monitoring. Do not use a personal account or a real user account.

## Command

```powershell
npm run auth:smoke
```

By default, the canary targets:

```text
https://app.zambudget.com
auth-smoke@zambudget.com
```

## Required Mailbox Hook

The repo does not contain mailbox credentials. Configure one of these locally or in GitLab CI/CD variables:

```text
AUTH_SMOKE_LINK_COMMAND
AUTH_SMOKE_MAGIC_LINK_FILE
```

Preferred CI mode:

```text
AUTH_SMOKE_LINK_COMMAND
```

The command should print the newest magic-link email body or the magic-link URL for `AUTH_SMOKE_TEST_EMAIL`. The canary passes these environment variables to the command:

```text
AUTH_SMOKE_TEST_EMAIL
AUTH_SMOKE_REQUESTED_AT
```

The command should filter to messages received after `AUTH_SMOKE_REQUESTED_AT` when the email provider supports it.

Manual/local fallback:

```powershell
$env:AUTH_SMOKE_MAGIC_LINK_FILE='C:\temp\zam-auth-link.txt'
npm run auth:smoke
```

Paste the received magic link into that file while the script waits. Do not commit the file.

## Optional Variables

```text
AUTH_SMOKE_APP_URL=https://app.zambudget.com
AUTH_SMOKE_EMAIL=auth-smoke@zambudget.com
AUTH_SMOKE_TIMEOUT_MS=120000
AUTH_SMOKE_POLL_INTERVAL_MS=10000
AUTH_SMOKE_LOG_FILE=test-results/auth-magic-link-canary.jsonl
AUTH_SMOKE_ALERT_WEBHOOK_URL=<secret webhook URL>
RUN_AUTH_MAGIC_LINK_CANARY=1
```

`AUTH_SMOKE_ALERT_WEBHOOK_URL` may point to a private alert endpoint, Slack-compatible webhook, Discord-compatible webhook, or another internal notifier. Treat it as a secret.

## Safe Events

The canary writes these safe event names:

- `auth_canary_started`
- `magic_link_requested`
- `magic_link_email_sent`
- `magic_link_callback_started`
- `magic_link_callback_success`
- `magic_link_callback_failed`
- `session_created`
- `logout_success`
- `auth_canary_completed`
- `auth_canary_failed`

Failure events include sanitized reasons and counts only.

## Never Log

Do not log:

- full magic links
- auth tokens
- refresh tokens
- recovery keys
- budget data
- transaction data
- raw session payloads
- mailbox credentials
- alert webhook URLs

The script redacts keys that look like links, URLs, tokens, secrets, sessions, payloads, or recovery-key material before writing JSONL logs.

## GitLab Behavior

`.gitlab-ci.yml` includes `auth_magic_link_canary` in the `monitor` stage.

The job runs only when one of these conditions is true:

- `AUTH_SMOKE_LINK_COMMAND` exists on the default branch pipeline.
- `AUTH_SMOKE_LINK_COMMAND` exists on a scheduled pipeline.
- `RUN_AUTH_MAGIC_LINK_CANARY=1` is explicitly set.

This prevents normal local tests and ordinary unconfigured pipelines from sending real auth emails.

Failed canaries are visible as failed GitLab jobs. If `AUTH_SMOKE_ALERT_WEBHOOK_URL` is configured, failures also send a sanitized alert.

## What It Proves

The canary verifies:

- sign-in page loads
- test email can request a magic link
- mailbox hook can retrieve the link
- magic-link callback starts
- Supabase creates a browser session
- `index.html` dashboard loads
- `window.currentUser` matches the test account
- Cloud Sync status is readable
- no auth/recovery/Cloud Sync critical console errors were observed
- browser signs out and clears local/session storage after the run

## What It Does Not Prove

This monitor does not test:

- account email change
- budget migration
- recovery key rotation
- OAuth providers
- premium features
- billing checkout
- user-owned mailbox deliverability

## Setup Checklist

1. Confirm `auth-smoke@zambudget.com` exists in Supabase Auth.
2. Confirm the account can receive Zam magic-link emails.
3. Confirm Supabase Auth Site URL is `https://app.zambudget.com`.
4. Confirm redirect URLs include `https://app.zambudget.com/index.html`.
5. Add `AUTH_SMOKE_LINK_COMMAND` as a masked/protected GitLab CI/CD variable.
6. Add `AUTH_SMOKE_ALERT_WEBHOOK_URL` if alerting should leave GitLab.
7. Run a manual pipeline with `RUN_AUTH_MAGIC_LINK_CANARY=1`.
8. Confirm `test-results/auth-magic-link-canary.jsonl` appears as an artifact.
9. Confirm no magic links, tokens, recovery keys, budget data, or transactions are present in logs.
10. Add a GitLab scheduled pipeline after the manual run is clean.
