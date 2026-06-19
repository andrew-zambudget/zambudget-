const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('required site data cookie', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('sets a host-only required site-data cookie without showing a banner', async ({ page, context }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await expect(page.locator('#zamSiteDataNotice')).toHaveCount(0);
        await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('zam_site_data_notice=required');

        const cookies = await context.cookies();
        const noticeCookie = cookies.find(cookie => cookie.name === 'zam_site_data_notice');
        expect(noticeCookie).toBeTruthy();
        expect(noticeCookie.domain.startsWith('.')).toBe(false);
        expect(noticeCookie.sameSite).toBe('Lax');
    });
});
