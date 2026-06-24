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

export const LOCAL_OPERATIONAL_METADATA_KEY = 'bb_local_operational_metadata_v1';
export const LOCAL_OPERATIONAL_METADATA_NAME = 'local_operational_metadata';
export const LOCAL_OPERATIONAL_METADATA_SCOPE = 'local-operational-metadata';

export const LEGACY_LOCAL_UPDATED_AT_KEY = 'bb_local_updated_at';
export const LEGACY_CLOUD_LAST_PUSHED_KEY = 'bb_cloud_last_pushed_at';
export const LEGACY_CLOUD_LAST_REMOTE_KEY = 'bb_cloud_last_remote_at';
export const LEGACY_CLOUD_SYNC_SLOT_KEY = 'bb_cloud_sync_slot_v1';
export const LEGACY_CLOUD_SYNC_SLOT_PREFIX = 'bb_cloud_sync_slot_';
export const LEGACY_RECOVERY_KEY_GRACE_STARTED_PREFIX = 'bb_cloud_recovery_key_grace_started_';

const FIELD_LOCAL_UPDATED_AT = 'localUpdatedAt';
const FIELD_CLOUD_LAST_PUSHED_AT = 'cloudLastPushedAt';
const FIELD_CLOUD_LAST_REMOTE_AT = 'cloudLastRemoteAt';
const FIELD_CLOUD_SYNC_SLOT_TOKEN = 'cloudSyncSlotToken';
const FIELD_RECOVERY_KEY_GRACE_STARTED_AT = 'recoveryKeyGraceStartedAt';

const LEGACY_DIRECT_KEYS = Object.freeze([
    [LEGACY_LOCAL_UPDATED_AT_KEY, FIELD_LOCAL_UPDATED_AT],
    [LEGACY_CLOUD_LAST_PUSHED_KEY, FIELD_CLOUD_LAST_PUSHED_AT],
    [LEGACY_CLOUD_LAST_REMOTE_KEY, FIELD_CLOUD_LAST_REMOTE_AT],
    [LEGACY_CLOUD_SYNC_SLOT_KEY, FIELD_CLOUD_SYNC_SLOT_TOKEN]
]);

let cache = {};
let initialized = false;
let writeQueue = Promise.resolve(true);

function cleanValue(value = '', maxLength = 260) {
    return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLength);
}

function normalizePayload(payload = {}) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {};

    return {
        localUpdatedAt: cleanValue(source.localUpdatedAt, 48),
        cloudLastPushedAt: cleanValue(source.cloudLastPushedAt, 48),
        cloudLastRemoteAt: cleanValue(source.cloudLastRemoteAt, 48),
        cloudSyncSlotToken: cleanValue(source.cloudSyncSlotToken, 320),
        recoveryKeyGraceStartedAt: cleanValue(source.recoveryKeyGraceStartedAt, 48)
    };
}

function mergeOperationalMetadataPayloads(primary = {}, fallback = {}) {
    const safePrimary = normalizePayload(primary);
    const safeFallback = normalizePayload(fallback);

    return normalizePayload({
        localUpdatedAt: safePrimary.localUpdatedAt || safeFallback.localUpdatedAt,
        cloudLastPushedAt: safePrimary.cloudLastPushedAt || safeFallback.cloudLastPushedAt,
        cloudLastRemoteAt: safePrimary.cloudLastRemoteAt || safeFallback.cloudLastRemoteAt,
        cloudSyncSlotToken: safePrimary.cloudSyncSlotToken || safeFallback.cloudSyncSlotToken,
        recoveryKeyGraceStartedAt: safePrimary.recoveryKeyGraceStartedAt || safeFallback.recoveryKeyGraceStartedAt
    });
}

function readStorage(storage, key) {
    try {
        return storage?.getItem?.(key) || '';
    } catch {
        return '';
    }
}

function removeStorage(storage, key) {
    try {
        storage?.removeItem?.(key);
    } catch {
        // Best-effort metadata cleanup only.
    }
}

function getStorage(options = {}) {
    return options.storage || globalThis.localStorage;
}

function getKeyId(options = {}) {
    return getLocalVaultKeyId({
        scope: options.scope || LOCAL_OPERATIONAL_METADATA_SCOPE
    });
}

async function getOrCreateOperationalMetadataKey(options = {}) {
    const result = await getOrCreateLocalVaultKey(getKeyId(options));
    return result.key;
}

async function readOperationalMetadataKey(options = {}) {
    return readLocalVaultKey(getKeyId(options));
}

