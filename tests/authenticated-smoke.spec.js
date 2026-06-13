const { test, expect } = require('@playwright/test');

const TEST_EMAIL = process.env.BUDGETBUDDY_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.BUDGETBUDDY_TEST_PASSWORD || '';
const HAS_AUTH_CREDENTIALS = Boolean(TEST_EMAIL && TEST_PASSWORD);

async function clearBrowserBudgetState(page) {
    await page.evaluate(async () => {
        try {
            await window.BuddyCloud?.releaseCurrentSyncSlot?.({ clearLocalSlot: true });
        } catch {
            // Best-effort cleanup for the disposable test account.
        }

        try {
            await window.sb?.auth?.signOut?.({ scope: 'local' });
        } catch {
            // The session may already be gone if app startup failed.
        }

        localStorage.clear();
        sessionStorage.clear();
    }).catch(() => {});
}

test.describe('BudgetBuddy authenticated smoke', () => {
    test.skip(!HAS_AUTH_CREDENTIALS, 'Set BUDGETBUDDY_TEST_EMAIL and BUDGETBUDDY_TEST_PASSWORD for the dedicated smoke-test account.');

    test.afterEach(async ({ page }) => {
        await clearBrowserBudgetState(page);
    });

    test('dedicated test account can sign in and load the app shell', async ({ page }) => {
        await page.goto('/login.html');
        await expect(page.locator('#magicEmail')).toBeVisible();

        const signInResult = await page.evaluate(async ({ email, password }) => {
            if (!window.supabase?.createClient) {
                return { ok: false, message: 'Supabase client script did not load.' };
            }

            const response = await fetch('./config.json', { cache: 'no-store' });
            if (!response.ok) {
                return { ok: false, message: 'Could not load config.json.' };
            }

            const config = await response.json();
            const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                return { ok: false, message: error.message };
            }

            return {
                ok: Boolean(data?.session?.user?.id),
                email: data?.session?.user?.email || '',
                userId: data?.session?.user?.id || ''
            };
        }, { email: TEST_EMAIL, password: TEST_PASSWORD });

        expect(signInResult, signInResult.message || 'Supabase password sign-in failed.').toEqual(expect.objectContaining({
            ok: true
        }));
        expect(signInResult.email.toLowerCase()).toBe(TEST_EMAIL.toLowerCase());

        await page.goto('/index.html');
        await expect(page.locator('.app-header')).toBeVisible();
        await expect(page.locator('.btn-avatar')).toBeVisible({ timeout: 15000 });

        const appStatus = await page.waitForFunction((expectedEmail) => {
            const email = window.currentUser?.email || '';
            const cloudStatus = window.BuddyCloud?.getStatus?.() || null;

            return email.toLowerCase() === expectedEmail.toLowerCase()
                ? {
                    email,
                    hasCurrentUser: Boolean(window.currentUser?.id),
                    hasSupabaseClient: Boolean(window.sb?.auth),
                    hasReadableCloudStatus: Boolean(cloudStatus),
                    cloudSignedIn: Boolean(cloudStatus?.signedIn)
                }
                : null;
        }, TEST_EMAIL, { timeout: 15000 });

        const status = await appStatus.jsonValue();
        expect(status).toEqual(expect.objectContaining({
            hasCurrentUser: true,
            hasSupabaseClient: true,
            hasReadableCloudStatus: true,
            cloudSignedIn: true
        }));

        const avatarEmail = await page.locator('.btn-avatar').first().getAttribute('data-account-email');
        expect((avatarEmail || '').toLowerCase()).toBe(TEST_EMAIL.toLowerCase());
    });
});
