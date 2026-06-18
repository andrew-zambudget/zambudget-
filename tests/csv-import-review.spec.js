const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const IMPORT_CSV = [
    'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
    '2026-06-01,Fresh Ready,12.50,,Groceries,Checking,ready row',
    '2026-06-02,,5.00,,Groceries,Checking,missing description',
    '2026-06-03,Existing Coffee,3.25,,Groceries,Checking,duplicate row',
    '2026-06-04,Bad Amount,abc,,Groceries,Checking,bad amount'
].join('\n');

const IMPOSSIBLE_DATE_CSV = [
    'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
    '2026-06-31,IMPOSSIBLE DATE,8.88,,Groceries,Checking,impossible date'
].join('\n');

async function seedImportHarness(page) {
    await page.evaluate(() => {
        window.currentUser = { id: 'csv-import-review-test-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'existing-coffee',
                    type: 'expense',
                    description: 'Existing Coffee',
                    category: 'Groceries',
                    amount: 3.25,
                    date: '2026-06-03',
                    paymentMethod: 'Checking',
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

async function openImportReview(page, csvText = IMPORT_CSV, fileName = 'zam_csv_import_review_test.csv') {
    await page.evaluate(async ({ text, name }) => {
        const file = new File([text], name, { type: 'text/csv' });
        await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
    }, { text: csvText, name: fileName });
}

test.describe('CSV import review', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('defaults to safe row selection and stores CSV import details', async ({ page }) => {
        const browserErrors = [];
        page.on('pageerror', error => browserErrors.push(error.message));

        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedImportHarness(page);
        await openImportReview(page);

        await expect(page.locator('#csvImportReviewModal')).toBeVisible();
        await expect(page.locator('#csvImportSummaryPrimary')).toHaveText('4 rows found');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('1 selected for import');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('1 duplicate will be skipped');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('2 rows need review');
        await expect(page.locator('#csvImportSummaryAttention')).toContainText('Line 3: Description is missing');
        await expect(page.locator('#csvImportConfirmBtn')).toHaveText('Import 1 Transaction');
        await expect(page.locator('#csvImportPreviewHeader th[data-sort="import"]')).toHaveCount(0);
        await expect(page.locator('#csvImportPreviewHeader th[data-sort="index"]')).toHaveCount(0);
        await expect(page.locator('#csvImportPreviewHeader th.csv-import-static-header').first()).toContainText('Import');
        await expect(page.locator('#csvImportPreviewHeader .csv-import-sort-arrow')).toHaveCount(0);
        await expect(page.locator('#csvImportPreviewHeader th[data-sort="line"] .csv-import-sort-label')).toHaveText('Line ↑');
        await page.locator('#csvImportPreviewHeader th[data-sort="amount"] .csv-import-sortable-button').click();
        await expect(page.locator('#csvImportPreviewHeader .csv-import-sort-arrow')).toHaveCount(0);
        await expect(page.locator('#csvImportPreviewHeader th[data-sort="amount"] .csv-import-sort-label')).toHaveText('Amount ↑');

        const expandButtonFits = await page.evaluate(() => {
            const button = document.getElementById('csvImportExpandPreviewBtn')?.getBoundingClientRect();
            const modal = document.querySelector('#csvImportReviewModal .modal-box')?.getBoundingClientRect();
            return Boolean(button && modal && button.right <= modal.right + 1 && button.left >= modal.left - 1);
        });
        expect(expandButtonFits).toBe(true);

        await page.locator('#csvImportExpandPreviewBtn').click();
        await expect(page.locator('#csvImportPreviewExpandedPanel')).toBeVisible();
        const expandedHasNoPageOverflow = await page.evaluate(() => (
            document.documentElement.scrollWidth <= window.innerWidth + 1
            && document.body.scrollWidth <= window.innerWidth + 1
        ));
        expect(expandedHasNoPageOverflow).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.locator('#csvImportPreviewExpandedPanel')).toBeHidden();

        await page.locator('#csvImportViewAttention').click();
        await expect(page.locator('#csvImportPreviewBody .csv-import-row-attention')).toHaveCount(1);
        await expect(page.locator('#csvImportPreviewBody .csv-import-row-attention input.csv-import-row-select')).not.toBeChecked();
        await page.locator('#csvImportPreviewBody .csv-import-row-attention input.csv-import-row-select').check();
        await expect(page.locator('#csvImportConfirmBtn')).toHaveText('Import 2 Transactions');

        await page.locator('#csvImportConfirmBtn').click();
        await expect(page.locator('#csvImportReviewModal')).toBeHidden();
        await expect(page.locator('#csvImportFeedbackModal')).toBeHidden();
        await expect(page.locator('#csvImportCompleteNotice')).toBeVisible();
        await expect(page.locator('#csvImportCompleteNotice')).toContainText('2 transactions imported');
        await expect(page.locator('#csvImportCompleteNotice')).toContainText('1 duplicate skipped');
        await page.locator('#csvImportCompleteNotice .csv-import-complete-feedback-btn').click();
        await expect(page.locator('#csvImportFeedbackModal')).toBeVisible();
        await expect(page.locator('#csvImportFeedbackSummary')).toContainText('2 transactions imported');
        await expect(page.locator('#csvImportFeedbackSummary')).toContainText('1 duplicate skipped');
        await page.locator('#csvImportFeedbackModal .modal-close').click();

        const imported = await page.evaluate(() => window.getTransactions()
            .filter(tx => tx.source_type === 'csv_import')
            .map(tx => ({
                id: tx.id,
                description: tx.description,
                amount: tx.amount,
                sourceType: tx.importDetails?.sourceType,
                sourceLineNumber: tx.importDetails?.sourceLineNumber,
                rawCount: tx.importDetails?.rawCsvValues?.length || 0,
                mappedDescription: tx.importDetails?.mappedImportValues?.description || ''
            })));

        expect(imported).toHaveLength(2);
        expect(imported.map(tx => tx.description).sort()).toEqual(['Fresh Ready', 'Imported Transaction']);
        expect(imported.every(tx => tx.sourceType === 'csv_import')).toBe(true);
        expect(imported.every(tx => tx.sourceLineNumber)).toBe(true);
        expect(imported.every(tx => tx.rawCount >= 7)).toBe(true);

        const manualId = await page.evaluate(() => {
            const manual = {
                id: 'manual-transaction',
                type: 'expense',
                description: 'Manual Transaction',
                category: 'Groceries',
                amount: 1,
                date: '2026-06-05',
                paymentMethod: 'cash',
                notes: '',
                tag: 'expense',
                createdAt: '2026-06-05T12:00:00.000Z'
            };
            window.addTransaction?.(manual);
            window.render?.();
            return manual.id;
        });

        await page.evaluate((txId) => window.openRecentEditTransactionModal(null, txId), manualId);
        await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal .transaction-import-details')).toHaveCount(0);
        await page.locator('#recentEditTransactionModal .modal-close').click();

        await page.evaluate((txId) => window.openRecentEditTransactionModal(null, txId), imported[0].id);
        await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal .transaction-import-details')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal .transaction-import-summary-meta')).toContainText('Imported from CSV');

        expect(browserErrors).toEqual([]);
    });

    test('rejects impossible calendar dates without normalizing them', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedImportHarness(page);
        await openImportReview(page, IMPOSSIBLE_DATE_CSV, 'zam_impossible_date_test.csv');

        await expect(page.locator('#csvImportReviewModal')).toBeVisible();
        await expect(page.locator('#csvImportSummaryPrimary')).toHaveText('1 row found');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('0 selected for import');
        await expect(page.locator('#csvImportSummaryBreakdown')).toContainText('1 row needs review');
        await expect(page.locator('#csvImportSummaryAttention')).toContainText('Line 2: Invalid date');

        await page.locator('#csvImportViewInvalid').click();
        const invalidRow = page.locator('#csvImportPreviewBody .csv-import-row-invalid');
        await expect(invalidRow).toHaveCount(1);
        await expect(invalidRow).toContainText('IMPOSSIBLE DATE');
        await expect(invalidRow).toContainText('Invalid date');
        await expect(invalidRow).not.toContainText('2026-06-30');
    });
});
