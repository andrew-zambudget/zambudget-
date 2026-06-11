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

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const supabaseAdmin = getSupabaseAdmin();
    const user = await requireUser(req, supabaseAdmin);
    const body = await readJson(req);

    const { data: profile } = await supabaseAdmin
      .from('billing_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      throw new HttpError(404, 'No Stripe customer was found for this account.');
    }

    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
    const returnUrl = getAllowedReturnUrl(req, body.returnUrl, '/index.html');
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl
    });

    return jsonResponse({ url: portalSession.url });
  } catch (error) {
    return handleError(error);
  }
});
