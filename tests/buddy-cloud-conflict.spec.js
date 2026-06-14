const { test, expect } = require('@playwright/test');

const BLANK_PAGE = '/tests/fixtures/blank.html';

function modulePath(path) {
    return `${path}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resetStorage(page) {
    await page.goto(BLANK_PAGE);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

async function runTrustedSignInScenario(page, { localAmount = 42 } = {}) {
    return page.evaluate(async ({ stateModulePath, cloudModulePath, localAmount }) => {
        const State = await import(stateModulePath);
        const Cloud = await import(cloudModulePath);
        const user = { id: 'trusted-signin-user', email: 'trusted@example.com' };
        const store = { vault: null, snapshots: [] };

        function makeSupabaseStub() {
            const makeQuery = (table) => {
                const query = {
                    _limit: 0,
                    select() { return this; },
                    eq() { return this; },
                    order() { return this; },
                    limit(value) {
                        this._limit = Number(value) || 0;
                        return this;
                    },
                    range() { return this; },
                    in() { return this; },
                    maybeSingle() {
                        if (table === 'buddy_cloud_vaults') {
                            return Promise.resolve({ data: store.vault ? { ...store.vault } : null, error: null });
                        }
                        if (table === 'buddy_cloud_vault_snapshots') {
                            return Promise.resolve({ data: store.snapshots[0] ? { ...store.snapshots[0] } : null, error: null });
                        }
                        return Promise.resolve({ data: null, error: null });
                    },
                    insert(row) {
                        if (table === 'buddy_cloud_vault_snapshots') {
                            store.snapshots.unshift({ ...row });
                        }
                        return Promise.resolve({ data: row, error: null });
                    },
                    upsert(row) {
                        if (table === 'buddy_cloud_vaults') {
                            store.vault = {
                                ...(store.vault || {}),
                                ...row,
                                updated_at: row.updated_at || row.client_updated_at
                            };
                        }
                        return Promise.resolve({ data: store.vault, error: null });
                    },
                    update(fields) {
                        if (table === 'buddy_cloud_vaults') {
                            store.vault = {
                                ...(store.vault || {}),
                                ...fields
                            };
                        }
                        this._result = { data: store.vault, error: null };
                        return this;
                    },
                    delete() {
                        this._result = { data: null, error: null };
                        return this;
                    },
                    then(resolve, reject) {
                        if (this._result) return Promise.resolve(this._result).then(resolve, reject);
                        if (table === 'buddy_cloud_vault_snapshots') {
                            const rows = this._limit ? store.snapshots.slice(0, this._limit) : [...store.snapshots];
                            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                        }
                        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                    }
                };
                return query;
            };

            return {
                from: makeQuery,
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

        const supabaseClient = makeSupabaseStub();
        const initialSnapshot = {
            transactions: [{
                id: 'tx-trusted-signin',
                type: 'expense',
                amount: 42,
                category: 'Testing',
                description: 'Trusted sign-in check',
                date: '2020-01-01',
                createdAt: '2020-01-01T00:00:00.000Z',
                createdAtUTC: '2020-01-01T00:00:00.000Z',
                serverLoggedAtUTC: '2020-01-01T00:00:00.000Z',
                updatedAtUTC: '2020-01-01T00:00:00.000Z'
            }],
            categories: [{
                id: 'cat-trusted-signin',
                type: 'expense',
                name: 'Testing',
                icon: 'T',
                budget: 100,
                createdAt: '2020-01-01T00:00:00.000Z'
            }],
            settings: { currency: '$', lastCategorySort: 'custom' }
        };

        State.replaceSnapshot(initialSnapshot, { remoteUpdatedAt: '2020-01-01T00:00:00.000Z' });
        await Cloud.init({
            supabaseClient,
            user,
            getSnapshot: State.getSnapshot,
            replaceSnapshot: State.replaceSnapshot,
            afterRemoteApply: () => {},
            isPremiumAccount: () => false
        });
        const setup = await Cloud.enableSync();

        store.vault.client_updated_at = '2020-01-01T01:00:00.000Z';
        store.vault.updated_at = '2020-01-01T01:00:00.000Z';

        State.replaceSnapshot({
            ...initialSnapshot,
            transactions: [{
                ...initialSnapshot.transactions[0],
                amount: localAmount,
                updatedAtUTC: '2020-01-01T02:00:00.000Z'
            }]
        }, { remoteUpdatedAt: '2020-01-01T02:00:00.000Z' });
        localStorage.setItem(`bb_cloud_force_pull_after_sign_in_${user.id}`, 'true');

        await Cloud.importRecoveryKey(setup.recoveryKey);
        const initResult = await Cloud.init({
            supabaseClient,
            user,
            getSnapshot: State.getSnapshot,
            replaceSnapshot: State.replaceSnapshot,
            afterRemoteApply: () => {},
            isPremiumAccount: () => false
        });
        const status = Cloud.getStatus();
        const stored = JSON.parse(localStorage.getItem('bb_data') || '{}');

        return {
            initResult,
            hasConflict: status.hasConflict,
            lastError: status.lastError,
            conflictRemoteAt: localStorage.getItem('bb_cloud_conflict_remote_at'),
            forcePullMarker: localStorage.getItem(`bb_cloud_force_pull_after_sign_in_${user.id}`),
            lastRemoteAt: localStorage.getItem('bb_cloud_last_remote_at'),
            storedAmount: stored.transactions?.[0]?.amount || 0
        };
    }, {
        stateModulePath: modulePath('/js/state.js'),
        cloudModulePath: modulePath('/js/cloudSync.js'),
        localAmount
    });
}

test.describe('Buddy Cloud conflict sensitivity', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('stale enabled state without a remote vault allows fresh recovery key setup', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, cloudModulePath }) => {
            const State = await import(stateModulePath);
            const Cloud = await import(cloudModulePath);
            const user = { id: 'fresh-test-user', email: 'test-user@example.invalid' };
            const store = { vault: null, snapshots: [] };

            function makeSupabaseStub() {
                const makeQuery = (table) => {
                    const query = {
                        _limit: 0,
                        select() { return this; },
                        eq() { return this; },
                        order() { return this; },
                        limit(value) {
                            this._limit = Number(value) || 0;
                            return this;
                        },
                        maybeSingle() {
                            if (table === 'buddy_cloud_vaults') {
                                return Promise.resolve({ data: store.vault ? { ...store.vault } : null, error: null });
                            }
                            if (table === 'buddy_cloud_vault_snapshots') {
                                return Promise.resolve({ data: store.snapshots[0] ? { ...store.snapshots[0] } : null, error: null });
                            }
                            return Promise.resolve({ data: null, error: null });
                        },
                        insert(row) {
                            if (table === 'buddy_cloud_vault_snapshots') {
                                store.snapshots.unshift({ ...row });
                            }
                            return Promise.resolve({ data: row, error: null });
                        },
                        upsert(row) {
                            if (table === 'buddy_cloud_vaults') {
                                store.vault = {
                                    ...(store.vault || {}),
                                    ...row,
                                    updated_at: row.updated_at || row.client_updated_at
                                };
                            }
                            return Promise.resolve({ data: store.vault, error: null });
                        },
                        then(resolve, reject) {
                            if (table === 'buddy_cloud_vault_snapshots') {
                                const rows = this._limit ? store.snapshots.slice(0, this._limit) : [...store.snapshots];
                                return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                            }
                            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                        }
                    };
                    return query;
                };

                return {
                    from: makeQuery,
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

            State.replaceSnapshot({
                transactions: [],
                categories: [],
                settings: { currency: '$' }
            });
            localStorage.setItem('bb_cloud_sync_enabled', 'true');

            const initResult = await Cloud.init({
                supabaseClient: makeSupabaseStub(),
                user,
                getSnapshot: State.getSnapshot,
                replaceSnapshot: State.replaceSnapshot,
                afterRemoteApply: () => {},
                isPremiumAccount: () => false
            });
            const statusAfterInit = Cloud.getStatus();
            const setup = await Cloud.enableSync();
            const statusAfterSetup = Cloud.getStatus();

            return {
                initResult,
                enabledAfterInit: statusAfterInit.enabled,
                lastErrorAfterInit: statusAfterInit.lastError,
                setupEnabled: setup.enabled,
                remoteExisted: setup.remoteExisted,
                hasRecoveryKey: typeof setup.recoveryKey === 'string' && setup.recoveryKey.length > 20,
                enabledAfterSetup: statusAfterSetup.enabled,
                hasKeyAfterSetup: statusAfterSetup.hasKey,
                vaultCreated: Boolean(store.vault?.payload)
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            cloudModulePath: modulePath('/js/cloudSync.js')
        });

        expect(result.initResult).toBe(false);
        expect(result.enabledAfterInit).toBe(false);
        expect(result.lastErrorAfterInit).toBe('');
        expect(result.setupEnabled).toBe(true);
        expect(result.remoteExisted).toBe(false);
        expect(result.hasRecoveryKey).toBe(true);
        expect(result.enabledAfterSetup).toBe(true);
        expect(result.hasKeyAfterSetup).toBe(true);
        expect(result.vaultCreated).toBe(true);
    });

    test('status reports local changes newer than verified Buddy Cloud', async ({ page }) => {
        const result = await page.evaluate(async ({ stateModulePath, cloudModulePath }) => {
            const State = await import(stateModulePath);
            const Cloud = await import(cloudModulePath);
            const user = { id: 'unbacked-local-status-user', email: 'unbacked-status@example.com' };

            State.replaceSnapshot({
                transactions: [{
                    id: 'tx-old-cloud',
                    type: 'expense',
                    amount: 12,
                    category: 'Testing',
                    description: 'Old verified cloud state',
                    date: '2026-06-13',
                    createdAt: '2026-06-13T18:00:00.000Z',
                    createdAtUTC: '2026-06-13T18:00:00.000Z',
                    serverLoggedAtUTC: '2026-06-13T18:00:00.000Z',
                    updatedAtUTC: '2026-06-13T18:00:00.000Z'
                }],
                categories: [{
                    id: 'cat-old-cloud',
                    type: 'expense',
                    name: 'Testing',
                    icon: 'T',
                    budget: 50,
                    createdAt: '2026-06-13T18:00:00.000Z'
                }],
                settings: { currency: '$' }
            }, { remoteUpdatedAt: '2026-06-13T18:00:00.000Z' });
            localStorage.setItem('bb_cloud_last_pushed_at', '2026-06-13T18:00:00.000Z');
            localStorage.setItem('bb_cloud_last_remote_at', '2026-06-13T18:00:00.000Z');
            localStorage.setItem('bb_cloud_sync_enabled', 'true');

            State.addTransaction({
                id: 'tx-new-local',
                type: 'expense',
                amount: 8,
                category: 'Testing',
                description: 'New local change',
                date: '2026-06-13',
                createdAt: '2026-06-13T20:00:00.000Z',
                createdAtUTC: '2026-06-13T20:00:00.000Z',
                serverLoggedAtUTC: '2026-06-13T20:00:00.000Z',
                updatedAtUTC: '2026-06-13T20:00:00.000Z'
            });

            const supabaseClient = {
                from: () => ({
                    select() { return this; },
                    eq() { return this; },
                    maybeSingle: async () => ({
                        data: {
                            payload: { algorithm: 'AES-GCM', iv: 'unused', ciphertext: 'unused' },
                            payload_checksum: 'old-checksum',
                            client_updated_at: '2026-06-13T18:00:00.000Z',
                            updated_at: '2026-06-13T18:00:00.000Z',
                            sync_owner_slots: []
                        },
                        error: null
                    })
                }),
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

            await Cloud.init({
                supabaseClient,
                user,
                getSnapshot: State.getSnapshot,
                replaceSnapshot: State.replaceSnapshot,
                afterRemoteApply: () => {},
                isPremiumAccount: () => false
            });

            const status = Cloud.getStatus();
            return {
                hasUnverifiedLocalChanges: status.hasUnverifiedLocalChanges,
                lastVerifiedCloudAt: status.lastVerifiedCloudAt,
                localUpdatedAt: status.localUpdatedAt,
                lastError: status.lastError
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            cloudModulePath: modulePath('/js/cloudSync.js')
        });

        expect(result.hasUnverifiedLocalChanges).toBe(true);
        expect(result.lastVerifiedCloudAt).toBe('2026-06-13T18:00:00.000Z');
        expect(Date.parse(result.localUpdatedAt)).toBeGreaterThan(Date.parse(result.lastVerifiedCloudAt));
        expect(result.lastError).toContain('Import your Buddy Cloud recovery key');
    });

    test('trusted sign-in pulls cloud when local copy only has volatile timestamp noise', async ({ page }) => {
        const result = await runTrustedSignInScenario(page, { localAmount: 42 });

        expect(result.initResult).toBe(true);
        expect(result.hasConflict).toBe(false);
        expect(result.lastError).toBe('');
        expect(result.conflictRemoteAt).toBeNull();
        expect(result.forcePullMarker).toBeNull();
        expect(result.lastRemoteAt).toBe('2020-01-01T01:00:00.000Z');
        expect(result.storedAmount).toBe(42);
    });

    test('trusted sign-in still blocks for review when local budget content differs', async ({ page }) => {
        const result = await runTrustedSignInScenario(page, { localAmount: 99 });

        expect(result.initResult).toBe(false);
        expect(result.hasConflict).toBe(true);
        expect(result.lastError).toContain('Possible data loss prevented');
        expect(result.conflictRemoteAt).toBe('2020-01-01T01:00:00.000Z');
        expect(result.forcePullMarker).toBe('true');
        expect(result.storedAmount).toBe(99);
    });
});
