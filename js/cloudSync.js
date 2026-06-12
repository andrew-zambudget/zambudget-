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
const CLOUD_SYNC_SLOT_PREFIX = 'bb_cloud_sync_slot_';
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
let isInitialized = false;
let isApplyingRemote = false;
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

function getUserKeyName(userId = currentUser?.id) {
    return userId ? `${CLOUD_KEY_PREFIX}${userId}` : '';
}

function getSyncSlotKeyName(userId = currentUser?.id) {
    return userId ? `${CLOUD_SYNC_SLOT_PREFIX}${userId}` : '';
}

function hasLocalCloudKey() {
    const keyName = getUserKeyName();
    return Boolean(keyName && localStorage.getItem(keyName));
}

function getStoredCloudKey() {
    const keyName = getUserKeyName();
    return keyName ? localStorage.getItem(keyName) || '' : '';
}

function storeCloudKey(value) {
    const keyName = getUserKeyName();
    if (!keyName) throw new Error('Sign in before setting a Buddy Cloud key.');
    localStorage.setItem(keyName, value);
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
    if (!keyName) throw new Error('Sign in before using Buddy Cloud sync.');

    const existing = localStorage.getItem(keyName);
    if (existing) return existing;

    const token = generateCloudKey();
    localStorage.setItem(keyName, token);
    return token;
}

async function getSyncSlotHash() {
    return sha256(getOrCreateSyncSlotToken());
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
    return {
        syncSlotOwnerHash: syncOwnerHash || currentSlot.hash || '',
        syncSlotClaimedAt: currentSlot.claimed_at || '',
        syncSlotLastSeenAt: currentSlot.last_seen_at || '',
        syncSlotDeviceCount: slots.length,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT
    };
}

