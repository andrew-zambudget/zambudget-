const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';
const TOKEN_SENTINEL = 'PHASE1_BROWSER_ACCESS_TOKEN_SENTINEL';

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

test.describe('browser access encrypted metadata storage', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('writes browser access tokens as encrypted local metadata', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, token }) => {
            const BrowserAccessVault = await import(moduleUrl);
            const storageKey = BrowserAccessVault.getBrowserAccessVaultStorageKey();
            await BrowserAccessVault.writeEncryptedBrowserAccessToken(token, {
                userId: 'browser-access-user',
                storageKey,
                createdAt: '2026-06-21T20:00:00.000Z',
                updatedAt: '2026-06-21T20:00:00.000Z'
            });

            return {
                storageKey,
                raw: localStorage.getItem(storageKey) || '',
                restored: await BrowserAccessVault.readEncryptedBrowserAccessToken({
                    userId: 'browser-access-user',
                    storageKey
                }),
                classification: BrowserAccessVault.classifyBrowserAccessTokenRecord({
                    userId: 'browser-access-user',
                    storageKey
                }),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/browserAccessVaultStorage.js'),
            token: TOKEN_SENTINEL
        });

        expect(result.storageKey).toBe('bb_browser_access_tokens_v1');
        expect(result.classification.kind).toBe('encrypted');
        expect(result.raw).toContain('zam_local_metadata_vault');
        expect(result.raw).toContain('browser_access_tokens');
        expect(result.raw).not.toContain(TOKEN_SENTINEL);
        expect(result.restored).toBe(TOKEN_SENTINEL);
        expect(result.keys).toEqual(['bb_browser_access_tokens_v1']);
    });

    test('migrates legacy plaintext token without changing its value', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, token }) => {
            const BrowserAccessVault = await import(moduleUrl);
            const storageKey = BrowserAccessVault.getBrowserAccessVaultStorageKey();
            const legacyKey = BrowserAccessVault.getLegacyBrowserAccessTokenStorageKey('legacy-browser-access-user');
            localStorage.setItem(legacyKey, token);

            const restored = await BrowserAccessVault.getOrCreateEncryptedBrowserAccessToken({
                userId: 'legacy-browser-access-user',
                storageKey
            });

            return {
                raw: localStorage.getItem(storageKey) || '',
                restored,
                classification: BrowserAccessVault.classifyBrowserAccessTokenRecord({
                    userId: 'legacy-browser-access-user',
                    storageKey
                }),
                legacyValue: localStorage.getItem(legacyKey),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/browserAccessVaultStorage.js'),
            token: TOKEN_SENTINEL
        });

        expect(result.restored).toBe(TOKEN_SENTINEL);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.raw).not.toContain(TOKEN_SENTINEL);
        expect(result.legacyValue).toBeNull();
        expect(result.keys).toEqual(['bb_browser_access_tokens_v1']);
    });

    test('corrupt encrypted token fails closed by rotating to a new encrypted token', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, token }) => {
            const BrowserAccessVault = await import(moduleUrl);
            const storageKey = BrowserAccessVault.getBrowserAccessVaultStorageKey();
            await BrowserAccessVault.writeEncryptedBrowserAccessToken(token, {
                userId: 'corrupt-browser-access-user',
                storageKey
            });
            const parsed = JSON.parse(localStorage.getItem(storageKey));
            parsed.ciphertext = `${parsed.ciphertext.slice(0, -4)}xxxx`;
            localStorage.setItem(storageKey, JSON.stringify(parsed));

            const rotated = await BrowserAccessVault.getOrCreateEncryptedBrowserAccessToken({
                userId: 'corrupt-browser-access-user',
                storageKey
            });

            return {
                raw: localStorage.getItem(storageKey) || '',
                rotated,
                classification: BrowserAccessVault.classifyBrowserAccessTokenRecord({
                    userId: 'corrupt-browser-access-user',
                    storageKey
                })
            };
        }, {
            moduleUrl: modulePath('/js/browserAccessVaultStorage.js'),
            token: TOKEN_SENTINEL
        });

        expect(result.rotated).toBeTruthy();
        expect(result.rotated).not.toBe(TOKEN_SENTINEL);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.raw).not.toContain(TOKEN_SENTINEL);
    });
});
