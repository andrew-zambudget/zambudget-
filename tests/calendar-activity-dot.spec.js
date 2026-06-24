const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function makeTransaction({ id, date, type, amount, paymentMethod = 'card', giftCardId = '', tag = '', signedAmount = undefined }) {
    return {
        id,
        type,
        tag,
        description: id,
        category: type === 'income' ? 'Paycheck' : 'Groceries',
        amount,
        ...(signedAmount !== undefined ? { signedAmount } : {}),
        date,
        paymentMethod,
        giftCardId,
        notes: '',
        createdAt: `${date}T12:00:00.000Z`
    };
}

function makeCalendarBudget() {
    return {
        transactions: [
            makeTransaction({
                id: 'positive-income-day',
                date: '2026-06-10',
                type: 'income',
                amount: 2600,
                paymentMethod: 'bank'
            }),
            makeTransaction({
                id: 'tagged-income-day',
                date: '2026-06-11',
                type: 'expense',
                tag: 'income',
                amount: 800,
                signedAmount: 800,
                paymentMethod: 'bank'
            }),
            makeTransaction({
                id: 'expense-day',
                date: '2026-06-12',
                type: 'expense',
                amount: 1450
            }),
            makeTransaction({
                id: 'gift-card-day',
                date: '2026-06-14',
                type: 'expense',
                amount: 25,
                paymentMethod: 'gift_card',
                giftCardId: 'gift-card-1'
            })
        ],
        categories: [
            {
                id: 'income-paycheck',
                type: 'income',
                name: 'Paycheck',
                icon: 'P',
                budget: 2600
            },
            {
                id: 'expense-groceries',
                type: 'expense',
                name: 'Groceries',
                icon: 'G',
                budget: 500
            }
        ],
        settings: {
            currency: '$',
            defaultType: 'expense',
            defaultPayment: '',
            defaultCategory: '',
            giftCards: [
                {
                    id: 'gift-card-1',
                    merchantName: 'Target',
                    displayName: 'Target',
                    amountLeft: 25,
                    originalAmount: 50
                }
            ]
        }
    };
}

test.describe('calendar activity dots', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate((budget) => {
            window.currentUser = { id: 'calendar-dot-test-user' };
            window.replaceSnapshot?.(budget, { remoteUpdatedAt: '2026-06-20T12:00:00.000Z' });
            window.switchTab?.('calendar');
        }, makeCalendarBudget());
    });

    test('uses green, red, and blue activity dot classes by transaction type', async ({ page }) => {
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-10"]')).toHaveClass(/calendar-activity-positive/);
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-11"]')).toHaveClass(/calendar-activity-positive/);
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-12"]')).toHaveClass(/calendar-activity-expense/);
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-14"]')).toHaveClass(/calendar-activity-gift-card/);
    });

    test('calendar ignores stale Recent filters and still includes income in month totals', async ({ page }) => {
        await page.evaluate(() => {
            window.switchTab?.('recent');
            window.currentTxFilter = 'expense';
            const search = document.getElementById('txSearch');
            if (search) search.value = 'expense-day';
            window.renderRecentTransactions?.();
            window.switchTab?.('calendar');
        });

        await expect(page.locator('#calendarScope')).toHaveText('All transactions');
        await expect(page.locator('#calendarMonthIncome')).toHaveText('$3,400.00');
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-10"]')).toHaveClass(/calendar-activity-positive/);
        await expect(page.locator('.calendar-day[data-calendar-date="2026-06-11"]')).toHaveClass(/calendar-activity-positive/);

        await page.locator('.calendar-day[data-calendar-date="2026-06-11"]').click();
        await expect(page.locator('#calendarSelectedMeta')).toContainText('1 transaction - net +$800.00');
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx-kind')).toContainText('Income');
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx-amount')).toContainText('+$800.00');
    });

    test('category calendar button toggles back to the previous tab', async ({ page }) => {
        await page.evaluate(() => window.switchTab?.('add'));
        await page.locator('#categoryCalendarMonthBtn').click();
        await expect(page.locator('#tab-calendar')).toHaveClass(/active/);
        await page.locator('#categoryCalendarMonthBtn').click();
        await expect(page.locator('#tab-add')).toHaveClass(/active/);

        await page.evaluate(() => window.switchTab?.('income'));
        await page.locator('#categoryCalendarMonthBtn').click();
        await expect(page.locator('#tab-calendar')).toHaveClass(/active/);
        await page.locator('#categoryCalendarMonthBtn').click();
        await expect(page.locator('#tab-income')).toHaveClass(/active/);
    });

    test('selected calendar day shows a compact transaction detail list', async ({ page }) => {
        await page.locator('.calendar-day[data-calendar-date="2026-06-10"]').click();

        await expect(page.locator('#calendarSelectedPanel')).toBeVisible();
        await expect(page.locator('#calendarSelectedTitle')).toContainText('Wed, Jun 10, 2026');
        await expect(page.locator('#calendarSelectedMeta')).toContainText('1 transaction - net +$2,600.00');
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx')).toHaveCount(1);
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx-description')).toContainText('positive-income-day');
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx-kind')).toContainText('Income');
        await expect(page.locator('#calendarSelectedList .calendar-selected-tx-amount')).toContainText('+$2,600.00');
    });

    test('selected day View Recent action keeps a normal tablet button shape', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 900 });
        await page.locator('.calendar-day[data-calendar-date="2026-06-10"]').click();

        const action = page.locator('.calendar-selected-action');
        await expect(action).toBeVisible();
        await expect(action).toHaveText('View Recent');

        const box = await action.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(100);
        expect(box.height).toBeLessThanOrEqual(52);
    });
});
