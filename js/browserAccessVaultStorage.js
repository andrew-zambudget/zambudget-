import {
    classifyLocalMetadataRecord,
    readEncryptedLocalMetadataRecord,
    writeEncryptedLocalMetadataRecord
} from './localMetadataVaultStorage.js';
import {
    getLocalVaultKeyId,
    getOrCreateLocalVaultKey,
    readLocalVaultKey
} from './localVaultKeyProvider.js';

export const BROWSER_ACCESS_TOKEN_PREFIX = 'bb_browser_access_token_';
export const BROWSER_ACCESS_METADATA_NAME = 'browser_access_token';
export const BROWSER_ACCESS_VAULT_SCOPE = 'browser-access';
export const BROWSER_ACCESS_TOKEN_BYTES = 32;

function encodeBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanToken(value = '') {
    return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, 256);
}

export function generateBrowserAccessToken() {
    const bytes = new Uint8Array(BROWSER_ACCESS_TOKEN_BYTES);
    crypto.getRandomValues(bytes);
    return encodeBase64Url(bytes);
}

export function getBrowserAccessTokenStorageKey(userId = '') {
    const safeUserId = String(userId || '').trim();
    return safeUserId ? `${BROWSER_ACCESS_TOKEN_PREFIX}${safeUserId}` : '';
}

export function getBrowserAccessVaultKeyId(options = {}) {
    return getLocalVaultKeyId({
        userId: options.userId || '',
        scope: options.scope || BROWSER_ACCESS_VAULT_SCOPE
    });
}

export async function getOrCreateBrowserAccessVaultKey(options = {}) {
    return getOrCreateLocalVaultKey(getBrowserAccessVaultKeyId(options));
}

export async function readBrowserAccessVaultKey(options = {}) {
    return readLocalVaultKey(getBrowserAccessVaultKeyId(options));
}

export function classifyBrowserAccessTokenRecord(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || getBrowserAccessTokenStorageKey(options.userId);
    const rawValue = storageKey ? storage?.getItem?.(storageKey) || '' : '';
    const classification = classifyLocalMetadataRecord(rawValue, {
        name: BROWSER_ACCESS_METADATA_NAME
    });

    if (classification.kind === 'invalid' && cleanToken(rawValue)) {
        return { kind: 'legacy-plaintext' };
    }

    return classification;
}

export async function writeEncryptedBrowserAccessToken(token, options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || getBrowserAccessTokenStorageKey(options.userId);
    const safeToken = cleanToken(token);

    if (!storageKey) {
        throw new TypeError('Browser access token storage key is required.');
    }

    if (!safeToken) {
        throw new TypeError('Browser access token is required.');
    }

    const keyResult = options.key
        ? { key: options.key }
        : await getOrCreateBrowserAccessVaultKey(options);

    await writeEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        { token: safeToken },
        keyResult.key,
        {
            name: BROWSER_ACCESS_METADATA_NAME,
            createdAt: options.createdAt,
            updatedAt: options.updatedAt
        }
    );

    return safeToken;
}

export async function readEncryptedBrowserAccessToken(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || getBrowserAccessTokenStorageKey(options.userId);
    const key = options.key || await readBrowserAccessVaultKey(options);

    if (!storageKey || !key) return '';

    const payload = await readEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        key,
        { name: BROWSER_ACCESS_METADATA_NAME }
    );

    return cleanToken(payload?.token);
}

export async function getOrCreateEncryptedBrowserAccessToken(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || getBrowserAccessTokenStorageKey(options.userId);

    if (!storageKey) return '';

    const rawValue = storage.getItem(storageKey) || '';
    const classification = classifyBrowserAccessTokenRecord({ ...options, storage, storageKey });

    if (classification.kind === 'encrypted') {
        try {
            const token = await readEncryptedBrowserAccessToken({ ...options, storage, storageKey });
            if (token) return token;
        } catch {
            storage.removeItem(storageKey);
        }
    }

    const legacyToken = classification.kind === 'legacy-plaintext' ? cleanToken(rawValue) : '';
    const nextToken = legacyToken || generateBrowserAccessToken();
    try {
        await writeEncryptedBrowserAccessToken(nextToken, { ...options, storage, storageKey });
    } catch (error) {
        if (legacyToken) storage.removeItem(storageKey);
        throw error;
    }
    return nextToken;
}
