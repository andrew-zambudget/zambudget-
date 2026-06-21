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

export const SYNC_HISTORY_STORAGE_KEY = 'bb_sync_history';
export const SYNC_HISTORY_METADATA_NAME = 'sync_history';
export const SYNC_HISTORY_VAULT_SCOPE = 'sync-history';
export const SYNC_HISTORY_LIMIT = 5;

const SAFE_STATUSES = new Set(['synced', 'local', 'syncing', 'error', 'paused']);

function cleanText(value, maxLength = 160) {
    return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function normalizeCount(value) {
    return Math.max(0, Number.parseInt(value, 10) || 0);
}

function sanitizeDetails(details = null) {
    if (!details || typeof details !== 'object') return null;
    if (details.kind !== 'buddy_cloud_sync_summary' || details.privacySafe !== true) return null;

    return {
        kind: 'buddy_cloud_sync_summary',
        privacySafe: true,
        transactions: {
            added: normalizeCount(details.transactions?.added),
            updated: normalizeCount(details.transactions?.updated),
            deleted: normalizeCount(details.transactions?.deleted)
        },
        snapshot: {
            before: cleanText(details.snapshot?.before, 32) || 'none',
            after: cleanText(details.snapshot?.after, 32) || 'pending'
        },
        resultStatus: cleanText(details.resultStatus, 32) || 'success'
    };
}

export function sanitizeSyncHistoryEvent(event = {}, index = 0) {
    const source = event && typeof event === 'object' ? event : {};
    const fallbackTime = new Date().toISOString();
    const rawTime = cleanText(source.time, 40) || fallbackTime;
    const safeStatus = SAFE_STATUSES.has(source.status) ? source.status : 'local';
    const safeEvent = {
        id: cleanText(source.id, 80) || `${rawTime}-${index}`,
        time: Number.isNaN(new Date(rawTime).getTime()) ? fallbackTime : rawTime,
        status: safeStatus,
        message: cleanText(source.message, 160) || 'Saved partially.'
    };
    const details = sanitizeDetails(source.details);
    if (details) safeEvent.details = details;
    return safeEvent;
}

export function sanitizeSyncHistoryEvents(events = []) {
    return Array.isArray(events)
        ? events.slice(0, SYNC_HISTORY_LIMIT).map((event, index) => sanitizeSyncHistoryEvent(event, index))
        : [];
}

export function getSyncHistoryVaultKeyId(options = {}) {
    return getLocalVaultKeyId({
        userId: options.userId || '',
        scope: options.scope || SYNC_HISTORY_VAULT_SCOPE
    });
}

export async function getOrCreateSyncHistoryVaultKey(options = {}) {
    return getOrCreateLocalVaultKey(getSyncHistoryVaultKeyId(options));
}

export async function readSyncHistoryVaultKey(options = {}) {
    return readLocalVaultKey(getSyncHistoryVaultKeyId(options));
}

export function classifySyncHistoryRecord(storage = localStorage) {
    return classifyLocalMetadataRecord(storage?.getItem?.(SYNC_HISTORY_STORAGE_KEY) || '', {
        name: SYNC_HISTORY_METADATA_NAME
    });
}

export async function writeEncryptedSyncHistory(events = [], options = {}) {
    const storage = options.storage || localStorage;
    const sanitized = sanitizeSyncHistoryEvents(events);
    const keyResult = options.key
        ? { key: options.key }
        : await getOrCreateSyncHistoryVaultKey(options);

    await writeEncryptedLocalMetadataRecord(
        storage,
        options.storageKey || SYNC_HISTORY_STORAGE_KEY,
        sanitized,
        keyResult.key,
        {
            name: SYNC_HISTORY_METADATA_NAME,
            createdAt: options.createdAt,
            updatedAt: options.updatedAt
        }
    );

    return sanitized;
}

export async function readEncryptedSyncHistory(options = {}) {
    const storage = options.storage || localStorage;
    const storageKey = options.storageKey || SYNC_HISTORY_STORAGE_KEY;
    const key = options.key || await readSyncHistoryVaultKey(options);

    if (!key) return [];

    try {
        const payload = await readEncryptedLocalMetadataRecord(
            storage,
            storageKey,
            key,
            { name: SYNC_HISTORY_METADATA_NAME }
        );
        return sanitizeSyncHistoryEvents(payload || []);
    } catch (error) {
        if (options.throwOnError) throw error;
        return [];
    }
}