function buildSyncSlotClaim(remote = null, syncOwnerHash = '', { replace = false } = {}) {
    const now = new Date().toISOString();
    const slots = normalizeSyncOwnerSlots(remote);
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
    if (bytes.byteLength !== 32) throw new Error('Buddy Cloud recovery key is invalid.');
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSnapshot(snapshot, rawKey) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await importAesKey(rawKey);
    const plaintext = JSON.stringify({
        app: 'BudgetBuddy',
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

async function decryptSnapshot(payload, rawKey) {
    if (!payload || payload.algorithm !== 'AES-GCM' || !payload.iv || !payload.ciphertext) {
        throw new Error('Buddy Cloud vault payload is not recognized.');
    }

    const key = await importAesKey(rawKey);
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

function pluralizeSyncLabel(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatSyncAmount(amount, currencySymbol = '$') {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed)) return '';

    return `${currencySymbol}${Math.abs(parsed).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatSyncDate(value = '') {
    const normalized = String(value || '').trim();
    const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnly
        ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
        : new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSyncTransactionTime(tx = {}) {
    const value = tx?.updatedAtUTC || tx?.serverLoggedAtUTC || tx?.createdAtUTC || tx?.createdAt || tx?.date || '';
    return getTimestampMs(value);
}

function formatSyncTransactionDetail(tx = {}, currencySymbol = '$') {
    const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
    const description = cleanText(tx.description || tx.category || tx.type || 'Transaction').slice(0, 48);
    const amount = formatSyncAmount(tx.amount, currencySymbol);
    const type = cleanText(tx.type).slice(0, 18);
    const date = formatSyncDate(tx.date || tx.serverLoggedAtUTC || tx.createdAtUTC || tx.createdAt);
    const meta = [type, amount, date].filter(Boolean).join(' - ');

    return meta ? `${description} (${meta})` : description;
}

function buildSyncSnapshotDetails(snapshot = {}) {
    const transactions = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
    const categories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
    const activeTransactions = transactions.filter(tx => !tx?.isDeleted);
    const currencySymbol = String(snapshot.settings?.currency || '$').trim().slice(0, 4) || '$';
    const recentTransactions = activeTransactions
        .slice()
        .sort((a, b) => getSyncTransactionTime(b) - getSyncTransactionTime(a))
        .slice(0, 5)
        .map(tx => formatSyncTransactionDetail(tx, currencySymbol))
        .filter(Boolean);

    return {
        summary: `Snapshot included ${pluralizeSyncLabel(activeTransactions.length, 'active transaction')} and ${pluralizeSyncLabel(categories.length, 'category', 'categories')}.`,
        items: recentTransactions,
        note: 'Shown only on this device before encryption.'
    };
}

function scheduleConflictGraceRetry(waitMs = CLOUD_CONFLICT_GRACE_MS) {
    clearTimeout(conflictGraceTimer);
    rememberStatus({
        syncing: false,
        nextSyncAt: new Date(Date.now() + Math.max(1000, waitMs)).toISOString(),
        nextSyncReason: 'Buddy Cloud conflict recheck after the grace window'
    });
    conflictGraceTimer = setTimeout(() => {
        conflictGraceTimer = null;
        rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Buddy Cloud conflict recheck running now' });
        init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount })
            .catch(error => {
                console.error('[Buddy Cloud] Conflict grace retry failed:', error);
                record(getCloudErrorMessage(error, 'Buddy Cloud could not recheck recent changes.'), 'error');
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

function rememberStatus(next = {}) {
    const conflict = getConflictState();
    lastKnownStatus = {
        ...lastKnownStatus,
        enabled: isEnabled(),
        signedIn: Boolean(currentUser?.id),
        hasKey: hasLocalCloudKey(),
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
            if (details && typeof details === 'object') event.details = details;
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

function getCloudErrorMessage(error, fallback = 'Buddy Cloud sync failed.') {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();

    if (code === MULTI_DEVICE_LIMIT_CODE) {
        return `Free Tier allows ${FREE_SYNC_DEVICE_LIMIT} active synced browsers at a time. Upgrade to Premium for unlimited Buddy Cloud devices, or use this browser instead.`;
    }

    if (
        code === 'PGRST204'
        || message.includes('sync_owner_slots')
        || message.includes('sync_owner_hash')
        || message.includes('sync_owner_claimed_at')
        || message.includes('sync_owner_last_seen_at')
    ) {
        return 'Buddy Cloud two-device Free sync is not ready yet. Apply supabase/migrations/202606100007_buddy_cloud_two_free_sync_slots.sql in Supabase, then retry sync.';
    }

    if (
        code === 'PGRST205'
        || (message.includes('buddy_cloud_vaults') && message.toLowerCase().includes('schema cache'))
        || (message.includes("Could not find the table") && message.includes('buddy_cloud_vaults'))
    ) {
        return 'Buddy Cloud database is not ready yet. Apply supabase/migrations/202606100002_buddy_cloud_vaults.sql in Supabase, then retry sync.';
    }

    return message || fallback;
}

function getVersionHistoryErrorMessage(error, fallback = 'Buddy Cloud Version History is temporarily unavailable.') {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();

    if (
        code === 'PGRST205'
        || code === '42P01'
        || message.includes(CLOUD_SNAPSHOT_TABLE)
        || message.toLowerCase().includes('schema cache')
        || (message.includes("Could not find the table") && message.includes('buddy_cloud_vault_snapshots'))
    ) {
        return 'Buddy Cloud Version History is not ready yet. Apply supabase/migrations/202606100006_buddy_cloud_vault_snapshots.sql in Supabase, then retry.';
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
    const error = new Error(`Free Tier allows ${FREE_SYNC_DEVICE_LIMIT} active synced browsers at a time.`);
    error.code = MULTI_DEVICE_LIMIT_CODE;
    error.remoteUpdatedAt = remote?.client_updated_at || remote?.updated_at || '';
    error.slotClaimedAt = slots[0]?.claimed_at || remote?.sync_owner_claimed_at || '';
    error.slotLastSeenAt = slots[0]?.last_seen_at || remote?.sync_owner_last_seen_at || '';
    error.slotCount = slots.length;
    error.slotLimit = FREE_SYNC_DEVICE_LIMIT;
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

    const normalizedReason = String(reason || 'Buddy Cloud synced.').slice(0, 120);
    const loweredReason = normalizedReason.toLowerCase();
    const isPreRestoreSafetySnapshot = loweredReason.includes('before restoring buddy cloud version');
    const isRestoredVersionSnapshot = loweredReason.includes('restored buddy cloud version');
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

async function createPreRestoreSafetySnapshot(rawKey) {
    const snapshot = getLocalSnapshot();
    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const payload = await encryptSnapshot(snapshot, rawKey);
    const checksum = await sha256(JSON.stringify(payload));
    const created = await maybeCreateVaultSnapshot({
        payload,
        checksum,
        clientUpdatedAt,
        reason: 'Before restoring Buddy Cloud version.'
    });

    if (!created) throw new Error('BudgetBuddy could not create a safety snapshot. Try again before restoring.');
    return true;
}

async function createLocalVersionSafetySnapshot(rawKey, reason = 'Before keeping cloud version.') {
    const snapshot = getLocalSnapshot();
    if (!localSnapshotHasBudgetData(snapshot)) return false;

    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const payload = await encryptSnapshot(snapshot, rawKey);
    const checksum = await sha256(JSON.stringify(payload));
    const created = await maybeCreateVaultSnapshot({
        payload,
        checksum,
        clientUpdatedAt,
        reason
    });

    if (!created) throw new Error('BudgetBuddy could not create a safety snapshot of this browser version. Try again before keeping the cloud version.');
    return true;
}

async function claimSyncSlot(remote = null, { replace = false } = {}) {
    if (!currentUser?.id || !sb?.from) return { allowed: true, premium: false };

    if (canUseMultipleSyncDevices()) {
        rememberStatus({
            syncSlotBlocked: false,
            multiDeviceAllowed: true,
            syncSlotDeviceCount: 0,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: '',
            syncSlotLastSeenAt: ''
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
            syncSlotOwnerHash: syncOwnerHash,
            syncSlotDeviceCount: slots.length,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: slots[0]?.claimed_at || remote?.sync_owner_claimed_at || '',
            syncSlotLastSeenAt: slots[0]?.last_seen_at || remote?.sync_owner_last_seen_at || ''
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

async function performPushSnapshotNow(reason = 'Budget synced to Buddy Cloud.') {
    if (!isEnabled() || !canUseCloud() || isApplyingRemote) {
        rememberStatus({ syncing: false, nextSyncAt: '', nextSyncReason: '' });
        return false;
    }

    const rawKey = getStoredCloudKey();
    if (!rawKey) {
        rememberStatus({ syncing: false, nextSyncAt: '', nextSyncReason: '' });
        record('Buddy Cloud needs your recovery key on this device.', 'error');
        return false;
    }

    rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Buddy Cloud upload running now' });
    const snapshot = getLocalSnapshot();
    const syncDetails = buildSyncSnapshotDetails(snapshot);
    record('Syncing with Buddy Cloud...', 'syncing', syncDetails);
    const clientUpdatedAt = snapshot.meta?.localUpdatedAt || new Date().toISOString();
    const existingRemote = await fetchRemoteVault();
    await claimSyncSlot(existingRemote);
    if (existingRemote) {
        await decryptSnapshot(existingRemote.payload, rawKey);
    }
    const payload = await encryptSnapshot(snapshot, rawKey);
    const checksum = await sha256(JSON.stringify(payload));
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
        console.warn('[Buddy Cloud] Version history snapshot failed:', snapshotError);
        rememberStatus({
            versionHistoryError: getVersionHistoryErrorMessage(snapshotError)
        });
    }
    localStorage.setItem(CLOUD_LAST_PUSHED_KEY, clientUpdatedAt);
    localStorage.setItem(CLOUD_LAST_REMOTE_KEY, clientUpdatedAt);
    clearConflictState();
    record(reason, 'synced', syncDetails);
    return true;
}

async function pushSnapshotNow(reason = 'Budget synced to Buddy Cloud.') {
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

export function queuePush(reason = 'Budget synced to Buddy Cloud.') {
    if (!isInitialized || !isEnabled() || !canUseCloud() || isApplyingRemote) return;
    clearTimeout(pushTimer);
    rememberStatus({
        syncing: true,
        nextSyncAt: new Date(Date.now() + PUSH_DEBOUNCE_MS).toISOString(),
        nextSyncReason: 'Automatic upload after the latest local budget save'
    });
    pushTimer = setTimeout(() => {
        pushSnapshotNow(reason).catch(error => {
            console.error('[Buddy Cloud] Push failed:', error);
            record(getCloudErrorMessage(error), 'error');
        });
    }, PUSH_DEBOUNCE_MS);
}

export async function forcePush() {
    return pushSnapshotNow('Local budget uploaded to Buddy Cloud.');
}

export async function forcePull() {
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Buddy Cloud first.');
    const rawKey = getStoredCloudKey();
    if (!rawKey) throw new Error('Import your Buddy Cloud recovery key on this device first.');

    record('Downloading Buddy Cloud vault...', 'syncing');
    const remote = await fetchRemoteVault();
    if (!remote) {
        record('No Buddy Cloud vault exists yet.', 'local');
        return false;
    }

    await claimSyncSlot(remote);
    const snapshot = await decryptSnapshot(remote.payload, rawKey);
    record('Saving this browser version before keeping cloud...', 'syncing');
    await createLocalVersionSafetySnapshot(rawKey);
    isApplyingRemote = true;
    try {
        replaceSnapshot?.(snapshot, { source: 'buddy_cloud', remoteUpdatedAt: remote.client_updated_at });
    } finally {
        isApplyingRemote = false;
    }

    localStorage.setItem(CLOUD_LAST_REMOTE_KEY, remote.client_updated_at);
    localStorage.setItem(CLOUD_LAST_PUSHED_KEY, remote.client_updated_at);
    clearConflictState();
    record('Buddy Cloud budget downloaded.', 'synced');
    afterRemoteApply?.();
    return true;
}

export async function enableSync(options = {}) {
    if (!canUseCloud()) throw new Error('Sign in before setting up Buddy Cloud.');
    if (!crypto?.subtle) throw new Error('This browser does not support secure Buddy Cloud encryption.');

    const existingKey = getStoredCloudKey();
    const remote = await fetchRemoteVault();
    if (remote && !existingKey && !options.recoveryKey) {
        localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
        rememberStatus();
        return { enabled: true, remoteExisted: true, needsKey: true };
    }

    const rawKey = options.recoveryKey || existingKey || generateCloudKey();
    let remoteSnapshot = null;
    if (remote) {
        remoteSnapshot = await decryptSnapshot(remote.payload, rawKey);
        await claimSyncSlot(remote, { replace: options.replaceSyncSlot === true });
    }
    storeCloudKey(rawKey);
    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    if (!remote) {
        await pushSnapshotNow('Buddy Cloud enabled. Local budget uploaded.');
        rememberStatus();
        return { enabled: true, recoveryKey: rawKey, remoteExisted: false };
    }

    const hasLocalData = localSnapshotHasBudgetData();
    if (hasLocalData && !options.prefer) {
        const localSnapshot = getLocalSnapshot();
        const localUpdatedAt = localSnapshot.meta?.localUpdatedAt || '';
        rememberStatus();
        return {
            enabled: true,
            recoveryKey: rawKey,
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
        return { enabled: true, recoveryKey: rawKey, remoteExisted: true, usedRemote: true };
    }

    await forcePush();
    return { enabled: true, recoveryKey: rawKey, remoteExisted: true, usedLocal: true };
}

export async function replaceSyncSlot() {
    if (!canUseCloud()) throw new Error('Sign in before managing Buddy Cloud devices.');
    const rawKey = getStoredCloudKey();
    if (!rawKey) throw new Error('Import your Buddy Cloud recovery key before making this browser active.');

    const remote = await fetchRemoteVault();
    if (!remote) throw new Error('No Buddy Cloud vault exists yet.');

    await decryptSnapshot(remote.payload, rawKey);
    await claimSyncSlot(remote, { replace: true });
    record('This browser is now the active Buddy Cloud browser.', 'synced');
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
        syncSlotDeviceCount: 0,
        syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: ''
    });
    return true;
}

export function removeThisDevice() {
    clearTimeout(pushTimer);
    const keyName = getUserKeyName();
    const slotKeyName = getSyncSlotKeyName();
    if (keyName) localStorage.removeItem(keyName);
    if (slotKeyName) localStorage.removeItem(slotKeyName);
    localStorage.removeItem(CLOUD_ENABLED_KEY);
    localStorage.removeItem(CLOUD_LAST_PUSHED_KEY);
    localStorage.removeItem(CLOUD_LAST_REMOTE_KEY);
    localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    clearConflictState();
    rememberStatus({
        syncing: false,
        syncSlotBlocked: false,
        syncSlotOwnerHash: '',
        syncSlotClaimedAt: '',
        syncSlotLastSeenAt: ''
    });
    record('Buddy Cloud removed from this browser. Cloud vault was not deleted.', 'local');
}

export function exportRecoveryKey() {
    const rawKey = getStoredCloudKey();
    if (!rawKey) throw new Error('Buddy Cloud is not enabled on this device yet.');
    return rawKey;
}

export async function importRecoveryKey(rawKey) {
    await importAesKey(rawKey);
    storeCloudKey(String(rawKey || '').trim());
    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    rememberStatus();
    record('Buddy Cloud recovery key imported.', 'local');
    return true;
}

export async function listVersionHistory(limit = 10) {
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Buddy Cloud first.');
    if (!getStoredCloudKey()) throw new Error('Import your Buddy Cloud recovery key before using version history.');

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
    if (!isEnabled() || !canUseCloud()) throw new Error('Sign in to use Buddy Cloud first.');
    const rawKey = getStoredCloudKey();
    if (!rawKey) throw new Error('Import your Buddy Cloud recovery key before restoring a version.');
    if (!snapshotId) throw new Error('Choose a Buddy Cloud version to restore.');

    record('Restoring Buddy Cloud version...', 'syncing');
    const { data, error } = await sb
        .from(CLOUD_SNAPSHOT_TABLE)
        .select('snapshot_id, payload, client_updated_at, created_at')
        .eq('user_id', currentUser.id)
        .eq('vault_name', VAULT_NAME)
        .eq('snapshot_id', snapshotId)
        .maybeSingle();

    if (error) throw createVersionHistoryError(error);
    if (!data) throw new Error('That Buddy Cloud version was not found.');

    const snapshot = await decryptSnapshot(data.payload, rawKey);
    record('Creating pre-restore safety snapshot...', 'syncing');
    await createPreRestoreSafetySnapshot(rawKey);
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
        replaceSnapshot?.(restoredSnapshot, {
            source: 'buddy_cloud_version_history',
            remoteUpdatedAt: data.client_updated_at || data.created_at || ''
        });
    } finally {
        isApplyingRemote = false;
    }

    afterRemoteApply?.();
    await pushSnapshotNow('Restored Buddy Cloud version.');
    return true;
}

export async function init(options = {}) {
    sb = options.supabaseClient || window.sb || null;
    currentUser = options.user || window.currentUser || null;
    getSnapshot = options.getSnapshot;
    replaceSnapshot = options.replaceSnapshot;
    afterRemoteApply = options.afterRemoteApply;
    isPremiumAccount = typeof options.isPremiumAccount === 'function' ? options.isPremiumAccount : isPremiumAccount;
    isInitialized = true;
    rememberStatus();

    if (!currentUser) {
        record('Sign in to protect this budget with Buddy Cloud.', 'local');
        return false;
    }

    if (!isEnabled()) {
        record('Buddy Cloud setup needed. Signed-in budgets use Buddy Cloud protection by default.', 'local');
        return false;
    }

    if (!hasLocalCloudKey()) {
        record('Import your Buddy Cloud recovery key to sync this device.', 'error');
        return false;
    }

    rememberStatus({ syncing: true, nextSyncAt: '', nextSyncReason: 'Buddy Cloud check running now' });

    try {
        const remote = await fetchRemoteVault();
        if (!remote) {
            await forcePush();
            return true;
        }

        await claimSyncSlot(remote);

        const lastRemoteAt = localStorage.getItem(CLOUD_LAST_REMOTE_KEY) || '';
        const localSnapshot = getLocalSnapshot();
        const localUpdatedAt = localSnapshot.meta?.localUpdatedAt || '';
        const remoteChanged = remote.client_updated_at && remote.client_updated_at !== lastRemoteAt;
        const localChanged = localUpdatedAt && localUpdatedAt !== localStorage.getItem(CLOUD_LAST_PUSHED_KEY);
        const localHasBudgetData = localSnapshotHasBudgetData(localSnapshot);
        const localSummary = getSnapshotSummary(localSnapshot);
        const rawKey = getStoredCloudKey();
        let remoteSnapshot = null;
        let remoteSummary = null;
        const getRemoteSummary = async () => {
            if (!remoteSnapshot) remoteSnapshot = await decryptSnapshot(remote.payload, rawKey);
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
            record('Possible data loss prevented. Review saved versions before Buddy Cloud overwrites either copy.', 'error');
            return false;
        };

        if (!localHasBudgetData) {
            const nextRemoteSummary = await getRemoteSummary();
            if (summaryHasBudgetData(nextRemoteSummary)) {
                clearConflictState();
                await forcePull();
                return true;
            }
        }

        if (remoteChanged && localChanged) {
            const waitMs = getConflictGraceWaitMs(remote.client_updated_at, localUpdatedAt);
            if (waitMs > 0) {
                clearConflictState();
                localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
                rememberStatus({ syncing: false, lastError: '' });
                console.info(`[Buddy Cloud] Recent local and cloud changes detected. Rechecking in ${formatWaitMinutes(waitMs)}.`);
                scheduleConflictGraceRetry(waitMs);
                return false;
            }

            return stopForVersionReview();
        }

        clearConflictState();

        if (remoteChanged) {
            const nextRemoteSummary = await getRemoteSummary();
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

        record('Buddy Cloud is up to date.', 'synced');
        return true;
    } catch (error) {
        console.error('[Buddy Cloud] Init failed:', error);
        record(getCloudErrorMessage(error, 'Buddy Cloud could not start.'), 'error');
        return false;
    }
}

export async function refreshUser(user) {
    currentUser = user || null;
    if (!currentUser) {
        rememberStatus({
            syncSlotBlocked: false,
            syncSlotOwnerHash: '',
            syncSlotDeviceCount: 0,
            syncSlotLimit: FREE_SYNC_DEVICE_LIMIT,
            syncSlotClaimedAt: '',
            syncSlotLastSeenAt: ''
        });
        return false;
    }
    rememberStatus();
    return init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount });
}

export async function syncNow() {
    if (!currentUser) throw new Error('Sign in before syncing with Buddy Cloud.');
    return init({ supabaseClient: sb, user: currentUser, getSnapshot, replaceSnapshot, afterRemoteApply, isPremiumAccount });
}

export function getStatus() {
    return {
        ...lastKnownStatus,
        enabled: isEnabled(),
        signedIn: Boolean(currentUser?.id),
        hasKey: hasLocalCloudKey(),
        canUseCloud: canUseCloud(),
        isPremium: canUseMultipleSyncDevices(),
        multiDeviceAllowed: canUseMultipleSyncDevices(),
        freeDeviceLimit: FREE_SYNC_DEVICE_LIMIT,
        syncSlotLimit: lastKnownStatus.syncSlotLimit || FREE_SYNC_DEVICE_LIMIT
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
    removeThisDevice,
    exportRecoveryKey,
    importRecoveryKey,
    listVersionHistory,
    restoreVersion,
    getStatus
};
