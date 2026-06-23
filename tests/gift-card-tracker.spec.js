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

        await expect(page.locator('#giftCardManagerSection')).toHaveClass(/is-collapsed/);
        await expect(page.locator('#giftCardManagerCount')).toHaveText('No gift cards yet');
        await expect(page.locator('#giftCardManagerToggleBtn')).toHaveText('Show');
        await expect(page.locator('.gift-card-manager-add')).toBeHidden();
        await expect(page.locator('#giftCardManagerList')).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.getSnapshot?.().settings?.showGiftCardManager)).toBe(false);

        await page.locator('#giftCardManagerToggleBtn').click();
        await expect(page.locator('#giftCardManagerSection')).not.toHaveClass(/is-collapsed/);
        await expect(page.locator('#giftCardManagerToggleBtn')).toHaveText('Hide');
        await expect(page.locator('.gift-card-manager-add')).toBeVisible();
        await expect(page.locator('#giftCardManagerList')).toBeVisible();
        await expect(page.locator('#giftCardManagerList')).toContainText('No gift cards yet. Add one here, then choose it as a Pay With option when logging an expense.');

        await page.evaluate(() => window.openGiftCardModal?.('create'));
        await expect(page.locator('#giftCardModal')).toBeVisible();
        await page.locator('#giftCardModalMerchant').fill('Coffee');
        await page.locator('#giftCardModalNickname').fill('Coffee card');
        await page.locator('#giftCardModalOriginalAmount').fill('50.00');
        await page.locator('#giftCardModalAmountLeft').click();
        await page.locator('#giftCardModalAmountLeft').fill('40.00');
        await expect(page.locator('#giftCardModalAmountLeft')).toHaveValue('40.00');
        await page.locator('#giftCardModalLastFour').fill('7890');
        await page.evaluate(() => {
            const expiration = document.getElementById('giftCardModalExpirationDate');
            if (expiration) expiration.value = '2030-12-31';
        });
        await page.locator('#giftCardModalSubmitBtn').click();
        await expect.poll(() => page.evaluate(() => window.getGiftCards?.().length)).toBe(1);
        await expect(page.locator('#giftCardModalSuccess')).toBeVisible();

        const createdCard = await page.evaluate(() => window.getGiftCards()[0]);
        expectMoneyClose(createdCard.originalAmount, 50);
        expectMoneyClose(createdCard.amountLeft, 40);
        expect(createdCard.expirationDate).toBe('2030-12-31');

        await page.locator('#giftCardModalSuccess .btn-create', { hasText: 'Use for an Expense' }).click();
        await expect(page.locator('#giftCardModal')).toBeHidden();
        await expect(page.locator('#giftCardTrackerPanel')).toBeVisible();
        await page.locator('#txAmount').fill('12.34');
        await page.locator('#txDescription').fill('Gift card smoke');
        await page.locator('.cat-pill-v2[data-cat="Groceries"]').click();
        await page.locator('.hero-save-btn').click();
        await expect.poll(() => page.evaluate(() => window.getTransactions?.().length)).toBe(1);

        const afterSave = await page.evaluate(() => ({
            card: window.getGiftCards()[0],
            tx: window.getTransactions()[0]
        }));
        expectMoneyClose(afterSave.card.amountLeft, 27.66);
        expect(afterSave.tx.paymentMethod).toBe('gift_card');
        expect(afterSave.tx.giftCardId).toBeTruthy();
        expectMoneyClose(afterSave.tx.giftCardBalanceBefore, 40);
        expectMoneyClose(afterSave.tx.giftCardBalanceAfter, 27.66);

        await page.evaluate(() => window.undoLastTransaction());
        await expect.poll(() => page.evaluate(() => window.getTransactions?.().length)).toBe(0);
        const afterUndo = await page.evaluate(() => window.getGiftCards()[0]);
        expectMoneyClose(afterUndo.amountLeft, 40);
        await expect(page.locator('#giftCardTrackerSummary')).toContainText('$40.00');

        await page.evaluate((cardId) => window.openGiftCardModal?.('edit', cardId), createdCard.id);
        await expect(page.locator('#giftCardModal')).toBeVisible();
        await page.locator('#giftCardModalNickname').fill('Coffee backup');
        await page.locator('#giftCardModalAmountLeft').click();
        await page.locator('#giftCardModalAmountLeft').fill('35.00');
        await expect(page.locator('#giftCardModalAmountLeft')).toHaveValue('35.00');
        await page.locator('#giftCardModalSubmitBtn').click();
        await expect(page.locator('#giftCardModal')).toBeHidden();
        const afterEdit = await page.evaluate(() => window.getGiftCards()[0]);
        expect(afterEdit.nickname).toBe('Coffee backup');
        expectMoneyClose(afterEdit.amountLeft, 35);

        await page.evaluate(() => {
            window.switchTab?.('add');
            window.toggleGiftCardManagerVisibility?.();
        });
        await expect(page.locator('#giftCardManagerList')).toBeHidden();
        await expect.poll(() => page.evaluate(() => {
            return window.getSnapshot?.().settings?.showGiftCardManager;
        })).toBe(false);

        expect(browserErrors).toEqual([]);
    });
});
