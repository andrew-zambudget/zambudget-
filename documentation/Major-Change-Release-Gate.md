# Major Change Release Gate

Use this gate before shipping any major change, release candidate, billing/account change, Buddy Cloud change, privacy/security change, data-retention change, or user-visible workflow change.

## Required Review

- Review the app legal pages: `privacypolicy.html` and `terms.html`.
- Review the public changelog: `changelog.html`.
- Review the marketing website copy on `budget-buddy.io` when the change affects public promises, pricing, privacy, security, Buddy Cloud, billing, account deletion, support, or launch copy.
- Update the affected files or record that no update was needed before deploy.

## Update Triggers

Update Privacy Policy copy when a change affects:

- What data BudgetBuddy stores, processes, transmits, deletes, or retains.
- Buddy Cloud encryption, recovery keys, sync metadata, browser access records, snapshots, or account data.
- Third-party services such as Supabase, Stripe, Cloudflare, analytics, monitoring, email, support tools, or payment systems.
- User privacy promises, local-only behavior, anonymous/signed-in behavior, diagnostics, logs, or support reports.

Update Terms copy when a change affects:

- Billing, subscriptions, cancellation, refunds, Premium access, or account deletion.
- User responsibilities, service limits, acceptable use, availability, data loss risks, or support boundaries.
- Legal disclaimers around cloud sync, recovery keys, payments, beta status, or open-source/free-tier promises.

Update Changelog copy when a change is:

- User-visible.
- A release candidate or production release.
- Related to billing, privacy, security, Buddy Cloud, account deletion, login, data migration, or deployment behavior.
- A bug fix users may have seen in production.

Update marketing-site copy when a change affects:

- Claims on `budget-buddy.io`.
- Launch, beta, pricing, Premium, privacy, security, or Buddy Cloud messaging.
- CTA destinations or product positioning.

## Final Verification

For major changes, the final work summary must include one of these:

- `Legal/marketing updated:` followed by the files/pages changed.
- `Legal/marketing checked: no changes needed` followed by the reason.

Do not treat a major change as complete until this gate has been checked.
