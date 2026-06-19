// js/privacyStorageCleanup.js

const SYNC_HISTORY_KEY = 'bb_sync_history';
const SYNC_HISTORY_LIMIT = 5;
const CLOUD_KEY_PREFIX = 'bb_cloud_key_';
const BB_DATA_KEY = 'bb_data';
const BB_LOCAL_UPDATED_AT_KEY = 'bb_local_updated_at';
const LEGACY_TRANSACTIONS_KEY = 'bb_transactions';
const LEGACY_CATEGORIES_KEY = 'bb_categories';
const LEGACY_CUSTOM_CATEGORIES_KEY = 'bb_custom_categories';
const LEGACY_DESCRIPTION_BUFFER_KEY = 'bb_circular_buffer';
const DEMO_ACTIVE_KEY = 'bb_demo_active';
const DEMO_BACKUP_HAS_DATA_KEY = 'bb_demo_backup_has_data';
const DEMO_BACKUP_DATA_KEY = 'bb_demo_backup_bb_data';
const DEMO_BACKUP_UPDATED_AT_KEY = 'bb_demo_backup_local_updated_at';
const DEMO_BACKUP_KEYS = [
    DEMO_BACKUP_HAS_DATA_KEY,
    DEMO_BACKUP_DATA_KEY,
    DEMO_BACKUP_UPDATED_AT_KEY,
    'bb_demo_backup_created_at'
];
const DEMO_RECOVERY_MODAL_ID = 'bbDemoBackupRecoveryModal';
const DEMO_RECOVERY_STYLE_ID = 'bbDemoBackupRecoveryStyles';

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
        // Privacy cleanup must never block app startup.
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Privacy cleanup must never block app startup.
    }
}

function parseStoredJson(key, fallback = null) {
    const raw = storageGet(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function cleanText(value, maxLength = 160) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hasModernBudgetShape(payload = null) {
    if (!payload || typeof payload !== 'object') return false;

    return Array.isArray(payload.transactions) && Array.isArray(payload.categories);
}

function getExistingBudgetState() {
    const raw = storageGet(BB_DATA_KEY);
    if (!raw) return { exists: false, valid: false, payload: null };

    const payload = parseStoredJson(BB_DATA_KEY, null);
    return {
        exists: true,
        valid: hasModernBudgetShape(payload),
        payload
    };
}

function getLegacyArray(key) {
    const parsed = parseStoredJson(key, []);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
}

function normalizeLegacyTransaction(tx = {}, index = 0) {
    const now = new Date().toISOString();
    const createdAt = tx.createdAt || tx.createdAtUTC || tx.serverLoggedAtUTC || tx.date || now;

    return {
        ...tx,
        id: tx.id || `legacy-tx-${Date.now()}-${index}`,
        amount: Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0,
        type: tx.type || 'expense',
        category: typeof tx.category === 'string' ? tx.category : '',
        description: typeof tx.description === 'string' ? tx.description : '',
        date: typeof tx.date === 'string' && tx.date ? tx.date : now.slice(0, 10),
        createdAt,
        createdAtUTC: tx.createdAtUTC || createdAt,
        serverLoggedAtUTC: tx.serverLoggedAtUTC || createdAt,
        updatedAtUTC: tx.updatedAtUTC || now,
        isDeleted: tx.isDeleted === true
    };
}

function getCategoryIdentity(cat = {}) {
    const type = String(cat.type || 'expense').trim().toLowerCase();
    const name = String(cat.name || '').trim().toLowerCase();
    const id = String(cat.id || '').trim().toLowerCase();
    return `${type}:${name || id}`;
}

function normalizeLegacyCategory(cat = {}, index = 0) {
    const now = new Date().toISOString();
    const name = String(cat.name || '').replace(/\s+/g, ' ').trim();
    if (!name) return null;

    return {
        ...cat,
        id: cat.id || `legacy-cat-${Date.now()}-${index}`,
        name,
        icon: cat.icon || '\u{1F4C1}',
        type: cat.type || 'expense',
        budget: Number.isFinite(Number(cat.budget)) ? Number(cat.budget) : 0,
        createdAt: cat.createdAt || now
    };
}

function getMergedLegacyCategories() {
    const legacyCategories = [
        ...getLegacyArray(LEGACY_CATEGORIES_KEY),
        ...getLegacyArray(LEGACY_CUSTOM_CATEGORIES_KEY)
    ];
    const seen = new Set();

    return legacyCategories
        .map(normalizeLegacyCategory)
        .filter(Boolean)
        .filter(cat => {
            const identity = getCategoryIdentity(cat);
            if (!identity || seen.has(identity)) return false;
            seen.add(identity);
            return true;
        });
}

function migrateLegacyBudgetStorage() {
    const existing = getExistingBudgetState();
    if (existing.valid) {
        return { migrated: false, reason: 'bb_data_present' };
    }

    const transactions = getLegacyArray(LEGACY_TRANSACTIONS_KEY)
        .map(normalizeLegacyTransaction)
        .filter(tx => tx.description || tx.category || Number(tx.amount) !== 0);
    const categories = getMergedLegacyCategories();

    if (!transactions.length && !categories.length) {
        return { migrated: false, reason: 'legacy_empty' };
    }

    const payload = {
        transactions,
        categories,
        settings: {
            lastCategorySort: 'manual'
        }
    };
    const migrated = storageSet(BB_DATA_KEY, JSON.stringify(payload));
    if (!migrated) return { migrated: false, reason: 'write_failed' };

    if (!storageGet(BB_LOCAL_UPDATED_AT_KEY)) {
        storageSet(BB_LOCAL_UPDATED_AT_KEY, new Date().toISOString());
    }

    return {
        migrated: true,
        transactionCount: transactions.length,
        categoryCount: categories.length
    };
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
    DEMO_BACKUP_KEYS.forEach(storageRemove);
    storageRemove(DEMO_ACTIVE_KEY);
}

function cleanupPersistedCloudKeys() {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(CLOUD_KEY_PREFIX))
            .forEach(storageRemove);
    } catch {
        // Privacy cleanup must never block app startup.
    }
}

