import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `${name} is not configured.`);
  return value;
}

export function getSupabaseAdmin() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function requireUser(req: Request, supabaseAdmin = getSupabaseAdmin()) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Sign in is required.');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session.');

  return data.user;
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function getAllowedReturnUrl(req: Request, rawUrl: unknown, fallbackPath = '/index.html') {
  const appUrl = Deno.env.get('APP_URL') || req.headers.get('Origin') || new URL(req.url).origin;
  const fallbackOrigin = new URL(appUrl).origin;
  const fallback = fallbackPath.startsWith('http')
    ? fallbackPath
    : `${fallbackOrigin}${fallbackPath}`;
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return fallback;

  try {
    const candidate = new URL(rawUrl);
    return candidate.origin === fallbackOrigin ? rawUrl : fallback;
  } catch {
    return fallback;
  }
}

export function handleOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return null;
}

export function handleError(error: unknown) {
  const err = error as Partial<HttpError>;
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  const body: Record<string, unknown> = { error: message };
  if (typeof err.code === 'string' && err.code) body.code = err.code;
  return jsonResponse(body, status);
}
