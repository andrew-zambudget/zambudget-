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

export const LEGACY_BROWSER_ACCESS_TOKEN_PREFIX = 'bb_browser_access_token_';
export const BROWSER_ACCESS_TOKENS_STORAGE_KEY = 'bb_browser_access_tokens_v1';
export const BROWSER_ACCESS_TOKENS_METADATA_NAME = 'browser_access_tokens';
export const BROWSER_ACCESS_VAULT_SCOPE = 'browser-access';
export const BROWSER_ACCESS_TOKEN_BYTES = 32;

function encodeBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanUserId(value = '') {
    return String(value || '').trim().slice(0, 160);
}

function cleanToken(value = '') {
    return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, 256);
}

function normalizeTokenMap(payload = {}) {
    const source = payload?.tokens && typeof payload.tokens === 'object' && !Array.isArray(payload.tokens)
        ? payload.tokens
        : {};
    return Object.fromEntries(
        Object.entries(source)
            .map(([userId, token]) => [cleanUserId(userId), cleanToken(token)])
            .filter(([userId, token]) => userId && token)
    );
}

export function generateBrowserAccessToken() {
    const bytes = new Uint8Array(BROWSER_ACCESS_TOKEN_BYTES);
    crypto.getRandomValues(bytes);
    return encodeBase64Url(bytes);
}

export function getLegacyBrowserAccessTokenStorageKey(userId = '') {
    const safeUserId = cleanUserId(userId);
    return safeUserId ? `${LEGACY_BROWSER_ACCESS_TOKEN_PREFIX}${safeUserId}` : '';
}

export function getBrowserAccessVaultStorageKey() {
    return BROWSER_ACCESS_TOKENS_STORAGE_KEY;
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
    const storageKey = options.storageKey || BROWSER_ACCESS_TOKENS_STORAGE_KEY;
    const rawValue = storageKey ? storage?.getItem?.(storageKey) || '' : '';
    return classifyLocalMetadataRecord(rawValue, {
        name: BROWSER_ACCESS_TOKENS_METADATA_NAME
    });
}

export function hasLegacyBrowserAccessToken(options = {}) {
    const storage = options.storage || localStorage;
    const legacyKey = options.legacyKey || getLegacyBrowserAccessTokenStorageKey(options.userId);
    return Boolean(legacyKey && cleanToken(storage?.getItem?.(legacyKey) || ''));
}

async function readEncryptedBrowserAccessTokenMap(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || BROWSER_ACCESS_TOKENS_STORAGE_KEY;
    const key = options.key || await readBrowserAccessVaultKey(options);
    if (!key) return {};

    const payload = await readEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        key,
        { name: BROWSER_ACCESS_TOKENS_METADATA_NAME }
    );
    return normalizeTokenMap(payload);
}

async function writeEncryptedBrowserAccessTokenMap(tokenMap = {}, options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || BROWSER_ACCESS_TOKENS_STORAGE_KEY;
    const safeMap = normalizeTokenMap({ tokens: tokenMap });
    const keyResult = options.key
        ? { key: options.key }
        : await getOrCreateBrowserAccessVaultKey(options);

    await writeEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        { tokens: safeMap },
        keyResult.key,
        {
            name: BROWSER_ACCESS_TOKENS_METADATA_NAME,
            createdAt: options.createdAt,
            updatedAt: options.updatedAt
        }
    );

    return safeMap;
}

export async function writeEncryptedBrowserAccessToken(token, options = {}) {
    const userId = cleanUserId(options.userId);
    const safeToken = cleanToken(token);
    if (!userId) throw new TypeError('Browser access user id is required.');
    if (!safeToken) throw new TypeError('Browser access token is required.');

    let tokenMap = {};
    try {
        tokenMap = await readEncryptedBrowserAccessTokenMap(options);
    } catch {
        tokenMap = {};
    }
    tokenMap[userId] = safeToken;
    await writeEncryptedBrowserAccessTokenMap(tokenMap, options);
    return safeToken;
}

export async function readEncryptedBrowserAccessToken(options = {}) {
    const userId = cleanUserId(options.userId);
    if (!userId) return '';
    const tokenMap = await readEncryptedBrowserAccessTokenMap(options);
    return cleanToken(tokenMap[userId]);
}

export async function deleteEncryptedBrowserAccessToken(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || BROWSER_ACCESS_TOKENS_STORAGE_KEY;
    const userId = cleanUserId(options.userId);
    const legacyKey = options.legacyKey || getLegacyBrowserAccessTokenStorageKey(userId);

    if (legacyKey) storage.removeItem(legacyKey);
    if (!userId) return false;

    let tokenMap = {};
    try {
        tokenMap = await readEncryptedBrowserAccessTokenMap({ ...options, storage, storageKey });
    } catch {
        return false;
    }

    if (!tokenMap[userId]) return false;
    delete tokenMap[userId];

    if (Object.keys(tokenMap).length === 0) {
        storage.removeItem(storageKey);
    } else {
        await writeEncryptedBrowserAccessTokenMap(tokenMap, { ...options, storage, storageKey });
    }
    return true;
}

export async function getOrCreateEncryptedBrowserAccessToken(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || BROWSER_ACCESS_TOKENS_STORAGE_KEY;
    const userId = cleanUserId(options.userId);
    const legacyKey = options.legacyKey || getLegacyBrowserAccessTokenStorageKey(userId);
    if (!userId) return '';

    let tokenMap = {};
    try {
        tokenMap = await readEncryptedBrowserAccessTokenMap({ ...options, storage, storageKey });
        if (tokenMap[userId]) {
            if (legacyKey) storage.removeItem(legacyKey);
            return tokenMap[userId];
        }
    } catch {
        storage.removeItem(storageKey);
        tokenMap = {};
    }

    const legacyToken = legacyKey ? cleanToken(storage.getItem(legacyKey) || '') : '';
    const nextToken = legacyToken || generateBrowserAccessToken();
    tokenMap[userId] = nextToken;

    try {
        await writeEncryptedBrowserAccessTokenMap(tokenMap, { ...options, storage, storageKey });
        if (legacyKey) storage.removeItem(legacyKey);
    } catch (error) {
        if (legacyKey) storage.removeItem(legacyKey);
        throw error;
    }
    return nextToken;
}
