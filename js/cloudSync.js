// js/cloudSync.js

const CLOUD_ENABLED_KEY = 'bb_cloud_sync_enabled';
const CLOUD_HISTORY_KEY = 'bb_sync_history';
const CLOUD_LAST_PUSHED_KEY = 'bb_cloud_last_pushed_at';
const CLOUD_LAST_REMOTE_KEY = 'bb_cloud_last_remote_at';
const CLOUD_LAST_ERROR_KEY = 'bb_cloud_last_error';
const CLOUD_CONFLICT_REMOTE_KEY = 'bb_cloud_conflict_remote_at';
const CLOUD_CONFLICT_LOCAL_KEY = 'bb_cloud_conflict_local_at';
const CLOUD_CONFLICT_LAST_SYNCED_KEY = 'bb_cloud_conflict_last_synced_at';
const CLOUD_CONFLICT_REMOTE_SUMMARY_KEY = 'bb_cloud_conflict_remote_summary';
const CLOUD_CONFLICT_LOCAL_SUMMARY_KEY = 'bb_cloud_conflict_local_summary';
const CLOUD_KEY_PREFIX = 'bb_cloud_key_';
const CLOUD_TRUSTED_KEY_DB_NAME = 'budgetbuddy_buddy_cloud_keys';
const CLOUD_TRUSTED_KEY_DB_VERSION = 1;
const CLOUD_TRUSTED_KEY_STORE = 'trusted_keys';
const CLOUD_SYNC_SLOT_PREFIX = 'bb_cloud_sync_slot_';
const CLOUD_FORCE_PULL_AFTER_SIGN_IN_PREFIX = 'bb_cloud_force_pull_after_sign_in_';
const CLOUD_TABLE = 'buddy_cloud_vaults';
const CLOUD_SNAPSHOT_TABLE = 'buddy_cloud_vault_snapshots';
const VAULT_NAME = 'primary';
const SCHEMA_VERSION = 1;
const ENCRYPTION_VERSION = 1;
const PUSH_DEBOUNCE_MS = 1200;
const CLOUD_HISTORY_LIMIT = 5;
const CLOUD_VERSION_HISTORY_FREE_LIMIT = 1;
const CLOUD_VERSION_HISTORY_PREMIUM_LIMIT = 10;
const CLOUD_VERSION_HISTORY_MIN_INTERVAL_MS = 60 * 60 * 1000;
const CLOUD_CONFLICT_GRACE_MS = 5 * 60 * 1000;
const FREE_SYNC_DEVICE_LIMIT = 2;
const FREE_SYNC_SLOT_IDLE_RECLAIM_MINUTES = 60;
const FREE_SYNC_SLOT_IDLE_RECLAIM_MS = FREE_SYNC_SLOT_IDLE_RECLAIM_MINUTES * 60 * 1000;
const FREE_SYNC_SLOT_IDLE_RECLAIM_LABEL = `${FREE_SYNC_SLOT_IDLE_RECLAIM_MINUTES} minutes`;
const MULTI_DEVICE_LIMIT_CODE = 'BUDDY_CLOUD_MULTI_DEVICE_LIMIT';

let sb = null;
let currentUser = null;
let getSnapshot = null;
let replaceSnapshot = null;
let afterRemoteApply = null;
let isPremiumAccount = null;
let pushTimer = null;
let conflictGraceTimer = null;
let activePushPromise = null;
let syncSlotRealtimeChannel = null;
let syncSlotRealtimeUserId = '';
let isInitialized = false;
let isApplyingRemote = false;
let memoryCloudKeys = new Map();
let lastKnownStatus = {
    enabled: false,
    signedIn: false,
    syncing: false,
    nextSyncAt: '',
    nextSyncReason: '',
    lastError: '',
    lastPushedAt: '',
    lastRemoteAt: ''
};

function encodeBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
    const normalized = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function textToBytes(value) {
    return new TextEncoder().encode(value);
}

function bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
}

async function sha256(value) {
    const digest = await crypto.subtle.digest('SHA-256', textToBytes(value));
    return encodeBase64Url(new Uint8Array(digest));
}

function isCryptoKey(value) {
    return typeof CryptoKey !== 'undefined' && value instanceof CryptoKey;
}

function canUseTrustedCloudKeyStorage() {
    return typeof indexedDB !== 'undefined' && Boolean(crypto?.subtle);
}

function openTrustedCloudKeyDb() {
    if (!canUseTrustedCloudKeyStorage()) return Promise.resolve(null);

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        let request;
        try {
            request = indexedDB.open(CLOUD_TRUSTED_KEY_DB_NAME, CLOUD_TRUSTED_KEY_DB_VERSION);
        } catch (error) {
            console.warn('[Cloud Sync] Trusted key storage unavailable:', error);
            settle(null);
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(CLOUD_TRUSTED_KEY_STORE)) {
                db.createObjectStore(CLOUD_TRUSTED_KEY_STORE, { keyPath: 'userId' });
            }
        };
        request.onsuccess = () => settle(request.result);
        request.onerror = () => {
            console.warn('[Cloud Sync] Could not open trusted key storage:', request.error);
            settle(null);
        };
        request.onblocked = () => {
            console.warn('[Cloud Sync] Trusted key storage is blocked by another tab.');
            settle(null);
        };
    });
}

async function readTrustedCloudKey(userId) {
    if (!userId) return null;
    const db = await openTrustedCloudKeyDb();
    if (!db) return null;

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            try { db.close(); } catch {}
            resolve(value);
        };

        try {
            const tx = db.transaction(CLOUD_TRUSTED_KEY_STORE, 'readonly');
            const request = tx.objectStore(CLOUD_TRUSTED_KEY_STORE).get(userId);
            request.onsuccess = () => {
                const key = request.result?.key || null;
                settle(isCryptoKey(key) ? key : null);
            };
            request.onerror = () => settle(null);
            tx.onabort = () => settle(null);
        } catch (error) {
            console.warn('[Cloud Sync] Could not read trusted key:', error);
            settle(null);
        }
    });
}

async function persistTrustedCloudKey(userId, cryptoKey) {
    if (!userId || !isCryptoKey(cryptoKey)) return false;
    const db = await openTrustedCloudKeyDb();
    if (!db) return false;

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            try { db.close(); } catch {}
            resolve(value);
        };

        try {
            const tx = db.transaction(CLOUD_TRUSTED_KEY_STORE, 'readwrite');
            const request = tx.objectStore(CLOUD_TRUSTED_KEY_STORE).put({
                userId,
                key: cryptoKey,
                algorithm: 'AES-GCM',
                usages: ['encrypt', 'decrypt'],
                updatedAt: new Date().toISOString()
            });
            request.onerror = () => settle(false);
            tx.oncomplete = () => settle(true);
            tx.onabort = () => settle(false);
        } catch (error) {
            console.warn('[Cloud Sync] Could not save trusted key:', error);
            settle(false);
        }
    });
}

async function deleteTrustedCloudKey(userId) {
    if (!userId) return false;
    const db = await openTrustedCloudKeyDb();
    if (!db) return false;

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            try { db.close(); } catch {}
            resolve(value);
        };

        try {
            const tx = db.transaction(CLOUD_TRUSTED_KEY_STORE, 'readwrite');
            tx.objectStore(CLOUD_TRUSTED_KEY_STORE).delete(userId);
            tx.oncomplete = () => settle(true);
            tx.onabort = () => settle(false);
            tx.onerror = () => settle(false);
        } catch (error) {
            console.warn('[Cloud Sync] Could not delete trusted key:', error);
            settle(false);
        }
    });
}

async function deleteAllTrustedCloudKeys() {
    if (typeof indexedDB === 'undefined') return false;

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        let request;
        try {
            request = indexedDB.deleteDatabase(CLOUD_TRUSTED_KEY_DB_NAME);
        } catch (error) {
            console.warn('[Cloud Sync] Could not clear trusted key storage:', error);
            settle(false);
            return;
        }

        request.onsuccess = () => settle(true);
        request.onerror = () => settle(false);
        request.onblocked = () => settle(false);
    });
}

function getUserKeyName(userId = currentUser?.id) {
    return userId ? `${CLOUD_KEY_PREFIX}${userId}` : '';
}

function purgePersistedCloudKey(userId = currentUser?.id) {
    const keyName = getUserKeyName(userId);
    try {
        if (keyName) localStorage.removeItem(keyName);
    } catch {
        // Key cleanup must never block cloud status checks.
    }
}

function purgeAllPersistedCloudKeys() {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(CLOUD_KEY_PREFIX))
            .forEach(key => localStorage.removeItem(key));
    } catch {
        // Key cleanup must never block cloud status checks.
    }
}

function clearMemoryCloudKey(userId = currentUser?.id) {
    if (userId) memoryCloudKeys.delete(userId);
    purgePersistedCloudKey(userId);
}

function getMemoryCloudKeyEntry(userId = currentUser?.id) {
    const normalizedUserId = userId || '';
    purgePersistedCloudKey(normalizedUserId);
    return normalizedUserId ? memoryCloudKeys.get(normalizedUserId) || null : null;
}

function getStoredCloudRawKey() {
    return getMemoryCloudKeyEntry()?.rawKey || '';
}

function getStoredCloudKeyMaterial() {
    const entry = getMemoryCloudKeyEntry();
    return entry?.rawKey || entry?.cryptoKey || null;
}

