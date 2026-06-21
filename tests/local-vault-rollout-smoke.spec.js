const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const SENTINELS = Object.freeze({
    freshMerchant: 'ROLLOUT_FRESH_SENTINEL_MERCHANT',
    existingMerchant: 'ROLLOUT_EXISTING_SENTINEL_MERCHANT',
    runtimeMerchant: 'ROLLOUT_RUNTIME_SENTINEL_MERCHANT',
    category: 'ROLLOUT_SENTINEL_CATEGORY',
    note: 'ROLLOUT_SENTINEL_NOTE'
});

function supabaseSignedInStub() {
    return `
        window.supabase = {
            createClient() {
                const emptyQuery = {
                    select() { return this; },
                    insert() { return Promise.resolve({ data: null, error: null }); },
                    update() { return this; },
                    upsert() { return Promise.resolve({ data: null, error: null }); },
                    delete() { return this; },
                    eq() { return this; },
                    order() { return this; },
                    limit() { return this; },
                    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
                    single() { return Promise.resolve({ data: null, error: null }); },
                    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
                };

                return {
                    auth: {
                        getSession: async () => ({
                            data: {
                                session: {
                                    access_token: 'rollout-test-token',
                                    refresh_token: 'rollout-test-refresh',
                                    user: { id: 'rollout-runtime-user', email: 'rollout-runtime@example.com' }
                                }
                            },
                            error: null
                        }),
                        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                        signOut: async () => ({ error: null })
                    },
                    from: () => emptyQuery,
                    functions: {
                        invoke: async () => ({ data: { isPremium: false, status: 'free' }, error: null })
                    },
                    channel: () => ({
                        on() { return this; },
                        subscribe(callback) {
                            if (typeof callback === 'function') callback('SUBSCRIBED');
                            return this;
                        },
                        unsubscribe() {}
                    }),
                    removeChannel: async () => ({ error: null })
                };
            }
        };
    `;
}

async function installSignedInRuntimeStub(page, { localVaultStorageEnabled = true } = {}) {
    await page.route('**/config.json', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            supabaseUrl: 'https://example.supabase.co',
            supabaseAnonKey: 'test-anon-key',
            billingEnabled: false,
            localVaultStorageEnabled
        })
    }));
    await page.route('**/js/vendor/supabase.js', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: supabaseSignedInStub()
    }));
    await page.route('**/@supabase/supabase-js@2', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: supabaseSignedInStub()
    }));
}

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

