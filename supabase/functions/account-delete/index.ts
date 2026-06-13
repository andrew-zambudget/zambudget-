import {
  getSupabaseAdmin,
  handleError,
  handleOptions,
  HttpError,
  jsonResponse,
  readJson,
  requireUser
} from '../_shared/billing.ts';

const BLOCKED_BILLING_STATUSES = new Set(['active', 'past_due']);
const ACTIVE_SUBSCRIPTION_CODE = 'ACTIVE_STRIPE_SUBSCRIPTION';
const REAUTH_REQUIRED_CODE = 'REAUTH_REQUIRED';
const AUTH_DELETE_NOT_VERIFIED_CODE = 'AUTH_USER_DELETE_NOT_VERIFIED';
const ACCOUNT_ROWS_DELETE_NOT_VERIFIED_CODE = 'ACCOUNT_ROWS_DELETE_NOT_VERIFIED';
const ACCOUNT_EMAIL_DELETE_NOT_VERIFIED_CODE = 'ACCOUNT_EMAIL_DELETE_NOT_VERIFIED';
const ACCOUNT_METADATA_DELETE_NOT_VERIFIED_CODE = 'ACCOUNT_METADATA_DELETE_NOT_VERIFIED';
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

function isMissingOptionalColumnError(error: unknown, column = '') {
  const typed = error as { code?: string; message?: string };
  const message = String(typed?.message || '').toLowerCase();
  return typed?.code === '42703'
    || typed?.code === 'PGRST204'
    || (column && message.includes(column.toLowerCase()))
    || message.includes('column')
    || message.includes('schema cache');
}

function isOptionalSchemaError(error: unknown, table = '', column = '') {
  return isMissingOptionalTableError(error, table) || isMissingOptionalColumnError(error, column);
}

function normalizeAccountEmail(email: unknown) {
  return typeof email === 'string' ? email.trim() : '';
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

async function deleteRowsByColumnValue(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  value: unknown,
  options: { optional?: boolean } = {}
) {
  const cleanValue = typeof value === 'string' ? value.trim() : value;
  if (!cleanValue) return NOT_APPLICABLE;

  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(column, cleanValue);

  if (error) {
    if (options.optional && isOptionalSchemaError(error, table, column)) return NOT_APPLICABLE;
    throw error;
  }

  return true;
}

async function verifyNoRowsForUser(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string,
  options: { optional?: boolean; column?: string } = {}
) {
  const column = options.column || 'user_id';
  const { count, error } = await supabaseAdmin
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, userId);

  if (error) {
    if (options.optional && isMissingOptionalTableError(error, table)) return NOT_APPLICABLE;
    throw error;
  }

  if ((count || 0) > 0) {
    throw new HttpError(
      500,
      `Account deletion did not complete. ${table} still contains account rows.`,
      ACCOUNT_ROWS_DELETE_NOT_VERIFIED_CODE
    );
  }

  return true;
}

async function verifyNoRowsByColumnValue(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  value: unknown,
  options: { optional?: boolean; code?: string } = {}
) {
  const cleanValue = typeof value === 'string' ? value.trim() : value;
  if (!cleanValue) return NOT_APPLICABLE;

  const { count, error } = await supabaseAdmin
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, cleanValue);

  if (error) {
    if (options.optional && isOptionalSchemaError(error, table, column)) return NOT_APPLICABLE;
    throw error;
  }

  if ((count || 0) > 0) {
    throw new HttpError(
      500,
      `Account deletion did not complete. ${table}.${column} still contains account metadata.`,
      options.code || ACCOUNT_METADATA_DELETE_NOT_VERIFIED_CODE
    );
  }

  return true;
}

function hasBlockedBillingSubscription(profile: { stripe_subscription_id?: string | null; subscription_status?: string | null } | null | undefined) {
  return Boolean(
    profile?.stripe_subscription_id
    && BLOCKED_BILLING_STATUSES.has(profile.subscription_status || '')
  );
}

