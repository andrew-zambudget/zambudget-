const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const SENTINELS = Object.freeze({
    merchant: 'PHASE3_SENTINEL_MERCHANT',
    category: 'PHASE3_SENTINEL_CATEGORY',
    note: 'PHASE3_SENTINEL_NOTE',
    giftCard: 'PHASE3_SENTINEL_GIFT_CARD',
    addedMerchant: 'PHASE3_SENTINEL_ADDED_AFTER_MIGRATION',
    corruptMerchant: 'PHASE3_SENTINEL_CORRUPT_STORAGE'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resetStorage(page) {
    await page.goto(BLANK_FIXTURE);
    await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();
        await new Promise(resolve => {
            const request = indexedDB.deleteDatabase('zam_local_vault_keys');
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    });
}

test.describe('local vault migration and encrypted persistence', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('flag-on init migrates plaintext bb_data into an encrypted local vault envelope', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            const Operational = await import('/js/localOperationalMetadataStorage.js');
            window.currentUser = { id: 'phase3-migration-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            localStorage.setItem('bb_local_updated_at', '2026-06-21T08:00:00.000Z');
            await Operational.initLocalOperationalMetadataStorage();
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [
                    {
                        id: 'phase3-migrate-tx',
                        type: 'expense',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: 44.12,
                        date: '2026-06-21',
                        notes: sentinels.note
                    }
                ],
                categories: [{ id: 'phase3-migrate-cat', name: sentinels.category }],
                settings: {
                    giftCards: [{ id: 'phase3-migrate-gift', nickname: sentinels.giftCard }]
                }
            }));

            const initResult = await State.initStateAsync();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                stored,
                classification: Vault.classifyLocalBudgetRecord(stored),
                transactions: State.getTransactions(),
                snapshot: State.getSnapshot(),
                localStorageKeys: Object.keys(localStorage).sort()
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.initResult.mode).toBe('encrypted');
        expect(result.classification.kind).toBe('encrypted');
        expect(result.transactions[0].description).toBe(SENTINELS.merchant);
        expect(result.snapshot.settings.giftCards[0].nickname).toBe(SENTINELS.giftCard);
        expect(result.localStorageKeys).toEqual(['bb_data', 'bb_local_operational_metadata_v1']);

        Object.values(SENTINELS).forEach((sentinel) => {
            expect(result.stored).not.toContain(sentinel);
        });
    });

    test('migration is idempotent and does not rewrite an already encrypted envelope', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'phase3-idempotent-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'phase3-idempotent-tx', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }));

            const first = await State.migrateBudgetDataToLocalVault({ updatedAt: '2026-06-21T09:00:00.000Z' });
            const afterFirst = localStorage.getItem('bb_data') || '';
            const second = await State.migrateBudgetDataToLocalVault({ updatedAt: '2026-06-21T10:00:00.000Z' });
            const afterSecond = localStorage.getItem('bb_data') || '';

            return {
                first,
                second,
                sameEnvelope: afterFirst === afterSecond,
                classification: Vault.classifyLocalBudgetRecord(afterSecond),
                stored: afterSecond
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.first.migrated).toBe(true);
        expect(result.second).toEqual({ migrated: false, reason: 'already_encrypted' });
        expect(result.sameEnvelope).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.stored).not.toContain(SENTINELS.merchant);
    });

    test('encrypted saveAsync persists future writes as an envelope and keeps Cloud Sync queue behavior', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            let queueCalls = 0;
            let queuedMessage = '';

            window.currentUser = { id: 'phase3-save-user' };
            window.BuddyCloud = {
                queuePush: (message) => {
                    queueCalls += 1;
                    queuedMessage = message;
                }
            };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'phase3-base-tx', description: sentinels.merchant }],
                categories: [{ id: 'phase3-base-cat', name: sentinels.category }],
                settings: {}
            }));
            await State.initStateAsync();

            State.getTransactions().push({
                id: 'phase3-added-tx',
                type: 'expense',
                description: sentinels.addedMerchant,
                category: sentinels.category,
                amount: 19.99,
                date: '2026-06-21',
                notes: sentinels.note
            });
            const saved = await State.saveAsync({ action: 'phase3 encrypted save' });
            const stored = localStorage.getItem('bb_data') || '';

            return {
                saved,
                stored,
                classification: Vault.classifyLocalBudgetRecord(stored),
                queueCalls,
                queuedMessage,
                transactionCount: State.getTransactions().length
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.saved).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.queueCalls).toBe(1);
        expect(result.queuedMessage).toContain('Budget synced to Cloud Sync');
        expect(result.transactionCount).toBe(2);
        expect(result.stored).not.toContain(SENTINELS.merchant);
        expect(result.stored).not.toContain(SENTINELS.addedMerchant);
        expect(result.stored).not.toContain(SENTINELS.note);
    });

    test('migration failure preserves original plaintext bb_data and creates no plaintext backup keys', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            window.currentUser = { id: 'phase3-failure-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const originalPlaintext = JSON.stringify({
                transactions: [{ id: 'phase3-failure-tx', description: sentinels.merchant }],
                categories: [{ id: 'phase3-failure-cat', name: sentinels.category }],
                settings: {}
            });
            localStorage.setItem('bb_data', originalPlaintext);

            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function patchedSetItem(key, value) {
                if (key === 'bb_data' && String(value || '').includes('zam_local_budget_vault')) {
                    throw new DOMException('Forced encrypted write failure', 'QuotaExceededError');
                }
                return originalSetItem.call(this, key, value);
            };

            let errorMessage = '';
            try {
                await State.migrateBudgetDataToLocalVault();
            } catch (error) {
                errorMessage = error?.message || '';
            }

            Storage.prototype.setItem = originalSetItem;

            return {
                errorMessage,
                stored: localStorage.getItem('bb_data') || '',
                keys: Object.keys(localStorage).sort()
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            sentinels: SENTINELS
        });

        expect(result.errorMessage).toContain('Browser storage is unavailable');
        expect(result.stored).toContain(SENTINELS.merchant);
        expect(result.stored).toContain(SENTINELS.category);
        expect(result.keys).toEqual(['bb_data']);
    });

    test('corrupt encrypted bb_data fails init safely without overwriting valid memory', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'phase3-corrupt-user' };
            State.replaceSnapshot({
                transactions: [{ id: 'phase3-memory-safe', description: sentinels.merchant }],
                categories: [],
                settings: {}
            });
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const key = await Vault.generateLocalVaultKey();
            const envelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ id: 'phase3-corrupt-storage', description: sentinels.corruptMerchant }],
                categories: [],
                settings: {}
            }, key);
            const replacement = envelope.ciphertext.startsWith('A') ? 'B' : 'A';
            envelope.ciphertext = `${replacement}${envelope.ciphertext.slice(1)}`;
            localStorage.setItem('bb_data', JSON.stringify(envelope));

            let threw = false;
            try {
                await State.initStateAsync();
            } catch {
                threw = true;
            }

            return {
                threw,
                memoryTransactions: State.getTransactions(),
                stored: localStorage.getItem('bb_data') || ''
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.threw).toBe(true);
        expect(result.memoryTransactions).toHaveLength(1);
        expect(result.memoryTransactions[0].description).toBe(SENTINELS.merchant);
        expect(result.stored).not.toContain(SENTINELS.corruptMerchant);
    });

    test('flag-off initStateAsync preserves current plaintext behavior', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'phase3-flag-off-user' };
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'phase3-flag-off-tx', description: sentinels.merchant }],
                categories: [{ id: 'phase3-flag-off-cat', name: sentinels.category }],
                settings: {}
            }));

            const initResult = await State.initStateAsync();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                stored,
                classification: Vault.classifyLocalBudgetRecord(stored),
                memoryTransactions: State.getTransactions()
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.initResult).toEqual({ mode: 'plaintext_default' });
        expect(result.classification.kind).toBe('plaintext');
        expect(result.stored).toContain(SENTINELS.merchant);
        expect(result.memoryTransactions[0].description).toBe(SENTINELS.merchant);
    });

    test('flag-off initState fails safe when bb_data is already encrypted', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'phase3-rollback-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'phase3-rollback-tx', description: sentinels.merchant }],
                categories: [{ id: 'phase3-rollback-cat', name: sentinels.category }],
                settings: {}
            }));
            await State.initStateAsync();
            const encryptedBeforeRollback = localStorage.getItem('bb_data') || '';
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = false;

            let errorMessage = '';
            try {
                State.initState();
            } catch (error) {
                errorMessage = error?.message || '';
            }

            const storedAfterRollbackAttempt = localStorage.getItem('bb_data') || '';

            return {
                errorMessage,
                storedUnchanged: encryptedBeforeRollback === storedAfterRollbackAttempt,
                classification: Vault.classifyLocalBudgetRecord(storedAfterRollbackAttempt),
                storedAfterRollbackAttempt
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.errorMessage).toContain('Encrypted local budget storage is present');
        expect(result.storedUnchanged).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.storedAfterRollbackAttempt).not.toContain(SENTINELS.merchant);
        expect(result.storedAfterRollbackAttempt).not.toContain(SENTINELS.category);
    });
});
