const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function makeTransaction(index, type = 'expense') {
    const padded = String(index).padStart(2, '0');
    const isIncome = type === 'income';
    return {
        id: `${type}-${padded}`,
        type,
        description: `${isIncome ? 'Income' : 'Expense'} Transaction ${padded}`,
        category: isIncome ? 'Paycheck' : `Category ${((index - 1) % 14) + 1}`,
        amount: isIncome ? 1000 + index : 10 + index,
        date: `2026-06-${String(Math.min(index, 28)).padStart(2, '0')}`,
        paymentMethod: isIncome ? 'bank' : 'card',
        notes: '',
        createdAt: `2026-06-${String(Math.min(index, 28)).padStart(2, '0')}T12:00:00.000Z`
    };
}

function makeCategory(index) {
    return {
        id: `cat-${index}`,
        type: 'expense',
        name: `Category ${index}`,
        icon: 'C',
        budget: 100 + index,
        customOrder: index,
        createdAt: `2026-05-${String(Math.min(index, 28)).padStart(2, '0')}T12:00:00.000Z`
    };
}

function makeIncomeSource(index) {
    return {
        id: `income-source-${index}`,
        type: 'income',
        name: `Income Source ${index}`,
        icon: 'I',
        budget: 1000 + index,
        customOrder: index,
        createdAt: `2026-05-${String(Math.min(index, 28)).padStart(2, '0')}T12:00:00.000Z`
    };
}

function makeSavingsGoal(index) {
    return {
        id: `savings-goal-${index}`,
        type: 'savings',
        name: `Savings Goal ${index}`,
        icon: 'S',
        budget: 500 + index,
        customOrder: index,
        createdAt: `2026-05-${String(Math.min(index, 28)).padStart(2, '0')}T12:00:00.000Z`
    };
}

function makeDebtAccount(index) {
    return {
        id: `debt-account-${index}`,
        type: 'debt',
        name: `Debt Account ${index}`,
        icon: 'D',
        balance: 1000 + (index * 100),
        startingBalance: 1200 + (index * 100),
        minPayment: 25 + index,
        apr: 12.5,
        dueDate: `2026-07-${String(Math.min(index, 28)).padStart(2, '0')}`,
        customOrder: index,
        createdAt: `2026-05-${String(Math.min(index, 28)).padStart(2, '0')}T12:00:00.000Z`
    };
}

function makeSeedBudget() {
    const expenses = Array.from({ length: 18 }, (_, index) => makeTransaction(index + 1, 'expense'));
    const income = Array.from({ length: 10 }, (_, index) => makeTransaction(index + 19, 'income'));
    return {
        transactions: [...expenses, ...income],
        categories: [
            ...Array.from({ length: 14 }, (_, index) => makeCategory(index + 1)),
            ...Array.from({ length: 12 }, (_, index) => makeIncomeSource(index + 1)),
            ...Array.from({ length: 11 }, (_, index) => makeSavingsGoal(index + 1)),
            ...Array.from({ length: 9 }, (_, index) => makeDebtAccount(index + 1))
        ],
        settings: {
            currency: '$',
            defaultType: 'expense',
            defaultPayment: '',
            defaultCategory: '',
            lastCategorySort: 'manual',
            giftCards: []
        }
    };
}

async function seedListDensityHarness(page) {
    await page.evaluate((budget) => {
        window.currentUser = { id: 'list-density-test-user' };
        window.replaceSnapshot?.(budget, { remoteUpdatedAt: '2026-06-20T12:00:00.000Z' });
        window.render?.();
    }, makeSeedBudget());
}

