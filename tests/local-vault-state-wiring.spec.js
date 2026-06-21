const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const SENTINELS = Object.freeze({
    merchant: 'PHASE2B_SENTINEL_MERCHANT',
    category: 'PHASE2B_SENTINEL_CATEGORY',
    note: 'PHASE2B_SENTINEL_NOTE',
    invalidMerchant: 'PHASE2B_INVALID_ENCRYPTED_MERCHANT',
    validMemory: 'PHASE2B_VALID_MEMORY_TRANSACTION',
    secret: 'PHASE2B_SECRET_SHOULD_NOT_LOG'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resetStorage(page) {
    await page.goto(BLANK_FIXTURE);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

test.describe('local vault state wiring scaffold', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('keeps default app persistence on current plaintext bb_data path', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);

            window.currentUser = { id: 'phase2b-default-user' };
            State.replaceSnapshot({
                transactions: [
                    {
                        id: 'phase2b-default-tx',
                        type: 'expense',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: 42.25,
                        date: '2026-06-21',
                        notes: sentinels.note
                    }
                ],
                categories: [{ id: 'phase2b-default-cat', type: 'expense', name: sentinels.category }],
                settings: { defaultCategory: sentinels.category }
            }, { remoteUpdatedAt: '2026-06-21T00:00:00.000Z' });

            const saved = State.save({ action: 'phase2b default save' });
            const raw = localStorage.getItem('bb_data') || '';

            return {
                experimentEnabled: State.isLocalVaultStorageExperimentEnabled(),
                saved,
                raw,
                classification: Vault.classifyLocalBudgetRecord(raw),
                timestamp: localStorage.getItem('bb_local_updated_at')
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.experimentEnabled).toBe(false);
        expect(result.saved).toBe(true);
        expect(result.classification.kind).toBe('plaintext');
        expect(result.raw).toContain(SENTINELS.merchant);
        expect(result.raw).toContain(SENTINELS.category);
        expect(result.raw).toContain(SENTINELS.note);
        expect(result.timestamp).toBeTruthy();
    });

    test('rejects local vault state helpers while the experiment flag is off', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            State.replaceSnapshot({
                transactions: [{ id: 'phase2b-disabled-tx', description: sentinels.validMemory }],
                categories: [],
                settings: {}
            });
            const before = localStorage.getItem('bb_data') || '';

            let errorMessage = '';
            try {
                await State.writeBudgetDataToLocalVault({
                    transactions: [{ id: 'phase2b-should-not-write', description: sentinels.merchant }],
                    categories: [],
                    settings: {}
                }, {});
            } catch (error) {
                errorMessage = error?.message || '';
            }

            return {
                errorMessage,
                before,
                after: localStorage.getItem('bb_data') || ''
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            sentinels: SENTINELS
        });

        expect(result.errorMessage).toContain('disabled');
        expect(result.after).toBe(result.before);
        expect(result.after).toContain(SENTINELS.validMemory);
        expect(result.after).not.toContain(SENTINELS.merchant);
    });

    test('writes and reads encrypted bb_data only when the test flag is enabled', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);

            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const key = await Vault.generateLocalVaultKey();
            const payload = {
                transactions: [
                    {
                        id: 'phase2b-encrypted-tx',
                        type: 'expense',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: 55.5,
                        date: '2026-06-21',
                        notes: sentinels.note
                    }
                ],
                categories: [{ id: 'phase2b-encrypted-cat', name: sentinels.category }],
                settings: { defaultCategory: sentinels.category }
            };

            await State.writeBudgetDataToLocalVault(payload, key, {
                updatedAt: '2026-06-21T00:00:00.000Z'
            });

            const raw = localStorage.getItem('bb_data') || '';
            const decrypted = await State.readBudgetDataFromLocalVault(key);

            return {
                experimentEnabled: State.isLocalVaultStorageExperimentEnabled(),
                raw,
                decrypted,
                classification: Vault.classifyLocalBudgetRecord(raw),
                keys: Object.keys(localStorage),
                timestamp: localStorage.getItem('bb_local_updated_at')
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.experimentEnabled).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.keys).toContain('bb_data');
        expect(result.timestamp).toBe('2026-06-21T00:00:00.000Z');
        expect(result.decrypted.transactions[0].description).toBe(SENTINELS.merchant);
        expect(result.decrypted.transactions[0].category).toBe(SENTINELS.category);
        expect(result.decrypted.transactions[0].notes).toBe(SENTINELS.note);

        Object.values(SENTINELS).forEach((sentinel) => {
            expect(result.raw).not.toContain(sentinel);
        });
    });

    test('does not overwrite valid memory state when encrypted storage is corrupt', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);

            State.replaceSnapshot({
                transactions: [
                    {
                        id: 'phase2b-valid-memory',
                        type: 'expense',
                        description: sentinels.validMemory,
                        category: 'Safe Category',
                        amount: 12.34,
                        date: '2026-06-21'
                    }
                ],
                categories: [],
                settings: {}
            });

            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const key = await Vault.generateLocalVaultKey();
            const envelope = await Vault.encryptLocalVaultPayload({
                transactions: [
                    {
                        id: 'phase2b-invalid-storage',
                        type: 'expense',
                        description: sentinels.invalidMerchant,
                        amount: 987.65,
                        notes: sentinels.secret
                    }
                ],
                categories: [],
                settings: {}
            }, key);
            const replacement = envelope.ciphertext.startsWith('A') ? 'B' : 'A';
            envelope.ciphertext = `${replacement}${envelope.ciphertext.slice(1)}`;
            localStorage.setItem('bb_data', JSON.stringify(envelope));

            const capturedLogs = [];
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;
            const capture = (...args) => capturedLogs.push(args.map(String).join(' '));
            console.log = capture;
            console.warn = capture;
            console.error = capture;

            let threw = false;
            try {
                await State.applyBudgetDataFromLocalVault(key);
            } catch {
                threw = true;
            }

            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;

            return {
                threw,
                memoryTransactions: State.getTransactions(),
                capturedLogs
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.threw).toBe(true);
        expect(result.memoryTransactions).toHaveLength(1);
        expect(result.memoryTransactions[0].description).toBe(SENTINELS.validMemory);

        const logs = result.capturedLogs.join('\n');
        expect(logs).not.toContain(SENTINELS.invalidMerchant);
        expect(logs).not.toContain(SENTINELS.secret);
        expect(logs).not.toContain('987.65');
    });

    test('does not queue Cloud Sync from the local vault test-only write helper', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            let queueCalls = 0;

            window.BuddyCloud = {
                queuePush: () => {
                    queueCalls += 1;
                }
            };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const key = await Vault.generateLocalVaultKey();

            await State.writeBudgetDataToLocalVault({
                transactions: [{ id: 'phase2b-cloud-safe', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }, key);

            return {
                queueCalls,
                classification: Vault.classifyLocalBudgetRecord(localStorage.getItem('bb_data') || '')
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.queueCalls).toBe(0);
        expect(result.classification.kind).toBe('encrypted');
    });
});