function getSyncSlotKeyName(userId = currentUser?.id) {
    return userId ? `${CLOUD_SYNC_SLOT_PREFIX}${userId}` : '';
}

function getForcePullAfterSignInKeyName(userId = currentUser?.id) {
    return userId ? `${CLOUD_FORCE_PULL_AFTER_SIGN_IN_PREFIX}${userId}` : '';
}

function shouldForcePullAfterSignIn() {
    const keyName = getForcePullAfterSignInKeyName();
    return Boolean(keyName && localStorage.getItem(keyName) === 'true');
}

function clearForcePullAfterSignIn() {
    const keyName = getForcePullAfterSignInKeyName();
    if (keyName) localStorage.removeItem(keyName);
}

function hasLocalCloudKey() {
    return Boolean(getStoredCloudKeyMaterial());
}

function hasExportableCloudKey() {
    return Boolean(getStoredCloudRawKey());
}

function hasTrustedCloudKey() {
    return Boolean(getMemoryCloudKeyEntry()?.cryptoKey);
}

async function restoreTrustedCloudKey(userId = currentUser?.id) {
    const normalizedUserId = userId || '';
    if (!normalizedUserId || getMemoryCloudKeyEntry(normalizedUserId)?.cryptoKey) {
        return Boolean(getMemoryCloudKeyEntry(normalizedUserId)?.cryptoKey);
    }

    const cryptoKey = await readTrustedCloudKey(normalizedUserId);
    if (!cryptoKey) return false;

    const existing = getMemoryCloudKeyEntry(normalizedUserId) || {};
    memoryCloudKeys.set(normalizedUserId, {
        ...existing,
        cryptoKey,
        trustedKeyAvailable: true
    });
    purgePersistedCloudKey(normalizedUserId);
    return true;
}

async function clearTrustedCloudKey(userId = currentUser?.id) {
    const normalizedUserId = userId || '';
    if (!normalizedUserId) return false;
    clearMemoryCloudKey(normalizedUserId);
    return deleteTrustedCloudKey(normalizedUserId);
}

async function clearAllTrustedCloudKeys() {
    memoryCloudKeys.clear();
    purgeAllPersistedCloudKeys();
    return deleteAllTrustedCloudKeys();
}

async function storeCloudKey(value, options = {}) {
    const userId = currentUser?.id || '';
    if (!userId) throw new Error('Sign in before setting a Cloud Sync key.');

    const normalized = String(value || '').trim();
    if (!normalized) throw new Error('Cloud Sync recovery key is invalid.');
    const cryptoKey = options.cryptoKey || await importAesKey(normalized);
    memoryCloudKeys.set(userId, {
        rawKey: normalized,
        cryptoKey,
        trustedKeyAvailable: false
    });
    purgePersistedCloudKey(userId);
    if (options.persistTrusted !== false) {
        const trustedKeyAvailable = await persistTrustedCloudKey(userId, cryptoKey);
        const entry = getMemoryCloudKeyEntry(userId);
        if (entry) memoryCloudKeys.set(userId, { ...entry, trustedKeyAvailable });
    }
    return normalized;
}

function generateCloudKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return encodeBase64Url(bytes);
}

function generateUuid() {
    if (crypto?.randomUUID) return crypto.randomUUID();

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getOrCreateSyncSlotToken() {
    const keyName = getSyncSlotKeyName();
    if (!keyName) throw new Error('Sign in before using Cloud Sync.');

    const existing = localStorage.getItem(keyName);
    if (existing) return existing;

    const token = generateCloudKey();
    localStorage.setItem(keyName, token);
    return token;
}

function getStoredSyncSlotToken(userId = currentUser?.id) {
    const keyName = getSyncSlotKeyName(userId);
    return keyName ? localStorage.getItem(keyName) || '' : '';
}

async function getSyncSlotHash() {
    return sha256(getOrCreateSyncSlotToken());
}

async function getExistingSyncSlotHash() {
    const token = getStoredSyncSlotToken();
    return token ? sha256(token) : '';
}

export async function getCurrentSyncSlotHash() {
    return getExistingSyncSlotHash();
}

function canUseMultipleSyncDevices() {
    try {
        return Boolean(typeof isPremiumAccount === 'function' && isPremiumAccount());
    } catch {
        return false;
    }
}

function normalizeSyncOwnerSlots(remote = null) {
    const slots = [];
    const seen = new Set();
    const addSlot = slot => {
        const hash = String(slot?.hash || slot?.sync_owner_hash || '').trim();
        if (!hash || seen.has(hash)) return;
        seen.add(hash);
        slots.push({
            hash,
            claimed_at: slot?.claimed_at || slot?.sync_owner_claimed_at || '',
            last_seen_at: slot?.last_seen_at || slot?.sync_owner_last_seen_at || ''
        });
    };

    if (Array.isArray(remote?.sync_owner_slots)) {
        remote.sync_owner_slots.forEach(addSlot);
    }

    if (remote?.sync_owner_hash) {
        addSlot({
            hash: remote.sync_owner_hash,
            claimed_at: remote.sync_owner_claimed_at || '',
            last_seen_at: remote.sync_owner_last_seen_at || ''
        });
    }

    return slots.slice(0, FREE_SYNC_DEVICE_LIMIT);
}

function getOldestSyncSlotIndex(slots = []) {
    return slots.reduce((oldestIndex, slot, index) => {
        const oldestSlot = slots[oldestIndex] || {};
        const oldestTime = new Date(oldestSlot.last_seen_at || oldestSlot.claimed_at || 0).getTime() || 0;
        const slotTime = new Date(slot.last_seen_at || slot.claimed_at || 0).getTime() || 0;
        return slotTime < oldestTime ? index : oldestIndex;
    }, 0);
}

function getSyncSlotActivityMs(slot = {}) {
    const time = new Date(slot.last_seen_at || slot.claimed_at || 0).getTime();
    return Number.isFinite(time) ? time : 0;
}

function isStaleFreeSyncSlot(slot = {}, nowMs = Date.now()) {
    const activityMs = getSyncSlotActivityMs(slot);
    return !activityMs || nowMs - activityMs > FREE_SYNC_SLOT_IDLE_RECLAIM_MS;
}

function pruneStaleFreeSyncSlots(slots = [], currentHash = '') {
    const nowMs = Date.now();
    return slots.filter(slot => slot?.hash === currentHash || !isStaleFreeSyncSlot(slot, nowMs));
}

function buildSyncSlotFields(slots = []) {
    const safeSlots = slots
        .filter(slot => slot?.hash)
        .slice(0, FREE_SYNC_DEVICE_LIMIT);
    const primary = safeSlots[0] || {};

    return {
        sync_owner_slots: safeSlots,
        sync_owner_hash: primary.hash || null,
        sync_owner_claimed_at: primary.claimed_at || null,
        sync_owner_last_seen_at: primary.last_seen_at || null
    };
}

function buildSyncSlotStatus(slots = [], syncOwnerHash = '') {
    const currentSlot = slots.find(slot => slot.hash === syncOwnerHash) || slots[0] || {};
    const currentBrowserHasSlot = Boolean(syncOwnerHash && slots.some(slot => slot.hash === syncOwnerHash));
    const syncSlotRows = slots
        .filter(slot => slot?.hash)
        .slice(0, FREE_SYNC_DEVICE_LIMIT)
        .map(slot => ({
            hash: slot.hash,
            claimed_at: slot.claimed_at || '',
            last_seen_at: slot.last_seen_at || ''
        }));
    return {
        syncSlotOwnerHash: syncOwnerHash || currentSlot.hash || '',
        syncSlotCurrentHash: syncOwnerHash || '',
        syncSlotClaimedAt: currentSlot.claimed_at || '',
        syncSlotLastSeenAt: currentSlot.last_seen_at || '',
        syncSlotDeviceCount: slots.length,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotCurrentBrowserActive: currentBrowserHasSlot,
        syncSlotRows
    };
}

function buildSyncSlotClaim(remote = null, syncOwnerHash = '', { replace = false } = {}) {
    const now = new Date().toISOString();
    const slots = pruneStaleFreeSyncSlots(normalizeSyncOwnerSlots(remote), syncOwnerHash);
    const existingIndex = slots.findIndex(slot => slot.hash === syncOwnerHash);

    if (existingIndex >= 0) {
        slots[existingIndex] = {
            ...slots[existingIndex],
            claimed_at: slots[existingIndex].claimed_at || now,
            last_seen_at: now
        };
    } else if (slots.length < FREE_SYNC_DEVICE_LIMIT) {
        slots.push({
            hash: syncOwnerHash,
            claimed_at: now,
            last_seen_at: now
        });
    } else if (replace) {
        const replaceIndex = getOldestSyncSlotIndex(slots);
        slots[replaceIndex] = {
            hash: syncOwnerHash,
            claimed_at: now,
            last_seen_at: now
        };
    } else {
        return null;
    }

    return {
        slots,
        fields: buildSyncSlotFields(slots),
        status: buildSyncSlotStatus(slots, syncOwnerHash)
    };
}

function getVersionHistoryLimit() {
    return canUseMultipleSyncDevices()
        ? CLOUD_VERSION_HISTORY_PREMIUM_LIMIT
        : CLOUD_VERSION_HISTORY_FREE_LIMIT;
}

async function importAesKey(rawKey) {
    const bytes = decodeBase64Url(rawKey);
    if (bytes.byteLength !== 32) throw new Error('Cloud Sync recovery key is invalid.');
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function getAesKey(keyMaterial) {
    if (isCryptoKey(keyMaterial)) return keyMaterial;
    return importAesKey(keyMaterial);
}

async function encryptSnapshot(snapshot, keyMaterial) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await getAesKey(keyMaterial);
    const plaintext = JSON.stringify({
        app: 'Zam!',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: snapshot
    });
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textToBytes(plaintext));

    return {
        algorithm: 'AES-GCM',
        iv: encodeBase64Url(iv),
        ciphertext: encodeBase64Url(new Uint8Array(ciphertext))
    };
}

