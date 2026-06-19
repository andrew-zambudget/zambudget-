const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('signed-out budget write guard', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('blocks budget data creation when signed out and not in demo mode', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(() => {
            sessionStorage.removeItem('zam_demo_active');
            window.currentUser = null;

            const categoryResult = window.addCategory?.('Leak Test', 'LT', 'expense', 100);
            const transactionResult = window.addTransaction?.({
                id: 'tx_signed_out_guard',
                type: 'expense',
                description: 'Should not persist',
                category: 'Leak Test',
                amount: 42,
                date: new Date().toISOString().slice(0, 10),
                tag: 'expense'
            });

            return {
                categoryResult,
                transactionResult,
                persisted: localStorage.getItem('bb_data'),
                categories: window.getCategories?.() || [],
                transactions: window.getTransactions?.() || []
            };
        });

        expect(result.categoryResult?.success).toBe(false);
        expect(result.transactionResult).toBe(false);
        expect(result.persisted).toBeNull();
        expect(result.categories).toEqual([]);
        expect(result.transactions).toEqual([]);
    });

    test('allows budget data creation in demo mode without a signed-in user', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(() => {
            sessionStorage.setItem('zam_demo_active', 'true');
            window.currentUser = null;

            const categoryResult = window.addCategory?.('Demo Test', 'DT', 'expense', 100);
            const transactionResult = window.addTransaction?.({
                id: 'tx_demo_guard',
                type: 'expense',
                description: 'Demo transaction',
                category: 'Demo Test',
                amount: 12,
                date: new Date().toISOString().slice(0, 10),
                tag: 'expense'
            });

            return {
                categoryResult,
                transactionResult,
                persisted: localStorage.getItem('bb_data'),
                demoPersisted: sessionStorage.getItem('zam_demo_data'),
                categories: window.getCategories?.() || [],
                transactions: window.getTransactions?.() || []
            };
        });

        expect(result.categoryResult?.success).toBe(true);
        expect(result.transactionResult).toBe(true);
        expect(result.persisted).toBeNull();
        expect(result.demoPersisted).not.toBeNull();
        expect(result.categories).toHaveLength(1);
        expect(result.transactions).toHaveLength(1);
    });
});
