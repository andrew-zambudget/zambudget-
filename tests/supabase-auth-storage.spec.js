const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';
const AUTH_STORAGE_KEY = 'zam_supabase_auth_session_v1';
const LEGACY_AUTH_KEY = 'sb-cmfnmhqyeipgtjktbouk-auth-token';
const ACCESS_SENTINEL = 'SUPABASE_ACCESS_TOKEN_SENTINEL';
const REFRESH_SENTINEL = 'SUPABASE_REFRESH_TOKEN_SENTINEL';
const USER_SENTINEL = 'auth-user-id-sentinel';
const EMAIL_SENTINEL = 'auth-storage-test@example.com';

function makeSessionPayload() {
    return JSON.stringify({
        currentSession: {
            access_token: ACCESS_SENTINEL,
            refresh_token: REFRESH_SENTINEL,
            token_type: 'bearer',
            user: {
                id: USER_SENTINEL,
                email: EMAIL_SENTINEL
            }
        }
    });
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
    await page.addScriptTag({ path: 'js/supabaseAuthStorage.js' });
}

test.describe('encrypted Supabase auth storage', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('stores Supabase auth sessions as encrypted local metadata', async ({ page }) => {
        const result = await page.evaluate(async ({ payload }) => {
            const storage = window.ZamSupabaseAuth.createEncryptedAuthStorage({
                storageKey: window.ZamSupabaseAuth.AUTH_STORAGE_KEY,
                supabaseUrl: 'https://cmfnmhqyeipgtjktbouk.supabase.co'
            });

            await storage.setItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY, payload);

            return {
                restored: await storage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY),
                raw: localStorage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY) || '',
                keys: Object.keys(localStorage).sort()
            };
        }, { payload: makeSessionPayload() });

        expect(result.restored).toBe(makeSessionPayload());
        expect(result.raw).toContain('zam_local_metadata_vault');
        expect(result.raw).toContain('supabase_auth_session');
        expect(result.raw).not.toContain(ACCESS_SENTINEL);
        expect(result.raw).not.toContain(REFRESH_SENTINEL);
        expect(result.raw).not.toContain(USER_SENTINEL);
        expect(result.raw).not.toContain(EMAIL_SENTINEL);
        expect(result.keys).toEqual([AUTH_STORAGE_KEY]);
    });

    test('migrates the legacy Supabase auth key and removes plaintext storage', async ({ page }) => {
        const result = await page.evaluate(async ({ payload, legacyKey }) => {
            localStorage.setItem(legacyKey, payload);

            const storage = window.ZamSupabaseAuth.createEncryptedAuthStorage({
                storageKey: window.ZamSupabaseAuth.AUTH_STORAGE_KEY,
                supabaseUrl: 'https://cmfnmhqyeipgtjktbouk.supabase.co'
            });

            return {
                restored: await storage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY),
                encryptedRaw: localStorage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY) || '',
                legacyRaw: localStorage.getItem(legacyKey),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            payload: makeSessionPayload(),
            legacyKey: LEGACY_AUTH_KEY
        });

        expect(result.restored).toBe(makeSessionPayload());
        expect(result.legacyRaw).toBeNull();
        expect(result.encryptedRaw).toContain('zam_local_metadata_vault');
        expect(result.encryptedRaw).not.toContain(ACCESS_SENTINEL);
        expect(result.encryptedRaw).not.toContain(REFRESH_SENTINEL);
        expect(result.encryptedRaw).not.toContain(USER_SENTINEL);
        expect(result.encryptedRaw).not.toContain(EMAIL_SENTINEL);
        expect(result.keys).toEqual([AUTH_STORAGE_KEY]);
    });

    test('removeItem clears encrypted and legacy auth records', async ({ page }) => {
        const result = await page.evaluate(async ({ payload, legacyKey }) => {
            localStorage.setItem(legacyKey, payload);
            const storage = window.ZamSupabaseAuth.createEncryptedAuthStorage({
                storageKey: window.ZamSupabaseAuth.AUTH_STORAGE_KEY,
                supabaseUrl: 'https://cmfnmhqyeipgtjktbouk.supabase.co'
            });

            await storage.setItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY, payload);
            await storage.removeItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY);

            return {
                encryptedRaw: localStorage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY),
                legacyRaw: localStorage.getItem(legacyKey),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            payload: makeSessionPayload(),
            legacyKey: LEGACY_AUTH_KEY
        });

        expect(result.encryptedRaw).toBeNull();
        expect(result.legacyRaw).toBeNull();
        expect(result.keys).toEqual([]);
    });

    test('corrupt encrypted auth storage fails closed without exposing plaintext', async ({ page }) => {
        const result = await page.evaluate(async ({ payload }) => {
            const storage = window.ZamSupabaseAuth.createEncryptedAuthStorage({
                storageKey: window.ZamSupabaseAuth.AUTH_STORAGE_KEY,
                supabaseUrl: 'https://cmfnmhqyeipgtjktbouk.supabase.co'
            });

            await storage.setItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY, payload);
            const parsed = JSON.parse(localStorage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY));
            parsed.ciphertext = `${parsed.ciphertext.slice(0, -4)}xxxx`;
            localStorage.setItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY, JSON.stringify(parsed));

            return {
                restored: await storage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY),
                encryptedRaw: localStorage.getItem(window.ZamSupabaseAuth.AUTH_STORAGE_KEY)
            };
        }, { payload: makeSessionPayload() });

        expect(result.restored).toBeNull();
        expect(result.encryptedRaw).toBeNull();
    });

    test('createClient injects encrypted auth storage options', async ({ page }) => {
        const result = await page.evaluate(() => {
            const fakeSupabase = {
                createClient(url, key, options) {
                    return {
                        url,
                        key,
                        storageKey: options?.auth?.storageKey || '',
                        hasStorage: Boolean(options?.auth?.storage),
                        persistSession: options?.auth?.persistSession,
                        autoRefreshToken: options?.auth?.autoRefreshToken,
                        detectSessionInUrl: options?.auth?.detectSessionInUrl
                    };
                }
            };

            return window.ZamSupabaseAuth.createClient(
                fakeSupabase,
                'https://cmfnmhqyeipgtjktbouk.supabase.co',
                'anon-key'
            );
        });

        expect(result).toEqual(expect.objectContaining({
            url: 'https://cmfnmhqyeipgtjktbouk.supabase.co',
            key: 'anon-key',
            storageKey: AUTH_STORAGE_KEY,
            hasStorage: true,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }));
    });

    test('bundled Supabase SDK accepts the encrypted auth storage adapter', async ({ page }) => {
        await page.addScriptTag({ path: 'js/vendor/supabase.js' });

        const result = await page.evaluate(async () => {
            const client = window.ZamSupabaseAuth.createClient(
                window.supabase,
                'https://cmfnmhqyeipgtjktbouk.supabase.co',
                'anon-key'
            );
            const { data, error } = await client.auth.getSession();

            return {
                hasAuthClient: Boolean(client?.auth),
                session: data?.session || null,
                error: error?.message || '',
                keys: Object.keys(localStorage).sort()
            };
        });

        expect(result).toEqual({
            hasAuthClient: true,
            session: null,
            error: '',
            keys: []
        });
    });
});

test.describe('static page auth status', () => {
    test('uses encrypted auth presence without parsing raw Supabase session details', async ({ page }) => {
        await page.goto(BLANK_FIXTURE);
        await page.evaluate(() => {
            localStorage.clear();
            document.body.innerHTML = '<div class="footer-page-actions"><a class="btn-text footer-auth-link" href="login.html">Log In</a></div>';
            localStorage.setItem('zam_supabase_auth_session_v1', JSON.stringify({
                kind: 'zam_local_metadata_vault',
                version: 1,
                algorithm: 'AES-GCM',
                name: 'supabase_auth_session',
                iv: 'iv',
                ciphertext: 'ciphertext'
            }));
        });
        await page.addScriptTag({ path: 'js/staticPageTheme.js' });

        const link = page.locator('.footer-auth-link');
        await expect(link).toHaveText('Signed In');
        await expect(link).toHaveAttribute('title', 'Signed in on this browser');
    });
});