async function decryptSnapshot(payload, keyMaterial) {
    if (!payload || payload.algorithm !== 'AES-GCM' || !payload.iv || !payload.ciphertext) {
        throw new Error('Cloud Sync vault payload is not recognized.');
    }

    const key = await getAesKey(keyMaterial);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decodeBase64Url(payload.iv) },
        key,
        decodeBase64Url(payload.ciphertext)
    );
    const parsed = JSON.parse(bytesToText(new Uint8Array(decrypted)));
    return parsed.data || {};
}

function getLocalSnapshot() {
    return typeof getSnapshot === 'function' ? getSnapshot() : {};
}

function localSnapshotHasBudgetData(snapshot = getLocalSnapshot()) {
    return Boolean(
        Array.isArray(snapshot.transactions) && snapshot.transactions.length
        || Array.isArray(snapshot.categories) && snapshot.categories.length
    );
}

function getLatestTransactionTime(transactions = []) {
    return transactions.reduce((latest, tx) => {
        const value = tx?.updatedAtUTC || tx?.serverLoggedAtUTC || tx?.createdAtUTC || tx?.createdAt || tx?.date || '';
        const time = new Date(value).getTime();
        return Number.isFinite(time) && time > latest ? time : latest;
    }, 0);
}

function getTimestampMs(value = '') {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : 0;
}

function getLastVerifiedCloudAt() {
    return localStorage.getItem(CLOUD_LAST_PUSHED_KEY) || localStorage.getItem(CLOUD_LAST_REMOTE_KEY) || '';
}

function getLocalCloudVerificationState() {
    const snapshot = getLocalSnapshot();
    const localUpdatedAt = snapshot?.meta?.localUpdatedAt || '';
    const lastVerifiedAt = getLastVerifiedCloudAt();
    const localUpdatedMs = getTimestampMs(localUpdatedAt);
    const lastVerifiedMs = getTimestampMs(lastVerifiedAt);
    const hasLocalBudgetData = localSnapshotHasBudgetData(snapshot);
    const hasUnverifiedLocalChanges = Boolean(
        hasLocalBudgetData
        && localUpdatedAt
        && (
            !lastVerifiedAt
            || localUpdatedAt !== lastVerifiedAt
        )
        && (
            !lastVerifiedMs
            || !localUpdatedMs
            || localUpdatedMs > lastVerifiedMs
        )
    );

    return {
        localUpdatedAt,
        lastVerifiedAt,
        hasUnverifiedLocalChanges
    };
}

function getConflictGraceWaitMs(remoteUpdatedAt = '', localUpdatedAt = '') {
    const newestChangeMs = Math.max(getTimestampMs(remoteUpdatedAt), getTimestampMs(localUpdatedAt));
    if (!newestChangeMs) return 0;
    const ageMs = Date.now() - newestChangeMs;
    return Math.max(0, CLOUD_CONFLICT_GRACE_MS - ageMs);
}

function formatWaitMinutes(ms = 0) {
    const minutes = Math.max(1, Math.ceil(ms / 60000));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function getShortChecksum(value = '', fallback = 'none') {
    const normalized = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return normalized ? `${normalized.slice(0, 4)}...` : fallback;
}

function getTransactionSyncId(tx = {}, index = 0) {
    return String(tx?.id || tx?.transactionId || tx?.uuid || tx?.createdAtUTC || tx?.serverLoggedAtUTC || tx?.createdAt || `index-${index}`);
}

function sortForSyncComparison(value) {
    if (Array.isArray(value)) return value.map(sortForSyncComparison);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((next, key) => {
            next[key] = sortForSyncComparison(value[key]);
            return next;
        }, {});
}

function getTransactionSignature(tx = {}) {
    try {
        return JSON.stringify(sortForSyncComparison(tx));
    } catch {
        return '';
    }
}

function getTransactionMap(snapshot = {}) {
    const transactions = Array.isArray(snapshot?.transactions) ? snapshot.transactions : [];
    return transactions.reduce((map, tx, index) => {
        map.set(getTransactionSyncId(tx, index), tx || {});
        return map;
    }, new Map());
}

function getSyncTransactionDelta(beforeSnapshot = null, afterSnapshot = {}) {
    const before = getTransactionMap(beforeSnapshot || {});
    const after = getTransactionMap(afterSnapshot || {});
    let added = 0;
    let updated = 0;
    let deleted = 0;

    after.forEach((nextTx, id) => {
        const previousTx = before.get(id);
        const wasDeleted = Boolean(previousTx?.isDeleted);
        const isDeleted = Boolean(nextTx?.isDeleted);

        if (!previousTx) {
            if (!isDeleted) added += 1;
            return;
        }

        if (!wasDeleted && isDeleted) {
            deleted += 1;
            return;
        }

        if (wasDeleted && !isDeleted) {
            added += 1;
            return;
        }

        if (!isDeleted && getTransactionSignature(previousTx) !== getTransactionSignature(nextTx)) {
            updated += 1;
        }
    });

    before.forEach((previousTx, id) => {
        if (!after.has(id) && !previousTx?.isDeleted) deleted += 1;
    });

    return { added, updated, deleted };
}

function buildSyncSnapshotDetails({
    beforeSnapshot = null,
    afterSnapshot = {},
    beforeChecksum = '',
    afterChecksum = '',
    resultStatus = 'success'
} = {}) {
    return {
        kind: 'buddy_cloud_sync_summary',
        privacySafe: true,
        transactions: getSyncTransactionDelta(beforeSnapshot, afterSnapshot),
        snapshot: {
            before: getShortChecksum(beforeChecksum),
            after: getShortChecksum(afterChecksum, 'pending')
        },
        resultStatus
    };
}

function getSafeSyncRecordDetails(details = null) {
    if (!details || typeof details !== 'object') return null;
    if (details.kind !== 'buddy_cloud_sync_summary' || details.privacySafe !== true) return null;

    const count = value => Math.max(0, Number.parseInt(value, 10) || 0);
    const cleanText = (value, fallback = '') => String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 64);

    return {
        kind: 'buddy_cloud_sync_summary',
        privacySafe: true,
        transactions: {
            added: count(details.transactions?.added),
            updated: count(details.transactions?.updated),
            deleted: count(details.transactions?.deleted)
        },
        snapshot: {
            before: cleanText(details.snapshot?.before, 'none'),
            after: cleanText(details.snapshot?.after, 'pending')
        },
        resultStatus: cleanText(details.resultStatus, 'success')
    };
}

function scheduleConflictGraceRetry(waitMs = CLOUD_CONFLICT_GRACE_MS) {
    clearTimeout(conflictGraceTimer);
    rememberStatus({
        syncing: false,
        nextSyncAt: new Date(Date.now() + Math.max(1000, waitMs)).toISOString(),
        nextSyncReason: 'Cloud Sync conflict recheck after the grace window'
    });
    conflictGraceTimer = setTimeout(() => {
        conflictGraceTimer = null;
        rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Cloud Sync conflict recheck running now' });
        init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount })
            .catch(error => {
                console.error('[Cloud Sync] Conflict grace retry failed:', error);
                record(getCloudErrorMessage(error, 'Cloud Sync could not recheck recent changes.'), 'error');
            });
    }, Math.max(1000, waitMs));
}

function getSnapshotSummary(snapshot = {}) {
    const transactions = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
    const categories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
    const activeTransactions = transactions.filter(tx => !tx?.isDeleted);
    const deletedTransactions = transactions.length - activeTransactions.length;
    const latestTransactionTime = getLatestTransactionTime(transactions);

    return {
        transactionCount: transactions.length,
        activeTransactionCount: activeTransactions.length,
        deletedTransactionCount: deletedTransactions,
        categoryCount: categories.length,
        incomeSourceCount: categories.filter(cat => cat?.type === 'income').length,
        latestTransactionAt: latestTransactionTime ? new Date(latestTransactionTime).toISOString() : ''
    };
}

function summaryHasBudgetData(summary = null) {
    return Boolean(
        Number(summary?.transactionCount || 0) > 0
        || Number(summary?.categoryCount || 0) > 0
    );
}

function summariesHaveSameShape(a = null, b = null) {
    if (!a || !b) return false;
    return Number(a.transactionCount || 0) === Number(b.transactionCount || 0)
        && Number(a.activeTransactionCount || 0) === Number(b.activeTransactionCount || 0)
        && Number(a.deletedTransactionCount || 0) === Number(b.deletedTransactionCount || 0)
        && Number(a.categoryCount || 0) === Number(b.categoryCount || 0)
        && Number(a.incomeSourceCount || 0) === Number(b.incomeSourceCount || 0);
}