async function readBillingProfilesForDeletion(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; email?: string | null }
) {
  const profiles: Array<{ subscription_status?: string | null; stripe_subscription_id?: string | null }> = [];
  const { data: byUserId, error: byUserIdError } = await supabaseAdmin
    .from('billing_profiles')
    .select('subscription_status, stripe_subscription_id')
    .eq('user_id', user.id);

  if (byUserIdError) {
    if (!isMissingOptionalTableError(byUserIdError, 'billing_profiles')) throw byUserIdError;
    return profiles;
  }

  if (Array.isArray(byUserId)) profiles.push(...byUserId);

  const email = normalizeAccountEmail(user.email);
  if (!email) return profiles;

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from('billing_profiles')
    .select('subscription_status, stripe_subscription_id')
    .eq('email', email);

  if (byEmailError) {
    if (!isOptionalSchemaError(byEmailError, 'billing_profiles', 'email')) throw byEmailError;
    return profiles;
  }

  if (Array.isArray(byEmail)) profiles.push(...byEmail);
  return profiles;
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

async function verifyAuthUserDeleted(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    const typed = error as { status?: number; code?: string; message?: string };
    const message = String(typed?.message || '').toLowerCase();
    if (
      typed?.status === 404
      || typed?.code === 'user_not_found'
      || message.includes('user not found')
      || message.includes('not found')
    ) {
      return true;
    }

    throw error;
  }

  if (data?.user?.id === userId) {
    throw new HttpError(
      500,
      'Supabase Auth identity deletion did not complete.',
      AUTH_DELETE_NOT_VERIFIED_CODE
    );
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
      requireRecentAuthForAccountDeletion(req, user.id);

      const billingProfiles = await readBillingProfilesForDeletion(supabaseAdmin, user);
      if (billingProfiles.some(hasBlockedBillingSubscription)) {
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
    const billingProfileEmailDeleted = await deleteRowsByColumnValue(supabaseAdmin, 'billing_profiles', 'email', user.email, { optional: true });
    const legacyProfileDeleted = await deleteRowsForUser(supabaseAdmin, 'profiles', user.id, { optional: true, column: 'id' });
    const legacyProfileEmailDeleted = await deleteRowsByColumnValue(supabaseAdmin, 'profiles', 'email', user.email, { optional: true });
    const buddyCloudVaultsVerifiedDeleted = await verifyNoRowsForUser(supabaseAdmin, 'buddy_cloud_vaults', user.id);
    const buddyCloudSnapshotsVerifiedDeleted = await verifyNoRowsForUser(supabaseAdmin, 'buddy_cloud_vault_snapshots', user.id, { optional: true });
    const browserAccessVerifiedDeleted = await verifyNoRowsForUser(supabaseAdmin, 'buddy_cloud_browser_access', user.id, { optional: true });
    const billingProfileVerifiedDeleted = await verifyNoRowsForUser(supabaseAdmin, 'billing_profiles', user.id, { optional: true });
    const billingProfileEmailVerifiedDeleted = await verifyNoRowsByColumnValue(supabaseAdmin, 'billing_profiles', 'email', user.email, {
      optional: true,
      code: ACCOUNT_EMAIL_DELETE_NOT_VERIFIED_CODE
    });
    const legacyProfileVerifiedDeleted = await verifyNoRowsForUser(supabaseAdmin, 'profiles', user.id, { optional: true, column: 'id' });
    const legacyProfileEmailVerifiedDeleted = await verifyNoRowsByColumnValue(supabaseAdmin, 'profiles', 'email', user.email, {
      optional: true,
      code: ACCOUNT_EMAIL_DELETE_NOT_VERIFIED_CODE
    });

    // Household/family sharing is not implemented in the current schema.
    // Return an explicit marker so account deletion reports stay truthful.
    const householdMembershipsDeleted = NOT_APPLICABLE;
    const sharedBudgetOwnershipHandled = NOT_APPLICABLE;
    const supportContactRecordsDeleted = NOT_APPLICABLE;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, false);
    if (error) throw error;
    await verifyAuthUserDeleted(supabaseAdmin, user.id);

    return jsonResponse({
      deleted: true,
      authUserDeleted: true,
      buddyCloudVaultsDeleted,
      buddyCloudSnapshotsDeleted,
      buddyCloudVaultsVerifiedDeleted,
      buddyCloudSnapshotsVerifiedDeleted,
      browserAccessDeleted,
      browserAccessVerifiedDeleted,
      billingProfileDeleted,
      billingProfileVerifiedDeleted,
      billingProfileEmailDeleted,
      billingProfileEmailVerifiedDeleted,
      legacyProfileDeleted,
      legacyProfileVerifiedDeleted,
      legacyProfileEmailDeleted,
      legacyProfileEmailVerifiedDeleted,
      householdMembershipsDeleted,
      sharedBudgetOwnershipHandled,
      supportContactRecordsDeleted,
      recoveryKeyMetadataDeletedLocally: true,
      activeSessionsRevokedByAuthDeletion: true,
      authEmailDeletedByAuthDeletion: true,
      authTimestampsDeletedByAuthDeletion: true,
      authProviderIdentitiesDeletedByAuthDeletion: true
    });
  } catch (error) {
    return handleError(error);
  }
});