test.describe('list density cleanup', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedListDensityHarness(page);
    });

    test('Recent defaults to five rows and expands without changing filtered selection rules', async ({ page }) => {
        await page.evaluate(() => {
            window.switchTab?.('recent');
            window.renderRecentTransactions?.();
        });

        await expect(page.locator('#recentTxList .recent-tx-card')).toHaveCount(5);
        await expect(page.locator('#recentDensityControls .list-density-count')).toContainText('Showing 5 of 28 transactions');

        await page.locator('#recentDensityControls .list-density-load-more').click();
        await expect(page.locator('#recentTxList .recent-tx-card')).toHaveCount(10);
        await expect(page.locator('#recentDensityControls .list-density-count')).toContainText('Showing 10 of 28 transactions');

        await page.locator('#recentDensityControls .list-density-option', { hasText: /^All$/ }).click();
        await expect(page.locator('#recentTxList .recent-tx-card')).toHaveCount(28);
        await expect(page.locator('#recentDensityControls .list-density-count')).toContainText('Showing all 28 transactions');

        await page.locator('#recentDensityControls .list-density-option', { hasText: /^5$/ }).click();
        await page.locator('#recentBulkToggleBtn').click();
        await page.locator('#recentBulkSelectBtn').click();
        await expect.poll(() => page.evaluate(() => window.selectedTxIds?.size || 0)).toBe(5);

        await page.locator('#recentBulkSelectBtn').click();
        await expect.poll(() => page.evaluate(() => window.selectedTxIds?.size || 0)).toBe(0);

        await page.locator('#view-recent .tag-pill[data-filter="expense"]').click();
        await expect(page.locator('#recentTxList .recent-tx-card')).toHaveCount(5);
        await expect(page.locator('#recentDensityControls .list-density-count')).toContainText('Showing 5 of 18 matching transactions');
        await expect(page.locator('#recentBulkSelectFilteredBtn')).toBeVisible();

        await page.locator('#recentBulkSelectFilteredBtn').click();
        await expect.poll(() => page.evaluate(() => window.selectedTxIds?.size || 0)).toBe(18);
    });

    test('Manage Categories defaults to five rows and shows all rows in edit mode', async ({ page }) => {
        await expect(page.locator('#categoryList .category-item')).toHaveCount(5);
        await expect(page.locator('#categoryDensityControls .list-density-count')).toContainText('Showing 5 of 14 categories');
        await expect(page.locator('#categoryDensityControls .list-density-load-more')).toHaveCount(0);
        await expect(page.locator('#categoryList .category-density-load-more')).toBeVisible();

        await page.locator('#categoryList .category-density-load-more').click();
        await expect(page.locator('#categoryList .category-item')).toHaveCount(10);
        await expect(page.locator('#categoryDensityControls .list-density-count')).toContainText('Showing 10 of 14 categories');
        await expect(page.locator('#categoryList .category-density-load-more')).toBeVisible();

        await page.locator('#categoryDensityControls .list-density-option', { hasText: /^5$/ }).click();
        await page.locator('#categorySortSelect').selectOption('alpha_desc');
        await expect(page.locator('#categoryList .category-item')).toHaveCount(5);
        await expect(page.locator('#categoryDensityControls .list-density-count')).toContainText('Showing 5 of 14 categories');
        await expect(page.locator('#categoryList .category-density-load-more')).toBeVisible();

        await page.locator('#categoryList .btn-edit-mode', { hasText: 'Edit' }).click();
        await expect(page.locator('#categoryList .category-item')).toHaveCount(14);
        await expect(page.locator('#categoryDensityControls .list-density-count')).toContainText('Showing all 14 categories for editing');
        await expect(page.locator('#categoryDensityControls .list-density-option')).toHaveCount(0);
        await expect(page.locator('#categoryList .category-density-load-more')).toHaveCount(0);

        const toolbar = page.locator('#categoryList .category-edit-toolbar');
        await expect(toolbar).toBeVisible();
        await expect(toolbar.locator('.category-edit-count')).toHaveText('No categories selected');
        await expect(toolbar.locator('.category-edit-hint')).toContainText('Select categories to edit icons or delete.');
        await expect(toolbar.locator('.category-edit-action-icon')).toBeDisabled();
        await expect(toolbar.locator('.category-edit-action-delete')).toBeDisabled();
        await expect(toolbar).toHaveCSS('user-select', 'none');

        const panelWidth = await toolbar.locator('.category-edit-panel').evaluate((node) => node.getBoundingClientRect().width);
        const doneWidth = await toolbar.locator('.category-edit-done').evaluate((node) => node.getBoundingClientRect().width);
        expect(doneWidth).toBeLessThan(panelWidth * 0.75);

        await page.locator('#categoryList .bulk-select-cb').first().check();
        await expect(toolbar.locator('.category-edit-count')).toHaveText('1 category selected');
        await expect(toolbar.locator('.category-edit-action-icon')).toBeEnabled();
        await expect(toolbar.locator('.category-edit-action-delete')).toBeEnabled();
        await expect(toolbar.locator('.category-edit-action-delete')).toHaveClass(/is-active/);

        const firstRow = page.locator('#categoryList .category-item').first();
        await expect(firstRow).toHaveCSS('border-style', 'solid');
        await expect(firstRow).toHaveAttribute('data-category-name', 'Category 1');
        await expect(firstRow.locator('.category-drag-handle')).toBeVisible();
        await expect(firstRow.locator('.category-position-input')).toHaveValue('1');

        const handleWidth = await firstRow.locator('.category-drag-handle').evaluate((node) => node.getBoundingClientRect().width);
        expect(handleWidth).toBeLessThan(48);
        const positionWidth = await firstRow.locator('.category-position-input').evaluate((node) => node.getBoundingClientRect().width);
        expect(positionWidth).toBeGreaterThanOrEqual(38);

        await page.locator('#categoryList .category-item[data-category-name="Category 1"] .category-reorder-btn[aria-label="Move Category 1 down"]').click();
        await expect(page.locator('#categoryList .category-item').nth(0)).toHaveAttribute('data-category-name', 'Category 2');
        await expect(page.locator('#categoryList .category-item').nth(1)).toHaveAttribute('data-category-name', 'Category 1');
        await expect(page.locator('#categoryList .category-item[data-category-name="Category 1"] .category-reorder-feedback')).toContainText('Moved to position 2');
        await expect(page.locator('#categoryReorderLiveRegion')).toContainText('Moved Category 1 to position 2');

        const categoryOnePosition = page.locator('#categoryList .category-item[data-category-name="Category 1"] .category-position-input');
        await categoryOnePosition.click();
        await categoryOnePosition.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await categoryOnePosition.pressSequentially('4');
        await categoryOnePosition.press('Enter');
        await expect(page.locator('#categoryList .category-item').nth(3)).toHaveAttribute('data-category-name', 'Category 1');
        await expect(page.locator('#categoryList .category-item[data-category-name="Category 1"] .category-reorder-feedback')).toContainText('Moved to position 4');
        await expect(page.locator('#categoryReorderLiveRegion')).toContainText('Moved Category 1 to position 4');

        const persistedOrder = await page.evaluate(() =>
            window.getCategoriesForSort?.('manual')
                ?.filter((cat) => cat.type === 'expense')
                ?.slice(0, 4)
                ?.map((cat) => cat.name)
        );
        expect(persistedOrder).toEqual(['Category 2', 'Category 3', 'Category 4', 'Category 1']);
    });

    test('Categories empty state animates only the icon and respects reduced motion', async ({ page }) => {
        await page.evaluate(() => {
            window.replaceSnapshot?.({
                transactions: [],
                categories: [],
                settings: {
                    currency: '$',
                    defaultType: 'expense',
                    defaultPayment: '',
                    defaultCategory: '',
                    lastCategorySort: 'manual',
                    giftCards: []
                }
            }, { remoteUpdatedAt: '2026-06-20T12:00:00.000Z' });
            window.switchTab?.('add');
            window.renderCategoryList?.();
        });

        const emptyState = page.locator('#categoryList .empty-state-container');
        const icon = emptyState.locator('.category-empty-state-icon');
        await expect(emptyState).toContainText('No categories yet. Create one or use Quick Add to get started.');
        await expect(icon).toBeVisible();
        await expect(icon).toHaveClass(/empty-state-animated-icon/);
        await expect(icon).toHaveCSS('animation-name', 'floatEmptyState');

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(icon).toHaveCSS('animation-name', 'none');
    });

    test('category drilldown inline title editor accepts spaces', async ({ page }) => {
        await page.evaluate(() => window.openCategoryDrillDown?.('Category 1', 'C'));
        await expect(page.locator('#categoryDrillDownPanel')).toHaveClass(/active/);

        await page.locator('#drillDownTitle').click();
        const titleInput = page.locator('#drillDownTitle input.drill-down-title-input');
        await expect(titleInput).toBeFocused();

        await titleInput.fill('');
        await titleInput.pressSequentially('Home Insurance');
        await expect(titleInput).toHaveValue('Home Insurance');
    });

    test('Income, Savings, and Debt use the shared list density controls', async ({ page }) => {
        await page.evaluate(() => {
            window.switchTab?.('income');
            window.renderIncomeTab?.();
        });
        await expect(page.locator('#incomeBreakdown > .category-item')).toHaveCount(5);
        await expect(page.locator('#incomeDensityControls .list-density-count')).toContainText('Showing 5 of 12 income sources');
        await page.locator('#incomeDensityControls .list-density-load-more').click();
        await expect(page.locator('#incomeBreakdown > .category-item')).toHaveCount(10);
        await expect(page.locator('#incomeDensityControls .list-density-count')).toContainText('Showing 10 of 12 income sources');
        await page.locator('#incomeDensityControls .list-density-option', { hasText: /^All$/ }).click();
        await expect(page.locator('#incomeBreakdown > .category-item')).toHaveCount(12);
        await expect(page.locator('#incomeDensityControls .list-density-count')).toContainText('Showing all 12 income sources');

        await page.evaluate(() => {
            window.switchTab?.('savings');
            window.renderSavingsTab?.();
        });
        await expect(page.locator('#savingsBucketsGrid .savings-goal-card:not(.emergency-fund-auto-card)')).toHaveCount(5);
        await expect(page.locator('#savingsDensityControls .list-density-count')).toContainText('Showing 5 of 11 savings goals');
        await page.locator('#savingsDensityControls .list-density-load-more').click();
        await expect(page.locator('#savingsBucketsGrid .savings-goal-card:not(.emergency-fund-auto-card)')).toHaveCount(10);
        await expect(page.locator('#savingsDensityControls .list-density-count')).toContainText('Showing 10 of 11 savings goals');
        await page.locator('#savingsDensityControls .list-density-option', { hasText: /^All$/ }).click();
        await expect(page.locator('#savingsBucketsGrid .savings-goal-card:not(.emergency-fund-auto-card)')).toHaveCount(11);
        await expect(page.locator('#savingsDensityControls .list-density-count')).toContainText('Showing all 11 savings goals');

        await page.evaluate(() => {
            window.switchTab?.('debt');
            window.renderDebtTab?.();
        });
        await expect(page.locator('#debtBreakdown .debt-card-list .debt-card')).toHaveCount(5);
        await expect(page.locator('#debtDensityControls .list-density-count')).toContainText('Showing 5 of 9 debt accounts');
        await page.locator('#debtDensityControls .list-density-load-more').click();
        await expect(page.locator('#debtBreakdown .debt-card-list .debt-card')).toHaveCount(9);
        await expect(page.locator('#debtDensityControls .list-density-count')).toContainText('Showing all 9 debt accounts');
    });
});
