const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function monthDate(offset = 0, day = 10) {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() + offset, day);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function makeCategoryDetailBudget() {
    return {
        transactions: [
            {
                id: 'dining-current-1',
                type: 'expense',
                description: 'Dinner this month',
                category: 'Dining Out',
                amount: 127.5,
                date: monthDate(0, 12),
                paymentMethod: 'card',
                notes: '',
                createdAt: `${monthDate(0, 12)}T12:00:00.000Z`
            },
            {
                id: 'dining-prior-1',
                type: 'expense',
                description: 'Prior month dinner',
                category: 'Dining Out',
                amount: 500,
                date: monthDate(-1, 12),
                paymentMethod: 'card',
                notes: '',
                createdAt: `${monthDate(-1, 12)}T12:00:00.000Z`
            }
        ],
        categories: [
            {
                id: 'expense-dining',
                type: 'expense',
                name: 'Dining Out',
                icon: 'D',
                budget: 100
            },
            {
                id: 'expense-utilities',
                type: 'expense',
                name: 'Utilities',
                icon: 'U',
                budget: 200
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
    };
}

function makeManyCategoryTransactionsBudget() {
    const transactions = [];
    for (let i = 1; i <= 12; i += 1) {
        transactions.push({
            id: `groceries-current-${i}`,
            type: 'expense',
            description: `Groceries trip ${i}`,
            category: 'Groceries',
            amount: 10 + i,
            date: monthDate(0, Math.min(27, i + 1)),
            paymentMethod: 'card',
            notes: '',
            createdAt: `${monthDate(0, Math.min(27, i + 1))}T12:00:00.000Z`
        });
    }
    for (let i = 1; i <= 4; i += 1) {
        transactions.push({
            id: `utilities-current-${i}`,
            type: 'expense',
            description: `Utilities bill ${i}`,
            category: 'Utilities',
            amount: 30 + i,
            date: monthDate(0, Math.min(27, i + 10)),
            paymentMethod: 'card',
            notes: '',
            createdAt: `${monthDate(0, Math.min(27, i + 10))}T12:00:00.000Z`
        });
    }
    transactions.push({
        id: 'groceries-prior-month',
        type: 'expense',
        description: 'Prior groceries',
        category: 'Groceries',
        amount: 999,
        date: monthDate(-1, 10),
        paymentMethod: 'card',
        notes: '',
        createdAt: `${monthDate(-1, 10)}T12:00:00.000Z`
    });

    return {
        transactions,
        categories: [
            {
                id: 'expense-groceries',
                type: 'expense',
                name: 'Groceries',
                icon: 'G',
                budget: 500
            },
            {
                id: 'expense-utilities',
                type: 'expense',
                name: 'Utilities',
                icon: 'U',
                budget: 200
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
    };
}

async function seedBudget(page, budget = makeCategoryDetailBudget()) {
    await page.evaluate((snapshot) => {
        window.currentUser = { id: 'category-detail-test-user' };
        window.replaceSnapshot?.(snapshot, { remoteUpdatedAt: new Date().toISOString() });
        window.render?.();
    }, budget);
}

async function openCategoryDetail(page, name = 'Dining Out', icon = 'D') {
    await page.evaluate(({ categoryName, categoryIcon }) => {
        window.openCategoryDrillDown?.(categoryName, categoryIcon);
    }, { categoryName: name, categoryIcon: icon });
    await expect(page.locator('#categoryDrillDownPanel')).toHaveClass(/active/);
}

test.describe('Category detail card', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedBudget(page);
    });

    test('shows current-month status, metrics, progress, and recent activity only', async ({ page }) => {
        await openCategoryDetail(page);

        await expect(page.locator('#drillDownTitle')).toHaveText('Dining Out');
        await expect(page.locator('#drillDownStatusLabel')).toHaveText('Over Budget');
        await expect(page.locator('#drillDownStatusMessage')).toContainText('Dining Out is over by $27.50 this month.');
        await expect(page.locator('#drillDownAssignedLabel')).toHaveText('Assigned');
        await expect(page.locator('#drillDownBudgetText')).toHaveText('$100.00');
        await expect(page.locator('#drillDownToggleLabel')).toHaveText('Spent');
        await expect(page.locator('#drillDownTotal')).toHaveText('$127.50');
        await expect(page.locator('#drillDownTotal')).toHaveAttribute('style', /--red/);
        await expect(page.locator('#drillDownRemainingLabel')).toHaveText('Over By');
        await expect(page.locator('#drillDownRemaining')).toHaveText('$27.50');
        await expect(page.locator('#drillDownRemaining')).toHaveAttribute('style', /--red/);
        await expect(page.locator('#drillDownProgressSummary')).toHaveCount(0);
        await expect(page.locator('#drillDownProgressTrack .income-progress-tick')).toHaveCount(9);
        await expect(page.locator('#drillDownProgressTrack .income-progress-tick-strong')).toHaveCount(1);
        await expect(page.locator('#drillDownStatusCard')).toHaveClass(/is-compact/);
        await expect(page.locator('#drillDownInsightCard')).toBeHidden();
        await expect(page.locator('#drillDownTxList')).toContainText('Dinner this month');
        await expect(page.locator('#drillDownTxList')).not.toContainText('Prior month dinner');
    });

    test('places status tile to the right of the remaining metric', async ({ page }) => {
        await openCategoryDetail(page);

        const layout = await page.evaluate(() => {
            const remaining = document.getElementById('drillDownRemaining')?.closest('.metric-group')?.getBoundingClientRect();
            const status = document.getElementById('drillDownStatusCard')?.getBoundingClientRect();
            return {
                remainingLeft: remaining?.left ?? 0,
                remainingTop: remaining?.top ?? 0,
                statusLeft: status?.left ?? 0,
                statusTop: status?.top ?? 0
            };
        });

        expect(layout.statusLeft).toBeGreaterThan(layout.remainingLeft);
        expect(Math.abs(layout.statusTop - layout.remainingTop)).toBeLessThan(8);
    });

    test('primary over-budget action focuses the assigned amount control', async ({ page }) => {
        await openCategoryDetail(page);

        await expect(page.locator('#drillDownPrimaryActionBtn')).toHaveText('Adjust Assigned');
        await page.locator('#drillDownPrimaryActionBtn').click();

        await expect(page.locator('#drillDownBudget')).toBeFocused();
    });

    test('action row view transactions routes to Recent with category search applied', async ({ page }) => {
        await openCategoryDetail(page);

        await expect(page.locator('#drillDownSecondaryActionBtn')).toHaveText('View Transactions');
        await page.locator('#drillDownSecondaryActionBtn').click();

        await expect(page.locator('#view-recent')).toHaveClass(/active/);
        await expect(page.locator('#txSearch')).toHaveValue('Dining Out');
        await expect(page.locator('#recentTxList')).toContainText('Dinner this month');
    });

    test('keeps fully used categories calm and avoids duplicate insight/actions', async ({ page }) => {
        const budget = makeCategoryDetailBudget();
        budget.transactions = [{
            id: 'rent-current-1',
            type: 'expense',
            description: 'Rent this month',
            category: 'Rent',
            amount: 1450,
            date: monthDate(0, 12),
            paymentMethod: 'bank',
            notes: '',
            createdAt: `${monthDate(0, 12)}T12:00:00.000Z`
        }];
        budget.categories = [{
            id: 'expense-rent',
            type: 'expense',
            name: 'Rent',
            icon: 'R',
            budget: 1450
        }];
        await seedBudget(page, budget);
        await openCategoryDetail(page, 'Rent', 'R');

        await expect(page.locator('#drillDownStatusLabel')).toHaveText('Fully Used');
        await expect(page.locator('#drillDownInsightCard')).toBeHidden();
        await expect(page.locator('#drillDownPrimaryActionBtn')).toHaveText('Adjust Assigned');
        await expect(page.locator('#drillDownPrimaryActionBtn')).not.toHaveClass(/btn-drill-primary/);
        await expect(page.locator('#drillDownSecondaryActionBtn')).toHaveText('View Transactions');
        await expect(page.locator('#drillDownSecondaryActionBtn')).toBeVisible();
        await expect(page.locator('#drillDownDeleteBtn')).toHaveClass(/btn-drill-danger/);
        await page.locator('#drillDownDeleteBtn').hover();
        await page.waitForTimeout(250);
        const deleteHoverStyle = await page.locator('#drillDownDeleteBtn').evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                hovered: el.matches(':hover'),
                backgroundColor: style.backgroundColor,
                color: style.color
            };
        });
        expect(deleteHoverStyle.hovered).toBe(true);
        expect(deleteHoverStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(deleteHoverStyle.backgroundColor).not.toBe('transparent');
        expect(deleteHoverStyle.color).toBe('rgb(255, 255, 255)');
        await expect(page.locator('#drillDownViewRecentBtn')).toHaveCount(0);
        await expect(page.locator('#drillDownLogExpenseBtn')).toBeVisible();

        const actionLayout = await page.evaluate(() => {
            const view = document.getElementById('drillDownSecondaryActionBtn')?.getBoundingClientRect();
            const del = document.getElementById('drillDownDeleteBtn')?.getBoundingClientRect();
            return {
                viewLeft: view?.left ?? 0,
                viewTop: view?.top ?? 0,
                deleteLeft: del?.left ?? 0,
                deleteTop: del?.top ?? 0
            };
        });
        expect(actionLayout.viewLeft).toBeLessThan(actionLayout.deleteLeft);
        expect(Math.abs(actionLayout.viewTop - actionLayout.deleteTop)).toBeLessThan(8);
    });

    test('keeps very large assigned and remaining amounts readable in the metric cards', async ({ page }) => {
        const budget = makeCategoryDetailBudget();
        budget.transactions = [{
            id: 'large-budget-current-1',
            type: 'expense',
            description: 'Large current spend',
            category: 'Dining Out',
            amount: 1450,
            date: monthDate(0, 12),
            paymentMethod: 'card',
            notes: '',
            createdAt: `${monthDate(0, 12)}T12:00:00.000Z`
        }];
        budget.categories[0].budget = 1000000000;
        await seedBudget(page, budget);
        await openCategoryDetail(page);

        await expect(page.locator('#drillDownBudgetText')).toHaveText('$1,000,000,000.00');
        await expect(page.locator('#drillDownBudgetText')).toHaveClass(/is-ultra-long-number/);
        await expect(page.locator('#drillDownRemaining')).toHaveText('$999,998,550.00');
        await expect(page.locator('#drillDownTotal')).toHaveAttribute('style', /--text/);
        await expect(page.locator('#drillDownRemaining')).toHaveAttribute('style', /--green/);

        const fitResults = await page.evaluate(() => {
            const ids = ['drillDownBudgetText', 'drillDownRemaining'];
            return ids.map(id => {
                const el = document.getElementById(id);
                return Boolean(el && el.scrollWidth <= el.clientWidth + 1);
            });
        });
        expect(fitResults).toEqual([true, true]);
    });

    test('slices slide-over recent activity after context filtering and resets by entity', async ({ page }) => {
        await seedBudget(page, makeManyCategoryTransactionsBudget());
        await openCategoryDetail(page, 'Groceries', 'G');

        await expect(page.locator('#drillDownRecentDisplaySize')).toHaveValue('5');
        await expect(page.locator('#drillDownTxList .drilldown-tx-card')).toHaveCount(5);
        await expect(page.locator('#drillDownTxList')).toContainText('Showing 5 of 12 related transactions');
        await expect(page.locator('#drillDownTxList')).toContainText('Load 5 more');
        await expect(page.locator('#drillDownTxList')).not.toContainText('Utilities bill');
        await expect(page.locator('#drillDownTxList')).not.toContainText('Prior groceries');

        await page.locator('.drill-down-load-more-btn').click();
        await expect(page.locator('#drillDownTxList .drilldown-tx-card')).toHaveCount(10);
        await expect(page.locator('#drillDownTxList')).toContainText('Showing 10 of 12 related transactions');
        await expect(page.locator('#drillDownTxList')).toContainText('Load 2 more');

        await page.locator('#drillDownRecentDisplaySize').selectOption('all');
        await expect(page.locator('#drillDownTxList .drilldown-tx-card')).toHaveCount(12);
        await expect(page.locator('#drillDownTxList')).toContainText('Showing 12 of 12 related transactions');
        await expect(page.locator('.drill-down-load-more-btn')).toHaveCount(0);

        await openCategoryDetail(page, 'Utilities', 'U');
        await expect(page.locator('#drillDownRecentDisplaySize')).toHaveValue('5');
        await expect(page.locator('#drillDownTxList .drilldown-tx-card')).toHaveCount(4);
        await expect(page.locator('#drillDownTxList')).toContainText('Showing 4 of 4 related transactions');
        await expect(page.locator('#drillDownTxList')).not.toContainText('Groceries trip');
    });
});
