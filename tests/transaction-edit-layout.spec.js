const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

async function seedEditHarness(page) {
    await page.evaluate(() => {
        window.currentUser = { id: 'transaction-edit-layout-test-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'edit-layout-transaction',
                    type: 'expense',
                    description: 'Date Layout Check',
                    category: 'Groceries',
                    amount: 12.34,
                    date: '2026-06-01',
                    paymentMethod: 'card',
                    notes: '',
                    tag: 'expense',
                    createdAt: '2026-06-01T12:00:00.000Z'
                }
            ],
            categories: [
                {
                    id: 'cat-groceries',
                    type: 'expense',
                    name: 'Groceries',
                    icon: 'G',
                    budget: 500,
                    createdAt: '2026-06-01T12:00:00.000Z'
                }
            ],
            settings: {
                currency: '$',
                defaultType: 'expense',
                defaultPayment: '',
                defaultCategory: '',
                lastCategorySort: 'manual',
                giftCards: []
            }
        }, { remoteUpdatedAt: '2026-06-01T12:00:00.000Z' });
        window.render?.();
        window.initAddTransactionForm?.();
    });
}

test.describe('transaction edit layout', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('keeps amount and date controls aligned without clipping date text', async ({ page }) => {
        await page.setViewportSize({ width: 760, height: 900 });
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedEditHarness(page);

        await page.evaluate(() => window.openRecentEditTransactionModal(null, 'edit-layout-transaction'));
        await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
        await expect(page.locator('#editTxDateLabel')).toHaveText('Jun 1, 2026');
        await expect(page.locator('#editTxDateSubLabel')).toHaveText('Mon, Jun 1, 2026');

        const metrics = await page.evaluate(() => {
            const amount = document.getElementById('editTxAmount');
            const trigger = document.getElementById('editTxDateTrigger');
            const label = document.getElementById('editTxDateLabel');
            const subLabel = document.getElementById('editTxDateSubLabel');
            const action = trigger?.querySelector('.transaction-edit-date-action');
            const rect = (el) => el?.getBoundingClientRect();
            const amountRect = rect(amount);
            const triggerRect = rect(trigger);
            const labelRect = rect(label);
            const subLabelRect = rect(subLabel);
            const actionRect = rect(action);
            return {
                amountHeight: amountRect?.height || 0,
                triggerHeight: triggerRect?.height || 0,
                labelInside: Boolean(triggerRect && labelRect && labelRect.top >= triggerRect.top && labelRect.bottom <= triggerRect.bottom),
                subLabelInside: Boolean(triggerRect && subLabelRect && subLabelRect.top >= triggerRect.top && subLabelRect.bottom <= triggerRect.bottom),
                actionInside: Boolean(triggerRect && actionRect && actionRect.top >= triggerRect.top && actionRect.bottom <= triggerRect.bottom),
                actionNotClipped: Boolean(action && action.scrollWidth <= action.clientWidth + 1 && action.scrollHeight <= action.clientHeight + 1)
            };
        });

        expect(Math.abs(metrics.amountHeight - metrics.triggerHeight)).toBeLessThanOrEqual(1);
        expect(metrics.triggerHeight).toBeGreaterThanOrEqual(64);
        expect(metrics.labelInside).toBe(true);
        expect(metrics.subLabelInside).toBe(true);
        expect(metrics.actionInside).toBe(true);
        expect(metrics.actionNotClipped).toBe(true);
    });
});
