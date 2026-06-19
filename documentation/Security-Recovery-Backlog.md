# Security and Recovery Backlog

Internal planning notes for account ownership, Cloud Sync recovery, budget migration, and other security-adjacent recovery work. This is not user-facing policy copy.

## High Priority

### Account Management: Change Email

Status: Planning hold.

Do not implement until the lead developer confirms account ownership keys, Cloud Sync behavior, billing behavior, and auth-provider email-change semantics.

Goal:

Allow a signed-in user to change the login email on the same Zam account without moving, duplicating, deleting, or reassigning budget data.

Core rule:

- The current authenticated user ID must stay the same.
- Only the email used for sign-in changes.
- Budgets, transactions, categories, merchant aliases, Cloud Sync records, recovery state, billing state, and trusted browser state remain attached to the same internal user ID.
- Do not migrate budget records from one user account to another in this flow.

Required ownership rule:

- Budget, sync, billing, and recovery ownership must not be keyed by email address.
- Allowed ownership keys: `auth_user_id`, `user_id`, or the stable UUID from the auth provider.
- Not allowed as ownership keys: email address, lowercased email, email-derived storage key, or email-based Cloud Sync path.
- Email may be displayed in the UI, stored as profile metadata, or used for communication, but it must not be the source of truth for data ownership.

Lead developer confirmation questions:

- Is all budget and Cloud Sync ownership keyed by stable `user_id`, not email?
- Does the auth provider support secure email change with confirmation for the current auth methods?
- What happens to Cloud Sync vault, browser access, sync slots, snapshots, and trusted browser keys after email change?
- Does Stripe or any billing customer email need to update separately after confirmation?
- Does recovery/trusted-browser state survive the email change without re-keying or re-import?
- Can a pending email change be canceled safely?
- Do we need re-authentication before allowing the change, and how does that differ for magic-link, password, and OAuth users?

Target entry point:

- Settings -> Account.
- Add an Account Email section inside the existing Account Management modal.
- Show current email, verification status, pending email change if present, and a Change Email action.

Required flow:

- User enters new email and confirms it.
- Validate required format, matching confirmation, not same as current email, and not already connected to another Zam account.
- Require recent authenticated session or re-authentication.
- Submit through the auth provider's change-email flow.
- Keep current email active until the new email is confirmed unless the provider securely supports a different pending state.
- Show pending state with resend/cancel actions if supported.

Security and recovery constraints:

- Do not create a new account.
- Do not create a new budget.
- Do not copy budget rows.
- Do not change `user_id`.
- Do not reset Cloud Sync.
- Do not rotate the recovery key by default.
- Do not email recovery keys, budget names, transaction data, Cloud Sync details, or billing details.
- Notify the old email when an email change is requested and after it completes, if provider/support email infrastructure supports that safely.

Billing constraints:

- Billing ownership remains tied to the same internal user/account ID.
- Do not create a new subscription.
- Do not cancel the existing subscription.
- Update billing customer email only after the new account email is confirmed.

Audit requirement:

- Record safe account events only.
- Suggested event types: `account_email_change_requested`, `account_email_change_completed`, and `account_email_change_canceled`.
- Store timestamp, user ID, masked or hashed old email, masked or hashed new email, and status.
- Do not log budget data, transactions, recovery keys, raw sync payloads, or billing secrets.

Acceptance baseline:

- Existing budget data remains visible after email change.
- Existing transactions, categories, merchant aliases, Cloud Sync state, billing state, and recovery state remain connected.
- Old email no longer works for sign-in after successful confirmation.
- New email works for sign-in after successful confirmation.
- Pending email change can be canceled safely if supported.
- Duplicate/invalid/session-too-old/provider errors show clear copy.

Out of scope:

- Moving budget data to a different existing account.
- Divorce/shared-account transfer flow.
- Support-assisted ownership transfer.
- Full Zam backup export/import.
- Recovery key rotation.
- Trusted browser revocation.
- Account deletion.
- Household/shared budgeting.
- Multi-user budget ownership.

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