function getLegacySyncSlotKeys(storage) {
    const keys = new Set([LEGACY_CLOUD_SYNC_SLOT_KEY]);
    try {
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (
                key
                && key.startsWith(LEGACY_CLOUD_SYNC_SLOT_PREFIX)
                && key !== LEGACY_CLOUD_SYNC_SLOT_KEY
            ) {
                keys.add(key);
            }
        }
    } catch {
        // Key enumeration may be blocked. Direct keys are still handled.
    }
    return Array.from(keys);
}

function getLegacyPrefixedKeys(storage, prefix) {
    const keys = new Set();
    try {
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key && key.startsWith(prefix)) keys.add(key);
        }
    } catch {
        // Key enumeration may be blocked. Direct keys are still handled.
    }
    return Array.from(keys);
}

function chooseLatestIsoTimestamp(values = []) {
    return values
        .map(value => cleanValue(value, 48))
        .filter(Boolean)
        .filter(value => Number.isFinite(new Date(value).getTime()))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || '';
}

function readLegacyPayload(storage) {
    const legacy = {};

    LEGACY_DIRECT_KEYS.forEach(([key, field]) => {
        const value = cleanValue(readStorage(storage, key), field === FIELD_CLOUD_SYNC_SLOT_TOKEN ? 320 : 48);
        if (value) legacy[field] = value;
    });

    if (!legacy.cloudSyncSlotToken) {
        const legacySlotKey = getLegacySyncSlotKeys(storage)
            .find(key => key !== LEGACY_CLOUD_SYNC_SLOT_KEY && readStorage(storage, key));
        if (legacySlotKey) {
            legacy.cloudSyncSlotToken = cleanValue(readStorage(storage, legacySlotKey), 320);
        }
    }

    const legacyGraceStartedAt = chooseLatestIsoTimestamp(
        getLegacyPrefixedKeys(storage, LEGACY_RECOVERY_KEY_GRACE_STARTED_PREFIX)
            .map(key => readStorage(storage, key))
    );
    if (legacyGraceStartedAt) {
        legacy.recoveryKeyGraceStartedAt = legacyGraceStartedAt;
    }

    return normalizePayload(legacy);
}

function removeLegacyPayload(storage) {
    LEGACY_DIRECT_KEYS.forEach(([key]) => removeStorage(storage, key));
    getLegacySyncSlotKeys(storage).forEach(key => removeStorage(storage, key));
    getLegacyPrefixedKeys(storage, LEGACY_RECOVERY_KEY_GRACE_STARTED_PREFIX)
        .forEach(key => removeStorage(storage, key));
}

async function readEncryptedPayload(storage, storageKey, options = {}) {
    const key = await readOperationalMetadataKey(options);
    if (!key) return {};

    const payload = await readEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        key,
        { name: LOCAL_OPERATIONAL_METADATA_NAME }
    );
    return normalizePayload(payload);
}

async function writeEncryptedPayload(payload = cache, options = {}) {
    const storage = getStorage(options);
    const storageKey = options.storageKey || LOCAL_OPERATIONAL_METADATA_KEY;
    const key = await getOrCreateOperationalMetadataKey(options);
    const safePayload = normalizePayload(payload);

    await writeEncryptedLocalMetadataRecord(
        storage,
        storageKey,
        safePayload,
        key,
        {
            name: LOCAL_OPERATIONAL_METADATA_NAME,
            createdAt: options.createdAt,
            updatedAt: options.updatedAt
        }
    );

    cache = safePayload;
    return safePayload;
}

function queueEncryptedWrite(options = {}) {
    const nextPayload = normalizePayload(cache);
    const nextWrite = writeQueue
        .catch(() => true)
        .then(() => writeEncryptedPayload(nextPayload, options))
        .then(() => true)
        .catch(error => {
            console.warn('[Local Metadata] Operational metadata write failed:', error?.message || error);
            return false;
        });

    writeQueue = nextWrite;
    return nextWrite;
}

export function classifyLocalOperationalMetadataRecord(options = {}) {
    const storage = getStorage(options);
    const storageKey = options.storageKey || LOCAL_OPERATIONAL_METADATA_KEY;
    return classifyLocalMetadataRecord(readStorage(storage, storageKey), {
        name: LOCAL_OPERATIONAL_METADATA_NAME
    });
}

