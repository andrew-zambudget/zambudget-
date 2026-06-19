const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function emergencyFundSnapshot(settings = {}) {
    return {
        transactions: [
            {
                id: 'savings-seed-1',
                type: 'savings',
                description: 'Emergency fund deposit',
                category: 'Emergency Fund',
                amount: 250,
                date: '2026-06-18',
                paymentMethod: 'bank',
                notes: '',
                tag: 'savings',
                createdAt: '2026-06-18T12:00:00.000Z'
            }
        ],
        categories: [
            {
                id: 'income-seed-1',
                type: 'income',
                name: 'Paycheck',
                icon: '',
                budget: 3000,
                createdAt: '2026-06-18T12:00:00.000Z'
            }
        ],
        settings: {
            currency: '$',
            defaultType: 'expense',
            defaultPayment: 'bank',
            defaultCategory: '',
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
            stripeCheckoutSessionId: '',
            ...settings
        }
    };
}

test.describe('emergency fund target editing', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('persists a custom target as an override when no recommendation can be validated', async ({ page }) => {
        await page.goto('/demo');
        await waitForAppReady(page);

        await page.evaluate((budget) => {
            window.replaceSnapshot?.(budget);
            window.render?.();
            window.switchTab?.('savings');
        }, emergencyFundSnapshot());

        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$1,000.00');

        await page.locator('#emergencyGoalEdit').click();
        await page.locator('#emergencyFundGoalInput').fill('5000');
        await page.locator('#emergencyFundGoalInput').press('Enter');

        await expect(page.locator('#emergencyFundRecommendationModal')).toHaveCount(0);
        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$5,000.00');

        const savedSettings = await page.evaluate(() => {
            const payload = JSON.parse(localStorage.getItem('bb_data') || '{}');
            return {
                savingsGoal: payload.settings?.savingsGoal,
                emergencyFundGoalOverride: payload.settings?.emergencyFundGoalOverride
            };
        });

        expect(savedSettings).toEqual({
            savingsGoal: 5000,
            emergencyFundGoalOverride: true
        });

        await page.reload();
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab?.('savings'));
        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$5,000.00');
    });

    test('keeps an override from the demo 3 month emergency fund recommendation', async ({ page }) => {
        await page.goto('/demo');
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab?.('savings'));

        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$7,455.00');

        await page.locator('#emergencyGoalEdit').click();
        await page.locator('#emergencyFundGoalInput').fill('8000');
        await page.locator('#emergencyFundGoalInput').press('Enter');
        await expect(page.locator('#emergencyFundRecommendationModal')).toBeVisible();
        await page.getByRole('button', { name: 'Keep Override' }).click();

        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$8,000.00');

        const savedSettings = await page.evaluate(() => {
            const payload = JSON.parse(localStorage.getItem('bb_data') || '{}');
            return {
                savingsGoal: payload.settings?.savingsGoal,
                emergencyFundGoalOverride: payload.settings?.emergencyFundGoalOverride
            };
        });

        expect(savedSettings).toEqual({
            savingsGoal: 8000,
            emergencyFundGoalOverride: true
        });

        await page.reload();
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab?.('savings'));
        await expect(page.locator('#emergencyGoalAmountText')).toHaveText('$8,000.00');
    });
});