const VOLATILE_SNAPSHOT_KEYS = new Set([
    'meta',
    'createdAt',
    'createdAtUTC',
    'serverLoggedAtUTC',
    'updatedAtUTC'
]);

function normalizeSnapshotForContentCompare(value, key = '') {
    if (VOLATILE_SNAPSHOT_KEYS.has(key)) return undefined;

    if (Array.isArray(value)) {
        return value.map(item => normalizeSnapshotForContentCompare(item));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((normalized, childKey) => {
                const childValue = normalizeSnapshotForContentCompare(value[childKey], childKey);
                if (childValue !== undefined) normalized[childKey] = childValue;
                return normalized;
            }, {});
    }

    return value;
}

function getSnapshotContentSignature(snapshot = {}) {
    return JSON.stringify(normalizeSnapshotForContentCompare({
        transactions: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
        categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
        settings: snapshot.settings || {}
    }));
}

function snapshotsHaveSameBudgetContent(a = null, b = null) {
    if (!a || !b) return false;
    return getSnapshotContentSignature(a) === getSnapshotContentSignature(b);
}

function storeConflictSummary(key, summary = null) {
    if (!key) return;
    if (!summary) {
        localStorage.removeItem(key);
        return;
    }

    try {
        localStorage.setItem(key, JSON.stringify(summary));
    } catch {
        localStorage.removeItem(key);
    }
}

