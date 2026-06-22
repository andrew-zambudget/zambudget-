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
    '2026-06-03,KING SOOPERS STORE 0045,86.42,,Grocery,Checking,seeded merchant',
    '2026-06-04,ABC ENTERPRISES 99821,74.32,,Entertainment,Checking,ambiguous'
].join('\n');

const MERCHANT_FALSE_POSITIVE_CSV = [
    'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
    '2026-06-01,Amazon,12.00,,Shopping,Checking,already clean',
    '2026-06-02,APPLE CARD PAYMENT,100.00,,Credit Card,Checking,payment',
    '2026-06-03,TRANSFER TO SAVINGS,200.00,,Transfer,Checking,transfer',
    '2026-06-04,APPLE.COM/BILL,9.99,,Subscriptions,Checking,apple bill',
    '2026-06-05,SQ *LOCAL COFFEE SHOP,6.25,,Coffee,Checking,square processor',
    '2026-06-06,PAYPAL *JSMITH,15.00,,Misc,Checking,paypal processor',
    '2026-06-07,DOORDASH*BURGER PLACE,22.34,,Dining,Checking,food delivery',
    '2026-06-08,TG ENTERTAINMENT LLC,84.00,,Entertainment,Checking,weak topgolf abbreviation'
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

async function enablePremium(page) {
    await page.evaluate(() => {
        window.setPremiumAccess?.(true, { source: 'merchant_recognition_test' });
    });
}

async function importMerchantCsv(page, text = MERCHANT_CSV, name = 'zam_merchant_recognition_lite.csv') {
    await page.evaluate(async ({ text, name }) => {
        const file = new File([text], name, { type: 'text/csv' });
        await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
    }, { text, name });
    await expect(page.locator('#csvImportReviewModal')).toBeVisible();
    await expect(page.locator('#csvImportConfirmBtn')).toContainText(/^Import \d+ Transactions$/);
    await page.locator('#csvImportConfirmBtn').click();
}

test.describe('Smart Merchant Cleanup', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('stores Premium status flags as opaque local markers', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const State = await import('/js/state.js');
            window.setPremiumAccess?.(true, { source: 'premium_marker_test' });
            const active = {
                premium: localStorage.getItem('bb_premium_active'),
                pro: localStorage.getItem('bb_pro_status'),
                isPro: Boolean(State.getIsPro?.())
            };

            window.setPremiumAccess?.(false, { source: 'premium_marker_test' });
            const inactive = {
                premium: localStorage.getItem('bb_premium_active'),
                pro: localStorage.getItem('bb_pro_status'),
                isPro: Boolean(State.getIsPro?.())
            };

            return { active, inactive };
        });

        expect(result.active.isPro).toBe(true);
        expect(result.active.premium).toMatch(/^zpa:v1:/);
        expect(result.active.pro).toMatch(/^zps:v1:/);
        expect(result.active.premium).not.toBe('true');
        expect(result.active.pro).not.toBe('true');

        expect(result.inactive.isPro).toBe(false);
        expect(result.inactive.premium).toMatch(/^zpa:v1:/);
        expect(result.inactive.pro).toMatch(/^zps:v1:/);
        expect(result.inactive.premium).not.toBe('false');
        expect(result.inactive.pro).not.toBe('false');
    });

    test('suggests merchant cleanup for Premium imports and preserves raw descriptions', async ({ page }) => {
        const browserErrors = [];
        page.on('pageerror', error => browserErrors.push(error.message));

        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedMerchantHarness(page);
        await enablePremium(page);
        await importMerchantCsv(page);

        await expect(page.locator('#csvImportCompleteModal')).toBeVisible();
        await expect(page.locator('#csvImportCompleteModal')).toContainText('4 transactions imported');
        await expect(page.locator('#csvImportCompleteModal')).toContainText('3 Smart Merchant Cleanup suggestions found');

        await page.locator('#csvImportCompleteModal button', { hasText: 'Review Suggestions' }).click();
        const cleanupModal = page.locator('#smartMerchantCleanupModal');
        await expect(cleanupModal).toBeVisible();
        await expect(cleanupModal).toContainText('Smart Merchant Cleanup');
        await expect(cleanupModal).toContainText('STARBUCKS STORE #1234');
        await expect(cleanupModal).toContainText('Starbucks');
        await expect(cleanupModal).toContainText('AMZN MKTP US*AB123');
        await expect(cleanupModal).toContainText('Amazon');
        await expect(cleanupModal).toContainText('KING SOOPERS STORE 0045');
        await expect(cleanupModal).toContainText('King Soopers');

        await cleanupModal.locator('.smart-merchant-cleanup-row-select').nth(1).uncheck();
        await cleanupModal.locator('.smart-merchant-cleanup-row-select').nth(2).uncheck();
        await expect(cleanupModal.locator('#smartMerchantCleanupSelectedCount')).toContainText('1 of 3 selected');
        await cleanupModal.locator('#smartMerchantCleanupAcceptSelectedBtn').click();
        await expect(cleanupModal).toBeVisible();
        await expect(cleanupModal.locator('#smartMerchantCleanupProgress')).toContainText('1 of 3 reviewed');
        await expect(cleanupModal).not.toContainText('STARBUCKS STORE #1234');
        await expect(cleanupModal).toContainText('AMZN MKTP US*AB123');

        const afterAccept = await page.evaluate(() => {
            const txs = window.getTransactions();
            const starbucks = txs.find(tx => tx.raw_description === 'STARBUCKS STORE #1234');
            const amazon = txs.find(tx => tx.raw_description === 'AMZN MKTP US*AB123');
            const kingSoopers = txs.find(tx => tx.raw_description === 'KING SOOPERS STORE 0045');
            const ambiguous = txs.find(tx => tx.raw_description === 'ABC ENTERPRISES 99821');
            const aliases = JSON.parse(localStorage.getItem('bb_merchant_aliases_v1') || '[]');
            return {
                starbucks,
                amazon,
                kingSoopers,
                ambiguous,
                aliases
            };
        });

        expect(afterAccept.starbucks.description).toBe('Starbucks');
        expect(afterAccept.starbucks.display_name).toBe('Starbucks');
        expect(afterAccept.starbucks.raw_description).toBe('STARBUCKS STORE #1234');
        expect(afterAccept.starbucks.merchant_cleanup_status).toBe('accepted');
        expect(afterAccept.aliases.some(alias => alias.cleaned_name === 'Starbucks')).toBe(true);
        expect(afterAccept.kingSoopers.merchantSuggestion.cleanedName).toBe('King Soopers');
        expect(afterAccept.ambiguous.merchant_cleanup_status).toBe('none');

        await cleanupModal.locator('#smartMerchantCleanupIgnoreSelectedBtn').click();
        await expect(cleanupModal).toBeVisible();
        await expect(cleanupModal).toContainText('Cleanup review complete');
        await expect(cleanupModal).toContainText('1 accepted');
        await expect(cleanupModal).toContainText('2 ignored');

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

        await cleanupModal.locator('#smartMerchantCleanupDoneBtn').click();
        await expect(cleanupModal).toHaveCount(0);

        expect(browserErrors).toEqual([]);
    });

    test('sorts merchant cleanup suggestions by visible columns', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedMerchantHarness(page);
        await enablePremium(page);
        await importMerchantCsv(page);

        await page.locator('#csvImportCompleteModal button', { hasText: 'Review Suggestions' }).click();
        const cleanupModal = page.locator('#smartMerchantCleanupModal');
        await expect(cleanupModal).toBeVisible();

        const suggestedNames = cleanupModal.locator('.smart-merchant-cleanup-table tbody tr td:nth-child(3) strong');
        await expect(suggestedNames).toHaveText(['Starbucks', 'Amazon', 'King Soopers']);

        await cleanupModal.locator('th[data-sort="suggested"] .smart-merchant-cleanup-sort-button').click();
        await expect(cleanupModal.locator('th[data-sort="suggested"]')).toHaveAttribute('aria-sort', 'ascending');
        await expect(suggestedNames).toHaveText(['Amazon', 'King Soopers', 'Starbucks']);
        await expect(cleanupModal.locator('#smartMerchantCleanupSelectedCount')).toContainText('3 of 3 selected');

        await cleanupModal.locator('th[data-sort="suggested"] .smart-merchant-cleanup-sort-button').click();
        await expect(cleanupModal.locator('th[data-sort="suggested"]')).toHaveAttribute('aria-sort', 'descending');
        await expect(suggestedNames).toHaveText(['Starbucks', 'King Soopers', 'Amazon']);

        await cleanupModal.locator('th[data-sort="confidence"] .smart-merchant-cleanup-sort-button').click();
        await expect(cleanupModal.locator('th[data-sort="confidence"]')).toHaveAttribute('aria-sort', 'descending');
        await expect(cleanupModal.locator('#smartMerchantCleanupSelectedCount')).toContainText('3 of 3 selected');
    });

    test('suppresses clean and payment rows while lowering processor confidence', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedMerchantHarness(page);
        await enablePremium(page);
        await importMerchantCsv(page, MERCHANT_FALSE_POSITIVE_CSV, 'zam_merchant_recognition_false_positive.csv');

        await expect(page.locator('#csvImportCompleteModal')).toBeVisible();
        await expect(page.locator('#csvImportCompleteModal')).toContainText('8 transactions imported');
        await expect(page.locator('#csvImportCompleteModal')).toContainText('5 Smart Merchant Cleanup suggestions found');

        await page.locator('#csvImportCompleteModal button', { hasText: 'Review Suggestions' }).click();
        const cleanupModal = page.locator('#smartMerchantCleanupModal');
        await expect(cleanupModal).toBeVisible();

        await expect(cleanupModal).not.toContainText('Amazon Marketplace');
        await expect(cleanupModal).not.toContainText('APPLE CARD PAYMENT');
        await expect(cleanupModal).not.toContainText('TRANSFER TO SAVINGS');

        await expect(cleanupModal).toContainText('APPLE.COM/BILL');
        await expect(cleanupModal).toContainText('Apple Services');
        await expect(cleanupModal).toContainText('SQ *LOCAL COFFEE SHOP');
        await expect(cleanupModal).toContainText('Local Coffee Shop');
        await expect(cleanupModal).toContainText('Payment processor prefix removed; merchant name inferred from remaining text.');
        await expect(cleanupModal).toContainText('PAYPAL *JSMITH');
        await expect(cleanupModal).toContainText('Low confidence');
        await expect(cleanupModal).toContainText('underlying merchant or person may differ');
        await expect(cleanupModal).toContainText('DOORDASH*BURGER PLACE');
        await expect(cleanupModal).toContainText('Restaurants / Food Delivery');
        await expect(cleanupModal).toContainText('TG ENTERTAINMENT LLC');
        await expect(cleanupModal).toContainText('Weak abbreviation-style match; review required.');
        await expect(cleanupModal.locator('#smartMerchantCleanupSelectedCount')).toContainText('3 of 5 selected');

        const paypalRow = cleanupModal.locator('tr', { hasText: 'PAYPAL *JSMITH' });
        await expect(paypalRow.locator('.smart-merchant-cleanup-row-select')).not.toBeChecked();
        const topgolfRow = cleanupModal.locator('tr', { hasText: 'TG ENTERTAINMENT LLC' });
        await expect(topgolfRow.locator('.smart-merchant-cleanup-row-select')).not.toBeChecked();
    });

    test('gates merchant cleanup suggestions for Free imports', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await seedMerchantHarness(page);

        await page.evaluate(async ({ text, name }) => {
            const file = new File([text], name, { type: 'text/csv' });
            await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
        }, { text: MERCHANT_CSV, name: 'zam_merchant_recognition_free.csv' });

        await expect(page.locator('#csvImportReviewModal')).toBeVisible();
        await page.locator('#csvImportToggleAdvancedOptionsBtn').click();
        const skipSuggestions = page.locator('#csvImportSkipMerchantSuggestions');
        await expect(skipSuggestions).toBeChecked();
        await expect(skipSuggestions).toBeDisabled();
        await expect(page.locator('#csvImportMerchantSuggestionsPremiumPill')).toBeVisible();
        await expect(page.locator('#csvImportMerchantSuggestionsHint')).toContainText('Smart Merchant Cleanup is Premium');

        await page.locator('#csvImportConfirmBtn').click();
        await expect(page.locator('#csvImportCompleteNotice')).toBeVisible();
        await expect(page.locator('#csvImportCompleteNotice')).toContainText('4 transactions imported');
        await expect(page.locator('#csvImportCompleteModal')).toHaveCount(0);

        const imported = await page.evaluate(() => window.getTransactions()
            .filter(tx => tx.source_type === 'csv_import')
            .map(tx => ({
                description: tx.description,
                rawDescription: tx.raw_description,
                cleanupStatus: tx.merchant_cleanup_status,
                hasSuggestion: Boolean(tx.merchantSuggestion)
            })));

        expect(imported).toHaveLength(4);
        expect(imported.every(tx => tx.cleanupStatus === 'none')).toBe(true);
        expect(imported.every(tx => tx.hasSuggestion === false)).toBe(true);
    });
});
