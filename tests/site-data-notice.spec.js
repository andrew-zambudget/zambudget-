const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('required site data notice', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('shows required site data notice and sets a host-only notice cookie', async ({ page, context }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const notice = page.locator('#zamSiteDataNotice');
        await expect(notice).toBeVisible();
        await expect(notice).toContainText('Required cookie and site data');
        await expect(notice).toContainText('No analytics or advertising cookies');

        await page.getByRole('button', { name: 'Got it' }).click();
        await expect(notice).toHaveCount(0);

        await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('zam_site_data_notice=required');

        const cookies = await context.cookies();
        const noticeCookie = cookies.find(cookie => cookie.name === 'zam_site_data_notice');
        expect(noticeCookie).toBeTruthy();
        expect(noticeCookie.domain.startsWith('.')).toBe(false);
        expect(noticeCookie.sameSite).toBe('Lax');

        await page.reload();
        await waitForAppReady(page);
        await expect(page.locator('#zamSiteDataNotice')).toHaveCount(0);
    });
});
