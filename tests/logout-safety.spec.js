const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('logout safety', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('missing recovery key with unverified local changes shows explicit sign-out options', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'logout-recovery-key-missing-user',
                email: 'logout-key-missing@example.com'
            };
            window.sb = {
                auth: {
                    signOut: async () => ({ error: null })
                }
            };
            window.BuddyCloud = {
                getStatus: () => ({
                    signedIn: true,
                    enabled: true,
                    hasKey: false,
                    canUseCloud: false
                })
            };
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'unsynced-logout-test', amount: 25, category: 'Testing' }],
                categories: [],
                settings: {}
            }));
            localStorage.setItem('bb_local_updated_at', '2026-06-13T02:00:00.000Z');
            localStorage.setItem('bb_cloud_last_remote_at', '2026-06-13T01:00:00.000Z');

            window.handleLogout();
        });

        await expect(page.locator('#accountConfirmTitle')).toHaveText('Log out?');
        await page.getByRole('button', { name: 'Secure Sign Out' }).click();

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Local Changes Not Backed Up');
        await expect(modal).toContainText('Local changes on this browser have not been backed up to Cloud Sync');
        await expect(modal).toContainText('Import your recovery key or sync before signing out');
        await expect(modal).toContainText('any local changes not already in Cloud Sync may be lost');
        await expect(modal.getByRole('button', { name: 'Recovery Help' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Sign Out Without Backup' })).toBeVisible();
    });
});
