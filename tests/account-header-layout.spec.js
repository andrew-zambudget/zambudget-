const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

async function openAccountModalFor(page, email, width) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/index.html');
    await waitForAppReady(page);
    await page.evaluate((accountEmail) => {
        window.currentUser = {
            id: 'account-layout-user',
            email: accountEmail,
            user_metadata: { full_name: accountEmail.split('@')[0] }
        };
        Math.random = () => 0;
        window.openAccountModal?.();
    }, email);
    await expect(page.locator('#accountModal')).toHaveClass(/active/);
}

test.describe('account header layout', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    for (const { label, width } of [
        { label: 'desktop', width: 1280 },
        { label: 'mobile', width: 390 }
    ]) {
        test(`account greeting and badges do not overlap on ${label}`, async ({ page }) => {
            await openAccountModalFor(
                page,
                'avery.long.account.name.with.many.sections@example.com',
                width
            );

            const title = page.locator('#accountModalTitle');
            await expect(title).toBeVisible();
            await expect(title).not.toContainText(/^Welcome,/);

            const layout = await page.evaluate(() => {
                const titleRect = document.getElementById('accountModalTitle')?.getBoundingClientRect();
                const badgeRect = document.querySelector('#accountModal .account-badge-row')?.getBoundingClientRect();
                const boxRect = document.querySelector('#accountModal .modal-box')?.getBoundingClientRect();
                return {
                    titleBottom: titleRect?.bottom || 0,
                    badgeTop: badgeRect?.top || 0,
                    titleLeft: titleRect?.left || 0,
                    titleRight: titleRect?.right || 0,
                    badgeLeft: badgeRect?.left || 0,
                    badgeRight: badgeRect?.right || 0,
                    boxLeft: boxRect?.left || 0,
                    boxRight: boxRect?.right || 0,
                    viewportWidth: window.innerWidth
                };
            });

            expect(layout.titleBottom).toBeLessThanOrEqual(layout.badgeTop + 1);
            expect(layout.titleLeft).toBeGreaterThanOrEqual(layout.boxLeft - 1);
            expect(layout.titleRight).toBeLessThanOrEqual(layout.boxRight + 1);
            expect(layout.badgeLeft).toBeGreaterThanOrEqual(layout.boxLeft - 1);
            expect(layout.badgeRight).toBeLessThanOrEqual(layout.boxRight + 1);
            expect(layout.boxRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
        });
    }
});
