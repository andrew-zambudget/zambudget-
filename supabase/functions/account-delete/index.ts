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
const REAUTH_REQUIRED_CODE = 'REAUTH_REQUIRED';
const NOT_APPLICABLE = 'not_applicable';
const RECENT_AUTH_WINDOW_SECONDS = 10 * 60;
const DESTRUCTIVE_AUTH_METHODS = new Set([
  'password',
  'otp',
  'magiclink',
  'oauth',
  'sso/saml',
  'totp',
  'recovery'
]);

function isMissingOptionalTableError(error: unknown, table = '') {
  const typed = error as { code?: string; message?: string };
  const message = String(typed?.message || '');
  return typed?.code === '42P01'
    || (table && message.includes(table))
    || message.toLowerCase().includes('schema cache');
}

async function deleteRowsForUser(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string,
  options: { optional?: boolean; column?: string } = {}
) {
  const column = options.column || 'user_id';
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(column, userId);

  if (error) {
    if (options.optional && isMissingOptionalTableError(error, table)) return NOT_APPLICABLE;
    throw error;
  }

  return true;
}

function getBearerToken(req: Request) {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1];
  if (!payload) return {};

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function hasRecentDestructiveAuth(token: string, userId: string) {
  const claims = decodeJwtPayload(token) as {
    amr?: Array<{ method?: string; timestamp?: number }>;
    sub?: string;
  };
  if (claims.sub !== userId) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const methods = Array.isArray(claims.amr) ? claims.amr : [];

  return methods.some((entry) => {
    const method = String(entry?.method || '').toLowerCase();
    const timestamp = Number(entry?.timestamp || 0);
    return DESTRUCTIVE_AUTH_METHODS.has(method)
      && Number.isFinite(timestamp)
      && nowSeconds - timestamp <= RECENT_AUTH_WINDOW_SECONDS;
  });
}

function requireRecentAuthForAccountDeletion(req: Request, userId: string) {
  const token = getBearerToken(req);
  if (token && hasRecentDestructiveAuth(token, userId)) return;

  throw new HttpError(
    401,
    'Verify your login again before deleting your BudgetBuddy account.',
    REAUTH_REQUIRED_CODE
  );
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
      requireRecentAuthForAccountDeletion(req, user.id);

      const { data: billingProfile, error: billingReadError } = await supabaseAdmin
        .from('billing_profiles')
        .select('subscription_status, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (billingReadError && !isMissingOptionalTableError(billingReadError, 'billing_profiles')) {
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
    const legacyProfileDeleted = await deleteRowsForUser(supabaseAdmin, 'profiles', user.id, { optional: true, column: 'id' });

    // Household/family sharing is not implemented in the current schema.
    // Return an explicit marker so account deletion reports stay truthful.
    const householdMembershipsDeleted = NOT_APPLICABLE;
    const sharedBudgetOwnershipHandled = NOT_APPLICABLE;
    const supportContactRecordsDeleted = NOT_APPLICABLE;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, false);
    if (error) throw error;

    return jsonResponse({
      deleted: true,
      authUserDeleted: true,
      buddyCloudVaultsDeleted,
      buddyCloudSnapshotsDeleted,
      browserAccessDeleted,
      billingProfileDeleted,
      legacyProfileDeleted,
      householdMembershipsDeleted,
      sharedBudgetOwnershipHandled,
      supportContactRecordsDeleted,
      recoveryKeyMetadataDeletedLocally: true,
      activeSessionsRevokedByAuthDeletion: true
    });
  } catch (error) {
    return handleError(error);
  }
});
