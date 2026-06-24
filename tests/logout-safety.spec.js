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

        await page.evaluate(async () => {
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
            const Operational = await import('/js/localOperationalMetadataStorage.js');
            Operational.setLocalUpdatedAt('2026-06-13T02:00:00.000Z');
            Operational.setCloudLastRemoteAt('2026-06-13T01:00:00.000Z');
            await Operational.flushLocalOperationalMetadataWrites();

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

    test('recovery key save prompt allows normal sign out anyway', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(async () => {
            const Operational = await import('/js/localOperationalMetadataStorage.js');
            window.currentUser = {
                id: 'logout-recovery-key-exportable-user',
                email: 'logout-exportable@example.com'
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
                    hasKey: true,
                    canUseCloud: true,
                    hasExportableKey: true
                }),
                exportRecoveryKey: () => 'test-exportable-recovery-key',
                forcePush: async () => {
                    const updatedAt = Operational.getLocalUpdatedAt() || new Date().toISOString();
                    Operational.setCloudLastPushedAt(updatedAt);
                    await Operational.flushLocalOperationalMetadataWrites();
                    return true;
                }
            };

            window.handleLogout();
        });

        await expect(page.locator('#accountConfirmTitle')).toHaveText('Log out?');
        await page.getByRole('button', { name: 'Secure Sign Out' }).click();

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Recovery Key');
        await expect(modal).toContainText('Download this recovery key before continuing');
        await expect(modal.getByRole('button', { name: 'I saved my Recovery Key' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Sign Out Anyway' })).toBeVisible();
    });

    test('recovery key verified during logout is preserved without stale grace reminder', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(async () => {
            const Operational = await import('/js/localOperationalMetadataStorage.js');
            window.currentUser = {
                id: 'logout-recovery-key-preserve-user',
                email: 'logout-preserve@example.com'
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
                    hasKey: true,
                    canUseCloud: true,
                    hasExportableKey: true
                }),
                exportRecoveryKey: () => 'test-logout-preserved-recovery-key',
                forcePush: async () => {
                    const updatedAt = Operational.getLocalUpdatedAt() || new Date().toISOString();
                    Operational.setCloudLastPushedAt(updatedAt);
                    await Operational.flushLocalOperationalMetadataWrites();
                    return true;
                }
            };
            localStorage.setItem('bb_cloud_recovery_key_grace_started_logout-recovery-key-preserve-user', '2026-06-13T01:00:00.000Z');

            window.handleLogout();
        });

        await expect(page.locator('#accountConfirmTitle')).toHaveText('Log out?');
        await page.getByRole('button', { name: 'Secure Sign Out' }).click();

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Recovery Key');

        const downloadEvent = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
        await modal.getByRole('button', { name: 'Download Key' }).click();
        await downloadEvent;

        await modal.getByRole('button', { name: 'I saved my Recovery Key' }).click();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Important: We Cannot Recover This Key');
        await page.locator('#buddyCloudModalInput').fill('test-logout-preserved-recovery-key');
        await modal.getByRole('button', { name: 'I saved my Recovery Key' }).click();

        await page.waitForURL(/sessionCleared=/, { timeout: 10000 });

        const flags = await page.evaluate(() => ({
            backedUp: localStorage.getItem('bb_cloud_recovery_key_backed_up_v1'),
            saved: localStorage.getItem('bb_cloud_recovery_key_saved_v1'),
            graceStarted: localStorage.getItem('bb_cloud_recovery_key_grace_started_logout-recovery-key-preserve-user')
        }));

        expect(flags.backedUp).toMatch(/^zrk:v1:/);
        expect(flags.saved).toMatch(/^zrk:v1:/);
        expect(flags.graceStarted).toBeNull();
    });

    test('trusted key without verified backup shows recovery warning before sign out', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'logout-recovery-key-trusted-only-user',
                email: 'logout-trusted-only@example.com'
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
                    hasKey: true,
                    canUseCloud: true,
                    hasExportableKey: false
                })
            };
            localStorage.setItem('bb_cloud_recovery_key_grace_started_logout-recovery-key-trusted-only-user', '2026-06-13T01:00:00.000Z');

            window.handleLogout();
        });

        await expect(page.locator('#accountConfirmTitle')).toHaveText('Log out?');
        await page.getByRole('button', { name: 'Secure Sign Out' }).click();

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Recovery Key Not Verified');
        await expect(modal).toContainText('Recovery key not verified. This browser can sync, but the key cannot be viewed after refresh.');
        await expect(modal).toContainText('Save or verify your key within');
        await expect(modal).toContainText('reset Cloud Sync before relying on this backup');
        await expect(modal.getByRole('button', { name: 'Recovery Help' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Sign Out Anyway' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Import Key' })).toHaveCount(0);
    });
});
