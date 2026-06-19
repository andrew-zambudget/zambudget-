const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

async function createExpenseFromAddTab(page, description = 'Local status smoke') {
    await page.evaluate(() => {
        sessionStorage.setItem('zam_demo_active', 'true');
        window.switchTab?.('add');
        window.setType?.('expense');
    });

    const categoryName = await page.evaluate(() => {
        const existing = window.getCategories().find(category => category.type === 'expense')?.name;
        if (existing) return existing;

        const result = window.addCategory?.('Sync Status Test', 'ST', 'expense', 100);
        return result?.success ? result.name : '';
    });
    expect(categoryName).not.toBe('');

    await page.fill('#txAmount', '12.34');
    await page.fill('#txDescription', description);
    await page.evaluate((category) => {
        const categoryInput = document.getElementById('txCategory');
        if (categoryInput) categoryInput.value = category;
        window.submitTransaction();
    }, categoryName);
}

test.describe('Cloud Sync local save status', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('Add transaction in demo mode is labeled as a local save', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await createExpenseFromAddTab(page, 'Demo local status');

        await expect(page.locator('#syncStatusBtn')).toHaveAttribute(
            'aria-label',
            /Saved locally\. Cloud Sync not active/
        );
    });

    test('Add transaction while offline is labeled as local and not backed up', async ({ page, context }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await context.setOffline(true);

        await createExpenseFromAddTab(page, 'Offline local status');

        await expect(page.locator('#syncStatusBtn')).toHaveAttribute(
            'aria-label',
            /Offline - saved locally\. Not backed up to Cloud Sync/
        );

        await context.setOffline(false);
    });
});
