const fs = require('fs/promises');
const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getExportTestDates() {
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), 5);
    const currentIncomeDate = new Date(now.getFullYear(), now.getMonth(), 6);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    return {
        currentDate: localDateKey(currentDate),
        currentIncomeDate: localDateKey(currentIncomeDate),
        lastMonthDate: localDateKey(lastMonthDate)
    };
}

async function seedExportHarness(page) {
    const dates = getExportTestDates();
    await page.evaluate((seedDates) => {
        window.currentUser = { id: 'csv-export-foundation-test-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'tx-coffee',
                    type: 'expense',
                    description: 'Coffee, "beans"',
                    category: 'Groceries',
                    amount: 12.5,
                    date: seedDates.currentDate,
                    paymentMethod: 'Checking',
                    notes: 'line\nbreak',
                    tag: 'expense',
                    createdAt: `${seedDates.currentDate}T12:00:00.000Z`
                },
                {
                    id: 'tx-payroll',
                    type: 'income',
                    description: 'Payroll',
                    category: 'Income',
                    amount: 2600,
                    date: seedDates.currentIncomeDate,
                    paymentMethod: 'bank',
                    notes: 'Main paycheck',
                    tag: 'income',
                    createdAt: `${seedDates.currentIncomeDate}T12:00:00.000Z`
                },
                {
                    id: 'tx-fuel',
                    type: 'expense',
                    description: 'Fuel',
                    category: 'Gas',
                    amount: 44.44,
                    date: seedDates.lastMonthDate,
                    paymentMethod: 'card',
                    notes: '',
                    tag: 'expense',
                    createdAt: `${seedDates.lastMonthDate}T12:00:00.000Z`
                },
                {
                    id: 'tx-deleted',
                    type: 'expense',
                    description: 'Deleted row',
                    category: 'Groceries',
                    amount: 99,
                    date: seedDates.currentDate,
                    paymentMethod: 'Checking',
                    notes: '',
                    tag: 'expense',
                    isDeleted: true,
                    createdAt: `${seedDates.currentDate}T12:00:00.000Z`
                }
            ],
            categories: [
                { id: 'cat-groceries', type: 'expense', name: 'Groceries', icon: 'G', budget: 500 },
                { id: 'cat-gas', type: 'expense', name: 'Gas', icon: 'F', budget: 200 },
                { id: 'cat-income', type: 'income', name: 'Income', icon: 'I', budget: 2600 }
            ],
            settings: {
                currency: '$',
                defaultType: 'expense',
                defaultPayment: '',
                defaultCategory: '',
                lastCategorySort: 'manual',
                giftCards: []
            }
        }, { remoteUpdatedAt: `${seedDates.currentDate}T12:00:00.000Z` });
        window.render?.();
    }, dates);
    return dates;
}

test.describe('CSV export foundation', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('exports filtered plain CSV and can import it back into Zam', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        const dates = await seedExportHarness(page);

        await page.evaluate(() => window.openCsvExportModal());
        await expect(page.locator('#csvExportModal')).toBeVisible();
        await expect(page.locator('#csvExportCount')).toHaveText('2 transactions will be exported');
        await expect(page.locator('#csvExportFileName')).toHaveValue(/zam-transactions-\d{4}-\d{2}-\d{2}\.csv/);
        await expect(page.locator('#csvExportConfirmBtn')).toBeEnabled();

        await page.locator('#csvExportDateRange').selectOption('all');
        await expect(page.locator('#csvExportCount')).toHaveText('3 transactions will be exported');

        await page.locator('#csvExportAccount').selectOption('Checking');
        await expect(page.locator('#csvExportCount')).toHaveText('1 transaction will be exported');

        await page.locator('#csvExportAccount').selectOption('');
        await page.locator('#csvExportCategory').selectOption('Gas');
        await expect(page.locator('#csvExportCount')).toHaveText('1 transaction will be exported');

        await page.locator('#csvExportCategory').selectOption('');
        await page.locator('#csvExportDateRange').selectOption('custom');
        await page.locator('#csvExportStartDate').fill(dates.lastMonthDate);
        await page.locator('#csvExportEndDate').fill(dates.lastMonthDate);
        await expect(page.locator('#csvExportCount')).toHaveText('1 transaction will be exported');

        await page.locator('#csvExportDateRange').selectOption('all');
        await page.locator('#csvExportFileName').fill('June Budget:/bad*name');

        const downloadPromise = page.waitForEvent('download');
        await page.locator('#csvExportConfirmBtn').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('June Budget--bad-name.csv');

        const downloadPath = await download.path();
        const csv = await fs.readFile(downloadPath, 'utf8');
        expect(csv.split(/\r?\n/)[0]).toBe('Date,Description,Amount,Category,Account,Notes');
        expect(csv).toContain(`${dates.currentDate},"Coffee, ""beans""",-12.50,Groceries,Checking,"line\nbreak"`);
        expect(csv).toContain(`${dates.currentIncomeDate},Payroll,2600.00,Income,bank,Main paycheck`);
        expect(csv).toContain(`${dates.lastMonthDate},Fuel,-44.44,Gas,card,`);
        expect(csv).not.toContain('Deleted row');
        expect(csv).not.toContain('$');
        expect(csv).not.toContain('1,234.56');

        await page.evaluate((csvText) => {
            window.replaceSnapshot({
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
            }, { remoteUpdatedAt: '2026-06-01T12:00:00.000Z' });
            const file = new File([csvText], 'zam-roundtrip.csv', { type: 'text/csv' });
            return window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
        }, csv);

        await expect(page.locator('#csvImportReviewModal')).toBeVisible();
        await expect(page.locator('#csvImportSummaryPrimary')).toHaveText('3 rows found');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('3 selected for import');
        await page.locator('#csvImportConfirmBtn').click();
        await expect(page.locator('#csvImportFeedbackModal')).toBeVisible();
        await page.locator('#csvImportFeedbackModal .modal-close').click();

        const roundTrip = await page.evaluate(() => window.getTransactions()
            .map(tx => ({
                description: tx.description,
                type: tx.type,
                amount: tx.amount,
                date: tx.date,
                category: tx.category,
                paymentMethod: tx.paymentMethod,
                notes: tx.notes
            }))
            .sort((a, b) => a.description.localeCompare(b.description)));

        expect(roundTrip).toEqual([
            {
                description: 'Coffee, "beans"',
                type: 'expense',
                amount: 12.5,
                date: dates.currentDate,
                category: 'Groceries',
                paymentMethod: 'Checking',
                notes: 'line\nbreak'
            },
            {
                description: 'Fuel',
                type: 'expense',
                amount: 44.44,
                date: dates.lastMonthDate,
                category: 'Gas',
                paymentMethod: 'card',
                notes: ''
            },
            {
                description: 'Payroll',
                type: 'income',
                amount: 2600,
                date: dates.currentIncomeDate,
                category: 'Income',
                paymentMethod: 'bank',
                notes: 'Main paycheck'
            }
        ]);
    });
});
