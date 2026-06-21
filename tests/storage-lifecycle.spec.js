const { test, expect } = require('@playwright/test');

const BLANK_PAGE = '/tests/fixtures/blank.html';

async function resetStorage(page, path = BLANK_PAGE) {
    await page.goto(path);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

function modulePath(path) {
    return `${path}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test.describe('Zam! storage lifecycle', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('demo save() does not advance demo timestamp when zam_demo_data write fails', async ({ page }) => {
        const result = await page.evaluate(async (stateModulePath) => {
            const State = await import(stateModulePath);
            sessionStorage.setItem('zam_demo_active', 'true');
            const originalSetItem = Storage.prototype.setItem;
            let timestampAttempted = false;

            Storage.prototype.setItem = function patchedSetItem(key, value) {
                if (key === 'zam_demo_data') throw new DOMException('Quota exceeded', 'QuotaExceededError');
                if (key === 'zam_demo_local_updated_at') timestampAttempted = true;
                return originalSetItem.call(this, key, value);
            };

            State.addTransaction({
                id: 'tx-quota-fail',
                type: 'expense',
                amount: 50,
                category: 'Food',
                description: 'Lunch',
                date: '2026-06-13'
            });

            Storage.prototype.setItem = originalSetItem;

            return {
                timestampAttempted,
                timestamp: sessionStorage.getItem('zam_demo_local_updated_at'),
                savedData: sessionStorage.getItem('zam_demo_data'),
                realData: localStorage.getItem('bb_data'),
                memoryCount: State.getTransactions().length
            };
        }, modulePath('/js/state.js'));

        expect(result.timestampAttempted).toBe(false);
        expect(result.timestamp).toBeNull();
        expect(result.savedData).toBeNull();
        expect(result.realData).toBeNull();
        expect(result.memoryCount).toBe(1);
    });

    test('replaceSnapshot() rolls memory back when bb_data write fails', async ({ page }) => {
        const result = await page.evaluate(async (stateModulePath) => {
            const State = await import(stateModulePath);
            State.replaceSnapshot({
                transactions: [{ id: 'tx-original', type: 'expense', amount: 100, category: 'Rent' }],
                categories: [],
                settings: {}
            }, { remoteUpdatedAt: '2026-06-13T00:00:00.000Z' });

            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function patchedSetItem(key, value) {
                if (key === 'bb_data') throw new DOMException('Quota exceeded', 'QuotaExceededError');
                return originalSetItem.call(this, key, value);
            };

            let threw = false;
            try {
                State.replaceSnapshot({
                    transactions: [{ id: 'tx-new', type: 'expense', amount: 500, category: 'Travel' }],
                    categories: [],
                    settings: {}
                });
            } catch {
                threw = true;
            }

            Storage.prototype.setItem = originalSetItem;

            return {
                threw,
                memoryTransactions: State.getTransactions(),
                storedTransactions: JSON.parse(localStorage.getItem('bb_data')).transactions
            };
        }, modulePath('/js/state.js'));

        expect(result.threw).toBe(true);
        expect(result.memoryTransactions).toHaveLength(1);
        expect(result.memoryTransactions[0].id).toBe('tx-original');
        expect(result.storedTransactions).toHaveLength(1);
        expect(result.storedTransactions[0].id).toBe('tx-original');
    });

    test('replaceSnapshot() keeps memory aligned when only timestamp metadata fails', async ({ page }) => {
        const result = await page.evaluate(async (stateModulePath) => {
            const State = await import(stateModulePath);
            const originalSetItem = Storage.prototype.setItem;

            Storage.prototype.setItem = function patchedSetItem(key, value) {
                if (key === 'bb_local_updated_at') throw new DOMException('Metadata write failed', 'QuotaExceededError');
                return originalSetItem.call(this, key, value);
            };

            let threw = false;
            try {
                State.replaceSnapshot({
                    transactions: [{ id: 'tx-metadata', type: 'income', amount: 900, category: 'Paycheck' }],
                    categories: [],
                    settings: {}
                });
            } catch {
                threw = true;
            }

            Storage.prototype.setItem = originalSetItem;

            return {
                threw,
                memoryTransactions: State.getTransactions(),
                storedTransactions: JSON.parse(localStorage.getItem('bb_data')).transactions,
                timestamp: localStorage.getItem('bb_local_updated_at')
            };
        }, modulePath('/js/state.js'));

        expect(result.threw).toBe(false);
        expect(result.memoryTransactions[0].id).toBe('tx-metadata');
        expect(result.storedTransactions[0].id).toBe('tx-metadata');
        expect(result.timestamp).toBeNull();
    });

    test('factoryReset() removes only Zam! namespace keys', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('bb_data', '{"transactions":[]}');
            sessionStorage.setItem('zam_demo_active', 'true');
            sessionStorage.setItem('zam_demo_data', '{"transactions":[{"id":"demo"}]}');
            localStorage.setItem('keep_this_key', 'safe');
            sessionStorage.setItem('bb_temp_session', 'active');
            sessionStorage.setItem('keep_this_session_key', 'safe');
        });

        const reloaded = page.waitForEvent('framenavigated');
        await page.evaluate(async (stateModulePath) => {
            const State = await import(stateModulePath);
            State.factoryReset();
        }, modulePath('/js/state.js')).catch((error) => {
            if (!/Execution context was destroyed|navigation/i.test(error.message)) throw error;
        });
        await reloaded;
        await page.waitForLoadState('domcontentloaded');

        const keys = await page.evaluate(() => ({
            data: localStorage.getItem('bb_data'),
            demo: sessionStorage.getItem('zam_demo_active'),
            demoData: sessionStorage.getItem('zam_demo_data'),
            kept: localStorage.getItem('keep_this_key'),
            session: sessionStorage.getItem('bb_temp_session'),
            keptSession: sessionStorage.getItem('keep_this_session_key')
        }));

        expect(keys.data).toBeNull();
        expect(keys.demo).toBeNull();
        expect(keys.demoData).toBeNull();
        expect(keys.session).toBeNull();
        expect(keys.kept).toBe('safe');
        expect(keys.keptSession).toBe('safe');
    });

    test('privacy cleanup removes stranded legacy demo backup without restore', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('bb_demo_backup_has_data', 'true');
            localStorage.setItem('bb_demo_backup_bb_data', JSON.stringify({
                transactions: [{ id: 'restore-me', amount: 999, category: 'Protected' }],
                categories: [],
                settings: {}
            }));
            localStorage.setItem('bb_demo_backup_local_updated_at', '2026-06-13T01:00:00.000Z');
            localStorage.removeItem('bb_demo_active');
        });

        const cleanupResult = await page.evaluate(async (cleanupModulePath) => {
            const Cleanup = await import(cleanupModulePath);
            return Cleanup.runPrivacyStorageCleanup();
        }, modulePath('/js/privacyStorageCleanup.js'));

        expect(cleanupResult.blocked).toBe(false);
        const restored = await page.evaluate(() => ({
            data: localStorage.getItem('bb_data'),
            updatedAt: localStorage.getItem('bb_local_updated_at'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data'),
            backupData: localStorage.getItem('bb_demo_backup_bb_data')
        }));

        expect(restored.data).toBeNull();
        expect(restored.updatedAt).toBeNull();
        expect(restored.backupFlag).toBeNull();
        expect(restored.backupData).toBeNull();
    });

    test('privacy cleanup migrates legacy storage only when modern bb_data is missing', async ({ page }) => {
        const migration = await page.evaluate(async (cleanupModulePath) => {
            localStorage.setItem('bb_transactions', JSON.stringify([
                { id: 'legacy-tx', type: 'expense', amount: 50, category: 'Legacy', description: 'Legacy lunch' }
            ]));
            localStorage.setItem('bb_categories', JSON.stringify([
                { id: 'legacy-cat', type: 'expense', name: 'Legacy', budget: 100 }
            ]));

            const Cleanup = await import(cleanupModulePath);
            const first = Cleanup.runPrivacyStorageCleanup();
            const migratedData = JSON.parse(localStorage.getItem('bb_data'));

            localStorage.setItem('bb_transactions', JSON.stringify([
                { id: 'legacy-tx-2', type: 'expense', amount: 500, category: 'Should Not Win', description: 'Old data' }
            ]));
            const second = Cleanup.runPrivacyStorageCleanup();
            const preservedData = JSON.parse(localStorage.getItem('bb_data'));

            return { first, migratedData, second, preservedData };
        }, modulePath('/js/privacyStorageCleanup.js'));

        expect(migration.first.blocked).toBe(false);
        expect(migration.first.legacyMigration.migrated).toBe(true);
        expect(migration.migratedData.transactions[0].id).toBe('legacy-tx');
        expect(migration.migratedData.categories[0].name).toBe('Legacy');
        expect(migration.second.legacyMigration).toEqual({ migrated: false, reason: 'bb_data_present' });
        expect(migration.preservedData.transactions[0].id).toBe('legacy-tx');
    });

    test('privacy cleanup strips old sensitive storage helpers', async ({ page }) => {
        const result = await page.evaluate(async (cleanupModulePath) => {
            localStorage.setItem('bb_cloud_key_user-1', 'raw-secret-key');
            localStorage.setItem('bb_circular_buffer', JSON.stringify({ expense: ['Sensitive merchant'] }));
            localStorage.setItem('bb_sync_history', JSON.stringify([
                {
                    id: 'old-history',
                    time: '2026-06-13T01:00:00.000Z',
                    status: 'synced',
                    message: 'Budget synced.',
                    details: { transaction: { amount: 12, description: 'Sensitive merchant' } }
                }
            ]));

            const Cleanup = await import(cleanupModulePath);
            Cleanup.runPrivacyStorageCleanup();

            return {
                cloudKey: localStorage.getItem('bb_cloud_key_user-1'),
                circularBuffer: localStorage.getItem('bb_circular_buffer'),
                history: JSON.parse(localStorage.getItem('bb_sync_history'))
            };
        }, modulePath('/js/privacyStorageCleanup.js'));

        expect(result.cloudKey).toBeNull();
        expect(result.circularBuffer).toBeNull();
        expect(result.history).toHaveLength(1);
        expect(result.history[0].details).toBeUndefined();
        expect(result.history[0].message).toBe('Budget synced.');
    });

    test('signed-in owner change clears stale account-scoped budget state', async ({ page }) => {
        const result = await page.evaluate(async (ownerModulePath) => {
            localStorage.setItem('bb_signed_in_owner_id', 'deleted-user-id');
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'old-budget', amount: 50, category: 'Old' }],
                categories: [{ id: 'old-cat', name: 'Old', type: 'expense' }],
                settings: {}
            }));
            localStorage.setItem('bb_local_updated_at', '2026-06-13T01:00:00.000Z');
            localStorage.setItem('bb_cloud_sync_enabled', 'true');
            localStorage.setItem('bb_cloud_sync_slot_v1', 'new-slot-token');
            localStorage.setItem('bb_cloud_sync_slot_deleted-user-id', 'old-slot-token');
            localStorage.setItem('bb_browser_access_token_deleted-user-id', 'old-browser-token');
            localStorage.setItem('bb_cloud_recovery_key_saved_v1', 'true');
            localStorage.setItem('bb_cloud_recovery_key_backed_up_v1', 'true');
            localStorage.setItem('bb_cloud_recovery_key_saved_deleted-user-id', 'true');
            localStorage.setItem('bb_theme_mode', 'dark');
            localStorage.setItem('bb_accent_color', 'teal');

            const Owner = await import(ownerModulePath);
            const guard = Owner.guardSignedInLocalOwner('fresh-user-id');

            return {
                guard,
                owner: localStorage.getItem('bb_signed_in_owner_id'),
                ownerHash: localStorage.getItem('bb_signed_in_owner_hash_v1'),
                data: localStorage.getItem('bb_data'),
                updatedAt: localStorage.getItem('bb_local_updated_at'),
                cloudEnabled: localStorage.getItem('bb_cloud_sync_enabled'),
                genericSlot: localStorage.getItem('bb_cloud_sync_slot_v1'),
                slot: localStorage.getItem('bb_cloud_sync_slot_deleted-user-id'),
                browserToken: localStorage.getItem('bb_browser_access_token_deleted-user-id'),
                genericRecoverySaved: localStorage.getItem('bb_cloud_recovery_key_saved_v1'),
                genericRecoveryBackedUp: localStorage.getItem('bb_cloud_recovery_key_backed_up_v1'),
                recoverySaved: localStorage.getItem('bb_cloud_recovery_key_saved_deleted-user-id'),
                theme: localStorage.getItem('bb_theme_mode'),
                accent: localStorage.getItem('bb_accent_color')
            };
        }, modulePath('/js/accountLocalState.js'));

        expect(result.guard.changed).toBe(true);
        expect(result.guard.previousUserId).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
        expect(result.guard.previousUserId).not.toContain('deleted-user-id');
        expect(result.guard.nextUserId).toBe('fresh-user-id');
        expect(result.owner).toBeNull();
        expect(result.ownerHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
        expect(result.ownerHash).not.toContain('fresh-user-id');
        expect(result.data).toBeNull();
        expect(result.updatedAt).toBeNull();
        expect(result.cloudEnabled).toBeNull();
        expect(result.genericSlot).toBeNull();
        expect(result.slot).toBeNull();
        expect(result.browserToken).toBeNull();
        expect(result.genericRecoverySaved).toBeNull();
        expect(result.genericRecoveryBackedUp).toBeNull();
        expect(result.recoverySaved).toBeNull();
        expect(result.theme).toBe('dark');
        expect(result.accent).toBe('teal');
    });

    test('signed-in owner guard preserves same-owner and unmarked existing budgets', async ({ page }) => {
        const result = await page.evaluate(async (ownerModulePath) => {
            const Owner = await import(ownerModulePath);

            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'unmarked-budget', amount: 25, category: 'Groceries' }],
                categories: [],
                settings: {}
            }));

            const firstRunGuard = Owner.guardSignedInLocalOwner('existing-user-id');
            const firstRunData = JSON.parse(localStorage.getItem('bb_data') || '{}');

            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'same-owner-budget', amount: 30, category: 'Fuel' }],
                categories: [],
                settings: {}
            }));

            const sameOwnerGuard = Owner.guardSignedInLocalOwner('existing-user-id');
            const sameOwnerData = JSON.parse(localStorage.getItem('bb_data') || '{}');

            return {
                firstRunGuard,
                firstRunData,
                sameOwnerGuard,
                sameOwnerData,
                owner: localStorage.getItem('bb_signed_in_owner_id'),
                ownerHash: localStorage.getItem('bb_signed_in_owner_hash_v1')
            };
        }, modulePath('/js/accountLocalState.js'));

        expect(result.firstRunGuard.changed).toBe(false);
        expect(result.firstRunData.transactions[0].id).toBe('unmarked-budget');
        expect(result.sameOwnerGuard.changed).toBe(false);
        expect(result.sameOwnerData.transactions[0].id).toBe('same-owner-budget');
        expect(result.owner).toBeNull();
        expect(result.ownerHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
        expect(result.ownerHash).not.toContain('existing-user-id');
    });

    test('demo mode keeps real budget untouched when the user exits', async ({ page }) => {
        await resetStorage(page, `${BLANK_PAGE}?setup=real-budget`);
        await page.evaluate(() => {
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'real-tx', amount: 800, category: 'RealRent', description: 'Real rent' }],
                categories: [{ id: 'real-cat', type: 'expense', name: 'RealRent', budget: 800 }],
                settings: {}
            }));
            localStorage.setItem('bb_local_updated_at', '2026-06-13T02:00:00.000Z');
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        });

        await page.goto(`${BLANK_PAGE}?demo=1`);

        const demoState = await page.evaluate(async (demoModulePath) => {
            const Demo = await import(demoModulePath);
            const demoModeState = Demo.prepareDemoMode({ user: null });
            Demo.initDemoMode({ demoModeState, user: null, accountTier: 'free' });
            return {
                active: Demo.isDemoModeActive(),
                data: localStorage.getItem('bb_data'),
                demoData: sessionStorage.getItem('zam_demo_data'),
                backup: localStorage.getItem('bb_demo_backup_bb_data'),
                bannerVisible: Boolean(document.getElementById('bbDemoModeBanner'))
            };
        }, modulePath('/js/demoMode.js'));

        expect(demoState.active).toBe(true);
        expect(demoState.data).toContain('RealRent');
        expect(demoState.data).not.toContain('demo-income-1');
        expect(demoState.demoData).toContain('demo-income-1');
        expect(demoState.backup).toBeNull();
        expect(demoState.bannerVisible).toBe(true);

        await Promise.all([
            page.waitForURL((url) => !url.searchParams.has('demo')),
            page.locator('[data-demo-action="end"]').click()
        ]);

        const restored = await page.evaluate(() => ({
            data: localStorage.getItem('bb_data'),
            active: sessionStorage.getItem('zam_demo_active'),
            demoData: sessionStorage.getItem('zam_demo_data'),
            backup: localStorage.getItem('bb_demo_backup_bb_data')
        }));

        expect(restored.data).toContain('RealRent');
        expect(restored.data).not.toContain('demo-income-1');
        expect(restored.active).toBeNull();
        expect(restored.demoData).toBeNull();
        expect(restored.backup).toBeNull();
    });
});
