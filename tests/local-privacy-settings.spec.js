const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('local privacy settings copy', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('shows quiet local storage protection status in settings only', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toBeVisible();

        const dataPrivacyCard = page.locator('#settingsData');
        await expect(dataPrivacyCard).toContainText('Local Storage Protection');
        await expect(dataPrivacyCard).toContainText('Active');
        await expect(dataPrivacyCard).toContainText('Saved budget data and local sync history are encrypted in this browser.');
        await expect(dataPrivacyCard).toContainText('Local storage protection makes saved browser data harder to read at rest.');
        await expect(dataPrivacyCard).toContainText('Cloud Sync and recovery keys remain the recovery path for synced budgets.');
        await expect(dataPrivacyCard).toContainText('Browser-only budgets still need user-managed backups.');
    });

    test('requires unlocking before the local erase confirmation is reachable', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toBeVisible();

        const unlockButton = page.locator('#unlockLocalEraseBtn');
        const eraseButton = page.locator('#openLocalEraseBtn');

        await expect(unlockButton).toBeVisible();
        await expect(eraseButton).toBeHidden();

        await unlockButton.click();

        await expect(unlockButton).toBeHidden();
        await expect(eraseButton).toBeVisible();

        await eraseButton.click();

        await expect(page.locator('#resetConfirmModal')).toBeVisible();
        await page.locator('#resetConfirmModal .btn-cancel').click();
        await expect(page.locator('#resetConfirmModal')).toBeHidden();

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toBeVisible();
        await expect(unlockButton).toBeVisible();
        await expect(eraseButton).toBeHidden();
    });
});
