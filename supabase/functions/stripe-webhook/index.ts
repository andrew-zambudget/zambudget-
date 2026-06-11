import Stripe from 'npm:stripe@17.7.0';
import {
  getSupabaseAdmin,
  handleError,
  handleOptions,
  HttpError,
  jsonResponse,
  requireEnv
} from '../_shared/billing.ts';

function stripeId(value: string | Stripe.Customer | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
}

function periodEnd(subscription: Stripe.Subscription) {
  return subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
}

async function findUserIdForCustomer(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, customerId: string) {
  const { data } = await supabaseAdmin
    .from('billing_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return data?.user_id || '';
}

async function upsertSubscription(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, subscription: Stripe.Subscription) {
  const customerId = stripeId(subscription.customer);
  const userId = subscription.metadata?.user_id || await findUserIdForCustomer(supabaseAdmin, customerId);
  if (!userId) throw new HttpError(400, 'No Supabase user was linked to this Stripe subscription.');

  await supabaseAdmin
    .from('billing_profiles')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      price_id: subscription.items.data[0]?.price?.id || null,
      current_period_end: periodEnd(subscription),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
    }, { onConflict: 'user_id' });
}

async function handleCheckoutCompleted(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.user_id || '';
  if (!userId) throw new HttpError(400, 'Checkout session is missing user metadata.');

  await supabaseAdmin
    .from('billing_profiles')
    .upsert({
      user_id: userId,
      stripe_customer_id: stripeId(session.customer as string | Stripe.Customer | null),
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null
    }, { onConflict: 'user_id' });

  if (session.subscription) {
    const subscription = typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

    await upsertSubscription(supabaseAdmin, subscription as Stripe.Subscription);
  }
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new HttpError(400, 'Missing Stripe signature.');

    const payload = await req.text();
    const event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    const supabaseAdmin = getSupabaseAdmin();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabaseAdmin, stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscription(supabaseAdmin, event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    return handleError(error);
  }
});
