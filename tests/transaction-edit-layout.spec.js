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

    test('keeps Add More Details aligned and closes date picker before Pay With focus', async ({ page }) => {
        await page.setViewportSize({ width: 760, height: 900 });
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab('add'));

        await page.locator('#toggleDetailsBtn').click();
        await expect(page.locator('#txHiddenDetails')).toHaveClass(/open/);

        const desktopLayout = await page.evaluate(() => {
            const dateGroup = document.querySelector('#txHiddenDetails .add-date-group');
            const payGroup = document.getElementById('txPaymentMethod')?.closest('.add-form-group');
            const notesGroup = document.getElementById('txNotes')?.closest('.add-form-group');
            const dateRect = dateGroup?.getBoundingClientRect();
            const payRect = payGroup?.getBoundingClientRect();
            const notesRect = notesGroup?.getBoundingClientRect();
            return {
                dateBeforePay: Boolean(dateRect && payRect && dateRect.right <= payRect.left),
                controlsAligned: Boolean(dateRect && payRect && Math.abs(dateRect.top - payRect.top) <= 2),
                notesBelow: Boolean(dateRect && payRect && notesRect && notesRect.top > dateRect.bottom && notesRect.top > payRect.bottom),
                paymentNotClipped: Boolean(payGroup && payGroup.scrollWidth <= payGroup.clientWidth + 1)
            };
        });

        expect(desktopLayout.dateBeforePay).toBe(true);
        expect(desktopLayout.controlsAligned).toBe(true);
        expect(desktopLayout.notesBelow).toBe(true);
        expect(desktopLayout.paymentNotClipped).toBe(true);

        await page.locator('#txDateTrigger').click();
        await expect(page.locator('#addDatePicker')).toBeVisible();
        await page.locator('#txPaymentMethod').focus();
        await expect(page.locator('#addDatePicker')).toBeHidden();
    });

    test('keeps reset form tooltip aligned and unrotated', async ({ page }) => {
        await page.setViewportSize({ width: 760, height: 900 });
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab('add'));

        const resetButton = page.locator('.add-form-reset-btn');
        await expect(resetButton).toBeVisible();
        await expect(resetButton).toHaveAttribute('aria-label', 'Reset add transaction form');
        await expect(resetButton).toHaveAttribute('data-tooltip', 'Reset form');

        await resetButton.hover();

        const tooltipState = await resetButton.evaluate((button) => {
            const tooltip = window.getComputedStyle(button, '::after');
            const caret = window.getComputedStyle(button, '::before');
            const buttonStyle = window.getComputedStyle(button);
            const buttonRect = button.getBoundingClientRect();
            const tooltipTop = Number.parseFloat(tooltip.top);
            const caretTop = Number.parseFloat(caret.top);
            const matrix = buttonStyle.transform === 'none'
                ? [1, 0, 0, 1, 0, 0]
                : buttonStyle.transform.match(/-?[\d.]+/g)?.map(Number) || [];
            const hasRotation = matrix.length >= 4
                ? Math.abs(matrix[1]) > 0.01 || Math.abs(matrix[2]) > 0.01
                : false;

            return {
                tooltipText: button.getAttribute('data-tooltip'),
                tooltipOpensBelow: Number.isFinite(tooltipTop) && tooltipTop > buttonRect.height,
                caretOpensBelow: Number.isFinite(caretTop) && caretTop > buttonRect.height,
                buttonNotRotated: !hasRotation
            };
        });

        expect(tooltipState.tooltipText).toBe('Reset form');
        expect(tooltipState.tooltipOpensBelow).toBe(true);
        expect(tooltipState.caretOpensBelow).toBe(true);
        expect(tooltipState.buttonNotRotated).toBe(true);

        await resetButton.focus();
        await expect(resetButton).toBeFocused();
    });

    test('stacks Add More Details cleanly on narrow screens', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(() => window.switchTab('add'));

        await page.locator('#toggleDetailsBtn').click();
        await expect(page.locator('#txHiddenDetails')).toHaveClass(/open/);

        const mobileLayout = await page.evaluate(() => {
            const dateGroup = document.querySelector('#txHiddenDetails .add-date-group');
            const payGroup = document.getElementById('txPaymentMethod')?.closest('.add-form-group');
            const notesGroup = document.getElementById('txNotes')?.closest('.add-form-group');
            const dateRect = dateGroup?.getBoundingClientRect();
            const payRect = payGroup?.getBoundingClientRect();
            const notesRect = notesGroup?.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            return {
                dateAbovePay: Boolean(dateRect && payRect && dateRect.bottom <= payRect.top),
                payAboveNotes: Boolean(payRect && notesRect && payRect.bottom <= notesRect.top),
                dateInsideViewport: Boolean(dateRect && dateRect.left >= 0 && dateRect.right <= viewportWidth),
                payInsideViewport: Boolean(payRect && payRect.left >= 0 && payRect.right <= viewportWidth),
                notesInsideViewport: Boolean(notesRect && notesRect.left >= 0 && notesRect.right <= viewportWidth)
            };
        });

        expect(mobileLayout.dateAbovePay).toBe(true);
        expect(mobileLayout.payAboveNotes).toBe(true);
        expect(mobileLayout.dateInsideViewport).toBe(true);
        expect(mobileLayout.payInsideViewport).toBe(true);
        expect(mobileLayout.notesInsideViewport).toBe(true);
    });
});
