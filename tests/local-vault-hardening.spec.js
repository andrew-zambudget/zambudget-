const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    waitForAppReady
} = require('./helpers/appHarness');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const HARDENING_SENTINELS = Object.freeze({
    merchant: 'HARDENING_SENTINEL_MERCHANT_NO_LEAK',
    category: 'HARDENING_SENTINEL_CATEGORY_NO_LEAK',
    note: 'HARDENING_SENTINEL_NOTE_NO_LEAK',
    giftCard: 'HARDENING_SENTINEL_GIFT_CARD_NO_LEAK',
    deleted: 'HARDENING_SENTINEL_DELETED_NO_LEAK',
    csv: 'HARDENING_SENTINEL_CSV_NO_LEAK',
    amount: '76543.21'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function expectNoSentinelLeak(rawText, sentinels = HARDENING_SENTINELS) {
    Object.values(sentinels).forEach((sentinel) => {
        expect(rawText).not.toContain(String(sentinel));
    });
}

async function resetAllBrowserStorage(page) {
    await page.goto(BLANK_FIXTURE);
    await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();

        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        const dbNames = typeof indexedDB.databases === 'function'
            ? (await indexedDB.databases()).map(db => db.name).filter(Boolean)
            : ['zam_local_vault_keys', 'budgetbuddy_buddy_cloud_keys'];

        await Promise.all(dbNames.map(name => new Promise(resolve => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        })));
    });
}

