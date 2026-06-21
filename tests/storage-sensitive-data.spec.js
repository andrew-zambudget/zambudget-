const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const root = path.resolve(__dirname, '..');

const SENTINELS = Object.freeze({
    merchant: 'PHASE1_SENTINEL_MERCHANT_STORAGE',
    category: 'PHASE1_SENTINEL_CATEGORY_STORAGE',
    notes: 'PHASE1_SENTINEL_NOTES_STORAGE',
    deleted: 'PHASE1_SENTINEL_DELETED_STORAGE',
    csvMerchant: 'PHASE1_CSV_PRIVATE_MERCHANT',
    csvNote: 'PHASE1_CSV_PRIVATE_NOTE',
    recoveryKey: 'PHASE1_RAW_RECOVERY_KEY_SHOULD_NOT_PERSIST'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function seedSensitiveBudget(page) {
    await page.goto('/index.html');
    await waitForAppReady(page);
    await page.evaluate(async (sentinels) => {
        window.currentUser = { id: 'storage-sensitive-test-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'tx-storage-sensitive-active',
                    type: 'expense',
                    description: sentinels.merchant,
                    category: sentinels.category,
                    amount: 123.45,
                    date: '2026-06-21',
                    paymentMethod: 'Checking',
                    notes: sentinels.notes,
                    tag: 'transaction',
                    createdAt: '2026-06-21T12:00:00.000Z'
                },
                {
                    id: 'tx-storage-sensitive-deleted',
                    type: 'expense',
                    description: sentinels.deleted,
                    category: sentinels.category,
                    amount: 77.77,
                    date: '2026-06-20',
                    paymentMethod: 'Checking',
                    notes: 'deleted row tombstone sentinel',
                    tag: 'transaction',
                    isDeleted: true,
                    createdAt: '2026-06-20T12:00:00.000Z'
                }
            ],
            categories: [
                {
                    id: 'cat-storage-sensitive',
                    type: 'expense',
                    name: sentinels.category,
                    icon: 'S',
                    budget: 500,
                    createdAt: '2026-06-21T12:00:00.000Z'
                }
            ],
            settings: {
                currency: '$',
                defaultType: 'expense',
                defaultPayment: 'Checking',
                defaultCategory: sentinels.category,
                lastCategorySort: 'manual',
                giftCards: [
                    {
                        id: 'gift-card-storage-sensitive',
                        merchantName: 'Storage Test Merchant',
                        nickname: 'Storage Test Gift Card',
                        originalAmount: 50,
                        amountLeft: 25,
                        lastFour: '4242',
                        reloadable: false,
                        notes: 'gift card metadata sentinel'
                    }
                ]
            }
        }, { remoteUpdatedAt: '2026-06-21T12:00:00.000Z' });
        await window.flushLocalVaultSaveQueue?.();
    }, SENTINELS);
}

