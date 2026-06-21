const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const SENTINELS = Object.freeze({
    merchant: 'PHASE2A_SENTINEL_MERCHANT_STORAGE',
    category: 'PHASE2A_SENTINEL_CATEGORY_STORAGE',
    note: 'PHASE2A_SENTINEL_NOTE_STORAGE',
    giftCard: 'PHASE2A_SENTINEL_GIFT_CARD_STORAGE',
    csvImport: 'PHASE2A_SENTINEL_CSV_IMPORT_STORAGE',
    deleted: 'PHASE2A_SENTINEL_DELETED_STORAGE'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test.describe('local vault storage adapter scaffold', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BLANK_FIXTURE);
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    });

    test('encrypts and decrypts a budget payload without exposing sensitive strings', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Vault = await import(moduleUrl);
            const key = await Vault.generateLocalVaultKey();
            const payload = {
                transactions: [
                    {
                        id: 'phase2a-tx-active',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        amount: 123.45,
                        date: '2026-06-21',
                        notes: sentinels.note
                    },
                    {
                        id: 'phase2a-tx-deleted',
                        description: sentinels.deleted,
                        category: sentinels.category,
                        amount: 67.89,
                        date: '2026-06-20',
                        isDeleted: true
                    }
                ],
                categories: [{ id: 'phase2a-cat', name: sentinels.category }],
                settings: {
                    giftCards: [{ id: 'phase2a-gift', nickname: sentinels.giftCard }],
                    csvImports: [{ id: 'phase2a-import', sourceFileName: sentinels.csvImport }]
                }
            };
            const envelope = await Vault.encryptLocalVaultPayload(payload, key, {
                createdAt: '2026-06-21T00:00:00.000Z',
                updatedAt: '2026-06-21T00:00:00.000Z'
            });
            const serialized = Vault.serializeLocalVaultEnvelope(envelope);
            const decrypted = await Vault.decryptLocalVaultEnvelope(serialized, key);

            return {
                serialized,
                decrypted,
                classification: Vault.classifyLocalBudgetRecord(serialized)
            };
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.decrypted.transactions[0].description).toBe(SENTINELS.merchant);
        expect(result.decrypted.transactions[0].category).toBe(SENTINELS.category);
        expect(result.decrypted.transactions[0].notes).toBe(SENTINELS.note);
        expect(result.decrypted.transactions[1].description).toBe(SENTINELS.deleted);
        expect(result.decrypted.settings.giftCards[0].nickname).toBe(SENTINELS.giftCard);
        expect(result.decrypted.settings.csvImports[0].sourceFileName).toBe(SENTINELS.csvImport);

        Object.values(SENTINELS).forEach((sentinel) => {
            expect(result.serialized).not.toContain(sentinel);
        });
    });

    test('maps encrypted records to bb_data without changing the storage key name', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Vault = await import(moduleUrl);
            const key = await Vault.generateLocalVaultKey();
            const payload = {
                transactions: [
                    {
                        id: 'phase2a-storage-record',
                        description: sentinels.merchant,
                        category: sentinels.category,
                        notes: sentinels.note
                    }
                ],
                categories: [{ id: 'phase2a-storage-cat', name: sentinels.category }],
                settings: {}
            };

            await Vault.writeEncryptedLocalVaultRecord(localStorage, payload, key, {
                createdAt: '2026-06-21T00:00:00.000Z',
                updatedAt: '2026-06-21T00:00:00.000Z'
            });

            const stored = localStorage.getItem('bb_data') || '';
            const decrypted = await Vault.readEncryptedLocalVaultRecord(localStorage, key);

            return {
                storageKey: Vault.LOCAL_VAULT_STORAGE_KEY,
                stored,
                decrypted,
                localStorageKeys: Object.keys(localStorage)
            };
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.storageKey).toBe('bb_data');
        expect(result.localStorageKeys).toEqual(['bb_data']);
        expect(result.decrypted.transactions[0].description).toBe(SENTINELS.merchant);
        expect(result.decrypted.transactions[0].category).toBe(SENTINELS.category);

        Object.values(SENTINELS).forEach((sentinel) => {
            expect(result.stored).not.toContain(sentinel);
        });
    });

    test('classifies current plaintext bb_data separately from encrypted envelopes', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Vault = await import(moduleUrl);
            const plaintext = JSON.stringify({
                transactions: [{ description: sentinels.merchant }],
                categories: [{ name: sentinels.category }],
                settings: { giftCards: [{ nickname: sentinels.giftCard }] }
            });
            const key = await Vault.generateLocalVaultKey();
            const envelope = await Vault.encryptLocalVaultPayload({ transactions: [] }, key);
            const serializedEnvelope = Vault.serializeLocalVaultEnvelope(envelope);

            return {
                empty: Vault.classifyLocalBudgetRecord(null),
                invalid: Vault.classifyLocalBudgetRecord('not json'),
                plaintext: Vault.classifyLocalBudgetRecord(plaintext),
                encrypted: Vault.classifyLocalBudgetRecord(serializedEnvelope)
            };
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js'),
            sentinels: SENTINELS
        });

        expect(result.empty.kind).toBe('empty');
        expect(result.invalid.kind).toBe('invalid');
        expect(result.plaintext.kind).toBe('plaintext');
        expect(result.plaintext.payloadShape).toEqual({
            hasTransactions: true,
            hasCategories: true,
            hasSettings: true
        });
        expect(result.encrypted.kind).toBe('encrypted');
    });

    test('rejects a tampered encrypted envelope', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl }) => {
            const Vault = await import(moduleUrl);
            const key = await Vault.generateLocalVaultKey();
            const envelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ description: 'tamper-protected' }]
            }, key);

            const replacement = envelope.ciphertext.startsWith('A') ? 'B' : 'A';
            const tamperedEnvelope = {
                ...envelope,
                ciphertext: `${replacement}${envelope.ciphertext.slice(1)}`
            };

            try {
                await Vault.decryptLocalVaultEnvelope(tamperedEnvelope, key);
                return { decrypted: true };
            } catch (error) {
                return {
                    decrypted: false,
                    errorName: error?.name || 'Error'
                };
            }
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js')
        });

        expect(result.decrypted).toBe(false);
        expect(result.errorName).toBeTruthy();
    });

    test('generated and imported local vault keys are non-extractable', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl }) => {
            const Vault = await import(moduleUrl);
            const generatedKey = await Vault.generateLocalVaultKey();
            const rawSeed = new Uint8Array(32);
            crypto.getRandomValues(rawSeed);
            const importedKey = await Vault.importLocalVaultRawKey(rawSeed);

            const generatedExport = await crypto.subtle.exportKey('raw', generatedKey)
                .then(() => 'exported')
                .catch((error) => error?.name || 'failed');
            const importedExport = await crypto.subtle.exportKey('raw', importedKey)
                .then(() => 'exported')
                .catch((error) => error?.name || 'failed');

            return {
                generatedExtractable: generatedKey.extractable,
                importedExtractable: importedKey.extractable,
                generatedExport,
                importedExport,
                generatedAlgorithm: generatedKey.algorithm.name,
                importedAlgorithm: importedKey.algorithm.name
            };
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js')
        });

        expect(result.generatedExtractable).toBe(false);
        expect(result.importedExtractable).toBe(false);
        expect(result.generatedExport).not.toBe('exported');
        expect(result.importedExport).not.toBe('exported');
        expect(result.generatedAlgorithm).toBe('AES-GCM');
        expect(result.importedAlgorithm).toBe('AES-GCM');
    });

    test('exposes stable Phase 2A envelope constants', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl }) => {
            const Vault = await import(moduleUrl);
            return {
                storageKey: Vault.LOCAL_VAULT_STORAGE_KEY,
                kind: Vault.LOCAL_VAULT_ENVELOPE_KIND,
                version: Vault.LOCAL_VAULT_ENVELOPE_VERSION,
                algorithm: Vault.LOCAL_VAULT_ALGORITHM,
                cryptoAvailable: Vault.isCryptoAvailable()
            };
        }, {
            moduleUrl: modulePath('/js/localVaultStorage.js')
        });

        expect(result).toEqual({
            storageKey: 'bb_data',
            kind: 'zam_local_budget_vault',
            version: 1,
            algorithm: 'AES-GCM',
            cryptoAvailable: true
        });
    });
});
