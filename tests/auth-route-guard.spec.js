const { test, expect } = require('@playwright/test');
const { resetBrowserStorage } = require('./helpers/appHarness');

function supabaseStub(sessionExpression = 'null') {
    return `
        window.supabase = {
            createClient() {
                const emptyQuery = {
                    select() { return this; },
                    insert() { return Promise.resolve({ data: null, error: null }); },
                    update() { return this; },
                    upsert() { return Promise.resolve({ data: null, error: null }); },
                    delete() { return this; },
                    eq() { return this; },
                    order() { return this; },
                    limit() { return this; },
                    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
                    single() { return Promise.resolve({ data: null, error: null }); },
                    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
                };

                return {
                    auth: {
                        getSession: async () => ({ data: { session: ${sessionExpression} }, error: null }),
                        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                        signOut: async () => ({ error: null })
                    },
                    from: () => emptyQuery,
                    functions: {
                        invoke: async () => ({ data: { isPremium: false, status: 'free' }, error: null })
                    },
                    channel: () => ({
                        on() { return this; },
                        subscribe(callback) {
                            if (typeof callback === 'function') callback('SUBSCRIBED');
                            return this;
                        },
                        unsubscribe() {}
                    }),
                    removeChannel: async () => ({ error: null })
                };
            }
        };
    `;
}

async function installSupabaseStub(page, sessionExpression = 'null') {
    await page.route('**/js/vendor/supabase.js', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: supabaseStub(sessionExpression)
    }));
}

test.describe('auth route guard', () => {
    test.beforeEach(async ({ page }) => {
        await resetBrowserStorage(page);
    });

    test('redirects logged-out root and protected app routes to login', async ({ page }) => {
        await installSupabaseStub(page);

        await page.goto('/');
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.locator('#loginView')).toBeVisible();

        await page.goto('/app');
        await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp$/);
        await expect(page.locator('#loginView')).toBeVisible();

        await page.goto('/app/cloud-sync');
        await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp%2Fcloud-sync$/);
        await expect(page.locator('#loginView')).toBeVisible();
    });

    test('redirects signed-in login and root routes to app', async ({ page }) => {
        await installSupabaseStub(page, `{
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            user: { id: 'route-user-1', email: 'route-user@example.com' }
        }`);

        await page.goto('/login');
        await expect(page).toHaveURL(/\/app$/);

        await page.goto('/login?returnTo=%2Fapp%2F');
        await expect(page).toHaveURL(/\/app$/);

        await page.goto('/');
        await expect(page).toHaveURL(/\/app$/);
    });

    test('keeps demo route public without creating a real session', async ({ page }) => {
        await installSupabaseStub(page);

        await page.goto('/demo');
        await expect(page).toHaveURL(/\/demo$/);
        await expect(page.locator('#bbDemoModeBanner')).toBeVisible();

        const state = await page.evaluate(() => ({
            demoActive: localStorage.getItem('bb_demo_active'),
            currentUser: window.currentUser
        }));

        expect(state.demoActive).toBe('true');
        expect(state.currentUser).toBeNull();
    });
});
