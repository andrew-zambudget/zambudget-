const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const MERCHANT_CSV = [
    'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
    '2026-06-01,STARBUCKS STORE #1234,5.75,,Coffee,Checking,coffee',
    '2026-06-02,AMZN MKTP US*AB123,27.99,,Shopping,Checking,order',
    '2026-06-03,ABC ENTERPRISES 99821,74.32,,Entertainment,Checking,ambiguous'
].join('\n');

async function seedMerchantHarness(page) {
    await page.evaluate(() => {
        window.currentUser = { id: 'merchant-recognition-test-user' };
        window.replaceSnapshot({
            transactions: [],
            categories: [
                {
                    id: 'cat-coffee',
                    type: 'expense',
                    name: 'Coffee',
                    icon: 'C',
                    budget: 100,
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'cat-shopping',
                    type: 'expense',
                    name: 'Shopping',
                    icon: 'S',
                    budget: 200,
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'cat-entertainment',
                    type: 'expense',
                    name: 'Entertainment',
                    icon: 'E',
                    budget: 150,
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

async function importMerchantCsv(page) {
    await page.evaluate(async ({ text, name }) => {
        const file = new File([text], name, { type: 'text/csv' });
        await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
    }, { text: MERCHANT_CSV, name: 'zam_merchant_recognition_lite.csv' });
    await expect(page.locator('#csvImportReviewModal')).toBeVisible();
    await expect(page.locator('#csvImportConfirmBtn')).toHaveText('Import 3 Transactions');
    await page.locator('#csvImportConfirmBtn').click();
}

test.describe('Merchant Recognition Lite', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('suggests merchant cleanup after CSV import and preserves raw descriptions', async ({ page }) => {
        const browserErrors = [];
        page.on('pageerror', error => browserErrors.push(error.message));

        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedMerchantHarness(page);
        await importMerchantCsv(page);

        await expect(page.locator('#csvImportCompleteNotice')).toBeVisible();
        await expect(page.locator('#csvImportCompleteNotice')).toContainText('3 transactions imported');
        await expect(page.locator('#csvImportCompleteNotice')).toContainText('2 merchant cleanup suggestions found');

        await page.locator('#csvImportCompleteNotice .csv-import-complete-review-btn').click();
        await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toContainText('STARBUCKS STORE #1234');
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toContainText('Starbucks');

        await page.locator('#recentEditTransactionModal .transaction-merchant-btn-accept').click();
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toHaveCount(0);

        const afterAccept = await page.evaluate(() => {
            const txs = window.getTransactions();
            const starbucks = txs.find(tx => tx.raw_description === 'STARBUCKS STORE #1234');
            const amazon = txs.find(tx => tx.raw_description === 'AMZN MKTP US*AB123');
            const ambiguous = txs.find(tx => tx.raw_description === 'ABC ENTERPRISES 99821');
            const aliases = JSON.parse(localStorage.getItem('bb_merchant_aliases_v1') || '[]');
            return {
                starbucks,
                amazon,
                ambiguous,
                aliases
            };
        });

        expect(afterAccept.starbucks.description).toBe('Starbucks');
        expect(afterAccept.starbucks.display_name).toBe('Starbucks');
        expect(afterAccept.starbucks.raw_description).toBe('STARBUCKS STORE #1234');
        expect(afterAccept.starbucks.merchant_cleanup_status).toBe('accepted');
        expect(afterAccept.aliases.some(alias => alias.cleaned_name === 'Starbucks')).toBe(true);
        expect(afterAccept.ambiguous.merchant_cleanup_status).toBe('none');

        await page.evaluate((txId) => window.openRecentEditTransactionModal(null, txId), afterAccept.amazon.id);
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toBeVisible();
        await page.locator('#recentEditTransactionModal .transaction-merchant-btn-ignore').click();
        await expect(page.locator('#recentEditTransactionModal .transaction-merchant-suggestion')).toHaveCount(0);

        const afterIgnore = await page.evaluate(() => {
            const amazon = window.getTransactions().find(tx => tx.raw_description === 'AMZN MKTP US*AB123');
            return {
                description: amazon.description,
                rawDescription: amazon.raw_description,
                status: amazon.merchant_cleanup_status
            };
        });
        expect(afterIgnore.description).toBe('AMZN MKTP US*AB123');
        expect(afterIgnore.rawDescription).toBe('AMZN MKTP US*AB123');
        expect(afterIgnore.status).toBe('ignored');

        expect(browserErrors).toEqual([]);
    });
});
