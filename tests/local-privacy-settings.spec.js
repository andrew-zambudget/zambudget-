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

    test('does not show local storage protection as a visible settings card', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toBeVisible();

        const dataPrivacyCard = page.locator('#settingsData');
        await expect(dataPrivacyCard).not.toContainText('Local Storage Protection');
        await expect(dataPrivacyCard).not.toContainText('Saved budget data and local sync history are encrypted in this browser.');
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

    test('auto-locks the local erase action after the short unlock window', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toBeVisible();

        const unlockButton = page.locator('#unlockLocalEraseBtn');
        const eraseButton = page.locator('#openLocalEraseBtn');
        const timer = page.locator('#localEraseTimer');

        await unlockButton.click();

        await expect(unlockButton).toBeHidden();
        await expect(eraseButton).toBeVisible();
        await expect(timer).toBeVisible();
        await expect(timer).toContainText(/Locks in \d+s/);

        await expect(eraseButton).toBeHidden({ timeout: 17000 });
        await expect(unlockButton).toBeVisible();
        await expect(timer).toBeHidden();
    });
});
