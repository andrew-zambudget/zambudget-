import Stripe from 'npm:stripe@17.7.0';
import {
  getSupabaseAdmin,
  handleError,
  handleOptions,
  HttpError,
  jsonResponse,
  readJson,
  requireEnv,
  requireUser
} from '../_shared/billing.ts';

const activeStatuses = new Set(['active']);

type BillingProfile = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  price_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

type BillingUser = {
  id: string;
  email?: string;
};

function stripeId(value: string | Stripe.Customer | Stripe.Subscription | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
}

function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

function isMissingStripeResourceError(error: unknown) {
  const err = error as {
    type?: string;
    code?: string;
    message?: string;
  };
  return err?.type === 'StripeInvalidRequestError'
    && err?.code === 'resource_missing'
    && String(err?.message || '').toLowerCase().includes('no such');
}

function periodEnd(subscription: Stripe.Subscription) {
  return subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
}

async function upsertSubscription(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, userId: string, email: string | undefined, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id || null;

  await supabaseAdmin
    .from('billing_profiles')
    .upsert({
      user_id: userId,
      email,
      stripe_customer_id: stripeId(subscription.customer),
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      price_id: priceId,
      current_period_end: periodEnd(subscription),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
    }, { onConflict: 'user_id' });
}

async function readBillingProfile(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('billing_profiles')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status, price_id, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return profile as BillingProfile | null;
}

function chooseLatestSubscription(subscriptions: Stripe.Subscription[]) {
  return subscriptions.reduce<Stripe.Subscription | null>((latest, subscription) => {
    if (!latest) return subscription;
    const latestTime = latest.current_period_end || latest.created || 0;
    const subscriptionTime = subscription.current_period_end || subscription.created || 0;
    return subscriptionTime > latestTime ? subscription : latest;
  }, null);
}

async function findLatestCustomerSubscription(stripe: Stripe, customerId = '') {
  if (!customerId) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10
  });

  const active = subscriptions.data.find(subscription => subscription.status === 'active');
  return active || chooseLatestSubscription(subscriptions.data);
}

function stripeObjectUserId(value: Stripe.Customer | Stripe.Subscription) {
  return value.metadata?.user_id || value.metadata?.supabase_user_id || '';
}

function belongsToUser(subscription: Stripe.Subscription, customer: Stripe.Customer, user: BillingUser) {
  const subscriptionUserId = stripeObjectUserId(subscription);
  const customerUserId = stripeObjectUserId(customer);

  if (subscriptionUserId) return subscriptionUserId === user.id;
  if (customerUserId) return customerUserId === user.id;

  return normalizeEmail(customer.email || '') === normalizeEmail(user.email || '');
}

async function findActiveSubscriptionByUserEmail(stripe: Stripe, user: BillingUser) {
  const email = normalizeEmail(user.email || '');
  if (!email) return null;

  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    if (normalizeEmail(customer.email || '') !== email) continue;

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 10
    });

    const subscription = subscriptions.data.find(candidate => belongsToUser(candidate, customer, user));
    if (subscription) return subscription;
  }

  return null;
}

async function syncStoredBillingProfile(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  user: BillingUser,
  profile: BillingProfile | null
) {
  let subscription: Stripe.Subscription | null = null;
  if (profile?.stripe_subscription_id) {
    try {
      subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    } catch (error) {
      if (!isMissingStripeResourceError(error)) throw error;
    }
  }

  if (!subscription && profile?.stripe_customer_id) {
    subscription = await findLatestCustomerSubscription(stripe, profile.stripe_customer_id);
  }

  if (!subscription) {
    subscription = await findActiveSubscriptionByUserEmail(stripe, user);
  }

  if (!subscription) return false;
  await upsertSubscription(supabaseAdmin, user.id, user.email, subscription);
  return true;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const supabaseAdmin = getSupabaseAdmin();
    const user = await requireUser(req, supabaseAdmin);
    const body = await readJson(req);
    const checkoutSessionId = typeof body.checkoutSessionId === 'string' ? body.checkoutSessionId.trim() : '';
    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));

    if (checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ['subscription']
      });

      const sessionUserId = session.client_reference_id || session.metadata?.user_id || '';
      if (sessionUserId !== user.id) throw new HttpError(403, 'Checkout session does not belong to this account.');

      const subscription = typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

      if (subscription) {
        await upsertSubscription(supabaseAdmin, user.id, user.email, subscription as Stripe.Subscription);
      }
    } else {
      const storedProfile = await readBillingProfile(supabaseAdmin, user.id);
      await syncStoredBillingProfile(supabaseAdmin, stripe, user, storedProfile);
    }

    const profile = await readBillingProfile(supabaseAdmin, user.id);

    const subscriptionStatus = profile?.subscription_status || 'inactive';

    return jsonResponse({
      active: activeStatuses.has(subscriptionStatus),
      subscriptionStatus,
      priceId: profile?.price_id || null,
      currentPeriodEnd: profile?.current_period_end || null,
      cancelAtPeriodEnd: Boolean(profile?.cancel_at_period_end),
      checkoutSessionId: checkoutSessionId || null
    });
  } catch (error) {
    return handleError(error);
  }
});
