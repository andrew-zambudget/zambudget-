import {
  getSupabaseAdmin,
  handleError,
  handleOptions,
  HttpError,
  jsonResponse,
  readJson,
  requireUser
} from '../_shared/billing.ts';

const BLOCKED_BILLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

function isMissingOptionalTableError(error: unknown) {
  const typed = error as { code?: string; message?: string };
  const message = String(typed?.message || '');
  return typed?.code === '42P01'
    || message.includes('buddy_cloud_vault_snapshots')
    || message.toLowerCase().includes('schema cache');
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const supabaseAdmin = getSupabaseAdmin();
    const user = await requireUser(req, supabaseAdmin);
    const body = await readJson(req);
    const deleteAuthUser = body?.deleteAuthUser === true;

    if (deleteAuthUser) {
      const { data: billingProfile, error: billingReadError } = await supabaseAdmin
        .from('billing_profiles')
        .select('subscription_status, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (billingReadError) throw billingReadError;

      if (
        billingProfile?.stripe_subscription_id &&
        BLOCKED_BILLING_STATUSES.has(billingProfile.subscription_status || '')
      ) {
        throw new HttpError(
          409,
          'Cancel your active Stripe subscription before deleting your BudgetBuddy account.'
        );
      }
    }

    const { error: vaultDeleteError } = await supabaseAdmin
      .from('buddy_cloud_vaults')
      .delete()
      .eq('user_id', user.id);
    if (vaultDeleteError) throw vaultDeleteError;

    const { error: snapshotDeleteError } = await supabaseAdmin
      .from('buddy_cloud_vault_snapshots')
      .delete()
      .eq('user_id', user.id);
    if (snapshotDeleteError && !isMissingOptionalTableError(snapshotDeleteError)) {
      throw snapshotDeleteError;
    }

    if (!deleteAuthUser) {
      return jsonResponse({ reset: true, authUserDeleted: false });
    }

    const { error: billingDeleteError } = await supabaseAdmin
      .from('billing_profiles')
      .delete()
      .eq('user_id', user.id);
    if (billingDeleteError) throw billingDeleteError;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, true);
    if (error) throw error;

    return jsonResponse({ deleted: true, authUserSoftDeleted: true });
  } catch (error) {
    return handleError(error);
  }
});
