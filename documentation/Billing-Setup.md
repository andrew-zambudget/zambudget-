# Premium Billing Setup

BudgetBuddy Premium uses Stripe Checkout, Stripe Billing Portal, Supabase Auth, Supabase Edge Functions, and the `billing_profiles` table.

Supabase project ref: `cmfnmhqyeipgtjktbouk`

## Beta Safety Switch

Billing is disabled for beta unless `config.json` explicitly contains:

```json
"billingEnabled": true
```

When `"billingEnabled": false`, the app keeps Premium visible but blocks checkout and billing-portal redirects with a beta-disabled message. Flip this only after the Stripe functions, webhook, Billing Portal, and cancellation/refund paths are verified.

## Required Stripe Values

- Publishable key: stored in `config.json` for Stripe.js when billing is enabled.
- Price ID: `price_1TgrnvJYNoBMRccPPRxiOOid`.
- Product ID: `prod_UgD9jxvduxmkiM`.
- Product tax code: `txcd_10103000`.

The app sends users to Checkout with a Stripe Price ID. The Product ID is not used by the front end. Configure the tax code on the Stripe product/price in the Stripe Dashboard when using automatic tax.

## Required Supabase Secrets

Set these Edge Function secrets before deploying. If you are using the Supabase CLI, log in first:

```bash
supabase login
supabase link --project-ref cmfnmhqyeipgtjktbouk
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PREMIUM_PRICE_ID=price_1TgrnvJYNoBMRccPPRxiOOid
supabase secrets set APP_URL=https://your-production-domain.example
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally available to Supabase Edge Functions automatically. If your project does not expose them automatically, set them as secrets too.

## Deploy Steps

You can also run the helper script from PowerShell:

```powershell
.\scripts\deploy-supabase-billing.ps1 -ProjectRef cmfnmhqyeipgtjktbouk -AppUrl https://your-production-domain.example
```

1. Apply the migration in `supabase/migrations/202606100001_billing_profiles.sql` with `supabase db push --project-ref cmfnmhqyeipgtjktbouk`.
2. Deploy these Edge Functions with `supabase functions deploy <function-name> --project-ref cmfnmhqyeipgtjktbouk`:
   - `billing-create-checkout`
   - `billing-create-portal`
   - `billing-status`
   - `stripe-webhook`
3. In Stripe, create a webhook endpoint pointing to:

```text
https://cmfnmhqyeipgtjktbouk.supabase.co/functions/v1/stripe-webhook
```

4. Subscribe the webhook endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Configure the Stripe Billing Portal in the Stripe Dashboard so users can update payment methods, view invoices, and cancel.

## Account Deletion and Billing

BudgetBuddy does not silently cancel paid Stripe subscriptions during account deletion. If a user has an active, trialing, or past-due Stripe subscription, `account-delete` returns `ACTIVE_STRIPE_SUBSCRIPTION` and the app sends the user to Stripe Billing Portal first.

After Stripe reports the subscription as cancelled or inactive, account deletion may remove the inactive billing profile record along with the user's Buddy Cloud records and auth identity. Stripe may retain billing records required for payments, tax, legal, or dispute handling.

Account deletion also requires recent login verification. If the signed-in session does not contain a recent non-refresh authentication method, `account-delete` returns `REAUTH_REQUIRED` and the app asks the user to verify again before retrying.

## Runtime Flow

1. Signed-in users click Upgrade.
2. `billing-create-checkout` creates the Checkout Session server-side.
3. Stripe redirects back to `index.html?payment=success&session_id=...`.
4. The app calls `billing-status` with that session ID.
5. Premium turns on only after the server confirms an active or trialing subscription.
6. Stripe webhooks keep `billing_profiles` current after future renewals, cancellation, or status changes.
