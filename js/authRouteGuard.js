const LOGIN_ROUTE = '/login';
const APP_ROUTE = '/app';
const DEMO_ROUTE = '/demo';
const CALLBACK_ROUTE = '/auth/callback';

const PUBLIC_ROUTES = new Set([
    LOGIN_ROUTE,
    CALLBACK_ROUTE,
    DEMO_ROUTE,
    '/privacy',
    '/terms',
    '/site-data',
    '/privacy.html',
    '/privacypolicy.html',
    '/terms.html'
]);

const PROTECTED_APP_ROUTES = new Set([
    APP_ROUTE,
    '/settings',
    '/import',
    '/export',
    '/cloud-sync',
    '/billing',
    '/account',
    '/recovery',
    '/premium',
    '/app/settings',
    '/app/import',
    '/app/export',
    '/app/cloud-sync',
    '/app/billing',
    '/app/account',
    '/app/recovery',
    '/app/premium'
]);

function trimTrailingSlash(path) {
    if (!path || path === '/') return '/';
    return path.replace(/\/+$/, '') || '/';
}

export function getNormalizedPath(pathname = window.location.pathname) {
    const path = trimTrailingSlash(String(pathname || '/'));
    if (path === '/login.html') return LOGIN_ROUTE;
    if (path === '/index.html') return '/index.html';
    if (path === '/privacypolicy.html') return '/privacy';
    if (path === '/terms.html') return '/terms';
    return path;
}

function isLocalDevHost(hostname = window.location.hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
}

export function isAuthCallbackRoute(pathname = window.location.pathname) {
    return getNormalizedPath(pathname) === CALLBACK_ROUTE;
}

export function isLoginRoute(pathname = window.location.pathname) {
    return getNormalizedPath(pathname) === LOGIN_ROUTE;
}

export function isDemoRoute(pathname = window.location.pathname) {
    const normalized = getNormalizedPath(pathname);
    return normalized === DEMO_ROUTE || normalized.startsWith(`${DEMO_ROUTE}/`);
}

export function isDemoRequest(pathname = window.location.pathname, search = window.location.search) {
    if (isDemoRoute(pathname)) return true;
    try {
        return new URLSearchParams(String(search || '')).has('demo');
    } catch {
        return false;
    }
}

export function isPublicRoute(pathname = window.location.pathname, search = window.location.search) {
    if (isDemoRequest(pathname, search)) return true;
    return PUBLIC_ROUTES.has(getNormalizedPath(pathname));
}

export function isProtectedAppRoute(pathname = window.location.pathname) {
    if (isDemoRequest(pathname)) return false;
    const normalized = getNormalizedPath(pathname);
    if (PROTECTED_APP_ROUTES.has(normalized)) return true;
    if (normalized.startsWith(`${APP_ROUTE}/`)) return true;
    if (normalized === '/index.html') return !isLocalDevHost();
    return false;
}

export function shouldRedirectRoot(pathname = window.location.pathname) {
    if (isDemoRequest(pathname)) return false;
    const normalized = getNormalizedPath(pathname);
    return normalized === '/' || (normalized === '/index.html' && !isLocalDevHost());
}

function buildRouteUrl(route, options = {}) {
    const url = new URL(route, window.location.origin);
    if (options.preferReturnTo) {
        const returnTo = getSafeReturnToPath();
        if (returnTo) {
            const returnUrl = new URL(returnTo, window.location.origin);
            return returnUrl.toString();
        }
    }
    if (options.preserveSearch) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });
    }
    if (options.returnTo) {
        const returnUrl = new URL(window.location.href);
        returnUrl.hash = '';
        url.searchParams.set('returnTo', `${returnUrl.pathname}${returnUrl.search}`);
    }
    return url.toString();
}

export function getSafeReturnToPath() {
    try {
        const currentUrl = new URL(window.location.href);
        const rawReturnTo = currentUrl.searchParams.get('returnTo');
        if (!rawReturnTo) return '';
        const returnUrl = new URL(rawReturnTo, window.location.origin);
        if (returnUrl.origin !== window.location.origin) return '';
        if (!returnUrl.pathname.startsWith(`${APP_ROUTE}/`) && returnUrl.pathname !== APP_ROUTE) return '';
        if (returnUrl.pathname === `${APP_ROUTE}/`) return `${APP_ROUTE}${returnUrl.search}`;
        return `${returnUrl.pathname}${returnUrl.search}`;
    } catch {
        return '';
    }
}

export function redirectToLogin(options = {}) {
    window.location.replace(buildRouteUrl(LOGIN_ROUTE, options));
}

export function redirectToApp(options = {}) {
    window.location.replace(buildRouteUrl(APP_ROUTE, options));
}

export function clearAuthPendingState() {
    document.documentElement.classList.remove('auth-route-pending');
    document.getElementById('authRouteLoading')?.remove();
}

async function getCurrentSession(supabaseClient) {
    if (!supabaseClient?.auth?.getSession) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session || null;
}

export async function guardCurrentAppRoute({ supabaseClient } = {}) {
    const normalized = getNormalizedPath();
    const session = await getCurrentSession(supabaseClient);
    const hasSession = Boolean(session?.user);

    if (isAuthCallbackRoute()) {
        redirectToApp({ preferReturnTo: true });
        return { redirected: true, session, user: session?.user || null, route: normalized };
    }

    if (!hasSession && shouldRedirectRoot()) {
        redirectToLogin();
        return { redirected: true, session: null, user: null, route: normalized };
    }

    if (!hasSession && !isPublicRoute() && (isProtectedAppRoute() || !isLocalDevHost())) {
        redirectToLogin({ returnTo: isProtectedAppRoute() });
        return { redirected: true, session: null, user: null, route: normalized };
    }

    if (hasSession && !isDemoRequest() && (normalized === '/' || normalized === LOGIN_ROUTE || normalized === '/index.html')) {
        redirectToApp({
            preferReturnTo: normalized === LOGIN_ROUTE,
            preserveSearch: normalized === '/index.html'
        });
        return { redirected: true, session, user: session.user, route: normalized };
    }

    clearAuthPendingState();
    return { redirected: false, session, user: session?.user || null, route: normalized };
}

export default {
    APP_ROUTE,
    LOGIN_ROUTE,
    CALLBACK_ROUTE,
    DEMO_ROUTE,
    clearAuthPendingState,
    getSafeReturnToPath,
    getNormalizedPath,
    guardCurrentAppRoute,
    isAuthCallbackRoute,
    isDemoRequest,
    isDemoRoute,
    isLoginRoute,
    isProtectedAppRoute,
    isPublicRoute,
    redirectToApp,
    redirectToLogin,
    shouldRedirectRoot
};
