# Security and Recovery Backlog

Internal planning notes for account ownership, Cloud Sync recovery, budget migration, and other security-adjacent recovery work. This is not user-facing policy copy.

## High Priority

### Account Ownership and Budget Migration

Problem:

Users must be able to leave an email address without losing their budget, but Zam must not let someone steal a budget through an informal support request.

Scenarios:

- User used the wrong email and needs to change the login email on the same account.
- User needs to move a budget from one account to a totally new account.
- User needs to move away from a shared email account after divorce, separation, business split, or loss of access.

Short-term target:

- Add a same-account email change flow:
  - Settings -> Account -> Change email.
  - Enter new email.
  - Confirm new email.
  - Require current session, password, or re-authentication.
  - Keep the same internal user ID.
  - Keep the budget attached to the same account identity.
- Keep CSV export/import available as a limited fallback.
- Add clear user guidance that CSV is not a full account backup.

Medium-term target:

- Add a Full Zam Backup export/import format.
- Include transactions, categories, income setup, settings, gift cards when supported, local merchant aliases, and other app-owned budget data.
- Avoid relying on CSV for full migration because CSV does not preserve the full budget shape.

Long-term target:

- Build an account ownership transfer flow:
  - Recovery-key verified.
  - Re-encrypt data for the destination account.
  - Rotate recovery key.
  - Revoke old trusted browsers.
  - Disable old Cloud Sync sessions.
  - Update or transfer billing ownership where legally and technically allowed.
  - Keep an audit trail of transfer steps.

Divorce or shared-email safety flow:

- Add Account Safety -> Move budget to a new email/account.
- Explain that the flow helps move a budget away from an email account the user no longer controls or no longer wants to share.
- Guide the user through:
  - Export full Zam backup.
  - Create or sign into the new account.
  - Import backup.
  - Verify budget contents.
  - Rotate recovery key.
  - Revoke old trusted browsers.
  - Delete or disable old account data.

Support rule:

- Do not make support manually move budgets between accounts casually.
- Support cannot reliably prove ownership from a request like "move this budget to my email."
- Prefer user-controlled export/import, recovery-key verified restore, logged transfer flows, and strong warnings.

Security principle:

Users must be able to leave an email address without losing their budget. Zam must not allow budget takeover through social engineering or informal support handling.
