const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('Premium billing copy', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('upgrade modal uses direct subscription pricing without trial copy', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openUpgradeModal?.('Buddy Cloud Plus'));

        const modal = page.locator('#upgradeModal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('$3.99');
        await expect(modal).toContainText('Subscribe to Premium');
        await expect(modal).not.toContainText(/trial/i);
    });

    test('terms show the direct monthly Premium price without trial language', async ({ page }) => {
        await page.goto('/terms.html');

        await expect(page.locator('body')).toContainText('The current Premium plan is $3.99 per month.');
        await expect(page.locator('body')).not.toContainText(/trial/i);
    });

    test('success modal uses an ASCII-safe billing icon', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.showPremiumSuccessModal?.('Payment received', 'Premium access is being verified.'));

        const modal = page.locator('#premiumSuccessModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.icon-large')).toHaveText('$');
        await expect(modal).not.toContainText('â');
    });

    test('live billing is blocked from localhost before checkout starts', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const calls = [];
            window.currentUser = { id: 'billing-localhost-user', email: 'billing-localhost@example.com' };
            window.bbConfig = {
                ...(window.bbConfig || {}),
                billingEnabled: true,
                billingMode: 'beta-live',
                stripePublishableKey: 'pk_live_test_local_guard'
            };
            window.sb = {
                ...(window.sb || {}),
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ name, options });
                        return { data: { url: 'https://checkout.stripe.com/test' }, error: null };
                    }
                }
            };
            const messages = [];
            window.showToast = message => messages.push(message);

            await window.startStripeCheckout();
            return { calls, messages };
        });

        expect(result.calls).toHaveLength(0);
        expect(result.messages.join(' ')).toContain('Live billing must be started from https://app.budget-buddy.io');
    });
});
