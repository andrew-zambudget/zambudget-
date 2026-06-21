const SIGNED_IN_OWNER_KEY = 'bb_signed_in_owner_id';
const SIGNED_IN_OWNER_HASH_KEY = 'bb_signed_in_owner_hash_v1';

const ACCOUNT_SCOPED_KEYS = Object.freeze([
    'bb_data',
    'bb_local_updated_at',
    'bb_sync_history',
    'bb_transactions',
    'bb_categories',
    'bb_custom_categories',
    'bb_circular_buffer',
    'bb_cloud_sync_enabled',
    'bb_cloud_sync_slot_v1',
    'bb_cloud_last_pushed_at',
    'bb_cloud_last_remote_at',
    'bb_cloud_last_error',
    'bb_cloud_conflict_remote_at',
    'bb_cloud_conflict_local_at',
    'bb_cloud_conflict_last_synced_at',
    'bb_cloud_conflict_remote_summary',
    'bb_cloud_conflict_local_summary',
    'bb_cloud_device_id',
    'bb_browser_access_tokens_v1',
    'bb_cloud_recovery_key_saved_v1',
    'bb_cloud_recovery_key_backed_up_v1',
    'bb_pro_status',
    'bb_premium_active',
    'bb_stripe_checkout_session_id',
    'bb_premium_activated_at',
    'bb_stripe_redirect_acknowledged'
]);

const ACCOUNT_SCOPED_PREFIXES = Object.freeze([
    'bb_cloud_key_',
    'bb_cloud_sync_slot_',
    'bb_cloud_recovery_key_saved_',
    'bb_cloud_recovery_key_backed_up_',
    'bb_cloud_recovery_key_grace_started_',
    'bb_cloud_recovery_key_unlocked_until_',
    'bb_cloud_default_setup_attempted_',
    'bb_cloud_force_pull_after_sign_in_',
    'bb_cloud_recent_restore_',
    'bb_cloud_manual_sync_at_',
    'bb_browser_access_token_'
]);

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
        return true;
    } catch {
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Continue best-effort cleanup.
    }
}

function hashOwnerId(userId = '') {
    const value = String(userId || '').trim();
    if (!value) return '';

    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function getSignedInLocalOwnerId() {
    const legacyOwnerId = storageGet(SIGNED_IN_OWNER_KEY) || '';
    if (legacyOwnerId) {
        const legacyHash = hashOwnerId(legacyOwnerId);
        if (legacyHash && !storageGet(SIGNED_IN_OWNER_HASH_KEY)) {
            storageSet(SIGNED_IN_OWNER_HASH_KEY, legacyHash);
        }
        storageRemove(SIGNED_IN_OWNER_KEY);
    }
    return storageGet(SIGNED_IN_OWNER_HASH_KEY) || '';
}

export function clearSignedInAccountScopedLocalState({ preserveOwnerKey = false } = {}) {
    ACCOUNT_SCOPED_KEYS.forEach(storageRemove);

    try {
        Object.keys(localStorage)
            .filter(key => ACCOUNT_SCOPED_PREFIXES.some(prefix => key.startsWith(prefix)))
            .forEach(storageRemove);
    } catch {
        // If key enumeration is blocked, direct keys above still cleared.
    }

    storageRemove(SIGNED_IN_OWNER_KEY);
    if (!preserveOwnerKey) storageRemove(SIGNED_IN_OWNER_HASH_KEY);
}

export function guardSignedInLocalOwner(userId = '') {
    const nextUserId = String(userId || '').trim();
    if (!nextUserId) return { changed: false, previousUserId: '', nextUserId: '' };

    const nextOwnerHash = hashOwnerId(nextUserId);
    const previousOwnerHash = getSignedInLocalOwnerId();
    if (previousOwnerHash && previousOwnerHash !== nextOwnerHash) {
        clearSignedInAccountScopedLocalState({ preserveOwnerKey: true });
        storageSet(SIGNED_IN_OWNER_HASH_KEY, nextOwnerHash);
        return { changed: true, previousUserId: previousOwnerHash, nextUserId };
    }

    storageSet(SIGNED_IN_OWNER_HASH_KEY, nextOwnerHash);
    storageRemove(SIGNED_IN_OWNER_KEY);
    return { changed: false, previousUserId: previousOwnerHash, nextUserId };
}
