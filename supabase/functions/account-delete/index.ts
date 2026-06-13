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
const ACTIVE_SUBSCRIPTION_CODE = 'ACTIVE_STRIPE_SUBSCRIPTION';
const NOT_APPLICABLE = 'not_applicable';

function isMissingOptionalTableError(error: unknown) {
  const typed = error as { code?: string; message?: string };
  const message = String(typed?.message || '');
  return typed?.code === '42P01'
    || message.includes('buddy_cloud_vault_snapshots')
    || message.toLowerCase().includes('schema cache');
}

async function deleteRowsForUser(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string,
  options: { optional?: boolean } = {}
) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq('user_id', userId);

  if (error) {
    if (options.optional && isMissingOptionalTableError(error)) return NOT_APPLICABLE;
    throw error;
  }

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
    const deleteAuthUser = body?.deleteAuthUser === true;

    if (deleteAuthUser) {
      const { data: billingProfile, error: billingReadError } = await supabaseAdmin
        .from('billing_profiles')
        .select('subscription_status, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (billingReadError && !isMissingOptionalTableError(billingReadError)) {
        throw billingReadError;
      }

      if (
        billingProfile?.stripe_subscription_id &&
        BLOCKED_BILLING_STATUSES.has(billingProfile.subscription_status || '')
      ) {
        throw new HttpError(
          409,
          'Cancel your active Stripe subscription before deleting your BudgetBuddy account.',
          ACTIVE_SUBSCRIPTION_CODE
        );
      }
    }

    const buddyCloudVaultsDeleted = await deleteRowsForUser(supabaseAdmin, 'buddy_cloud_vaults', user.id);
    const buddyCloudSnapshotsDeleted = await deleteRowsForUser(supabaseAdmin, 'buddy_cloud_vault_snapshots', user.id, { optional: true });

    if (!deleteAuthUser) {
      return jsonResponse({
        reset: true,
        authUserDeleted: false,
        buddyCloudVaultsDeleted,
        buddyCloudSnapshotsDeleted
      });
    }

    const browserAccessDeleted = await deleteRowsForUser(supabaseAdmin, 'buddy_cloud_browser_access', user.id, { optional: true });
    const billingProfileDeleted = await deleteRowsForUser(supabaseAdmin, 'billing_profiles', user.id, { optional: true });

    // Household/family sharing is not implemented in the current schema.
    // Return an explicit marker so account deletion reports stay truthful.
    const householdMembershipsDeleted = NOT_APPLICABLE;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, false);
    if (error) throw error;

    return jsonResponse({
      deleted: true,
      authUserDeleted: true,
      buddyCloudVaultsDeleted,
      buddyCloudSnapshotsDeleted,
      browserAccessDeleted,
      billingProfileDeleted,
      householdMembershipsDeleted,
      activeSessionsRevokedByAuthDeletion: true
    });
  } catch (error) {
    return handleError(error);
  }
});
