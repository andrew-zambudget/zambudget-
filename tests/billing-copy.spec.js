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
});