export async function initLocalOperationalMetadataStorage(options = {}) {
    const storage = getStorage(options);
    const storageKey = options.storageKey || LOCAL_OPERATIONAL_METADATA_KEY;
    const legacyPayload = readLegacyPayload(storage);
    let encryptedPayload = {};

    try {
        encryptedPayload = await readEncryptedPayload(storage, storageKey, options);
    } catch {
        removeStorage(storage, storageKey);
        encryptedPayload = {};
    }

    const merged = mergeOperationalMetadataPayloads(encryptedPayload, legacyPayload);

    cache = merged;
    initialized = true;

    if (
        legacyPayload.localUpdatedAt
        || legacyPayload.cloudLastPushedAt
        || legacyPayload.cloudLastRemoteAt
        || legacyPayload.cloudSyncSlotToken
        || legacyPayload.recoveryKeyGraceStartedAt
        || encryptedPayload.localUpdatedAt
        || encryptedPayload.cloudLastPushedAt
        || encryptedPayload.cloudLastRemoteAt
        || encryptedPayload.cloudSyncSlotToken
        || encryptedPayload.recoveryKeyGraceStartedAt
    ) {
        await writeEncryptedPayload(merged, options);
    }

    removeLegacyPayload(storage);

    return {
        initialized,
        migratedLegacy: Boolean(
            legacyPayload.localUpdatedAt
            || legacyPayload.cloudLastPushedAt
            || legacyPayload.cloudLastRemoteAt
            || legacyPayload.cloudSyncSlotToken
            || legacyPayload.recoveryKeyGraceStartedAt
        ),
        payload: { ...cache }
    };
}

export function getOperationalMetadataSnapshot() {
    return { ...cache };
}

export function getOperationalMetadataValue(field, fallback = '') {
    return cleanValue(cache[field] || fallback, field === FIELD_CLOUD_SYNC_SLOT_TOKEN ? 320 : 48);
}

export function setOperationalMetadataValue(field, value = '', options = {}) {
    cache = normalizePayload({
        ...cache,
        [field]: value
    });
    queueEncryptedWrite(options);
    return cache[field] || '';
}

export function removeOperationalMetadataValue(field, options = {}) {
    cache = normalizePayload({
        ...cache,
        [field]: ''
    });
    queueEncryptedWrite(options);
}

export function getLocalUpdatedAt() {
    return getOperationalMetadataValue(FIELD_LOCAL_UPDATED_AT);
}

export function setLocalUpdatedAt(value = new Date().toISOString(), options = {}) {
    return setOperationalMetadataValue(FIELD_LOCAL_UPDATED_AT, value, options);
}

export function getCloudLastPushedAt() {
    return getOperationalMetadataValue(FIELD_CLOUD_LAST_PUSHED_AT);
}

export function setCloudLastPushedAt(value = '', options = {}) {
    return setOperationalMetadataValue(FIELD_CLOUD_LAST_PUSHED_AT, value, options);
}

export function removeCloudLastPushedAt(options = {}) {
    removeOperationalMetadataValue(FIELD_CLOUD_LAST_PUSHED_AT, options);
}

export function getCloudLastRemoteAt() {
    return getOperationalMetadataValue(FIELD_CLOUD_LAST_REMOTE_AT);
}

export function setCloudLastRemoteAt(value = '', options = {}) {
    return setOperationalMetadataValue(FIELD_CLOUD_LAST_REMOTE_AT, value, options);
}

export function removeCloudLastRemoteAt(options = {}) {
    removeOperationalMetadataValue(FIELD_CLOUD_LAST_REMOTE_AT, options);
}

export function getCloudSyncSlotToken() {
    return getOperationalMetadataValue(FIELD_CLOUD_SYNC_SLOT_TOKEN);
}

export function setCloudSyncSlotToken(value = '', options = {}) {
    return setOperationalMetadataValue(FIELD_CLOUD_SYNC_SLOT_TOKEN, value, options);
}

export function removeCloudSyncSlotToken(options = {}) {
    removeOperationalMetadataValue(FIELD_CLOUD_SYNC_SLOT_TOKEN, options);
}

export function getRecoveryKeyGraceStartedAt() {
    return getOperationalMetadataValue(FIELD_RECOVERY_KEY_GRACE_STARTED_AT);
}

export function setRecoveryKeyGraceStartedAt(value = new Date().toISOString(), options = {}) {
    return setOperationalMetadataValue(FIELD_RECOVERY_KEY_GRACE_STARTED_AT, value, options);
}

export function removeRecoveryKeyGraceStartedAt(options = {}) {
    removeOperationalMetadataValue(FIELD_RECOVERY_KEY_GRACE_STARTED_AT, options);
}

export function removeLegacyOperationalMetadata(options = {}) {
    removeLegacyPayload(getStorage(options));
}

export function clearLocalOperationalMetadataStorage(options = {}) {
    const storage = getStorage(options);
    const storageKey = options.storageKey || LOCAL_OPERATIONAL_METADATA_KEY;
    cache = {};
    initialized = false;
    writeQueue = Promise.resolve(true);
    removeStorage(storage, storageKey);
    removeLegacyPayload(storage);
}

export function flushLocalOperationalMetadataWrites() {
    return writeQueue;
}

export function isLocalOperationalMetadataInitialized() {
    return initialized;
}
