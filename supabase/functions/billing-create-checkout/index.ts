import Stripe from 'npm:stripe@17.7.0';
import {
  getAllowedReturnUrl,
  getSupabaseAdmin,
  handleError,
  handleOptions,
  HttpError,
  jsonResponse,
  readJson,
  requireEnv,
  requireUser
} from '../_shared/billing.ts';

function isMissingStripeCustomerError(error: unknown) {
  const err = error as {
    type?: string;
    code?: string;
    param?: string;
    message?: string;
  };
  const message = String(err?.message || '').toLowerCase();
  return err?.type === 'StripeInvalidRequestError'
    && err?.code === 'resource_missing'
    && (err?.param === 'customer' || message.includes('no such customer'));
}

async function upsertBillingCustomer(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; email?: string },
  stripeCustomerId: string
) {
  await supabaseAdmin
    .from('billing_profiles')
    .upsert({
      user_id: user.id,
      email: user.email,
      stripe_customer_id: stripeCustomerId
    }, { onConflict: 'user_id' });
}

async function createBillingCustomer(
  stripe: Stripe,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; email?: string }
) {
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    metadata: { supabase_user_id: user.id }
  });

  await upsertBillingCustomer(supabaseAdmin, user, customer.id);
  return customer.id;
}

async function ensureBillingCustomer(
  stripe: Stripe,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; email?: string },
  storedCustomerId = ''
) {
  const customerId = String(storedCustomerId || '').trim();
  if (!customerId) return createBillingCustomer(stripe, supabaseAdmin, user);

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) return customer.id;
  } catch (error) {
    if (!isMissingStripeCustomerError(error)) throw error;
  }

  return createBillingCustomer(stripe, supabaseAdmin, user);
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const supabaseAdmin = getSupabaseAdmin();
    const user = await requireUser(req, supabaseAdmin);
    const body = await readJson(req);

    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
    const priceId = requireEnv('STRIPE_PREMIUM_PRICE_ID');
    const successUrl = getAllowedReturnUrl(req, body.successUrl, '/index.html?payment=success&session_id={CHECKOUT_SESSION_ID}');
    const cancelUrl = getAllowedReturnUrl(req, body.cancelUrl, '/index.html?payment=cancelled');

    const { data: profile } = await supabaseAdmin
      .from('billing_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const customerId = await ensureBillingCustomer(stripe, supabaseAdmin, user, profile?.stripe_customer_id || '');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      automatic_tax: { enabled: false },
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      allow_promotion_codes: true
    });

    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (error) {
    return handleError(error);
  }
});