function cleanupLegacyDescriptionBuffer() {
    storageRemove(LEGACY_DESCRIPTION_BUFFER_KEY);
}

function hasStrandedDemoBackup() {
    return storageGet(DEMO_ACTIVE_KEY) !== 'true'
        && storageGet(DEMO_BACKUP_HAS_DATA_KEY) === 'true'
        && Boolean(storageGet(DEMO_BACKUP_DATA_KEY));
}

function clearDemoBackupKeys() {
    DEMO_BACKUP_KEYS.forEach(storageRemove);
}

function injectDemoRecoveryStyles() {
    if (document.getElementById(DEMO_RECOVERY_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = DEMO_RECOVERY_STYLE_ID;
    style.textContent = `
        .bb-demo-recovery-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: grid;
            place-items: center;
            padding: 1rem;
            background: rgba(2, 6, 23, 0.78);
            color: #0f172a;
        }

        .bb-demo-recovery-card {
            width: min(34rem, 100%);
            padding: 1.35rem;
            border: 1px solid rgba(20, 184, 166, 0.34);
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 24px 70px rgba(2, 6, 23, 0.38);
        }

        .bb-demo-recovery-card h1 {
            margin: 0 0 0.65rem;
            color: #0f172a;
            font-size: 1.25rem;
            line-height: 1.18;
        }

        .bb-demo-recovery-card p {
            margin: 0 0 0.85rem;
            color: #475569;
            font-size: 0.94rem;
            line-height: 1.5;
        }

        .bb-demo-recovery-note {
            padding: 0.75rem;
            border: 1px solid rgba(245, 158, 11, 0.28);
            border-radius: 10px;
            background: rgba(245, 158, 11, 0.1);
            color: #78350f;
            font-weight: 750;
        }

        .bb-demo-recovery-error {
            margin-top: 0.7rem;
            color: #b91c1c;
            font-size: 0.88rem;
            font-weight: 800;
        }

        .bb-demo-recovery-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
            margin-top: 1rem;
        }

        .bb-demo-recovery-action {
            min-height: 2.65rem;
            padding: 0.72rem 0.95rem;
            border: 0;
            border-radius: 10px;
            background: #0f766e;
            color: #ffffff;
            font-weight: 900;
            cursor: pointer;
        }

        .bb-demo-recovery-action:disabled {
            cursor: wait;
            opacity: 0.68;
        }
    `;
    document.head.appendChild(style);
}

function setRecoveryError(modal, message = '') {
    const error = modal?.querySelector('[data-demo-recovery-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
}

function retryDemoBackupRestore(modal) {
    storageRemove(DEMO_ACTIVE_KEY);
    clearDemoBackupKeys();
    return true;
}

function mountDemoBackupRecoveryModal() {
    if (document.getElementById(DEMO_RECOVERY_MODAL_ID)) return;
    injectDemoRecoveryStyles();

    const overlay = document.createElement('div');
    overlay.id = DEMO_RECOVERY_MODAL_ID;
    overlay.className = 'bb-demo-recovery-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'bbDemoRecoveryTitle');
    overlay.innerHTML = `
        <section class="bb-demo-recovery-card">
            <h1 id="bbDemoRecoveryTitle">Budget restore paused</h1>
            <p>Zam! found a protected pre-demo budget backup, but the demo session was not active. The app is paused so this backup is not overwritten or deleted.</p>
            <p class="bb-demo-recovery-note">If restore fails, your browser storage is probably full. Clear some browser storage space, then try again.</p>
            <div class="bb-demo-recovery-actions">
                <button type="button" class="bb-demo-recovery-action" data-demo-recovery-restore>Restore My Budget</button>
            </div>
            <div class="bb-demo-recovery-error" data-demo-recovery-error hidden></div>
        </section>
    `;

    overlay.querySelector('[data-demo-recovery-restore]')?.addEventListener('click', (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        setRecoveryError(overlay, '');
        const restored = retryDemoBackupRestore(overlay);
        if (restored) {
            button.textContent = 'Budget restored';
            window.setTimeout(() => window.location.reload(), 350);
            return;
        }
        button.disabled = false;
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-demo-recovery-restore]')?.focus({ preventScroll: true });
}

export function runPrivacyStorageCleanup(options = {}) {
    const { skipBudgetMigration = false } = options || {};
    cleanupSyncHistory();
    cleanupPersistedCloudKeys();
    cleanupLegacyDescriptionBuffer();
    cleanupInactiveDemoBackup();

    if (skipBudgetMigration) {
        return { blocked: false, legacyMigration: { migrated: false, reason: 'demo_request' } };
    }

    const legacyMigration = migrateLegacyBudgetStorage();
    return { blocked: false, legacyMigration };
}
