const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const SINGLE_SOURCE_BUDGET = {
    transactions: [],
    categories: [
        {
            id: 'income-paycheck',
            type: 'income',
            name: 'Paycheck',
            icon: 'PAY',
            budget: 20,
            createdAt: '2026-06-15T12:00:00.000Z'
        }
    ],
    settings: {
        currency: '$',
        defaultType: 'expense',
        defaultPayment: 'bank',
        lastCategorySort: 'manual'
    }
};

test.describe('income total editing', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('edits expected and logged totals when one income source backs the summary', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate((budget) => {
            localStorage.setItem('bb_demo_active', 'true');
            window.replaceSnapshot?.(budget);
            window.render?.();
        }, SINGLE_SOURCE_BUDGET);
        await page.evaluate(() => window.switchTab('income'));

        await expect(page.locator('#incomeTotalLogged')).toHaveText('$0.00');
        await expect(page.locator('#incomeTotalExpected')).toHaveText('$20.00');

        await page.locator('#incomeTotalExpected').click();
        await expect(page.locator('#incomeSourceModal')).toBeVisible();
        await expect(page.locator('#incomeSourcePlanned')).toHaveValue('20');
        await page.locator('#incomeSourcePlanned').fill('35');
        await page.locator('#incomeSourceSubmitBtn').click();
        await expect(page.locator('#incomeSourceModal')).not.toHaveClass(/active/);
        await expect(page.locator('#incomeTotalExpected')).toHaveText('$35.00');

        await page.locator('#incomeTotalLogged').click();
        await expect(page.locator('#incomeTotalEditModal')).toBeVisible();
        await page.locator('#incomeTotalLoggedInput').fill('25');
        await page.locator('#incomeTotalEditModal .btn-create').click();
        await expect(page.locator('#incomeTotalEditModal')).toHaveCount(0);
        await expect(page.locator('#incomeTotalLogged')).toHaveText('$25.00');

        const savedIncome = await page.evaluate(() => {
            const transactions = window.getTransactions?.() || [];
            const categories = window.getCategories?.() || [];
            return {
                transactions,
                source: categories.find(category => category.name === 'Paycheck')
            };
        });
        expect(savedIncome.source.budget).toBe(35);
        expect(savedIncome.transactions).toHaveLength(1);
        expect(savedIncome.transactions[0]).toMatchObject({
            type: 'income',
            category: 'Paycheck',
            amount: 25,
            paymentMethod: 'bank'
        });

        await page.locator('#incomeTotalLogged').click();
        await page.locator('#incomeTotalLoggedInput').fill('0');
        await page.locator('#incomeTotalEditModal .btn-create').click();
        await expect(page.locator('#incomeTotalLogged')).toHaveText('$0.00');

        const clearedTransactions = await page.evaluate(() => window.getTransactions?.() || []);
        expect(clearedTransactions).toHaveLength(0);
    });

    test('puts Gift Cards before Groceries in category quick add', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(() => localStorage.setItem('bb_demo_active', 'true'));
        await page.locator('#toggleQuickAddLink').click();

        const labels = await page.locator('#quickAddGrid .quick-add-btn').evaluateAll(buttons =>
            buttons.map(button => button.textContent.replace(/\s+/g, ' ').trim())
        );
        expect(labels[0]).toContain('Gift Cards');
        expect(labels[1]).toContain('Groceries');

        await page.locator('#quickAddGrid .quick-add-btn').first().click();
        const categories = await page.evaluate(() => window.getCategories?.() || []);
        expect(categories.some(category => category.name === 'Gift Cards' && category.type === 'expense')).toBe(true);
    });
});
