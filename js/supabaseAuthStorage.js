(function () {
    'use strict';

    const AUTH_STORAGE_KEY = 'zam_supabase_auth_session_v1';
    const AUTH_METADATA_NAME = 'supabase_auth_session';
    const AUTH_VAULT_SCOPE = 'supabase-auth';
    const LEGACY_AUTH_KEY_PATTERN = /^sb-.+-auth-token$/;

    let dependencyPromise = null;

    function safeGet(storage, key) {
        try {
            return storage?.getItem?.(key) || '';
        } catch {
            return '';
        }
    }

    function safeSet(storage, key, value) {
        try {
            storage?.setItem?.(key, value);
            return true;
        } catch {
            return false;
        }
    }

    function safeRemove(storage, key) {
        try {
            storage?.removeItem?.(key);
            return true;
        } catch {
            return false;
        }
    }

    function parseJson(value) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    function getProjectRef(supabaseUrl = '') {
        try {
            const hostname = new URL(String(supabaseUrl || '')).hostname;
            const [projectRef] = hostname.split('.');
            return /^[a-z0-9-]+$/i.test(projectRef || '') ? projectRef : '';
        } catch {
            return '';
        }
    }

    function getLegacyAuthStorageKey(projectRef = '') {
        const safeProjectRef = String(projectRef || '').trim();
        return safeProjectRef ? `sb-${safeProjectRef}-auth-token` : '';
    }

    function isLegacyAuthStorageKey(key = '') {
        return LEGACY_AUTH_KEY_PATTERN.test(String(key || ''));
    }

    function looksLikeEncryptedAuthRecord(rawValue = '') {
        const parsed = parseJson(rawValue);
        return Boolean(
            parsed
            && parsed.kind === 'zam_local_metadata_vault'
            && parsed.version === 1
            && parsed.algorithm === 'AES-GCM'
            && parsed.name === AUTH_METADATA_NAME
            && typeof parsed.iv === 'string'
            && typeof parsed.ciphertext === 'string'
        );
    }

    function collectLegacyAuthStorageKeys(storage, options = {}) {
        const keys = new Set();
        const explicitLegacyKey = options.legacyStorageKey || getLegacyAuthStorageKey(options.projectRef);
        if (explicitLegacyKey) keys.add(explicitLegacyKey);

        try {
            for (let index = 0; index < storage.length; index += 1) {
                const key = storage.key(index);
                if (isLegacyAuthStorageKey(key)) keys.add(key);
            }
        } catch {
            // Best-effort cleanup only.
        }

        return Array.from(keys);
    }

    function findLegacyAuthSession(storage, legacyKeys = []) {
        for (const key of legacyKeys) {
            const value = safeGet(storage, key);
            if (value) return { key, value };
        }
        return { key: '', value: '' };
    }

    function removeLegacyAuthSessions(storage, legacyKeys = []) {
        legacyKeys.forEach(key => {
            if (key) safeRemove(storage, key);
        });
    }

    async function loadDependencies() {
        if (!dependencyPromise) {
            dependencyPromise = Promise.all([
                import('/js/localMetadataVaultStorage.js'),
                import('/js/localVaultKeyProvider.js')
            ]).then(([metadataVault, keyProvider]) => ({ metadataVault, keyProvider }));
        }
        return dependencyPromise;
    }

    async function getAuthStorageKey() {
        const { keyProvider } = await loadDependencies();
        const keyId = keyProvider.getLocalVaultKeyId({ scope: AUTH_VAULT_SCOPE });
        const result = await keyProvider.getOrCreateLocalVaultKey(keyId);
        return result.key;
    }

    async function writeEncryptedAuthSession(storage, storageKey, sessionValue, options = {}) {
        const { metadataVault } = await loadDependencies();
        const key = await getAuthStorageKey();

        await metadataVault.writeEncryptedLocalMetadataRecord(
            storage,
            storageKey,
            { value: String(sessionValue || '') },
            key,
            {
                name: AUTH_METADATA_NAME,
                createdAt: options.createdAt,
                updatedAt: options.updatedAt
            }
        );
    }

    async function readEncryptedAuthSession(storage, storageKey) {
        const { metadataVault } = await loadDependencies();
        const key = await getAuthStorageKey();
        const payload = await metadataVault.readEncryptedLocalMetadataRecord(
            storage,
            storageKey,
            key,
            { name: AUTH_METADATA_NAME }
        );

        return typeof payload?.value === 'string' ? payload.value : null;
    }

    function createEncryptedAuthStorage(options = {}) {
        const storage = options.storage || window.localStorage;
        const storageKey = options.storageKey || AUTH_STORAGE_KEY;
        const projectRef = options.projectRef || getProjectRef(options.supabaseUrl);

        function getLegacyKeys() {
            return collectLegacyAuthStorageKeys(storage, {
                projectRef,
                legacyStorageKey: options.legacyStorageKey
            });
        }

        async function migrateLegacyIfAvailable() {
            const legacyKeys = getLegacyKeys();
            const legacy = findLegacyAuthSession(storage, legacyKeys);
            if (!legacy.value) return null;

            try {
                await writeEncryptedAuthSession(storage, storageKey, legacy.value, options);
                removeLegacyAuthSessions(storage, legacyKeys);
                return legacy.value;
            } catch {
                safeRemove(storage, storageKey);
                removeLegacyAuthSessions(storage, legacyKeys);
                return null;
            }
        }

        return {
            getItem: async function getItem(requestedKey) {
                const targetKey = requestedKey || storageKey;
                const rawValue = safeGet(storage, targetKey);

                if (rawValue) {
                    try {
                        return await readEncryptedAuthSession(storage, targetKey);
                    } catch {
                        safeRemove(storage, targetKey);
                        return null;
                    }
                }

                return migrateLegacyIfAvailable();
            },

            setItem: async function setItem(requestedKey, value) {
                const targetKey = requestedKey || storageKey;
                try {
                    await writeEncryptedAuthSession(storage, targetKey, value, options);
                    removeLegacyAuthSessions(storage, getLegacyKeys());
                } catch {
                    safeRemove(storage, targetKey);
                    removeLegacyAuthSessions(storage, getLegacyKeys());
                }
            },

            removeItem: async function removeItem(requestedKey) {
                const targetKey = requestedKey || storageKey;
                safeRemove(storage, targetKey);
                removeLegacyAuthSessions(storage, getLegacyKeys());
            }
        };
    }

    function createClient(supabaseGlobal, supabaseUrl, supabaseAnonKey, options = {}) {
        if (!supabaseGlobal?.createClient) {
            throw new Error('Supabase browser client is not available.');
        }

        const authOptions = {
            ...(options.auth || {}),
            storageKey: options.auth?.storageKey || AUTH_STORAGE_KEY,
            storage: options.auth?.storage || createEncryptedAuthStorage({
                storageKey: options.auth?.storageKey || AUTH_STORAGE_KEY,
                supabaseUrl,
                projectRef: getProjectRef(supabaseUrl)
            }),
            persistSession: options.auth?.persistSession !== false,
            autoRefreshToken: options.auth?.autoRefreshToken !== false,
            detectSessionInUrl: options.auth?.detectSessionInUrl !== false
        };

        return supabaseGlobal.createClient(supabaseUrl, supabaseAnonKey, {
            ...options,
            auth: authOptions
        });
    }

    window.ZamSupabaseAuth = {
        AUTH_METADATA_NAME,
        AUTH_STORAGE_KEY,
        AUTH_VAULT_SCOPE,
        createClient,
        createEncryptedAuthStorage,
        getLegacyAuthStorageKey,
        getProjectRef,
        isLegacyAuthStorageKey,
        looksLikeEncryptedAuthRecord
    };
})();