test.describe('local vault controlled rollout smoke', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('fresh account flag-on write survives refresh as an encrypted bb_data envelope', async ({ page }) => {
        const firstLoad = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'rollout-fresh-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;

            const initResult = await State.initStateAsync();
            State.replaceSnapshot({
                transactions: [{
                    id: 'rollout-fresh-tx',
                    type: 'expense',
                    description: sentinels.freshMerchant,
                    category: sentinels.category,
                    amount: 23.45,
                    date: '2026-06-21',
                    notes: sentinels.note
                }],
                categories: [{ id: 'rollout-fresh-cat', name: sentinels.category }],
                settings: {}
            });
            const saved = await State.saveAsync({ action: 'rollout fresh encrypted save' });
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                saved,
                classification: Vault.classifyLocalBudgetRecord(stored),
                stored,
                keyNames: Object.keys(localStorage).sort()
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(firstLoad.initResult).toEqual({ mode: 'encrypted_empty' });
        expect(firstLoad.saved).toBe(true);
        expect(firstLoad.classification.kind).toBe('encrypted');
        expect(firstLoad.keyNames).toEqual(['bb_data', 'bb_local_updated_at']);
        expect(firstLoad.stored).not.toContain(SENTINELS.freshMerchant);
        expect(firstLoad.stored).not.toContain(SENTINELS.category);
        expect(firstLoad.stored).not.toContain(SENTINELS.note);

        await page.reload();

        const afterRefresh = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'rollout-fresh-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;

            const initResult = await State.initStateAsync();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                classification: Vault.classifyLocalBudgetRecord(stored),
                transactions: State.getTransactions(),
                stored
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(afterRefresh.initResult.mode).toBe('encrypted');
        expect(afterRefresh.classification.kind).toBe('encrypted');
        expect(afterRefresh.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({ description: SENTINELS.freshMerchant })
        ]));
        expect(afterRefresh.stored).not.toContain(SENTINELS.freshMerchant);
    });

    test('existing plaintext account migrates once and survives same-user refresh', async ({ page }) => {
        const migrated = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'rollout-existing-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{
                    id: 'rollout-existing-tx',
                    type: 'expense',
                    description: sentinels.existingMerchant,
                    category: sentinels.category,
                    amount: 67.89,
                    date: '2026-06-21'
                }],
                categories: [{ id: 'rollout-existing-cat', name: sentinels.category }],
                settings: {}
            }));

            const initResult = await State.initStateAsync();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                classification: Vault.classifyLocalBudgetRecord(stored),
                transactions: State.getTransactions(),
                stored
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(migrated.initResult.mode).toBe('encrypted');
        expect(migrated.classification.kind).toBe('encrypted');
        expect(migrated.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({ description: SENTINELS.existingMerchant })
        ]));
        expect(migrated.stored).not.toContain(SENTINELS.existingMerchant);
        expect(migrated.stored).not.toContain(SENTINELS.category);

        await page.reload();

        const afterRefresh = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'rollout-existing-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;

            const initResult = await State.initStateAsync();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                initResult,
                classification: Vault.classifyLocalBudgetRecord(stored),
                transactions: State.getTransactions(),
                stored
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(afterRefresh.initResult.mode).toBe('encrypted');
        expect(afterRefresh.classification.kind).toBe('encrypted');
        expect(afterRefresh.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({ description: SENTINELS.existingMerchant })
        ]));
        expect(afterRefresh.stored).not.toContain(SENTINELS.existingMerchant);
    });

    test('sync save callers queue encrypted writes when the rollout flag is on', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            window.currentUser = { id: 'rollout-sync-save-user' };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            await State.initStateAsync();

            const saved = State.addTransaction({
                id: 'rollout-sync-save-tx',
                type: 'expense',
                description: sentinels.runtimeMerchant,
                category: sentinels.category,
                amount: 12.34,
                date: '2026-06-21',
                notes: sentinels.note
            });
            const flushed = await State.flushLocalVaultSaveQueue();
            const stored = localStorage.getItem('bb_data') || '';

            return {
                saved,
                flushed,
                classification: Vault.classifyLocalBudgetRecord(stored),
                stored,
                transactionCount: State.getTransactions().length,
                lastError: String(State.getLastLocalVaultSaveError?.()?.message || '')
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.saved).toBe(true);
        expect(result.flushed).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.transactionCount).toBe(1);
        expect(result.lastError).toBe('');
        expect(result.stored).not.toContain(SENTINELS.runtimeMerchant);
        expect(result.stored).not.toContain(SENTINELS.note);
    });

    test('app startup honors config flag and migrates existing bb_data before render', async ({ page }) => {
        await installSignedInRuntimeStub(page, { localVaultStorageEnabled: true });
        await page.goto(BLANK_FIXTURE);
        await page.evaluate((sentinels) => {
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{
                    id: 'rollout-app-start-tx',
                    type: 'expense',
                    description: sentinels.runtimeMerchant,
                    category: sentinels.category,
                    amount: 98.76,
                    date: '2026-06-21'
                }],
                categories: [{ id: 'rollout-app-start-cat', name: sentinels.category }],
                settings: {}
            }));
        }, SENTINELS);

        await page.goto('/app', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.app-header', { timeout: 15000 });
        await page.waitForFunction(() => typeof window.getTransactions === 'function', null, { timeout: 15000 });

        const state = await page.evaluate(async ({ vaultModulePath, sentinels }) => {
            const Vault = await import(vaultModulePath);
            const stored = localStorage.getItem('bb_data') || '';

            return {
                flagEnabled: window.__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__ === true,
                classification: Vault.classifyLocalBudgetRecord(stored),
                transactions: window.getTransactions?.() || [],
                stored,
                hasLocalVaultKeyInLocalStorage: Object.keys(localStorage).some(key => /vault/i.test(key))
            };
        }, {
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(state.flagEnabled).toBe(true);
        expect(state.classification.kind).toBe('encrypted');
        expect(state.transactions).toEqual(expect.arrayContaining([
            expect.objectContaining({ description: SENTINELS.runtimeMerchant })
        ]));
        expect(state.stored).not.toContain(SENTINELS.runtimeMerchant);
        expect(state.hasLocalVaultKeyInLocalStorage).toBe(false);
    });
});
