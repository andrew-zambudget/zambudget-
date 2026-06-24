const { test, expect } = require('@playwright/test');
const {
    collectConsoleMessages,
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function makeDebtPaymentBudget() {
    return {
        transactions: [],
        categories: [
            {
                id: 'debt-visa',
                type: 'debt',
                name: 'Visa Card',
                icon: 'V',
                balance: 1200,
                startingBalance: 1500,
                minPayment: 35,
                apr: 18.9,
                dueDate: '2026-07-15'
            }
        ],
        settings: {
            currency: '$',
            defaultType: 'expense',
            defaultPayment: '',
            defaultCategory: '',
            giftCards: []
        }
    };
}

test.describe('debt payment flow', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate((budget) => {
            sessionStorage.setItem('zam_demo_active', 'true');
            window.currentUser = { id: 'debt-payment-test-user' };
            window.replaceSnapshot?.(budget, { remoteUpdatedAt: '2026-06-20T12:00:00.000Z' });
            window.switchTab?.('debt');
            window.renderDebtTab?.();
        }, makeDebtPaymentBudget());
    });

    test('Debt tab Log Payment opens Add Transaction prefilled and saves without console errors', async ({ page }) => {
        const consoleErrors = collectConsoleMessages(page, text => (
            /Cannot set properties of null|TypeError|ReferenceError/i.test(text)
        ));

        await page.locator('#debtBreakdown .debt-card-action', { hasText: 'Log Payment' }).click();

        await expect(page.locator('#tab-add')).toHaveClass(/active/);
        await expect(page.locator('#txAmount')).toHaveValue('35.00');
        await expect(page.locator('#txDescription')).toHaveValue('Payment: Visa Card');
        await expect(page.locator('#txCategory')).toHaveValue('Visa Card');
        await expect(page.locator('#addTxCategoryContainer .cat-pill-v2.active')).toContainText('Visa Card');
        await expect(page.locator('#addTxStatus')).toHaveText('Debt payment ready for Visa Card.');

        await page.evaluate(() => {
            window.currentUser = { id: 'debt-payment-test-user' };
            const button = document.getElementById('submitBtn');
            button?.classList.remove('is-signed-out-disabled');
            button?.removeAttribute('aria-disabled');
            button?.removeAttribute('data-budget-auth-gated');
            button?.removeAttribute('data-signed-out-disabled');
            if (button) button.disabled = false;
        });
        await page.locator('#submitBtn').click();

        await expect.poll(() => page.evaluate(() => {
            const tx = window.getSnapshot?.().transactions?.find(item => item.description === 'Payment: Visa Card');
            return tx ? {
                type: tx.type,
                tag: tx.tag,
                category: tx.category,
                amount: tx.amount
            } : null;
        })).toEqual({
            type: 'debt',
            tag: 'debt',
            category: 'Visa Card',
            amount: 35
        });

        await expect(page.locator('#tab-recent')).toHaveClass(/active/);
        expect(consoleErrors).toEqual([]);
    });
});
