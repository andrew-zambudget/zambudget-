const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function currentMonthDate(day = 10) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function makeBudget({ income = 0, assigned = 0 } = {}) {
    const transactions = income > 0
        ? [{
            id: `income-${income}`,
            type: 'income',
            description: 'Current month income',
            category: 'Paycheck',
            amount: income,
            date: currentMonthDate(5),
            paymentMethod: 'bank',
            notes: '',
            createdAt: `${currentMonthDate(5)}T12:00:00.000Z`
        }]
        : [];

    return {
        transactions,
        categories: [
            {
                id: 'income-paycheck',
                type: 'income',
                name: 'Paycheck',
                icon: 'P',
                budget: income
            },
            {
                id: 'expense-plan',
                type: 'expense',
                name: 'Monthly Plan',
                icon: 'M',
                budget: assigned
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

async function seedMonthPlan(page, budget) {
    await page.evaluate((snapshot) => {
        window.currentUser = { id: 'month-plan-test-user' };
        window.replaceSnapshot?.(snapshot, { remoteUpdatedAt: new Date().toISOString() });
        window.render?.();
        window.renderZBBDashboard?.();
    }, budget);
}

test.describe('This Month Plan summary', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await page.goto('/index.html');
        await waitForAppReady(page);
    });

    test('shows overassigned state with global amount reveal', async ({ page }) => {
        await seedMonthPlan(page, makeBudget({ income: 2000, assigned: 3715 }));

        await expect(page.locator('#zbbSummaryCard')).toContainText("This Month's Plan");
        await expect(page.locator('#zbbStatusTitle')).toHaveText('Overassigned by $1,715.00');
        await expect(page.locator('#zbbStatusText')).toContainText('You assigned more than this month');
        await expect(page.locator('#zbbPrimaryAction')).toHaveText('Fix Budget');
        await expect(page.locator('#zbbSecondaryAction')).toHaveText('Add Income');
        await expect(page.locator('#zbbTBBLabel')).toHaveText('Overassigned');
        await expect(page.locator('#zbbSummaryCard .reveal-tooltip')).toHaveCount(0);

        await expect(page.locator('#zbbSummaryCard .money-container.revealed')).toHaveCount(0);
        await page.locator('#zbbAmountRevealToggle').click();
        await expect(page.locator('#zbbAmountRevealToggle')).toHaveText('Hide amounts');
        await expect(page.locator('#zbbSummaryCard .money-container.revealed')).toHaveCount(3);
        await expect(page.locator('#zbbTBB')).toHaveText('$1,715.00');
        await page.locator('#zbbAmountRevealToggle').click();
        await expect(page.locator('#zbbAmountRevealToggle')).toHaveText('Show amounts');
        await expect(page.locator('#zbbSummaryCard .money-container.revealed')).toHaveCount(0);
    });

    test('shows left to assign state', async ({ page }) => {
        await seedMonthPlan(page, makeBudget({ income: 2000, assigned: 1755 }));

        await expect(page.locator('#zbbStatusTitle')).toHaveText('$245.00 left to assign');
        await expect(page.locator('#zbbPrimaryAction')).toHaveText('Assign Money');
        await expect(page.locator('#zbbSecondaryAction')).toBeHidden();
        await expect(page.locator('#zbbTBBLabel')).toHaveText('Left to Assign');
    });

    test('Assign Money opens category attention choices instead of a generic page jump', async ({ page }) => {
        const budget = makeBudget({ income: 2000, assigned: 100 });
        budget.categories = [
            budget.categories[0],
            {
                id: 'expense-dining',
                type: 'expense',
                name: 'Dining Out',
                icon: 'D',
                budget: 50
            },
            {
                id: 'expense-groceries',
                type: 'expense',
                name: 'Groceries',
                icon: 'G',
                budget: 0
            },
            {
                id: 'expense-plan',
                type: 'expense',
                name: 'Monthly Plan',
                icon: 'M',
                budget: 50
            }
        ];
        budget.transactions.push(
            {
                id: 'expense-dining-1',
                type: 'expense',
                description: 'Dinner',
                category: 'Dining Out',
                amount: 75,
                date: currentMonthDate(7),
                paymentMethod: 'card',
                notes: '',
                createdAt: `${currentMonthDate(7)}T12:00:00.000Z`
            },
            {
                id: 'expense-groceries-1',
                type: 'expense',
                description: 'Groceries',
                category: 'Groceries',
                amount: 30,
                date: currentMonthDate(8),
                paymentMethod: 'card',
                notes: '',
                createdAt: `${currentMonthDate(8)}T12:00:00.000Z`
            }
        );

        await seedMonthPlan(page, budget);
        await page.locator('#zbbPrimaryAction').click();

        const panel = page.locator('#categoryNeedsAttentionPanel');
        await expect(panel).toBeVisible();
        await expect(panel.locator('#categoryNeedsAttentionTitle')).toHaveText('Assign Money');
        await expect(panel.locator('.category-attention-item')).toHaveCount(2);
        await expect(panel).toContainText('Dining Out');
        await expect(panel).toContainText('Over by $25.00');
        await expect(panel).toContainText('Groceries');
        await expect(panel).toContainText('1 transaction with no assigned budget');

        await panel.locator('.category-attention-item', { hasText: 'Dining Out' }).click();
        await expect(page.locator('#categoryDrillDownPanel')).toHaveClass(/active/);
        await expect(page.locator('#drillDownTitle')).toHaveText('Dining Out');
        await expect(page.locator('#drillDownBudget')).toBeFocused();
    });

    test('shows ready state when fully assigned', async ({ page }) => {
        await seedMonthPlan(page, makeBudget({ income: 2000, assigned: 2000 }));

        await expect(page.locator('#zbbStatusTitle')).toHaveText('Ready to Track');
        await expect(page.locator('#zbbStatusText')).toContainText('Every dollar assigned fits within your income');
        await expect(page.locator('#zbbPrimaryAction')).toHaveText('Review Budget');
        await expect(page.locator('#zbbSecondaryAction')).toBeHidden();
        await expect(page.locator('#zbbTBBLabel')).toHaveText('Fully Assigned');
    });

    test('shows no-income state before income exists', async ({ page }) => {
        await seedMonthPlan(page, makeBudget({ income: 0, assigned: 500 }));

        await expect(page.locator('#zbbStatusTitle')).toHaveText('Add income to start');
        await expect(page.locator('#zbbStatusText')).toContainText('Record income before assigning money');
        await expect(page.locator('#zbbPrimaryAction')).toHaveText('Add Income');
        await expect(page.locator('#zbbSecondaryAction')).toBeHidden();

        await page.locator('#zbbPrimaryAction').click();
        await expect(page.locator('#tab-add')).toHaveClass(/active/);
        await expect(page.locator('#view-add')).toHaveClass(/active/);
        await expect(page.locator('#btnIncome')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#heroAmountContainer')).toHaveClass(/add-income-cta-highlight/);
        await expect(page.locator('#txAmount')).toBeFocused();
    });
});