function readConflictSummary(key) {
    if (!key) return null;
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function isEnabled() {
    return localStorage.getItem(CLOUD_ENABLED_KEY) === 'true';
}

function canUseCloud() {
    return Boolean(sb?.from && currentUser?.id && crypto?.subtle);
}

function getConflictState() {
    return {
        remoteUpdatedAt: localStorage.getItem(CLOUD_CONFLICT_REMOTE_KEY) || '',
        localUpdatedAt: localStorage.getItem(CLOUD_CONFLICT_LOCAL_KEY) || '',
        lastSyncedAt: localStorage.getItem(CLOUD_CONFLICT_LAST_SYNCED_KEY) || '',
        remoteSummary: readConflictSummary(CLOUD_CONFLICT_REMOTE_SUMMARY_KEY),
        localSummary: readConflictSummary(CLOUD_CONFLICT_LOCAL_SUMMARY_KEY)
    };
}

function setConflictState({ remoteUpdatedAt = '', localUpdatedAt = '', lastSyncedAt = '', remoteSummary = null, localSummary = null } = {}) {
    if (remoteUpdatedAt) localStorage.setItem(CLOUD_CONFLICT_REMOTE_KEY, remoteUpdatedAt);
    if (localUpdatedAt) localStorage.setItem(CLOUD_CONFLICT_LOCAL_KEY, localUpdatedAt);
    if (lastSyncedAt) localStorage.setItem(CLOUD_CONFLICT_LAST_SYNCED_KEY, lastSyncedAt);
    storeConflictSummary(CLOUD_CONFLICT_REMOTE_SUMMARY_KEY, remoteSummary);
    storeConflictSummary(CLOUD_CONFLICT_LOCAL_SUMMARY_KEY, localSummary);
}

function clearConflictState() {
    localStorage.removeItem(CLOUD_CONFLICT_REMOTE_KEY);
    localStorage.removeItem(CLOUD_CONFLICT_LOCAL_KEY);
    localStorage.removeItem(CLOUD_CONFLICT_LAST_SYNCED_KEY);
    localStorage.removeItem(CLOUD_CONFLICT_REMOTE_SUMMARY_KEY);
    localStorage.removeItem(CLOUD_CONFLICT_LOCAL_SUMMARY_KEY);
}

function clearStaleEnabledStateForFreshSetup() {
    localStorage.removeItem(CLOUD_ENABLED_KEY);
    localStorage.removeItem(CLOUD_LAST_PUSHED_KEY);
    localStorage.removeItem(CLOUD_LAST_REMOTE_KEY);
    localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    clearConflictState();
    rememberStatus({
        syncing: false,
        syncSlotBlocked: false,
        syncSlotOwnerHash: '',
        syncSlotCurrentHash: '',
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: '',
        syncSlotCurrentBrowserActive: false,
        syncSlotRows: []
    });
}

function rememberStatus(next = {}) {
    const conflict = getConflictState();
    lastKnownStatus = {
        ...lastKnownStatus,
        enabled: isEnabled(),
        signedIn: Boolean(currentUser?.id),
        hasKey: hasLocalCloudKey(),
        hasExportableKey: hasExportableCloudKey(),
        hasTrustedKey: hasTrustedCloudKey(),
        lastPushedAt: localStorage.getItem(CLOUD_LAST_PUSHED_KEY) || '',
        lastRemoteAt: localStorage.getItem(CLOUD_LAST_REMOTE_KEY) || '',
        lastError: localStorage.getItem(CLOUD_LAST_ERROR_KEY) || '',
        hasConflict: Boolean(conflict.remoteUpdatedAt || conflict.localUpdatedAt),
        conflictRemoteAt: conflict.remoteUpdatedAt,
        conflictLocalAt: conflict.localUpdatedAt,
        conflictLastSyncedAt: conflict.lastSyncedAt,
        conflictRemoteSummary: conflict.remoteSummary,
        conflictLocalSummary: conflict.localSummary,
        isPremium: canUseMultipleSyncDevices(),
        multiDeviceAllowed: canUseMultipleSyncDevices(),
        freeDeviceLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
        versionHistoryLimit: getVersionHistoryLimit(),
        ...next
    };
    window.dispatchEvent(new CustomEvent('buddy-cloud-status', { detail: getStatus() }));
}

function record(message, status = 'synced', details = null) {
    if (status === 'error') {
        localStorage.setItem(CLOUD_LAST_ERROR_KEY, message);
    } else if (status === 'synced' || status === 'local') {
        localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    }

    if (typeof window.recordSyncEvent === 'function') {
        window.recordSyncEvent(message, status, details);
    } else {
        try {
            const history = JSON.parse(localStorage.getItem(CLOUD_HISTORY_KEY) || '[]');
            const event = { id: Date.now(), time: new Date().toISOString(), status, message };
            const safeDetails = getSafeSyncRecordDetails(details);
            if (safeDetails) event.details = safeDetails;
            history.unshift(event);
            localStorage.setItem(CLOUD_HISTORY_KEY, JSON.stringify(history.slice(0, CLOUD_HISTORY_LIMIT)));
        } catch {
            // Keep cloud sync independent of history rendering.
        }
    }

    rememberStatus({
        syncing: status === 'syncing',
        nextSyncAt: status === 'syncing' ? lastKnownStatus.nextSyncAt : '',
        nextSyncReason: status === 'syncing' ? lastKnownStatus.nextSyncReason : ''
    });
}

function getCloudErrorMessage(error, fallback = 'Cloud Sync failed.') {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();

    if (code === MULTI_DEVICE_LIMIT_CODE) {
        return `Free Tier includes ${FREE_SYNC_DEVICE_LIMIT} active Cloud Sync slots. Browsers inactive for ${FREE_SYNC_SLOT_IDLE_RECLAIM_LABEL} are released automatically, or use this browser instead.`;
    }

    if (
        code === 'PGRST204'
        || message.includes('sync_owner_slots')
        || message.includes('sync_owner_hash')
        || message.includes('sync_owner_claimed_at')
        || message.includes('sync_owner_last_seen_at')
    ) {
        return 'Cloud Sync two-device Free sync is not ready yet. Apply supabase/migrations/202606100007_buddy_cloud_two_free_sync_slots.sql in Supabase, then retry sync.';
    }

    if (
        code === 'PGRST205'
        || (message.includes('buddy_cloud_vaults') && message.toLowerCase().includes('schema cache'))
        || (message.includes("Could not find the table") && message.includes('buddy_cloud_vaults'))
    ) {
        return 'Cloud Sync database is not ready yet. Apply supabase/migrations/202606100002_buddy_cloud_vaults.sql in Supabase, then retry sync.';
    }

    return message || fallback;
}

function getVersionHistoryErrorMessage(error, fallback = 'Cloud Sync Version History is temporarily unavailable.') {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();

    if (
        code === 'PGRST205'
        || code === '42P01'
        || message.includes(CLOUD_SNAPSHOT_TABLE)
        || message.toLowerCase().includes('schema cache')
        || (message.includes("Could not find the table") && message.includes('buddy_cloud_vault_snapshots'))
    ) {
        return 'Cloud Sync Version History is not ready yet. Apply supabase/migrations/202606100006_buddy_cloud_vault_snapshots.sql in Supabase, then retry.';
    }

    return message || fallback;
}

function createVersionHistoryError(error, fallback) {
    const next = new Error(getVersionHistoryErrorMessage(error, fallback));
    next.cause = error;
    next.code = error?.code || '';
    return next;
}

function createMultiDeviceLimitError(remote = null, slots = normalizeSyncOwnerSlots(remote)) {
    const error = new Error(`Free Tier includes ${FREE_SYNC_DEVICE_LIMIT} active Cloud Sync slots.`);
    error.code = MULTI_DEVICE_LIMIT_CODE;
    error.remoteUpdatedAt = remote?.client_updated_at || remote?.updated_at || '';
    error.slotClaimedAt = slots[0]?.claimed_at || remote?.sync_owner_claimed_at || '';
    error.slotLastSeenAt = slots[0]?.last_seen_at || remote?.sync_owner_last_seen_at || '';
    error.slotCount = slots.length;
    error.slotLimit = FREE_SYNC_DEVICE_LIMIT;
    error.slotIdleReclaimMinutes = FREE_SYNC_SLOT_IDLE_RECLAIM_MINUTES;
    error.slotIdleReclaimLabel = FREE_SYNC_SLOT_IDLE_RECLAIM_LABEL;
    return error;
}

async function fetchRemoteVault() {
    const { data, error } = await sb
        .from(CLOUD_TABLE)
        .select('payload, payload_checksum, client_updated_at, updated_at, sync_owner_hash, sync_owner_claimed_at, sync_owner_last_seen_at, sync_owner_slots')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function fetchLatestVaultSnapshot() {
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id, client_updated_at, created_at')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function fetchLatestRecoverableVaultSnapshot(keyMaterial) {
    if (!keyMaterial) return null;

    const retentionLimit = getVersionHistoryLimit();
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id, payload, client_updated_at, created_at')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .order('created_at', { ascending: false })
        .limit(retentionLimit);

    if (error) throw createVersionHistoryError(error);

    for (const row of data || []) {
        const snapshot = await decryptSnapshot(row.payload, keyMaterial);
        const summary = getSnapshotSummary(snapshot);
        if (summaryHasBudgetData(summary)) {
            return { row, snapshot, summary };
        }
    }

    return null;
}

async function pruneVaultSnapshots() {
    const retentionLimit = getVersionHistoryLimit();
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .order('created_at', { ascending: false })
        .range(retentionLimit, retentionLimit + 99);

    if (error) throw error;

    const staleIds = (data || []).map(row => row.snapshot_id).filter(Boolean);
    if (!staleIds.length) return;

    const { error: deleteError } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .delete()
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .in('snapshot_id', staleIds);

    if (deleteError) throw deleteError;
}

async function maybeCreateVaultSnapshot({ payload, checksum, clientUpdatedAt, reason }) {
    if (!payload || !currentUser?.id || !sb?.from) return false;

    const normalizedReason = String(reason || 'Synced to Cloud Sync.').slice(0, 120);
    const loweredReason = normalizedReason.toLowerCase();
    const isPreRestoreSafetySnapshot = loweredReason.includes('before restoring cloud sync version');
    const isRestoredVersionSnapshot = loweredReason.includes('restored cloud sync version');
    const isPreCloudDownloadSafetySnapshot = loweredReason.includes('before keeping cloud version');
    if (!canUseMultipleSyncDevices() && isRestoredVersionSnapshot) return false;
    const forceSnapshot = isRestoredVersionSnapshot || isPreRestoreSafetySnapshot || isPreCloudDownloadSafetySnapshot;
    const latest = await fetchLatestVaultSnapshot();

    if (latest && !forceSnapshot) {
        if (latest.client_updated_at && latest.client_updated_at === clientUpdatedAt) return false;

        const latestCreatedMs = new Date(latest.created_at || '').getTime();
        if (!Number.isNaN(latestCreatedMs) && Date.now() - latestCreatedMs < CLOUD_VERSION_HISTORY_MIN_INTERVAL_MS) {
            return false;
        }
    }

    const snapshotCreatedAt = new Date().toISOString();
    const { error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .insert({
            user_id: currentUser.id,
            snapshot_id: generateUuid(),
            vault_name: VAULT_NAME,
            schema_version: SCHEMA_VERSION,
            encryption_version: ENCRYPTION_VERSION,
            payload,
            payload_checksum: checksum,
            client_updated_at: clientUpdatedAt,
            snapshot_reason: normalizedReason,
            created_at: snapshotCreatedAt
        });

    if (error) throw error;

    await pruneVaultSnapshots();
    rememberStatus({
        versionHistoryError: '',
        versionHistoryLastSnapshotAt: snapshotCreatedAt
    });
    return true;
}

async function createPreRestoreSafetySnapshot(keyMaterial) {
    const snapshot = getLocalSnapshot();
    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const payload = await encryptSnapshot(snapshot, keyMaterial);
    const checksum = await sha256(JSON.stringify(payload));
    const created = await maybeCreateVaultSnapshot({
        payload,
        checksum,
        clientUpdatedAt,
        reason: 'Before restoring Cloud Sync version.'
    });

    if (!created) throw new Error('Zam! could not create a safety snapshot. Try again before restoring.');
    return true;
}

async function createLocalVersionSafetySnapshot(keyMaterial, reason = 'Before keeping cloud version.') {
    const snapshot = getLocalSnapshot();
    if (!localSnapshotHasBudgetData(snapshot)) return false;

    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const payload = await encryptSnapshot(snapshot, keyMaterial);
    const checksum = await sha256(JSON.stringify(payload));
    const created = await maybeCreateVaultSnapshot({
        payload,
        checksum,
        clientUpdatedAt,
        reason
    });

    if (!created) throw new Error('Zam! could not create a safety snapshot of this browser version. Try again before keeping the cloud version.');
    return true;
}

async function recoverLatestVersionSnapshot(keyMaterial, reason = 'Recovered Cloud Sync version after blank sign-in.') {
    const recoverable = await fetchLatestRecoverableVaultSnapshot(keyMaterial);
    if (!recoverable) return false;

    record('Recovering latest Cloud Sync saved version...', 'syncing');
    isApplyingRemote = true;
    try {
        await replaceSnapshot?.(recoverable.snapshot, {
            source: 'buddy_cloud_version_history_auto_recovery',
            remoteUpdatedAt: recoverable.row.client_updated_at || recoverable.row.created_at || ''
        });
    } finally {
        isApplyingRemote = false;
    }

    afterRemoteApply?.();
    await pushSnapshotNow(reason);
    clearForcePullAfterSignIn();
    return true;
}

async function claimSyncSlot(remote = null, { replace = false } = {}) {
    if (!currentUser?.id || !sb?.from) return { allowed: true, premium: false };

    if (canUseMultipleSyncDevices()) {
        rememberStatus({
            syncSlotBlocked: false,
            multiDeviceAllowed: true,
            syncSlotCurrentHash: '',
            syncSlotDeviceCount: 0,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: '',
            syncSlotLastSeenAt: '',
            syncSlotCurrentBrowserActive: false,
            syncSlotRows: []
        });
        return { allowed: true, premium: true };
    }

    const syncOwnerHash = await getSyncSlotHash();
    const claim = buildSyncSlotClaim(remote, syncOwnerHash, { replace });
    if (!claim) {
        const slots = normalizeSyncOwnerSlots(remote);
        rememberStatus({
            syncSlotBlocked: true,
            multiDeviceAllowed: false,
            ...buildSyncSlotStatus(slots, syncOwnerHash)
        });
        throw createMultiDeviceLimitError(remote, slots);
    }

    if (!remote) {
        rememberStatus({
            syncSlotBlocked: false,
            multiDeviceAllowed: false,
            ...claim.status
        });
        return { allowed: true, premium: false, syncOwnerHash, ...claim.fields };
    }

    const { error } = await sb
        .from(CLOUD_TABLE)
        .update(claim.fields)
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME);

    if (error) throw error;

    rememberStatus({
        syncSlotBlocked: false,
        multiDeviceAllowed: false,
        ...claim.status
    });
    return { allowed: true, premium: false, syncOwnerHash, ...claim.fields, ...claim.status };
}

async function persistPrunedSyncSlots(remote = null, slots = []) {
    if (!remote || !currentUser?.id || !sb?.from) return false;

    const { error } = await sb
        .from(CLOUD_TABLE)
        .update(buildSyncSlotFields(slots))
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME);

    if (error) throw error;
    return true;
}

export async function refreshSyncSlotStatus(options = {}) {
    const { persistStale = true } = options;
    if (!currentUser?.id || !sb?.from) return false;

    if (canUseMultipleSyncDevices()) {
        rememberStatus({
            syncSlotBlocked: false,
            multiDeviceAllowed: true,
            syncSlotCurrentHash: '',
            syncSlotDeviceCount: 0,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: '',
            syncSlotLastSeenAt: '',
            syncSlotCurrentBrowserActive: false,
            syncSlotRows: []
        });
        return true;
    }

    const remote = await fetchRemoteVault();
    const syncOwnerHash = await getExistingSyncSlotHash();
    const remoteSlots = normalizeSyncOwnerSlots(remote);
    const activeSlots = pruneStaleFreeSyncSlots(remoteSlots, syncOwnerHash);
    const currentHasSlot = Boolean(syncOwnerHash && activeSlots.some(slot => slot.hash === syncOwnerHash));
    const isBlocked = Boolean(syncOwnerHash && !currentHasSlot && activeSlots.length >= FREE_SYNC_DEVICE_LIMIT);

    if (persistStale && remote && activeSlots.length !== remoteSlots.length) {
        await persistPrunedSyncSlots(remote, activeSlots);
    }

    rememberStatus({
        syncSlotBlocked: isBlocked,
        multiDeviceAllowed: false,
        ...buildSyncSlotStatus(activeSlots, syncOwnerHash)
    });
    return true;
}

function stopSyncSlotRealtimeSubscription() {
    if (syncSlotRealtimeChannel && sb?.removeChannel) {
        try {
            sb.removeChannel(syncSlotRealtimeChannel);
        } catch (error) {
            console.warn('[Cloud Sync] Could not remove sync slot realtime channel:', error);
        }
    }
    syncSlotRealtimeChannel = null;
    syncSlotRealtimeUserId = '';
}

function ensureSyncSlotRealtimeSubscription() {
    const userId = currentUser?.id || '';
    if (!userId || !sb?.channel) {
        stopSyncSlotRealtimeSubscription();
        return;
    }
    if (syncSlotRealtimeChannel && syncSlotRealtimeUserId === userId) return;

    stopSyncSlotRealtimeSubscription();
    syncSlotRealtimeUserId = userId;
    syncSlotRealtimeChannel = sb
        .channel(`budgetbuddy-sync-slots-${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: CLOUD_TABLE,
                filter: `user_id=eq.${userId}`
            },
            () => {
                refreshSyncSlotStatus({ persistStale: false }).catch(error => {
                    console.warn('[Cloud Sync] Sync slot realtime refresh failed:', error);
                });
            }
        )
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[Cloud Sync] Sync slot realtime ${status.toLowerCase()}; polling fallback remains active.`);
            }
        });
}

