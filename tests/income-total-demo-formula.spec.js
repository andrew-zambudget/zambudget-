const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const DEMO_TOTAL_MISMATCH_CASE = {
    transactions: [
        {
            id: 'demo-income-1',
            type: 'income',
            description: 'Primary paycheck',
            category: 'Paycheck',
            amount: 2600,
            date: '2026-06-15',
            paymentMethod: 'bank',
            notes: '',
            tag: 'income',
            createdAt: '2026-06-15T12:00:00.000Z'
        },
        {
            id: 'demo-income-2',
            type: 'income',
            description: 'Side Work project',
            category: 'Side Work',
            amount: 420,
            date: '2026-06-14',
            paymentMethod: 'bank',
            notes: '',
            tag: 'income',
            createdAt: '2026-06-14T12:00:00.000Z'
        },
        {
            id: 'demo-savings-1',
            type: 'savings',
            description: 'Emergency fund deposit',
            category: 'Emergency Fund',
            amount: 250,
            date: '2026-06-13',
            paymentMethod: 'bank',
            notes: '',
            tag: 'savings',
            createdAt: '2026-06-13T12:00:00.000Z'
        }
    ],
    categories: [
        {
            id: 'demo-cat-paycheck',
            type: 'income',
            name: 'Paycheck',
            icon: '💵',
            budget: 2600,
            createdAt: '2026-06-13T12:00:00.000Z'
        },
        {
            id: 'demo-cat-side-work',
            type: 'income',
            name: 'Side Work',
            icon: '💼',
            budget: 400,
            createdAt: '2026-06-13T12:00:00.000Z'
        }
    ],
    settings: {
        currency: '$',
        defaultType: 'expense',
        defaultPayment: 'bank',
        defaultCategory: 'Groceries',
        defaultTag: 'transaction',
        savingsGoal: 1000,
        emergencyFundMonths: 3,
        emergencyFundGoalOverride: false,
        emergencyFundInteracted: true,
        dashboardSummaryCollapsed: false,
        treatSavingsAsIncomeInZbb: false,
        treatSavingsAsTotalIncome: false,
        lastCategorySort: 'manual',
        isPro: false,
        premiumSinceUTC: '',
        stripeCheckoutSessionId: ''
    }
};

test.describe('income total formula in demo-like data', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('ignores savings-flagged income deposits when savings is not included', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate((budget) => {
            localStorage.setItem('bb_demo_active', 'true');
            window.replaceSnapshot?.(budget);
            window.render?.();
        }, DEMO_TOTAL_MISMATCH_CASE);
        await page.evaluate(() => window.switchTab('income'));

        await expect(page.locator('#incomeTotalLogged')).toHaveText('$3,020.00');
        await expect(page.locator('#incomeTotalExpected')).toHaveText('$3,000.00');
        await expect(page.locator('#incomeBreakdown .category-item').filter({ hasText: 'Side Work' }))
            .toContainText('Logged: $420.00');
    });
});
