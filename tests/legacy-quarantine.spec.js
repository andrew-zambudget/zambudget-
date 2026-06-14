const { test, expect } = require('@playwright/test');
const {
    QUARANTINE_TAG,
    collectConsoleMessages,
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('legacy quarantine warnings', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('demo-mode basic budget flow does not hit quarantined fallbacks', async ({ page }) => {
        const quarantineWarnings = collectConsoleMessages(page, text => text.includes(QUARANTINE_TAG));

        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            localStorage.setItem('bb_demo_active', 'true');
            window.switchTab('income');
            window.switchTab('savings');
            window.switchTab('debt');
            window.switchTab('recent');
            window.switchTab('add');
        });

        const categoryName = await page.evaluate(() => {
            const existing = window.getCategories().find(category => category.type === 'expense')?.name;
            if (existing) return existing;

            const result = window.addCategory?.('Quarantine Test', 'QT', 'expense', 100);
            return result?.success ? result.name : '';
        });
        expect(categoryName).not.toBe('');

        await page.fill('#txAmount', '12.34');
        await page.fill('#txDescription', 'Quarantine smoke');
        await page.evaluate((category) => {
            const categoryInput = document.getElementById('txCategory');
            if (categoryInput) categoryInput.value = category;
            window.setType?.('expense');
            window.submitTransaction();
            window.switchTab('recent');
            window.switchTab('savings');
        }, categoryName);

        expect(quarantineWarnings).toEqual([]);
    });
});
