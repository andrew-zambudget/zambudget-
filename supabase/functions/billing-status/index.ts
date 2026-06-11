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

const activeStatuses = new Set(['active', 'trialing']);

function stripeId(value: string | Stripe.Customer | Stripe.Subscription | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
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

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const supabaseAdmin = getSupabaseAdmin();
    const user = await requireUser(req, supabaseAdmin);
    const body = await readJson(req);
    const checkoutSessionId = typeof body.checkoutSessionId === 'string' ? body.checkoutSessionId.trim() : '';

    if (checkoutSessionId) {
      const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
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
    }

    const { data: profile, error } = await supabaseAdmin
      .from('billing_profiles')
      .select('subscription_status, price_id, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

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
