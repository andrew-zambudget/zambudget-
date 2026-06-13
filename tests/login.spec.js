const { test, expect } = require('@playwright/test');
const { resetBrowserStorage } = require('./helpers/appHarness');

test.describe('login page safeguards', () => {
    test.beforeEach(async ({ page }) => {
        await resetBrowserStorage(page);
    });

    test('magic link rate limit shows clear cooldown guidance', async ({ page }) => {
        await page.route('**/@supabase/supabase-js@2', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async () => ({
                                    data: null,
                                    error: { message: 'email rate limit exceeded' }
                                }),
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await expect(page.locator('#magicEmail')).toBeVisible();

        await page.locator('#magicEmail').fill('astruck92@gmail.com');
        await page.locator('#magicLinkBtn').click();

        const message = page.locator('#authMessage');
        const button = page.locator('#magicLinkBtn');

        await expect(message).toBeVisible();
        await expect(message).toContainText('Email sign-in is cooling down.');
        await expect(message).toContainText('continue with Google');
        await expect(message).not.toHaveText('email rate limit exceeded');
        await expect(button).toBeDisabled();
        await expect(button).toHaveText(/Try email again in (59|60)s/);
        await expect(page.locator('#googleSignInBtn')).toBeEnabled();
    });
});