async function getSyncSlotUpsertFields(existingRemote = null) {
    if (canUseMultipleSyncDevices()) {
        return {
            sync_owner_slots: [],
            sync_owner_hash: null,
            sync_owner_claimed_at: null,
            sync_owner_last_seen_at: null
        };
    }

    const syncOwnerHash = await getSyncSlotHash();
    const claim = buildSyncSlotClaim(existingRemote, syncOwnerHash);
    if (!claim) throw createMultiDeviceLimitError(existingRemote);
    return claim.fields;
}

async function performPushSnapshotNow(reason = 'Budget synced to Cloud Sync.') {
    if (!isEnabled() || !canUseCloud() || isApplyingRemote) {
        rememberStatus({ syncing: false, nextSyncAt: '', nextSyncReason: '' });
        return false;
    }

    const keyMaterial = getStoredCloudKeyMaterial();
    if (!keyMaterial) {
        rememberStatus({ syncing: false, nextSyncAt: '', nextSyncReason: '' });
        record('Cloud Sync needs your recovery key on this device.', 'error');
        return false;
    }

    rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Cloud Sync upload running now' });
    const snapshot = getLocalSnapshot();
    record('Syncing with Cloud Sync...', 'syncing');
    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const existingRemote = await fetchRemoteVault();
    await claimSyncSlot(existingRemote);
    let remoteSnapshot = null;
    if (existingRemote) {
        remoteSnapshot = await decryptSnapshot(existingRemote.payload, keyMaterial);
    }
    const payload = await encryptSnapshot(snapshot, keyMaterial);
    const checksum = await sha256(JSON.stringify(payload));
    const syncDetails = buildSyncSnapshotDetails({
        beforeSnapshot: remoteSnapshot,
        afterSnapshot: snapshot,
        beforeChecksum: existingRemote?.payload_checksum || '',
        afterChecksum: checksum,
        resultStatus: 'success'
    });
    const syncSlotFields = await getSyncSlotUpsertFields(existingRemote);

    const { error } = await sb
        .from(CLOUD_TABLE)
        .upsert({
            user_id: currentUser.id,
            vault_name: VAULT_NAME,
            schema_version: SCHEMA_VERSION,
            encryption_version: ENCRYPTION_VERSION,
            payload,
            payload_checksum: checksum,
            client_updated_at: clientUpdatedAt,
            ...syncSlotFields
        }, { onConflict: 'user_id,vault_name' });

    if (error) throw error;

    const syncOwnerHash = await getSyncSlotHash();
    const syncOwnerSlots = normalizeSyncOwnerSlots(syncSlotFields);
    rememberStatus({
        syncSlotBlocked: false,
        ...buildSyncSlotStatus(syncOwnerSlots, syncOwnerHash)
    });
    try {
        await maybeCreateVaultSnapshot({ payload, checksum, clientUpdatedAt, reason });
    } catch (snapshotError) {
        console.warn('[Cloud Sync] Version history snapshot failed:', snapshotError);
        rememberStatus({
            versionHistoryError: getVersionHistoryErrorMessage(snapshotError)
        });
    }
    localStorage.setItem(CLOUD_LAST_PUSHED_KEY, clientUpdatedAt);
    localStorage.setItem(CLOUD_LAST_REMOTE_KEY, clientUpdatedAt);
    clearConflictState();
    clearForcePullAfterSignIn();
    record('Sync completed', 'synced', syncDetails);
    return true;
}

async function pushSnapshotNow(reason = 'Budget synced to Cloud Sync.') {
    if (activePushPromise) {
        const result = await activePushPromise;
        if (!result) return result;

        const localUpdatedAt = getLocalSnapshot().meta?.localUpdatedAt || '';
        const lastPushedAt = localStorage.getItem(CLOUD_LAST_PUSHED_KEY) || '';
        if (localUpdatedAt && lastPushedAt && localUpdatedAt !== lastPushedAt) {
            return pushSnapshotNow(reason);
        }

        rememberStatus({ syncing: false, nextSyncAt: '', nextSyncReason: '' });
        return result;
    }

    clearTimeout(pushTimer);
    pushTimer = null;
    activePushPromise = performPushSnapshotNow(reason).finally(() => {
        activePushPromise = null;
    });
    return activePushPromise;
}

export function queuePush(reason = 'Budget synced to Cloud Sync.') {
    if (!isInitialized || !isEnabled() || !canUseCloud() || isApplyingRemote) return;
    clearTimeout(pushTimer);
    rememberStatus({
        syncing: true,
        nextSyncAt: new Date(Date.now() + PUSH_DEBOUNCE_MS).toISOString(),
        nextSyncReason: 'Automatic upload after the latest local budget save'
    });
    pushTimer = setTimeout(() => {
        pushSnapshotNow(reason).catch(error => {
            console.error('[Cloud Sync] Push failed:', error);
            record(getCloudErrorMessage(error), 'error');
        });
    }, PUSH_DEBOUNCE_MS);
}

export async function forcePush() {
    return pushSnapshotNow('Local budget uploaded to Cloud Sync.');
}

export async function forcePull() {
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Cloud Sync first.');
    const keyMaterial = getStoredCloudKeyMaterial();
    if (!keyMaterial) throw new Error('Import your Cloud Sync recovery key on this device first.');

    record('Downloading Cloud Sync vault...', 'syncing');
    const remote = await fetchRemoteVault();
    if (!remote) {
        record('No Cloud Sync vault exists yet.', 'local');
        return false;
    }

    await claimSyncSlot(remote);
    const snapshot = await decryptSnapshot(remote.payload, keyMaterial);
    record('Saving this browser version before keeping cloud...', 'syncing');
    await createLocalVersionSafetySnapshot(keyMaterial);
    isApplyingRemote = true;
    try {
        await replaceSnapshot?.(snapshot, { source: 'buddy_cloud', remoteUpdatedAt: remote.client_updated_at });
    } finally {
        isApplyingRemote = false;
    }

    localStorage.setItem(CLOUD_LAST_REMOTE_KEY, remote.client_updated_at);
    localStorage.setItem(CLOUD_LAST_PUSHED_KEY, remote.client_updated_at);
    clearConflictState();
    clearForcePullAfterSignIn();
    record('Cloud Sync budget downloaded.', 'synced');
    afterRemoteApply?.();
    return true;
}

export async function enableSync(options = {}) {
    if (!canUseCloud()) throw new Error('Sign in before setting up Cloud Sync.');
    if (!crypto?.subtle) throw new Error('This browser does not support secure Cloud Sync encryption.');

    const existingKeyMaterial = getStoredCloudKeyMaterial();
    const existingRawKey = getStoredCloudRawKey();
    const remote = await fetchRemoteVault();
    if (remote && !existingKeyMaterial && !options.recoveryKey) {
        localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
        rememberStatus();
        return { enabled: true, remoteExisted: true, needsKey: true };
    }

    const providedRawKey = String(options.recoveryKey || '').trim();
    const generatedRawKey = !providedRawKey && !existingKeyMaterial ? generateCloudKey() : '';
    const rawKey = providedRawKey || generatedRawKey;
    const keyMaterial = rawKey || existingKeyMaterial;
    const recoveryKeyForDisplay = rawKey || existingRawKey || '';
    if (!keyMaterial) throw new Error('Import your Cloud Sync recovery key before syncing this device.');

    let remoteSnapshot = null;
    if (remote) {
        remoteSnapshot = await decryptSnapshot(remote.payload, keyMaterial);
        await claimSyncSlot(remote, { replace: options.replaceSyncSlot === true });
    }
    if (rawKey) await storeCloudKey(rawKey);
    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    if (!remote) {
        await pushSnapshotNow('Cloud Sync enabled. Local budget uploaded.');
        rememberStatus();
        return { enabled: true, recoveryKey: rawKey, remoteExisted: false };
    }

    const hasLocalData = localSnapshotHasBudgetData();
    if (hasLocalData && !options.prefer) {
        const localSnapshot = getLocalSnapshot();
        if (shouldForcePullAfterSignIn() && snapshotsHaveSameBudgetContent(localSnapshot, remoteSnapshot)) {
            await forcePull();
            return { enabled: true, recoveryKey: recoveryKeyForDisplay, remoteExisted: true, usedRemote: true };
        }

        const localUpdatedAt = localSnapshot.meta?.localUpdatedAt || '';
        rememberStatus();
        return {
            enabled: true,
            recoveryKey: recoveryKeyForDisplay,
            remoteExisted: true,
            needsChoice: true,
            remoteUpdatedAt: remote.client_updated_at || remote.updated_at || '',
            localUpdatedAt,
            lastSyncedAt: localStorage.getItem(CLOUD_LAST_REMOTE_KEY) || localStorage.getItem(CLOUD_LAST_PUSHED_KEY) || '',
            remoteSummary: getSnapshotSummary(remoteSnapshot),
            localSummary: getSnapshotSummary(localSnapshot)
        };
    }

    if (options.prefer === 'remote' || !hasLocalData) {
        await forcePull();
        return { enabled: true, recoveryKey: recoveryKeyForDisplay, remoteExisted: true, usedRemote: true };
    }

    await forcePush();
    return { enabled: true, recoveryKey: recoveryKeyForDisplay, remoteExisted: true, usedLocal: true };
}