test.describe('sensitive browser storage guardrails', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('real bb_data is encrypted while readable app state is preserved', async ({ page }) => {
        await seedSensitiveBudget(page);

        const result = await page.evaluate(async ({ vaultModulePath }) => {
            const Vault = await import(vaultModulePath);
            const raw = localStorage.getItem('bb_data') || '';
            const snapshot = window.getSnapshot?.() || {};
            return {
                raw,
                classification: Vault.classifyLocalBudgetRecord(raw),
                transactionCount: snapshot.transactions?.length || 0,
                categoryCount: snapshot.categories?.length || 0,
                giftCardCount: snapshot.settings?.giftCards?.length || 0,
                localUpdatedAt: localStorage.getItem('bb_local_updated_at')
            };
        }, { vaultModulePath: modulePath('/js/localVaultStorage.js') });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.transactionCount).toBe(2);
        expect(result.categoryCount).toBe(1);
        expect(result.giftCardCount).toBe(1);
        expect(result.localUpdatedAt).toBeTruthy();
        expect(result.raw).not.toContain(SENTINELS.merchant);
        expect(result.raw).not.toContain(SENTINELS.category);
        expect(result.raw).not.toContain(SENTINELS.notes);
        expect(result.raw).not.toContain(SENTINELS.deleted);
        expect(result.raw).not.toContain('4242');
    });

    test('demo budget data stays in sessionStorage and does not overwrite real bb_data', async ({ page }) => {
        await page.goto('/tests/fixtures/blank.html');
        await page.evaluate((sentinels) => {
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [
                    {
                        id: 'tx-real-before-demo',
                        type: 'expense',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: 123.45,
                        date: '2026-06-21'
                    }
                ],
                categories: [
                    {
                        id: 'cat-real-before-demo',
                        type: 'expense',
                        name: sentinels.category,
                        budget: 500
                    }
                ],
                settings: {}
            }));
        }, SENTINELS);

        await page.goto('/index.html?demo=1');
        await waitForAppReady(page);

        const result = await page.evaluate((sentinels) => {
            window.currentUser = null;

            window.addTransaction?.({
                id: 'tx-demo-sensitive-storage',
                type: 'expense',
                description: 'Demo Only Sentinel',
                category: 'Demo',
                amount: 12,
                date: '2026-06-21',
                tag: 'transaction'
            });

            return {
                appData: localStorage.getItem('bb_data') || '',
                demoData: sessionStorage.getItem('zam_demo_data') || ''
            };
        }, SENTINELS);

        expect(result.appData).toContain(SENTINELS.merchant);
        expect(result.appData).not.toContain('Demo Only Sentinel');
        expect(result.demoData).toContain('Demo Only Sentinel');
        expect(result.demoData).not.toContain(SENTINELS.merchant);
    });

    test('privacy cleanup removes legacy raw recovery-key storage helpers', async ({ page }) => {
        const result = await page.evaluate(async ({ cleanupModulePath, sentinels }) => {
            localStorage.setItem('bb_cloud_key_storage-sensitive-test-user', sentinels.recoveryKey);
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'tx-safe', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }));

            const Cleanup = await import(cleanupModulePath);
            Cleanup.runPrivacyStorageCleanup();

            const allLocalStorage = Object.fromEntries(
                Array.from({ length: localStorage.length }, (_, index) => {
                    const key = localStorage.key(index);
                    return [key, localStorage.getItem(key)];
                })
            );

            return {
                rawRecoveryKey: localStorage.getItem('bb_cloud_key_storage-sensitive-test-user'),
                allLocalStorage
            };
        }, {
            cleanupModulePath: modulePath('/js/privacyStorageCleanup.js'),
            sentinels: SENTINELS
        });

        expect(result.rawRecoveryKey).toBeNull();
        expect(JSON.stringify(result.allLocalStorage)).not.toContain(SENTINELS.recoveryKey);
        expect(JSON.stringify(result.allLocalStorage)).toContain(SENTINELS.merchant);
    });

    test('CSV import batch history stores metadata, not full raw CSV values', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate((sentinels) => {
            window.currentUser = { id: 'storage-sensitive-csv-user' };
            window.replaceSnapshot({
                transactions: [],
                categories: [
                    {
                        id: 'cat-storage-csv',
                        type: 'expense',
                        name: 'Groceries',
                        icon: 'G',
                        budget: 200,
                        createdAt: '2026-06-21T12:00:00.000Z'
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
            }, { remoteUpdatedAt: '2026-06-21T12:00:00.000Z' });
        }, SENTINELS);

        await page.evaluate(async (sentinels) => {
            const csvText = [
                'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
                `2026-06-21,${sentinels.csvMerchant},19.99,,Groceries,Checking,${sentinels.csvNote}`
            ].join('\n');
            const file = new File([csvText], 'phase1_storage_guardrail.csv', { type: 'text/csv' });
            await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
        }, SENTINELS);

        await expect(page.locator('#csvImportReviewModal')).toBeVisible();
        await expect(page.locator('#csvImportConfirmBtn')).toContainText('Import 1 Transaction');
        await page.locator('#csvImportConfirmBtn').click();
        await expect.poll(async () => page.evaluate(() => localStorage.getItem('bb_csv_import_batches_v1') || '')).toContain('phase1_storage_guardrail.csv');

        const result = await page.evaluate(async ({ vaultModulePath }) => {
            await window.flushLocalVaultSaveQueue?.();
            const Vault = await import(vaultModulePath);
            const appData = localStorage.getItem('bb_data') || '';
            const snapshot = window.getSnapshot?.() || {};
            const batchesRaw = localStorage.getItem('bb_csv_import_batches_v1') || '';
            const batches = JSON.parse(batchesRaw || '[]');
            return {
                appData,
                classification: Vault.classifyLocalBudgetRecord(appData),
                transactions: snapshot.transactions || [],
                batchesRaw,
                latestBatch: batches[0] || null
            };
        }, { vaultModulePath: modulePath('/js/localVaultStorage.js') });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.appData).not.toContain(SENTINELS.csvMerchant);
        expect(result.appData).not.toContain(SENTINELS.csvNote);
        expect(result.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                description: SENTINELS.csvMerchant,
                notes: SENTINELS.csvNote
            })
        ]));
        expect(result.latestBatch?.sourceFileName).toBe('phase1_storage_guardrail.csv');
        expect(result.latestBatch?.rowsImported).toBe(1);
        expect(result.latestBatch?.importTransactionIds).toHaveLength(1);
        expect(result.batchesRaw).not.toContain(SENTINELS.csvMerchant);
        expect(result.batchesRaw).not.toContain(SENTINELS.csvNote);
    });

    test('diagnostic report export omits budget contents, tokens, and recovery keys', async ({ page }) => {
        await seedSensitiveBudget(page);
        await page.evaluate((sentinels) => {
            localStorage.setItem('bb_browser_access_token_storage-sensitive-test-user', 'PHASE1_BROWSER_ACCESS_TOKEN');
            window.__capturedDiagnosticBlobs = [];
            const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
            URL.createObjectURL = (blob) => {
                window.__capturedDiagnosticBlobs.push(blob);
                return originalCreateObjectUrl(blob);
            };
            window.__originalAnchorClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function captureDownloadClick() {
                window.__lastDiagnosticDownload = {
                    href: this.href,
                    download: this.download
                };
            };
        }, SENTINELS);

        const flowPromise = page.evaluate(() => window.handleAccountDiagnostics?.({ preventDefault() {}, stopPropagation() {} }));
        await expect(page.locator('#buddyCloudModal')).toBeVisible();
        await page.locator('#buddyCloudModal .buddy-cloud-action[data-action="export"]').click();
        await flowPromise;

        const report = await page.evaluate(async () => {
            const blob = window.__capturedDiagnosticBlobs?.[0];
            return {
                fileName: window.__lastDiagnosticDownload?.download || '',
                text: blob ? await blob.text() : ''
            };
        });

        expect(report.fileName).toMatch(/^Zam_Diagnostic_Report_\d{4}-\d{2}-\d{2}\.json$/);
        expect(report.text).toBeTruthy();
        expect(report.text).not.toContain(SENTINELS.merchant);
        expect(report.text).not.toContain(SENTINELS.category);
        expect(report.text).not.toContain(SENTINELS.notes);
        expect(report.text).not.toContain(SENTINELS.deleted);
        expect(report.text).not.toContain('PHASE1_BROWSER_ACCESS_TOKEN');
        expect(report.text).not.toContain(SENTINELS.recoveryKey);

        const parsed = JSON.parse(report.text);
        expect(parsed.privacy.excludesBudgetContents).toBe(true);
        expect(parsed.privacy.excludesTransactions).toBe(true);
        expect(parsed.privacy.excludesAmounts).toBe(true);
        expect(parsed.privacy.excludesRecoveryKey).toBe(true);
        expect(parsed.privacy.excludesAccessTokens).toBe(true);
        expect(parsed.buddyCloud.localBudgetPayloadSizeRange).toBeTruthy();
    });

    test('storage inventory documentation lists classified browser storage keys', () => {
        const inventory = fs.readFileSync(path.join(root, 'documentation', 'Storage-Inventory.md'), 'utf8');
        [
            'bb_data',
            'zam_demo_data',
            'bb_demo_backup_bb_data',
            'bb_csv_import_batches_v1',
            'bb_csv_import_mappings_v1',
            'bb_merchant_aliases_v1',
            'zam_gift_card_merchant_metadata_v1',
            'bb_cloud_sync_slot_<userId>',
            'bb_browser_access_tokens_v1',
            'bb_browser_access_token_<userId>',
            'budgetbuddy_buddy_cloud_keys',
            'zam_site_data_notice'
        ].forEach(key => {
            expect(inventory).toContain(key);
        });
    });
});