test.describe('local vault hardening and penetration checks', () => {
    test.beforeEach(async ({ page }) => {
        await resetAllBrowserStorage(page);
    });

    test('rejects cross-purpose budget and metadata envelopes', async ({ page }) => {
        const result = await page.evaluate(async ({ vaultModulePath, metadataModulePath, sentinels }) => {
            const Vault = await import(vaultModulePath);
            const Metadata = await import(metadataModulePath);
            const key = await Vault.generateLocalVaultKey();

            const budgetEnvelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ id: 'budget-envelope', description: sentinels.merchant }],
                categories: [{ id: 'budget-category', name: sentinels.category }],
                settings: {}
            }, key);
            const syncEnvelope = await Metadata.encryptLocalMetadataPayload([
                {
                    id: 'sync-history-event',
                    time: '2026-06-21T18:30:00.000Z',
                    status: 'synced',
                    message: 'Cloud Sync is up to date.'
                }
            ], key, { name: 'sync_history' });

            const budgetAsMetadata = await Metadata.decryptLocalMetadataEnvelope(
                Vault.serializeLocalVaultEnvelope(budgetEnvelope),
                key,
                { name: 'sync_history' }
            ).then(() => 'loaded').catch(error => error?.message || 'rejected');

            const metadataAsBudget = await Vault.decryptLocalVaultEnvelope(
                Metadata.serializeLocalMetadataEnvelope(syncEnvelope, { name: 'sync_history' }),
                key
            ).then(() => 'loaded').catch(error => error?.message || 'rejected');

            return { budgetAsMetadata, metadataAsBudget };
        }, {
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            metadataModulePath: modulePath('/js/localMetadataVaultStorage.js'),
            sentinels: HARDENING_SENTINELS
        });

        expect(result.budgetAsMetadata).not.toBe('loaded');
        expect(result.budgetAsMetadata).toContain('kind');
        expect(result.metadataAsBudget).not.toBe('loaded');
        expect(result.metadataAsBudget).toContain('kind');
    });

    test('rejects tampered budget and metadata envelope headers before data can load', async ({ page }) => {
        const result = await page.evaluate(async ({ vaultModulePath, metadataModulePath }) => {
            const Vault = await import(vaultModulePath);
            const Metadata = await import(metadataModulePath);
            const key = await Vault.generateLocalVaultKey();
            const flip = value => `${value.startsWith('A') ? 'B' : 'A'}${value.slice(1)}`;

            const budgetEnvelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ id: 'tamper-budget' }],
                categories: [],
                settings: {}
            }, key);
            const metadataEnvelope = await Metadata.encryptLocalMetadataPayload(
                [{ id: 'tamper-metadata', message: 'Saved locally.' }],
                key,
                { name: 'sync_history' }
            );

            const budgetMutations = {
                kind: { ...budgetEnvelope, kind: 'zam_local_metadata_vault' },
                version: { ...budgetEnvelope, version: 2 },
                algorithm: { ...budgetEnvelope, algorithm: 'AES-CBC' },
                iv: { ...budgetEnvelope, iv: flip(budgetEnvelope.iv) },
                ciphertext: { ...budgetEnvelope, ciphertext: flip(budgetEnvelope.ciphertext) }
            };
            const metadataMutations = {
                kind: { ...metadataEnvelope, kind: 'zam_local_budget_vault' },
                version: { ...metadataEnvelope, version: 2 },
                algorithm: { ...metadataEnvelope, algorithm: 'AES-CBC' },
                name: { ...metadataEnvelope, name: 'budget_data' },
                iv: { ...metadataEnvelope, iv: flip(metadataEnvelope.iv) },
                ciphertext: { ...metadataEnvelope, ciphertext: flip(metadataEnvelope.ciphertext) }
            };

            const budgetResults = {};
            for (const [name, envelope] of Object.entries(budgetMutations)) {
                budgetResults[name] = await Vault.decryptLocalVaultEnvelope(envelope, key)
                    .then(() => 'loaded')
                    .catch(error => error?.name || error?.message || 'rejected');
            }

            const metadataResults = {};
            for (const [name, envelope] of Object.entries(metadataMutations)) {
                metadataResults[name] = await Metadata.decryptLocalMetadataEnvelope(envelope, key, { name: 'sync_history' })
                    .then(() => 'loaded')
                    .catch(error => error?.name || error?.message || 'rejected');
            }

            return { budgetResults, metadataResults };
        }, {
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            metadataModulePath: modulePath('/js/localMetadataVaultStorage.js')
        });

        Object.values(result.budgetResults).forEach(value => expect(value).not.toBe('loaded'));
        Object.values(result.metadataResults).forEach(value => expect(value).not.toBe('loaded'));
    });

    test('vault keys resist export and wrap attempts; deleted key makes stored budget unreadable by the provider', async ({ page }) => {
        const result = await page.evaluate(async ({ providerModulePath, vaultModulePath, sentinels }) => {
            const Provider = await import(providerModulePath);
            const Vault = await import(vaultModulePath);
            const keyId = Provider.getLocalVaultKeyId({ userId: 'hardening-key-user', scope: 'budget-data' });
            const keyResult = await Provider.getOrCreateLocalVaultKey(keyId);
            const wrappingKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
                ['wrapKey']
            );

            await Vault.writeEncryptedLocalVaultRecord(localStorage, {
                transactions: [{ id: 'hardening-key-tx', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }, keyResult.key);

            const exportAttempt = await crypto.subtle.exportKey('raw', keyResult.key)
                .then(() => 'exported')
                .catch(error => error?.name || error?.message || 'failed');
            const wrapAttempt = await crypto.subtle.wrapKey(
                'raw',
                keyResult.key,
                wrappingKey,
                { name: 'AES-GCM', iv: new Uint8Array(12) }
            ).then(() => 'wrapped').catch(error => error?.name || error?.message || 'failed');

            const deleted = await Provider.deleteLocalVaultKey(keyId);
            const restoredKey = await Provider.readLocalVaultKey(keyId);
            const readAfterDelete = await Vault.readEncryptedLocalVaultRecord(localStorage, restoredKey)
                .then(() => 'read')
                .catch(error => error?.name || error?.message || 'failed');

            return {
                keyExtractable: keyResult.key.extractable,
                keyUsages: keyResult.key.usages,
                exportAttempt,
                wrapAttempt,
                deleted,
                restoredKeyPresent: Boolean(restoredKey),
                readAfterDelete,
                stored: localStorage.getItem('bb_data') || ''
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: HARDENING_SENTINELS
        });

        expect(result.keyExtractable).toBe(false);
        expect(result.keyUsages).toEqual(['encrypt', 'decrypt']);
        expect(result.exportAttempt).not.toBe('exported');
        expect(result.wrapAttempt).not.toBe('wrapped');
        expect(result.deleted).toBe(true);
        expect(result.restoredKeyPresent).toBe(false);
        expect(result.readAfterDelete).not.toBe('read');
        expectNoSentinelLeak(result.stored);
    });

    test('encrypted budget sentinels do not leak through local/session storage, cookies, cache, IndexedDB, network payloads, or console output', async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        const browserIssues = [];
        const networkPayloads = [];
        page.on('console', message => {
            if (['warning', 'error'].includes(message.type())) {
                browserIssues.push(`[${message.type()}] ${message.text()}`);
            }
        });
        page.on('pageerror', error => {
            browserIssues.push(`[pageerror] ${error.message}`);
        });
        page.on('request', request => {
            const postData = request.postData();
            if (postData) networkPayloads.push(`${request.method()} ${request.url()} ${postData}`);
        });

        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(async (sentinels) => {
            window.currentUser = { id: 'hardening-leak-user' };
            window.BuddyCloud = { queuePush() {} };
            window.replaceSnapshot({
                transactions: [
                    {
                        id: 'hardening-active',
                        type: 'expense',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: Number(sentinels.amount),
                        date: '2026-06-21',
                        notes: sentinels.note
                    },
                    {
                        id: 'hardening-deleted',
                        type: 'expense',
                        description: sentinels.deleted,
                        category: sentinels.category,
                        amount: 10.01,
                        date: '2026-06-20',
                        isDeleted: true
                    }
                ],
                categories: [{ id: 'hardening-category', type: 'expense', name: sentinels.category, budget: 123 }],
                settings: {
                    giftCards: [{ id: 'hardening-gift', merchantName: sentinels.giftCard, nickname: sentinels.giftCard }],
                    csvImports: [{ id: 'hardening-csv', sourceFileName: sentinels.csv }]
                }
            });
            await window.flushLocalVaultSaveQueue?.();

            if ('caches' in window) {
                const cache = await caches.open('zam-hardening-cache-probe');
                await cache.put('/tests/fixtures/blank.html?hardening-cache-probe', new Response('cache probe ok', {
                    headers: { 'Content-Type': 'text/plain' }
                }));
            }
        }, HARDENING_SENTINELS);

        const surfaces = await page.evaluate(async () => {
            const storageDump = storage => JSON.stringify(Object.fromEntries(
                Array.from({ length: storage.length }, (_, index) => {
                    const key = storage.key(index);
                    return [key, storage.getItem(key)];
                })
            ));

            const cacheDump = [];
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    const cache = await caches.open(cacheName);
                    const requests = await cache.keys();
                    for (const request of requests.slice(0, 20)) {
                        const response = await cache.match(request);
                        const contentType = response?.headers?.get('content-type') || '';
                        const text = contentType.includes('text') || contentType.includes('json')
                            ? await response.clone().text().catch(() => '')
                            : '';
                        cacheDump.push([cacheName, request.url, text.slice(0, 2000)]);
                    }
                }
            }

            const indexedDbDump = [];
            if (typeof indexedDB.databases === 'function') {
                const databases = (await indexedDB.databases()).filter(db => db.name);
                for (const databaseInfo of databases) {
                    const db = await new Promise(resolve => {
                        const request = indexedDB.open(databaseInfo.name);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => resolve(null);
                        request.onblocked = () => resolve(null);
                    });
                    if (!db) continue;
                    const storeNames = Array.from(db.objectStoreNames);
                    for (const storeName of storeNames) {
                        const records = await new Promise(resolve => {
                            try {
                                const tx = db.transaction(storeName, 'readonly');
                                const request = tx.objectStore(storeName).getAll();
                                request.onsuccess = () => resolve(request.result || []);
                                request.onerror = () => resolve([]);
                            } catch {
                                resolve([]);
                            }
                        });
                        indexedDbDump.push([databaseInfo.name, storeName, JSON.stringify(records)]);
                    }
                    db.close();
                }
            }

            return {
                localStorageDump: storageDump(localStorage),
                sessionStorageDump: storageDump(sessionStorage),
                cookieDump: document.cookie || '',
                cacheDump: JSON.stringify(cacheDump),
                indexedDbDump: JSON.stringify(indexedDbDump)
            };
        });

        expectNoSentinelLeak(surfaces.localStorageDump);
        expectNoSentinelLeak(surfaces.sessionStorageDump);
        expectNoSentinelLeak(surfaces.cookieDump);
        expectNoSentinelLeak(surfaces.cacheDump);
        expectNoSentinelLeak(surfaces.indexedDbDump);
        expectNoSentinelLeak(networkPayloads.join('\n'));
        expectNoSentinelLeak(browserIssues.join('\n'));
        expect(browserIssues).toEqual([]);
    });

    test('factory reset removes encrypted vault records and local vault key material', async ({ page }) => {
        const keyId = 'user:hardening-reset-user:budget-data';
        const reloaded = page.waitForEvent('framenavigated');
        await page.evaluate(async ({ stateModulePath, providerModulePath, vaultModulePath, sentinels, keyId: targetKeyId }) => {
            const State = await import(stateModulePath);
            const Provider = await import(providerModulePath);
            const Vault = await import(vaultModulePath);
            const keyResult = await Provider.getOrCreateLocalVaultKey(targetKeyId);

            await Vault.writeEncryptedLocalVaultRecord(localStorage, {
                transactions: [{ id: 'hardening-reset-tx', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }, keyResult.key);
            sessionStorage.setItem('zam_demo_active', 'true');
            localStorage.setItem('keep_this_key', 'safe');

            State.factoryReset();
        }, {
            stateModulePath: modulePath('/js/state.js'),
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: HARDENING_SENTINELS,
            keyId
        }).catch(error => {
            if (!/Execution context was destroyed|navigation/i.test(error.message)) throw error;
        });
        await reloaded;
        await page.waitForLoadState('domcontentloaded');

        const result = await page.evaluate(async ({ providerModulePath, keyId: targetKeyId }) => {
            const Provider = await import(providerModulePath);
            return {
                keyPresent: Boolean(await Provider.readLocalVaultKey(targetKeyId)),
                bbData: localStorage.getItem('bb_data'),
                demoActive: sessionStorage.getItem('zam_demo_active'),
                kept: localStorage.getItem('keep_this_key')
            };
        }, {
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            keyId
        });

        expect(result.keyPresent).toBe(false);
        expect(result.bbData).toBeNull();
        expect(result.demoActive).toBeNull();
        expect(result.kept).toBe('safe');
    });

    test('account owner switch clears prior account storage and local vault keys', async ({ page }) => {
        const result = await page.evaluate(async ({ ownerModulePath, providerModulePath, vaultModulePath, sentinels }) => {
            const Owner = await import(ownerModulePath);
            const Provider = await import(providerModulePath);
            const Vault = await import(vaultModulePath);
            const keyId = Provider.getLocalVaultKeyId({ userId: 'deleted-owner-user', scope: 'budget-data' });
            const keyResult = await Provider.getOrCreateLocalVaultKey(keyId);

            await Vault.writeEncryptedLocalVaultRecord(localStorage, {
                transactions: [{ id: 'hardening-owner-tx', description: sentinels.merchant }],
                categories: [],
                settings: {}
            }, keyResult.key);
            localStorage.setItem('bb_signed_in_owner_id', 'deleted-owner-user');
            localStorage.setItem('bb_local_operational_metadata_v1', 'old-operational-metadata');
            localStorage.setItem('bb_cloud_sync_slot_v1', 'old-sync-slot');

            const guard = Owner.guardSignedInLocalOwner('fresh-owner-user');
            let keyPresent = true;
            for (let attempt = 0; attempt < 20; attempt += 1) {
                keyPresent = Boolean(await Provider.readLocalVaultKey(keyId));
                if (!keyPresent) break;
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return {
                guard,
                keyPresent,
                bbData: localStorage.getItem('bb_data'),
                operational: localStorage.getItem('bb_local_operational_metadata_v1'),
                syncSlot: localStorage.getItem('bb_cloud_sync_slot_v1'),
                owner: localStorage.getItem('bb_signed_in_owner_id'),
                ownerHash: localStorage.getItem('bb_signed_in_owner_hash_v1')
            };
        }, {
            ownerModulePath: modulePath('/js/accountLocalState.js'),
            providerModulePath: modulePath('/js/localVaultKeyProvider.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: HARDENING_SENTINELS
        });

        expect(result.guard.changed).toBe(true);
        expect(result.keyPresent).toBe(false);
        expect(result.bbData).toBeNull();
        expect(result.operational).toBeNull();
        expect(result.syncSlot).toBeNull();
        expect(result.owner).toBeNull();
        expect(result.ownerHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    });
});