export async function replaceSyncSlot() {
    if (!canUseCloud()) throw new Error('Sign in before managing Cloud Sync devices.');
    const keyMaterial = getStoredCloudKeyMaterial();
    if (!keyMaterial) throw new Error('Import your Cloud Sync recovery key before making this browser active.');

    const remote = await fetchRemoteVault();
    if (!remote) throw new Error('No Cloud Sync vault exists yet.');

    await decryptSnapshot(remote.payload, keyMaterial);
    await claimSyncSlot(remote, { replace: true });
    record('This browser is now the active Cloud Sync browser.', 'synced');
    return true;
}

export async function clearSyncSlots() {
    if (!currentUser?.id || !sb?.from) return false;

    const { error } = await sb
        .from(CLOUD_TABLE)
        .update({
            sync_owner_slots: [],
            sync_owner_hash: null,
            sync_owner_claimed_at: null,
            sync_owner_last_seen_at: null
        })
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME);

    if (error) throw error;

    const slotKeyName = getSyncSlotKeyName();
    if (slotKeyName) localStorage.removeItem(slotKeyName);
    rememberStatus({
        syncSlotBlocked: false,
        syncSlotOwnerHash: '',
        syncSlotCurrentHash: '',
        syncSlotDeviceCount: 0,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: '',
        syncSlotCurrentBrowserActive: false,
        syncSlotRows: []
    });
    return true;
}

export async function releaseCurrentSyncSlot(options = {}) {
    const { clearLocalSlot = false } = options;
    if (!currentUser?.id || !sb?.from) return false;

    const syncOwnerHash = await getExistingSyncSlotHash();
    if (!syncOwnerHash) return false;

    const remote = await fetchRemoteVault();
    if (!remote) {
        if (clearLocalSlot) {
            const slotKeyName = getSyncSlotKeyName();
            if (slotKeyName) localStorage.removeItem(slotKeyName);
        }
        return false;
    }

    const slots = normalizeSyncOwnerSlots(remote);
    const nextSlots = slots.filter(slot => slot.hash !== syncOwnerHash);
    if (nextSlots.length === slots.length) {
        if (clearLocalSlot) {
            const slotKeyName = getSyncSlotKeyName();
            if (slotKeyName) localStorage.removeItem(slotKeyName);
        }
        return false;
    }

    await persistPrunedSyncSlots(remote, nextSlots);
    if (clearLocalSlot) {
        const slotKeyName = getSyncSlotKeyName();
        if (slotKeyName) localStorage.removeItem(slotKeyName);
    }
    rememberStatus({
        syncSlotBlocked: false,
        syncSlotOwnerHash: '',
        syncSlotCurrentHash: '',
        syncSlotDeviceCount: nextSlots.length,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: '',
        syncSlotCurrentBrowserActive: false,
        syncSlotRows: nextSlots
    });
    record('This browser was removed from Cloud Sync devices.', 'local');
    return true;
}

export async function releaseSyncSlotByHash(syncSlotHash = '') {
    const targetHash = String(syncSlotHash || '').trim();
    if (!targetHash || !currentUser?.id || !sb?.from) return false;

    const remote = await fetchRemoteVault();
    if (!remote) return false;

    const currentHash = await getExistingSyncSlotHash();
    const slots = normalizeSyncOwnerSlots(remote);
    const nextSlots = slots.filter(slot => slot.hash !== targetHash);
    if (nextSlots.length === slots.length) return false;

    await persistPrunedSyncSlots(remote, nextSlots);
    const nextCurrentHash = targetHash === currentHash ? '' : currentHash;
    if (targetHash === currentHash) {
        const slotKeyName = getSyncSlotKeyName();
        if (slotKeyName) localStorage.removeItem(slotKeyName);
    }

    rememberStatus({
        syncSlotBlocked: false,
        multiDeviceAllowed: false,
        ...buildSyncSlotStatus(nextSlots, nextCurrentHash)
    });
    record('Cloud Sync slot released.', 'local');
    return true;
}

export async function releaseOtherSyncSlots() {
    if (!currentUser?.id || !sb?.from) return false;

    const remote = await fetchRemoteVault();
    if (!remote) return false;

    const syncOwnerHash = await getExistingSyncSlotHash();
    const slots = normalizeSyncOwnerSlots(remote);
    const nextSlots = syncOwnerHash
        ? slots.filter(slot => slot.hash === syncOwnerHash)
        : [];

    if (nextSlots.length === slots.length) return false;

    await persistPrunedSyncSlots(remote, nextSlots);
    rememberStatus({
        syncSlotBlocked: false,
        multiDeviceAllowed: false,
        ...buildSyncSlotStatus(nextSlots, syncOwnerHash)
    });
    record('Other browsers were removed from Cloud Sync devices.', 'local');
    return true;
}

export function removeThisDevice() {
    clearTimeout(pushTimer);
    const slotKeyName = getSyncSlotKeyName();
    void clearTrustedCloudKey();
    clearMemoryCloudKey();
    if (slotKeyName) localStorage.removeItem(slotKeyName);
    clearForcePullAfterSignIn();
    localStorage.removeItem(CLOUD_ENABLED_KEY);
    localStorage.removeItem(CLOUD_LAST_PUSHED_KEY);
    localStorage.removeItem(CLOUD_LAST_REMOTE_KEY);
    localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    clearConflictState();
    rememberStatus({
        syncing: false,
        syncSlotBlocked: false,
        syncSlotOwnerHash: '',
        syncSlotCurrentHash: '',
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: '',
        syncSlotCurrentBrowserActive: false,
        syncSlotRows: []
    });
    record('Cloud Sync removed from this browser. Cloud vault was not deleted.', 'local');
}

export function exportRecoveryKey() {
    const rawKey = getStoredCloudRawKey();
    if (!rawKey && hasLocalCloudKey()) {
        throw new Error('Import your Cloud Sync recovery key again before viewing it. This trusted browser can sync, but the saved browser key cannot be displayed.');
    }
    if (!rawKey) throw new Error('Import your Cloud Sync recovery key before viewing it.');
    return rawKey;
}

export async function importRecoveryKey(rawKey) {
    const normalized = String(rawKey || '').trim();
    const cryptoKey = await importAesKey(normalized);
    if (canUseCloud()) {
        const remote = await fetchRemoteVault();
        if (remote) await decryptSnapshot(remote.payload, cryptoKey);
    }
    await storeCloudKey(normalized, { cryptoKey });
    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    rememberStatus();
    record('Cloud Sync recovery key trusted on this browser.', 'local');
    return true;
}

export async function listVersionHistory(limit = 10) {
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Cloud Sync first.');
    if (!getStoredCloudKeyMaterial()) throw new Error('Import your Cloud Sync recovery key before using version history.');

    const retentionLimit = getVersionHistoryLimit();
    const safeLimit = Math.max(1, Math.min(Number(limit) || retentionLimit, retentionLimit));
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id, schema_version, encryption_version, payload_checksum, client_updated_at, snapshot_reason, created_at')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    if (error) throw createVersionHistoryError(error);
    return Array.isArray(data) ? data : [];
}

export async function restoreVersion(snapshotId) {
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Cloud Sync first.');
    const keyMaterial = getStoredCloudKeyMaterial();
    if (!keyMaterial) throw new Error('Import your Cloud Sync recovery key before restoring a version.');
    if (!snapshotId) throw new Error('Choose a Cloud Sync version to restore.');

    record('Restoring Cloud Sync version...', 'syncing');
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id, payload, client_updated_at, created_at')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .eq('snapshot_id', snapshotId)
        .maybeSingle();

    if (error) throw createVersionHistoryError(error);
    if (!data) throw new Error('That Cloud Sync version was not found.');

    const snapshot = await decryptSnapshot(data.payload, keyMaterial);
    record('Creating pre-restore safety snapshot...', 'syncing');
    await createPreRestoreSafetySnapshot(keyMaterial);
    const restoredAt = new Date().toISOString();
    const restoredSnapshot = {
        ...snapshot,
        meta: {
            ...(snapshot?.meta || {}),
            localUpdatedAt: restoredAt,
            buddyCloudRestoredAt: restoredAt,
            buddyCloudRestoredFrom: data.client_updated_at || data.created_at || ''
        }
    };

    isApplyingRemote = true;
    try {
        await replaceSnapshot?.(restoredSnapshot, {
            source: 'buddy_cloud_version_history',
            remoteUpdatedAt: data.client_updated_at || data.created_at || ''
        });
    } finally {
        isApplyingRemote = false;
    }

    afterRemoteApply?.();
    await pushSnapshotNow('Restored Cloud Sync version.');
    return true;
}

