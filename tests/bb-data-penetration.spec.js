const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const SENTINELS = Object.freeze({
    merchant: 'PENTEST_BBDATA_MERCHANT_DO_NOT_LEAK',
    category: 'PENTEST_BBDATA_CATEGORY_DO_NOT_LEAK',
    note: 'PENTEST_BBDATA_NOTE_DO_NOT_LEAK',
    tombstone: 'PENTEST_BBDATA_TOMBSTONE_DO_NOT_LEAK',
    giftCard: 'PENTEST_BBDATA_GIFT_CARD_DO_NOT_LEAK',
    csvMerchant: 'PENTEST_BBDATA_CSV_MERCHANT_DO_NOT_LEAK',
    csvNote: 'PENTEST_BBDATA_CSV_NOTE_DO_NOT_LEAK',
    browserToken: 'PENTEST_BROWSER_ACCESS_TOKEN_DO_NOT_LEAK',
    recoveryKey: 'PENTEST_RECOVERY_KEY_DO_NOT_LEAK',
    amount: '98765.43'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function collectBrowserIssues(page) {
    const issues = [];
    page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) {
            issues.push(`[${message.type()}] ${message.text()}`);
        }
    });
    page.on('pageerror', error => {
        issues.push(`[pageerror] ${error.message}`);
    });
    return issues;
}

function expectNoSensitiveText(rawText, sentinels = SENTINELS) {
    Object.values(sentinels).forEach(value => {
        expect(rawText).not.toContain(value);
    });
}

async function seedEncryptedBudget(page) {
    await page.goto('/index.html');
    await waitForAppReady(page);
    await page.evaluate(async (sentinels) => {
        window.currentUser = { id: 'bb-data-penetration-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'pentest-active-tx',
                    type: 'expense',
                    description: sentinels.merchant,
                    category: sentinels.category,
                    amount: Number(sentinels.amount),
                    date: '2026-06-21',
                    paymentMethod: 'Checking',
                    notes: sentinels.note,
                    tag: 'transaction',
                    createdAt: '2026-06-21T12:00:00.000Z'
                },
                {
                    id: 'pentest-deleted-tx',
                    type: 'expense',
                    description: sentinels.tombstone,
                    category: sentinels.category,
                    amount: 44.44,
                    date: '2026-06-20',
                    paymentMethod: 'Checking',
                    notes: 'deleted row should remain encrypted',
                    tag: 'transaction',
                    isDeleted: true,
                    createdAt: '2026-06-20T12:00:00.000Z'
                }
            ],
            categories: [
                {
                    id: 'pentest-category',
                    type: 'expense',
                    name: sentinels.category,
                    icon: 'P',
                    budget: 1000,
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
                        id: 'pentest-gift-card',
                        merchantName: sentinels.giftCard,
                        nickname: sentinels.giftCard,
                        originalAmount: 100,
                        amountLeft: 45,
                        lastFour: '4321',
                        reloadable: false,
                        notes: sentinels.note
                    }
                ]
            }
        }, { remoteUpdatedAt: '2026-06-21T12:00:00.000Z' });
        await window.flushLocalVaultSaveQueue?.();
    }, SENTINELS);
}

