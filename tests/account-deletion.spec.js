const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('account deletion safeguards', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('delete account confirmation explains data scope, Stripe block, and recovery limits', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'account-delete-safety-user',
                email: 'delete-safety@example.com'
            };
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await expect(modal).toContainText('encrypted Buddy Cloud vault');
        await expect(modal).toContainText('encrypted version-history snapshots');
        await expect(modal).toContainText('device/browser access records');
        await expect(modal).toContainText('inactive billing profile');
        await expect(modal).toContainText('Supabase auth identity');
        await expect(modal).toContainText('Household or family memberships are not currently stored');
        await expect(modal).toContainText('Active Stripe subscriptions must be cancelled');
        await expect(modal).toContainText('Stripe may retain billing records');
        await expect(modal).toContainText('This cannot be recovered');
        await expect(page.locator('#buddyCloudModalInput')).toHaveAttribute('placeholder', 'DELETE ACCOUNT');

        await modal.getByRole('button', { name: 'Back' }).click();
        await expect(modal).toBeHidden();
    });
});