export async function init(options = {}) {
    const previousUserId = currentUser?.id || '';
    sb = options.supabaseClient || window.sb || null;
    currentUser = options.user || window.currentUser || null;
    const nextUserId = currentUser?.id || '';
    if (previousUserId && previousUserId !== nextUserId) clearMemoryCloudKey(previousUserId);
    if (!nextUserId) memoryCloudKeys.clear();
    purgeAllPersistedCloudKeys();
    getSnapshot = options.getSnapshot;
    replaceSnapshot = options.replaceSnapshot;
    afterRemoteApply = options.afterRemoteApply;
    isPremiumAccount = typeof options.isPremiumAccount === 'function' ? options.isPremiumAccount : isPremiumAccount;
    isInitialized = true;
    if (nextUserId) await restoreTrustedCloudKey(nextUserId);
    rememberStatus();

    if (!currentUser) {
        stopSyncSlotRealtimeSubscription();
        record('Sign in to protect this budget with Cloud Sync.', 'local');
        return false;
    }
    ensureSyncSlotRealtimeSubscription();

    if (!isEnabled()) {
        record('Cloud Sync setup needed. Signed-in budgets use Cloud Sync protection by default.', 'local');
        return false;
    }

    rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Cloud Sync check running now' });

    try {
        if (!hasLocalCloudKey()) {
            const remote = await fetchRemoteVault();
            if (!remote) {
                clearStaleEnabledStateForFreshSetup();
                record('Cloud Sync setup needed. No encrypted cloud vault exists for this account yet.', 'local');
                return false;
            }

            record('Import your Cloud Sync recovery key to sync this device.', 'error');
            return false;
        }

        const keyMaterial = getStoredCloudKeyMaterial();
        const remote = await fetchRemoteVault();
        if (!remote) {
            const localSnapshot = getLocalSnapshot();
            if (shouldForcePullAfterSignIn() && !localSnapshotHasBudgetData(localSnapshot)) {
                const recovered = await recoverLatestVersionSnapshot(keyMaterial);
                if (recovered) return true;
            }

            await forcePush();
            return true;
        }

        await claimSyncSlot(remote);

        const forcePullAfterSignIn = shouldForcePullAfterSignIn();
        const lastRemoteAt = localStorage.getItem(CLOUD_LAST_REMOTE_KEY) || '';
        const localSnapshot = getLocalSnapshot();
        const localUpdatedAt = localSnapshot.meta?.localUpdatedAt || '';
        const remoteChanged = remote.client_updated_at && remote.client_updated_at !== lastRemoteAt;
        const localChanged = localUpdatedAt && localUpdatedAt !== localStorage.getItem(CLOUD_LAST_PUSHED_KEY);
        const localHasBudgetData = localSnapshotHasBudgetData(localSnapshot);
        const localSummary = getSnapshotSummary(localSnapshot);
        let remoteSnapshot = null;
        let remoteSummary = null;
        const getRemoteSummary = async () => {
            if (!remoteSnapshot) remoteSnapshot = await decryptSnapshot(remote.payload, keyMaterial);
            if (!remoteSummary) remoteSummary = getSnapshotSummary(remoteSnapshot);
            return remoteSummary;
        };
        const stopForVersionReview = async () => {
            const nextRemoteSummary = await getRemoteSummary();
            setConflictState({
                remoteUpdatedAt: remote.client_updated_at || remote.updated_at || '',
                localUpdatedAt,
                lastSyncedAt: lastRemoteAt || localStorage.getItem(CLOUD_LAST_PUSHED_KEY) || '',
                remoteSummary: nextRemoteSummary,
                localSummary
            });
            record('Possible data loss prevented. Review saved versions before Cloud Sync overwrites either copy.', 'error');
            return false;
        };
        const trustedSignInCanUseCloudVersion = async () => {
            if (!forcePullAfterSignIn) return false;
            if (!localHasBudgetData) return true;
            await getRemoteSummary();
            return snapshotsHaveSameBudgetContent(localSnapshot, remoteSnapshot);
        };

        if (!localHasBudgetData) {
            const nextRemoteSummary = await getRemoteSummary();
            if (summaryHasBudgetData(nextRemoteSummary)) {
                clearConflictState();
                await forcePull();
                return true;
            }
            if (forcePullAfterSignIn) {
                const recovered = await recoverLatestVersionSnapshot(keyMaterial);
                if (recovered) return true;
            }
        }

        if (remoteChanged && localChanged) {
            if (await trustedSignInCanUseCloudVersion()) {
                clearConflictState();
                await forcePull();
                return true;
            }

            const waitMs = getConflictGraceWaitMs(remote.client_updated_at, localUpdatedAt);
            if (waitMs > 0) {
                clearConflictState();
                localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
                rememberStatus({ syncing: false, lastError: '' });
                console.info(`[Cloud Sync] Recent local and cloud changes detected. Rechecking in ${formatWaitMinutes(waitMs)}.`);
                scheduleConflictGraceRetry(waitMs);
                return false;
            }

            return stopForVersionReview();
        }

        clearConflictState();

        if (remoteChanged) {
            const nextRemoteSummary = await getRemoteSummary();
            if (await trustedSignInCanUseCloudVersion()) {
                await forcePull();
                return true;
            }
            if (localHasBudgetData && !summariesHaveSameShape(localSummary, nextRemoteSummary)) {
                return stopForVersionReview();
            }
            await forcePull();
            return true;
        }

        if (localChanged) {
            const nextRemoteSummary = await getRemoteSummary();
            if (!localHasBudgetData && summaryHasBudgetData(nextRemoteSummary)) {
                await forcePull();
                return true;
            }
            await forcePush();
            return true;
        }

        record('Cloud Sync is up to date.', 'synced');
        return true;
    } catch (error) {
        console.error('[Cloud Sync] Init failed:', error);
        record(getCloudErrorMessage(error, 'Cloud Sync could not start.'), 'error');
        return false;
    }
}

export async function refreshUser(user) {
    const previousUserId = currentUser?.id || '';
    currentUser = user || null;
    const nextUserId = currentUser?.id || '';
    if (previousUserId && previousUserId !== nextUserId) clearMemoryCloudKey(previousUserId);
    if (!nextUserId) memoryCloudKeys.clear();
    purgeAllPersistedCloudKeys();
    if (!currentUser) {
        stopSyncSlotRealtimeSubscription();
        rememberStatus({
            syncSlotBlocked: false,
            syncSlotOwnerHash: '',
            syncSlotCurrentHash: '',
            syncSlotDeviceCount: 0,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: '',
            syncSlotLastSeenAt: '',
            syncSlotCurrentBrowserActive: false,
            syncSlotRows: []
        });
        return false;
    }
    await restoreTrustedCloudKey(nextUserId);
    rememberStatus();
    ensureSyncSlotRealtimeSubscription();
    return init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount });
}

export async function syncNow() {
    if (!currentUser) throw new Error('Sign in before syncing with Cloud Sync.');
    return init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount });
}

export function getStatus() {
    const syncSlotRows = Array.isArray(lastKnownStatus.syncSlotRows)
        ? lastKnownStatus.syncSlotRows
            .filter(slot => slot?.hash)
            .map(slot => ({
                hash: slot.hash,
                claimed_at: slot.claimed_at || '',
                last_seen_at: slot.last_seen_at || ''
            }))
        : [];
    const isPremium = canUseMultipleSyncDevices();
    const localVerification = getLocalCloudVerificationState();
    return {
        ...lastKnownStatus,
        enabled: isEnabled(),
        signedIn: Boolean(currentUser?.id),
        hasKey: hasLocalCloudKey(),
        hasExportableKey: hasExportableCloudKey(),
        hasTrustedKey: hasTrustedCloudKey(),
        canUseCloud: canUseCloud(),
        isPremium,
        multiDeviceAllowed: isPremium,
        freeDeviceLimit: FREE_SYNC_DEVICE_LIMIT,
        freeSyncSlotIdleReclaimMinutes: FREE_SYNC_SLOT_IDLE_RECLAIM_MINUTES,
        freeSyncSlotIdleReclaimLabel: FREE_SYNC_SLOT_IDLE_RECLAIM_LABEL,
        syncSlotLimit: lastKnownStatus.syncSlotLimit || FREE_SYNC_DEVICE_LIMIT,
        localUpdatedAt: localVerification.localUpdatedAt,
        lastVerifiedCloudAt: localVerification.lastVerifiedAt,
        hasUnverifiedLocalChanges: localVerification.hasUnverifiedLocalChanges,
        syncSlotRows: isPremium ? [] : syncSlotRows
    };
}

window.BuddyCloud = {
    init,
    refreshUser,
    queuePush,
    forcePush,
    forcePull,
    syncNow,
    enableSync,
    replaceSyncSlot,
    clearSyncSlots,
    refreshSyncSlotStatus,
    getCurrentSyncSlotHash,
    releaseCurrentSyncSlot,
    releaseSyncSlotByHash,
    releaseOtherSyncSlots,
    removeThisDevice,
    clearTrustedKey: clearTrustedCloudKey,
    clearTrustedKeys: clearAllTrustedCloudKeys,
    exportRecoveryKey,
    importRecoveryKey,
    listVersionHistory,
    restoreVersion,
    getStatus
};