test.describe('bb_data local vault penetration checks', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('normal startup and encrypted save do not leak sensitive values or console errors', async ({ page }) => {
        const browserIssues = collectBrowserIssues(page);
        await seedEncryptedBudget(page);

        const result = await page.evaluate(async ({ vaultModulePath }) => {
            const Vault = await import(vaultModulePath);
            const raw = localStorage.getItem('bb_data') || '';
            const snapshot = window.getSnapshot?.() || {};
            return {
                raw,
                classification: Vault.classifyLocalBudgetRecord(raw),
                snapshot,
                localStorageDump: JSON.stringify(Object.fromEntries(
                    Array.from({ length: localStorage.length }, (_, index) => {
                        const key = localStorage.key(index);
                        return [key, localStorage.getItem(key)];
                    })
                )),
                sessionStorageDump: JSON.stringify(Object.fromEntries(
                    Array.from({ length: sessionStorage.length }, (_, index) => {
                        const key = sessionStorage.key(index);
                        return [key, sessionStorage.getItem(key)];
                    })
                ))
            };
        }, { vaultModulePath: modulePath('/js/localVaultStorage.js') });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.raw).toContain('zam_local_budget_vault');
        expect(result.snapshot.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                description: SENTINELS.merchant,
                notes: SENTINELS.note,
                amount: Number(SENTINELS.amount)
            }),
            expect.objectContaining({
                description: SENTINELS.tombstone,
                isDeleted: true
            })
        ]));
        expect(result.snapshot.categories).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: SENTINELS.category })
        ]));
        expect(result.snapshot.settings.giftCards).toEqual(expect.arrayContaining([
            expect.objectContaining({ merchantName: SENTINELS.giftCard })
        ]));
        expectNoSensitiveText(result.raw);
        expectNoSensitiveText(result.localStorageDump);
        expectNoSensitiveText(result.sessionStorageDump);
        expect(browserIssues).toEqual([]);
    });

    test('legacy plaintext migration removes readable bb_data without plaintext backup residue', async ({ page }) => {
        const browserIssues = collectBrowserIssues(page);
        await page.goto('/tests/fixtures/blank.html');
        await page.evaluate((sentinels) => {
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{
                    id: 'pentest-legacy-tx',
                    type: 'expense',
                    description: sentinels.merchant,
                    category: sentinels.category,
                    amount: Number(sentinels.amount),
                    date: '2026-06-21',
                    notes: sentinels.note
                }],
                categories: [{ id: 'pentest-legacy-cat', type: 'expense', name: sentinels.category }],
                settings: { giftCards: [{ id: 'pentest-legacy-gift', nickname: sentinels.giftCard }] }
            }));
        }, SENTINELS);

        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async ({ vaultModulePath }) => {
            const Vault = await import(vaultModulePath);
            const raw = localStorage.getItem('bb_data') || '';
            return {
                raw,
                classification: Vault.classifyLocalBudgetRecord(raw),
                keys: Object.keys(localStorage).sort(),
                dump: JSON.stringify(Object.fromEntries(
                    Array.from({ length: localStorage.length }, (_, index) => {
                        const key = localStorage.key(index);
                        return [key, localStorage.getItem(key)];
                    })
                )),
                snapshot: window.getSnapshot?.() || {}
            };
        }, { vaultModulePath: modulePath('/js/localVaultStorage.js') });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.snapshot.transactions[0].description).toBe(SENTINELS.merchant);
        expect(result.keys.filter(key => /backup|temp|plaintext/i.test(key))).toEqual([]);
        expectNoSensitiveText(result.raw);
        expectNoSensitiveText(result.dump);
        expect(browserIssues).toEqual([]);
    });

    test('tampered encrypted bb_data fails safe without exposing plaintext in storage or logs', async ({ page }) => {
        const browserIssues = collectBrowserIssues(page);
        await seedEncryptedBudget(page);

        const result = await page.evaluate(async ({ stateModulePath }) => {
            const State = await import(stateModulePath);
            const rawBefore = localStorage.getItem('bb_data') || '';
            const parsed = JSON.parse(rawBefore);
            parsed.ciphertext = `${parsed.ciphertext.slice(0, -8)}tampered`;
            localStorage.setItem('bb_data', JSON.stringify(parsed));

            let errorMessage = '';
            try {
                await State.initStateAsync();
            } catch (error) {
                errorMessage = error?.message || String(error || '');
            }

            return {
                errorMessage,
                rawAfter: localStorage.getItem('bb_data') || '',
                memorySnapshot: window.getSnapshot?.() || State.getSnapshot()
            };
        }, { stateModulePath: modulePath('/js/state.js') });

        expect(result.errorMessage).toBeTruthy();
        expectNoSensitiveText(result.rawAfter);
        expect(browserIssues.join('\n')).not.toContain(SENTINELS.merchant);
        expect(browserIssues.join('\n')).not.toContain(SENTINELS.category);
        expect(browserIssues.join('\n')).not.toContain(SENTINELS.note);
    });

    test('diagnostics and browser access helper storage omit sensitive values', async ({ page }) => {
        await seedEncryptedBudget(page);
        await page.evaluate(async (sentinels) => {
            const BrowserAccessVault = await import(`/js/browserAccessVaultStorage.js?test=${Date.now()}`);
            const Cleanup = await import(`/js/privacyStorageCleanup.js?test=${Date.now()}`);
            localStorage.setItem('bb_browser_access_token_bb-data-penetration-user', sentinels.browserToken);
            await BrowserAccessVault.getOrCreateEncryptedBrowserAccessToken({
                userId: 'bb-data-penetration-user'
            });
            localStorage.setItem('bb_cloud_key_bb-data-penetration-user', sentinels.recoveryKey);
            Cleanup.runPrivacyStorageCleanup();
            window.__capturedDiagnosticBlobs = [];
            const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
            URL.createObjectURL = (blob) => {
                window.__capturedDiagnosticBlobs.push(blob);
                return originalCreateObjectUrl(blob);
            };
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

        const result = await page.evaluate(async () => {
            const blob = window.__capturedDiagnosticBlobs?.[0];
            return {
                reportText: blob ? await blob.text() : '',
                localStorageDump: JSON.stringify(Object.fromEntries(
                    Array.from({ length: localStorage.length }, (_, index) => {
                        const key = localStorage.key(index);
                        return [key, localStorage.getItem(key)];
                    })
                ))
            };
        });

        expect(result.reportText).toBeTruthy();
        expectNoSensitiveText(result.reportText);
        expect(result.reportText).not.toContain(SENTINELS.browserToken);
        expect(result.reportText).not.toContain(SENTINELS.recoveryKey);
        expect(result.localStorageDump).not.toContain(SENTINELS.merchant);
        expect(result.localStorageDump).not.toContain(SENTINELS.note);
        expect(result.localStorageDump).not.toContain(SENTINELS.browserToken);
        expect(result.localStorageDump).not.toContain(SENTINELS.recoveryKey);
        expect(result.localStorageDump).not.toContain('bb_browser_access_token_bb-data-penetration-user');
        expect(result.localStorageDump).toContain('bb_browser_access_tokens_v1');
    });

    test('local vault key material is non-extractable and absent from web storage', async ({ page }) => {
        await seedEncryptedBudget(page);

        const result = await page.evaluate(async ({ providerModulePath }) => {
            const Provider = await import(providerModulePath);
            const keyResult = await Provider.getOrCreateLocalVaultKey({
                userId: 'bb-data-penetration-user',
                scope: 'budget-data'
            });
            let exportError = '';
            try {
                await crypto.subtle.exportKey('raw', keyResult.key);
            } catch (error) {
                exportError = error?.name || error?.message || String(error || '');
            }
            return {
                keyExtractable: keyResult.key.extractable,
                exportError,
                localStorageDump: JSON.stringify(localStorage),
                sessionStorageDump: JSON.stringify(sessionStorage)
            };
        }, { providerModulePath: modulePath('/js/localVaultKeyProvider.js') });

        expect(result.keyExtractable).toBe(false);
        expect(result.exportError).toBeTruthy();
        expect(result.localStorageDump).not.toContain('CryptoKey');
        expect(result.sessionStorageDump).not.toContain('CryptoKey');
    });
});
