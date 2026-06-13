// js/privacyStorageCleanup.js

const SYNC_HISTORY_KEY = 'bb_sync_history';
const SYNC_HISTORY_LIMIT = 5;
const DEMO_ACTIVE_KEY = 'bb_demo_active';
const DEMO_BACKUP_KEYS = [
    'bb_demo_backup_has_data',
    'bb_demo_backup_bb_data',
    'bb_demo_backup_local_updated_at',
    'bb_demo_backup_created_at'
];

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Privacy cleanup must never block app startup.
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Privacy cleanup must never block app startup.
    }
}

function cleanText(value, maxLength = 160) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeCount(value) {
    return Math.max(0, Number.parseInt(value, 10) || 0);
}

function sanitizeSyncDetails(details = null) {
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

function sanitizeSyncHistoryEvent(event = {}, index = 0) {
    const source = event && typeof event === 'object' ? event : {};
    const fallbackTime = new Date().toISOString();
    const eventTime = cleanText(source.time, 40) || fallbackTime;
    const safeStatus = ['synced', 'local', 'syncing', 'error', 'paused'].includes(source.status)
        ? source.status
        : 'local';
    const sanitized = {
        id: source.id || `${eventTime}-${index}`,
        time: Number.isNaN(new Date(eventTime).getTime()) ? fallbackTime : eventTime,
        status: safeStatus,
        message: cleanText(source.message, 160) || 'Local data saved.'
    };
    const details = sanitizeSyncDetails(source.details);
    if (details) sanitized.details = details;
    return sanitized;
}

function cleanupSyncHistory() {
    const raw = storageGet(SYNC_HISTORY_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            storageRemove(SYNC_HISTORY_KEY);
            return;
        }

        const sanitized = parsed
            .slice(0, SYNC_HISTORY_LIMIT)
            .map((event, index) => sanitizeSyncHistoryEvent(event, index));
        const nextValue = JSON.stringify(sanitized);
        if (nextValue !== raw) storageSet(SYNC_HISTORY_KEY, nextValue);
    } catch {
        storageRemove(SYNC_HISTORY_KEY);
    }
}

function cleanupInactiveDemoBackup() {
    if (storageGet(DEMO_ACTIVE_KEY) === 'true') return;
    DEMO_BACKUP_KEYS.forEach(storageRemove);
}

export function runPrivacyStorageCleanup() {
    cleanupSyncHistory();
    cleanupInactiveDemoBackup();
}
