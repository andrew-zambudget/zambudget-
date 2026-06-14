const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function expectMoneyClose(actual, expected) {
    expect(Math.abs(Number(actual) - expected)).toBeLessThan(0.01);
}

test.describe('Gift card tracker', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('saves a gift card, subtracts an expense, and restores balance on undo', async ({ page }) => {
        const browserErrors = [];
        page.on('pageerror', error => browserErrors.push(error.message));

        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = { id: 'gift-card-tracker-test-user' };
            window.replaceSnapshot({
                transactions: [],
                categories: [
                    {
                        id: 'cat-gift-card-test',
                        type: 'expense',
                        name: 'Groceries',
                        icon: 'G',
                        budget: 100,
                        createdAt: '2026-06-13T12:00:00.000Z'
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
            }, { remoteUpdatedAt: '2026-06-13T12:00:00.000Z' });
            window.render?.();
            window.initAddTransactionForm?.();
        });

        await page.evaluate(() => window.switchTab?.('add'));
        await page.locator('#toggleDetailsBtn').click();
        await page.locator('#txPaymentMethod').selectOption('gift_card');
        await expect(page.locator('#giftCardTrackerPanel')).toBeVisible();
        await expect(page.locator('#giftCardAddForm')).toBeVisible();

        await page.locator('#giftCardName').fill('Coffee');
        await page.locator('#giftCardNumber').fill('GC-1234567890');
        await page.locator('#giftCardTotalAmount').fill('50.00');
        await page.locator('#giftCardCurrentBalance').fill('40.00');
        await page.locator('#giftCardExpirationDate').fill('2030-12-31');
        await page.locator('.gift-card-save-btn').click();
        await expect.poll(() => page.evaluate(() => window.getGiftCards?.().length)).toBe(1);

        const createdCard = await page.evaluate(() => window.getGiftCards()[0]);
        expectMoneyClose(createdCard.totalAmount, 50);
        expectMoneyClose(createdCard.currentBalance, 40);
        expect(createdCard.expirationDate).toBe('2030-12-31');

        await page.locator('#txAmount').fill('12.34');
        await page.locator('#txDescription').fill('Gift card smoke');
        await page.locator('.cat-pill-v2[data-cat="Groceries"]').click();
        await page.locator('.hero-save-btn').click();
        await expect.poll(() => page.evaluate(() => window.getTransactions?.().length)).toBe(1);

        const afterSave = await page.evaluate(() => ({
            card: window.getGiftCards()[0],
            tx: window.getTransactions()[0]
        }));
        expectMoneyClose(afterSave.card.currentBalance, 27.66);
        expect(afterSave.tx.paymentMethod).toBe('gift_card');
        expect(afterSave.tx.giftCardId).toBeTruthy();
        expectMoneyClose(afterSave.tx.giftCardBalanceBefore, 40);
        expectMoneyClose(afterSave.tx.giftCardBalanceAfter, 27.66);

        await page.evaluate(() => window.undoLastTransaction());
        await expect.poll(() => page.evaluate(() => window.getTransactions?.().length)).toBe(0);
        const afterUndo = await page.evaluate(() => window.getGiftCards()[0]);
        expectMoneyClose(afterUndo.currentBalance, 40);
        await expect(page.locator('#giftCardTrackerSummary')).toContainText('$40.00');

        expect(browserErrors).toEqual([]);
    });
});
