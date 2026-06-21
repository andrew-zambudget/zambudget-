import {
    decryptLocalVaultEnvelope,
    encryptLocalVaultPayload,
    generateLocalVaultKey,
    isLocalVaultCryptoKey
} from './localVaultStorage.js';

export const LOCAL_VAULT_KEY_DB_NAME = 'zam_local_vault_keys';
export const LOCAL_VAULT_KEY_DB_VERSION = 1;
export const LOCAL_VAULT_KEY_STORE = 'local_vault_keys';
export const LOCAL_VAULT_DEFAULT_KEY_ID = 'browser-local:primary';
export const LOCAL_VAULT_KEY_ALGORITHM = 'AES-GCM';
export const CLOUD_SYNC_TRUSTED_KEY_DB_NAME = 'budgetbuddy_buddy_cloud_keys';

function canUseIndexedKeyStorage() {
    return typeof indexedDB !== 'undefined' && Boolean(globalThis.crypto?.subtle);
}

function normalizeKeyId(keyId = LOCAL_VAULT_DEFAULT_KEY_ID) {
    const normalized = String(keyId || LOCAL_VAULT_DEFAULT_KEY_ID).trim();
    if (!normalized) return LOCAL_VAULT_DEFAULT_KEY_ID;
    return normalized.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 160);
}

function openLocalVaultKeyDb() {
    if (!canUseIndexedKeyStorage()) return Promise.resolve(null);

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        let request;
        try {
            request = indexedDB.open(LOCAL_VAULT_KEY_DB_NAME, LOCAL_VAULT_KEY_DB_VERSION);
        } catch {
            settle(null);
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(LOCAL_VAULT_KEY_STORE)) {
                db.createObjectStore(LOCAL_VAULT_KEY_STORE, { keyPath: 'keyId' });
            }
        };
        request.onsuccess = () => settle(request.result);
        request.onerror = () => settle(null);
        request.onblocked = () => settle(null);
    });
}

function closeDb(db) {
    try {
        db?.close?.();
    } catch {
        // Keep key-provider cleanup non-blocking.
    }
}

function readKeyRecord(keyId) {
    return openLocalVaultKeyDb().then(db => {
        if (!db) return null;

        return new Promise(resolve => {
            let settled = false;
            const settle = value => {
                if (settled) return;
                settled = true;
                closeDb(db);
                resolve(value);
            };

            try {
                const tx = db.transaction(LOCAL_VAULT_KEY_STORE, 'readonly');
                const request = tx.objectStore(LOCAL_VAULT_KEY_STORE).get(normalizeKeyId(keyId));
                request.onsuccess = () => settle(request.result || null);
                request.onerror = () => settle(null);
                tx.onabort = () => settle(null);
            } catch {
                settle(null);
            }
        });
    });
}

function writeKeyRecord(record) {
    return openLocalVaultKeyDb().then(db => {
        if (!db) return false;

        return new Promise(resolve => {
            let settled = false;
            const settle = value => {
                if (settled) return;
                settled = true;
                closeDb(db);
                resolve(value);
            };

            try {
                const tx = db.transaction(LOCAL_VAULT_KEY_STORE, 'readwrite');
                tx.objectStore(LOCAL_VAULT_KEY_STORE).put(record);
                tx.oncomplete = () => settle(true);
                tx.onerror = () => settle(false);
                tx.onabort = () => settle(false);
            } catch {
                settle(false);
            }
        });
    });
}

export function canUseLocalVaultKeyProvider() {
    return canUseIndexedKeyStorage();
}

export function getLocalVaultKeyId({ userId = '', scope = '' } = {}) {
    const cleanScope = normalizeKeyId(scope || 'primary');
    const cleanUserId = normalizeKeyId(userId);
    return cleanUserId && cleanUserId !== LOCAL_VAULT_DEFAULT_KEY_ID
        ? `user:${cleanUserId}:${cleanScope}`
        : `browser-local:${cleanScope}`;
}

export async function readLocalVaultKey(keyId = LOCAL_VAULT_DEFAULT_KEY_ID) {
    const record = await readKeyRecord(keyId);
    const key = record?.key || null;
    return isLocalVaultCryptoKey(key) ? key : null;
}

export async function persistLocalVaultKey(keyId = LOCAL_VAULT_DEFAULT_KEY_ID, key) {
    if (!isLocalVaultCryptoKey(key)) return false;

    return writeKeyRecord({
        keyId: normalizeKeyId(keyId),
        key,
        algorithm: LOCAL_VAULT_KEY_ALGORITHM,
        usages: ['encrypt', 'decrypt'],
        updatedAt: new Date().toISOString()
    });
}

export async function getOrCreateLocalVaultKey(keyId = LOCAL_VAULT_DEFAULT_KEY_ID) {
    const normalizedKeyId = normalizeKeyId(keyId);
    const existingKey = await readLocalVaultKey(normalizedKeyId);
    if (existingKey) {
        return { key: existingKey, created: false, persisted: true };
    }

    const key = await generateLocalVaultKey();
    const persisted = await persistLocalVaultKey(normalizedKeyId, key);
    if (!persisted) {
        throw new Error('Could not persist local vault key.');
    }

    const restoredKey = await readLocalVaultKey(normalizedKeyId);
    if (!restoredKey) {
        throw new Error('Could not verify local vault key persistence.');
    }

    return { key: restoredKey, created: true, persisted: true };
}

export async function verifyLocalVaultKeyRoundtrip(key) {
    if (!isLocalVaultCryptoKey(key)) return false;

    const probe = {
        transactions: [{ id: 'local-vault-key-probe', description: 'roundtrip probe' }],
        categories: [],
        settings: {}
    };
    const envelope = await encryptLocalVaultPayload(probe, key);
    const restored = await decryptLocalVaultEnvelope(envelope, key);
    return restored?.transactions?.[0]?.id === 'local-vault-key-probe';
}

export async function deleteLocalVaultKey(keyId = LOCAL_VAULT_DEFAULT_KEY_ID) {
    const db = await openLocalVaultKeyDb();
    if (!db) return false;

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            closeDb(db);
            resolve(value);
        };

        try {
            const tx = db.transaction(LOCAL_VAULT_KEY_STORE, 'readwrite');
            tx.objectStore(LOCAL_VAULT_KEY_STORE).delete(normalizeKeyId(keyId));
            tx.oncomplete = () => settle(true);
            tx.onerror = () => settle(false);
            tx.onabort = () => settle(false);
        } catch {
            settle(false);
        }
    });
}

export function deleteAllLocalVaultKeys() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(false);

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        let request;
        try {
            request = indexedDB.deleteDatabase(LOCAL_VAULT_KEY_DB_NAME);
        } catch {
            settle(false);
            return;
        }

        request.onsuccess = () => settle(true);
        request.onerror = () => settle(false);
        request.onblocked = () => settle(false);
    });
}
