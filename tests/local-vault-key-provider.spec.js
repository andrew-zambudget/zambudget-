const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resetStorage(page) {
    await page.goto(BLANK_FIXTURE);
    await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();
        await new Promise(resolve => {
            const deleteLocal = indexedDB.deleteDatabase('zam_local_vault_keys');
            deleteLocal.onsuccess = () => resolve();
            deleteLocal.onerror = () => resolve();
            deleteLocal.onblocked = () => resolve();
        });
        await new Promise(resolve => {
            const deleteCloud = indexedDB.deleteDatabase('budgetbuddy_buddy_cloud_keys');
            deleteCloud.onsuccess = () => resolve();
            deleteCloud.onerror = () => resolve();
            deleteCloud.onblocked = () => resolve();
        });
    });
}

test.describe('local vault key provider', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('creates and reuses a non-extractable local vault key from its own IndexedDB store', async ({ page }) => {
        const result = await page.evaluate(async ({ providerModulePath, storageModulePath }) => {
            const Provider = await import(providerModulePath);
            const Vault = await import(storageModulePath);
            const keyId = Provider.getLocalVaultKeyId({ userId: 'phase3-key-user' });

            const first = await Provider.getOrCreateLocalVaultKey(keyId);
            const second = await Provider.getOrCreateLocalVaultKey(keyId);
            const envelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ id: 'phase3-key-reuse', description: 'Key reuse check' }],
                categories: [],
                settings: {}
            }, second.key);
            const restored = await Vault.decryptLocalVaultEnvelope(envelope, first.key);
            const exportAttempt = await crypto.subtle.exportKey('raw', first.key)
                .then(() => 'exported')
                .catch(error => error?.name || 'failed');

            return {
                keyId,
                dbName: Provider.LOCAL_VAULT_KEY_DB_NAME,
                cloudDbName: Provider.CLOUD_SYNC_TRUSTED_KEY_DB_NAME,
                storeName: Provider.LOCAL_VAULT_KEY_STORE,
                firstCreated: first.created,
                secondCreated: second.created,
                firstExtractable: first.key.extractable,
                secondExtractable: second.key.extractable,
                exportAttempt,
                restoredId: restored.transactions[0].id,
                roundtrip: await Provider.verifyLocalVaultKeyRoundtrip(first.key)
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            storageModulePath: modulePath('/js/localVaultStorage.js')
        });

        expect(result.keyId).toBe('user:phase3-key-user:primary');
        expect(result.dbName).toBe('zam_local_vault_keys');
        expect(result.cloudDbName).toBe('budgetbuddy_buddy_cloud_keys');
        expect(result.dbName).not.toBe(result.cloudDbName);
        expect(result.storeName).toBe('local_vault_keys');
        expect(result.firstCreated).toBe(true);
        expect(result.secondCreated).toBe(false);
        expect(result.firstExtractable).toBe(false);
        expect(result.secondExtractable).toBe(false);
        expect(result.exportAttempt).not.toBe('exported');
        expect(result.restoredId).toBe('phase3-key-reuse');
        expect(result.roundtrip).toBe(true);
    });

    test('does not treat browser access, sync-slot, or session token strings as local vault keys', async ({ page }) => {
        const result = await page.evaluate(async ({ providerModulePath, storageModulePath }) => {
            const Provider = await import(providerModulePath);
            const Vault = await import(storageModulePath);
            const tokenValues = [
                'bb_browser_access_token_should_not_decrypt',
                'bb_cloud_sync_slot_should_not_decrypt',
                'supabase_session_token_should_not_decrypt'
            ];
            const persistResults = [];
            const encryptResults = [];

            for (const token of tokenValues) {
                persistResults.push(await Provider.persistLocalVaultKey(`token:${token}`, token));
                try {
                    await Vault.encryptLocalVaultPayload({ transactions: [] }, token);
                    encryptResults.push('encrypted');
                } catch (error) {
                    encryptResults.push(error?.message || 'failed');
                }
            }

            return {
                persistResults,
                encryptResults,
                existingKey: await Provider.readLocalVaultKey('token:bb_browser_access_token_should_not_decrypt')
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            storageModulePath: modulePath('/js/localVaultStorage.js')
        });

        expect(result.persistResults).toEqual([false, false, false]);
        expect(result.existingKey).toBeNull();
        result.encryptResults.forEach(message => {
            expect(message).toContain('CryptoKey');
            expect(message).toContain('AES-GCM');
        });
    });

    test('deletes individual and all local vault keys without touching localStorage data', async ({ page }) => {
        const result = await page.evaluate(async ({ providerModulePath }) => {
            const Provider = await import(providerModulePath);
            const firstKeyId = Provider.getLocalVaultKeyId({ userId: 'phase3-delete-one' });
            const secondKeyId = Provider.getLocalVaultKeyId({ userId: 'phase3-delete-two' });

            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ description: 'local data must not be removed by key deletion' }],
                categories: [],
                settings: {}
            }));

            await Provider.getOrCreateLocalVaultKey(firstKeyId);
            await Provider.getOrCreateLocalVaultKey(secondKeyId);
            const deletedOne = await Provider.deleteLocalVaultKey(firstKeyId);
            const firstAfterDelete = await Provider.readLocalVaultKey(firstKeyId);
            const secondAfterDelete = await Provider.readLocalVaultKey(secondKeyId);
            const deletedAll = await Provider.deleteAllLocalVaultKeys();
            const secondAfterDeleteAll = await Provider.readLocalVaultKey(secondKeyId);

            return {
                deletedOne,
                deletedAll,
                firstAfterDelete: Boolean(firstAfterDelete),
                secondAfterDelete: Boolean(secondAfterDelete),
                secondAfterDeleteAll: Boolean(secondAfterDeleteAll),
                localData: localStorage.getItem('bb_data')
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js')
        });

        expect(result.deletedOne).toBe(true);
        expect(result.deletedAll).toBe(true);
        expect(result.firstAfterDelete).toBe(false);
        expect(result.secondAfterDelete).toBe(true);
        expect(result.secondAfterDeleteAll).toBe(false);
        expect(result.localData).toContain('local data must not be removed by key deletion');
    });

    test('reports provider availability and stable browser-local key ids', async ({ page }) => {
        const result = await page.evaluate(async ({ providerModulePath }) => {
            const Provider = await import(providerModulePath);
            return {
                available: Provider.canUseLocalVaultKeyProvider(),
                defaultId: Provider.getLocalVaultKeyId(),
                scopedLocalId: Provider.getLocalVaultKeyId({ scope: 'migration' }),
                dbName: Provider.LOCAL_VAULT_KEY_DB_NAME,
                version: Provider.LOCAL_VAULT_KEY_DB_VERSION,
                defaultKeyId: Provider.LOCAL_VAULT_DEFAULT_KEY_ID,
                algorithm: Provider.LOCAL_VAULT_KEY_ALGORITHM
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js')
        });

        expect(result).toEqual({
            available: true,
            defaultId: 'browser-local:primary',
            scopedLocalId: 'browser-local:migration',
            dbName: 'zam_local_vault_keys',
            version: 1,
            defaultKeyId: 'browser-local:primary',
            algorithm: 'AES-GCM'
        });
    });
});
