// js/state.js

let state = {
    transactions: [],
    categories: [],
    settings: {
        currency: '$',
        defaultType: 'expense',
        defaultCategory: '',
        defaultPayment: '',
        defaultTag: 'transaction',
        savingsGoal: 1000,
        emergencyFundMonths: 3,
        emergencyFundGoalOverride: false,
        emergencyFundInteracted: false,
        overrideDebtEmergencyFundLock: false,
        dashboardSummaryCollapsed: true,
        treatSavingsAsIncomeInZbb: false,
        treatSavingsAsTotalIncome: false,
        lastCategorySort: 'manual',
        isPro: false,
        premiumSinceUTC: '',
        stripeCheckoutSessionId: '',
        billingSubscriptionStatus: '',
        billingCurrentPeriodEnd: '',
        billingCancelAtPeriodEnd: false,
        showGiftCardManager: true,
        giftCards: []
    },
    // Runtime helpers
    currentType: 'expense',
    currentTag: 'transaction',
    currentDrilldownCat: null,
    selectedDate: new Date()
};

let suppressCloudQueue = false;
const APP_BUDGET_DATA_KEY = 'bb_data';
const APP_LOCAL_UPDATED_AT_KEY = 'bb_local_updated_at';
const DEMO_BUDGET_DATA_KEY = 'zam_demo_data';
const DEMO_LOCAL_UPDATED_AT_KEY = 'zam_demo_local_updated_at';
const DEMO_ACTIVE_KEY = 'zam_demo_active';
export const LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG = '__ZAM_ENABLE_LOCAL_VAULT_STORAGE_EXPERIMENT__';
const LOCAL_VAULT_ENVELOPE_KIND = 'zam_local_budget_vault';
const STORAGE_TEST_KEY = 'bb_storage_available_test';
const SIGNED_OUT_WRITE_MESSAGE = 'Sign in or start the demo before adding real budget data.';
const BROWSER_STORAGE_BLOCKED_MESSAGE = 'Zam needs required browser site data to save and load your budget on this device. Enable site data for app.zambudget.com or use your browser settings to clear/reset it.';
let lastSignedOutWriteNoticeAt = 0;
let lastBrowserStorageNoticeAt = 0;
let browserStorageAvailable = null;
let localVaultWriteQueue = Promise.resolve(true);
let localVaultLastWriteError = null;
const GIFT_CARD_NAME_MAX_LENGTH = 32;
const GIFT_CARD_MERCHANT_MAX_LENGTH = 64;
const GIFT_CARD_NOTES_MAX_LENGTH = 240;
const GIFT_CARD_LAST4_MAX_LENGTH = 4;

function notifyBrowserStorageBlocked() {
    if (typeof window === 'undefined' || typeof window.showToast !== 'function') return;

    const now = Date.now();
    if (now - lastBrowserStorageNoticeAt < 4000) return;
    lastBrowserStorageNoticeAt = now;
    window.showToast(BROWSER_STORAGE_BLOCKED_MESSAGE);
}

function markBrowserStorageBlocked(error = null) {
    browserStorageAvailable = false;
    if (error) console.warn('[State] Browser storage is unavailable.', error);
    notifyBrowserStorageBlocked();
}

export function isBrowserStorageAvailable({ refresh = false } = {}) {
    if (!refresh && browserStorageAvailable !== null) return browserStorageAvailable;

    try {
        if (typeof localStorage === 'undefined') {
            browserStorageAvailable = false;
            return false;
        }
        localStorage.setItem(STORAGE_TEST_KEY, '1');
        localStorage.removeItem(STORAGE_TEST_KEY);
        browserStorageAvailable = true;
        return true;
    } catch (error) {
        markBrowserStorageBlocked(error);
        return false;
    }
}

function storageGet(key, fallback = '') {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch (error) {
        markBrowserStorageBlocked(error);
        return fallback;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        browserStorageAvailable = true;
        return true;
    } catch (error) {
        markBrowserStorageBlocked(error);
        return false;
    }
}

function readStorageValue(storage, key, fallback = '') {
    try {
        return storage.getItem(key) ?? fallback;
    } catch (error) {
        markBrowserStorageBlocked(error);
        return fallback;
    }
}

function writeStorageValue(storage, key, value) {
    try {
        storage.setItem(key, value);
        browserStorageAvailable = true;
        return true;
    } catch (error) {
        markBrowserStorageBlocked(error);
        return false;
    }
}

function isSignedInForBudgetWrites() {
    return Boolean(typeof window !== 'undefined' && window.currentUser?.id);
}

function isDemoModeActiveForBudgetWrites() {
    try {
        return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DEMO_ACTIVE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function canWriteBudgetData() {
    return isSignedInForBudgetWrites() || isDemoModeActiveForBudgetWrites();
}

export function getBudgetStorage() {
    if (isDemoModeActiveForBudgetWrites()) {
        return {
            storage: sessionStorage,
            key: DEMO_BUDGET_DATA_KEY,
            localUpdatedAtKey: DEMO_LOCAL_UPDATED_AT_KEY,
            mode: 'demo'
        };
    }

    return {
        storage: localStorage,
        key: APP_BUDGET_DATA_KEY,
        localUpdatedAtKey: APP_LOCAL_UPDATED_AT_KEY,
        mode: 'app'
    };
}

export function assertDemoDoesNotTouchRealBudgetStorage(action = 'access', key = '') {
    if (isDemoModeActiveForBudgetWrites() && key === APP_BUDGET_DATA_KEY) {
        throw new Error(`Blocked demo ${action} on real app storage key bb_data`);
    }
}

function readBudgetData() {
    const target = getBudgetStorage();
    assertDemoDoesNotTouchRealBudgetStorage('read', target.key);
    return readStorageValue(target.storage, target.key, '');
}

function writeBudgetData(value) {
    const target = getBudgetStorage();
    assertDemoDoesNotTouchRealBudgetStorage('write', target.key);
    return writeStorageValue(target.storage, target.key, value);
}

export function isLocalVaultStorageExperimentEnabled() {
    return Boolean(typeof window !== 'undefined' && window[LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] === true);
}

function assertLocalVaultStorageExperimentEnabled() {
    if (!isLocalVaultStorageExperimentEnabled()) {
        throw new Error('Local vault storage experiment is disabled.');
    }
}

function getAppBudgetStorageTarget() {
    const target = getBudgetStorage();
    if (target.key !== APP_BUDGET_DATA_KEY || target.mode !== 'app') {
        throw new Error('Local vault storage Phase 2B is limited to app bb_data storage.');
    }
    return target;
}

async function getLocalVaultStorageModule() {
    assertLocalVaultStorageExperimentEnabled();
    return import('./localVaultStorage.js');
}

async function getLocalVaultKeyProviderModule() {
    assertLocalVaultStorageExperimentEnabled();
    return import('./localVaultKeyProvider.js');
}

function notifySignedOutBudgetWriteBlocked(action = '', options = {}) {
    const { toast = true } = options;
    const detail = action ? ` ${action}` : '';
    console.warn(`[State] Blocked signed-out budget write:${detail}`);

    if (!toast || typeof window === 'undefined' || typeof window.showToast !== 'function') return;

    const now = Date.now();
    if (now - lastSignedOutWriteNoticeAt < 1200) return;
    lastSignedOutWriteNoticeAt = now;
    window.showToast(SIGNED_OUT_WRITE_MESSAGE);
}

export function requireBudgetWriteAccess(action = 'change budget data') {
    if (canWriteBudgetData()) return true;
    notifySignedOutBudgetWriteBlocked(action);
    return false;
}

// Best-effort overwrite before removal.
// Browser storage engines do not guarantee true secure deletion.
function secureRemove(key) {
    try {
        localStorage.setItem(key, '0'.repeat(1024));
    } catch {
        // Ignore quota limits during overwrite attempt.
    }

    try {
        localStorage.removeItem(key);
    } catch {
        // Keep cleanup moving even if this browser blocks removal.
    }
}

function secureRemoveSession(key) {
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Keep cleanup moving even if this browser blocks removal.
    }
}

function getLocalUpdatedAt() {
    const target = getBudgetStorage();
    assertDemoDoesNotTouchRealBudgetStorage('read timestamp', target.key);
    return readStorageValue(target.storage, target.localUpdatedAtKey, '');
}

function setLocalUpdatedAt(value = new Date().toISOString()) {
    const target = getBudgetStorage();
    assertDemoDoesNotTouchRealBudgetStorage('write timestamp', target.key);
    if (!writeStorageValue(target.storage, target.localUpdatedAtKey, value)) {
        throw new Error('Browser storage is unavailable.');
    }
    return value;
}

function getDurablePayload() {
    return {
        transactions: state.transactions,
        categories: state.categories,
        settings: state.settings
    };
}

function getCloudSafeSettings(settings = state.settings) {
    const {
        isPro,
        premiumSinceUTC,
        stripeCheckoutSessionId,
        billingSubscriptionStatus,
        billingCurrentPeriodEnd,
        billingCancelAtPeriodEnd,
        ...safeSettings
    } = settings || {};

    return safeSettings;
}

function cleanGiftCardText(value, maxLength) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function normalizeGiftCardDate(value) {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';

    const [year, month, day] = normalized.split('-').map(Number);
    if (year < 1900 || year > 2100) return '';

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        ? normalized
        : '';
}

function normalizeGiftCardLastFour(value = '') {
    return cleanGiftCardText(value, 16).replace(/\s+/g, '').slice(-GIFT_CARD_LAST4_MAX_LENGTH);
}

function normalizeGiftCardAmount(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
    return Math.max(0, Number.parseFloat(fallback) || 0);
}

function getGiftCardDisplayName({ merchantName = '', nickname = '', lastFour = '' } = {}) {
    const cleanNickname = cleanGiftCardText(nickname, GIFT_CARD_NAME_MAX_LENGTH);
    if (cleanNickname) return cleanNickname;
    const cleanMerchant = cleanGiftCardText(merchantName, GIFT_CARD_MERCHANT_MAX_LENGTH);
    if (cleanMerchant) return `${cleanMerchant} Gift Card`;
    return lastFour ? `Gift Card ${lastFour}` : 'Gift Card';
}

function normalizeGiftCard(card = {}) {
    const originalAmount = normalizeGiftCardAmount(card.originalAmount ?? card.totalAmount);
    const rawAmountLeft = card.amountLeft ?? card.currentBalance;
    const fallbackAmountLeft = rawAmountLeft === '' || rawAmountLeft === undefined || rawAmountLeft === null
        ? originalAmount
        : rawAmountLeft;
    const reloadable = card.reloadable === true;
    const amountLeftValue = normalizeGiftCardAmount(fallbackAmountLeft, originalAmount);
    const amountLeft = reloadable || originalAmount <= 0
        ? amountLeftValue
        : Math.min(originalAmount, amountLeftValue);
    const last4 = normalizeGiftCardLastFour(card.lastFour || card.cardNumber);
    const merchantName = cleanGiftCardText(card.merchantName || card.merchant || card.name, GIFT_CARD_MERCHANT_MAX_LENGTH);
    const nickname = cleanGiftCardText(card.nickname, GIFT_CARD_NAME_MAX_LENGTH);
    const displayName = getGiftCardDisplayName({ merchantName, nickname, lastFour: last4 });
    const createdAt = card.createdAt || new Date().toISOString();
    const archived = card.archived === true || card.isArchived === true;

	    return {
	        id: String(card.id || `gift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
	        merchantName,
	        displayName,
	        nickname,
	        originalAmount,
	        amountLeft,
	        lastFour: last4,
	        reloadable,
	        issuedDate: normalizeGiftCardDate(card.issuedDate),
	        expirationDate: normalizeGiftCardDate(card.expirationDate),
	        notes: cleanGiftCardText(card.notes, GIFT_CARD_NOTES_MAX_LENGTH),
	        hasVaultSecret: card.hasVaultSecret === true,
	        vaultSecretId: cleanGiftCardText(card.vaultSecretId, 96),
	        archived,
	        archivedAt: card.archivedAt || '',
	        createdAt,
	        updatedAt: card.updatedAt || createdAt
	    };
	}

function normalizeGiftCards(cards = []) {
    if (!Array.isArray(cards)) return [];
    const seenIds = new Set();
    return cards
        .filter(Boolean)
        .map(normalizeGiftCard)
        .filter(card => {
            if (!card.id || seenIds.has(card.id)) return false;
            seenIds.add(card.id);
            return true;
        });
}

function normalizeBudgetValue(rawBudget) {
    if (typeof rawBudget === 'number' && Number.isFinite(rawBudget)) {
        return Math.max(0, rawBudget);
    }

    if (typeof rawBudget === 'string') {
        const parsed = Number.parseFloat(rawBudget.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    if (typeof rawBudget === 'boolean') {
        return rawBudget ? 1 : 0;
    }

    const parsed = Number(rawBudget);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeLoadedCategory(category = {}) {
    if (!category || typeof category !== 'object') return null;

    const sourceBudget = category.budget;
    const normalizedBudget = normalizeBudgetValue(sourceBudget);

    if (!Number.isFinite(Number(sourceBudget)) && typeof sourceBudget !== 'number') {
        return {
            ...category,
            budget: normalizedBudget
        };
    }

    if (typeof sourceBudget === 'number' && sourceBudget !== normalizedBudget) {
        return {
            ...category,
            budget: normalizedBudget
        };
    }

    if (typeof sourceBudget !== 'number' && sourceBudget !== undefined && sourceBudget !== '' && sourceBudget !== null) {
        return {
            ...category,
            budget: normalizedBudget
        };
    }

    if (category.budget !== undefined) {
        return {
            ...category,
            budget: normalizedBudget
        };
    }

    return category;
}

function normalizeLoadedCategories(categories = []) {
    if (!Array.isArray(categories)) return { categories: [], changed: false };

    const normalized = [];
    let changed = false;

    for (const category of categories) {
        const normalizedCategory = normalizeLoadedCategory(category);
        if (!normalizedCategory) continue;
        const hadSourceBudget = Object.prototype.hasOwnProperty.call(category, 'budget');
        const wasFixed = !Number.isFinite(normalizeBudgetValue(category.budget))
            || normalizedCategory.budget !== category.budget
            || (typeof category.budget !== 'number' && hadSourceBudget);
        if (wasFixed) {
            changed = true;
        }
        normalized.push(normalizedCategory);
    }

    return { categories: normalized, changed };
}

function getMutableGiftCards() {
    state.settings.giftCards = normalizeGiftCards(state.settings.giftCards);
    return state.settings.giftCards;
}

function applyLoadedPayload(parsed = {}) {
    state.transactions = (parsed.transactions || []).map(tx => normalizeTransaction(tx, false));
    const categoryLoad = normalizeLoadedCategories(parsed.categories || []);
    state.categories = categoryLoad.categories;
    state.settings = { ...state.settings, ...parsed.settings };
    const rawGiftCards = Array.isArray(state.settings.giftCards) ? state.settings.giftCards : [];
    state.settings.giftCards = normalizeGiftCards(rawGiftCards);
    const giftCardsChanged = JSON.stringify(rawGiftCards) !== JSON.stringify(state.settings.giftCards);
    const savingsGoal = parseFloat(state.settings.savingsGoal);
    state.settings.savingsGoal = (!Number.isFinite(savingsGoal) || savingsGoal === 10000)
        ? 1000
        : Math.max(1000, savingsGoal);
    const emergencyFundMonths = parseInt(state.settings.emergencyFundMonths, 10);
    state.settings.emergencyFundMonths = Number.isInteger(emergencyFundMonths)
        ? Math.min(6, Math.max(3, emergencyFundMonths))
        : 3;
    state.settings.emergencyFundGoalOverride = Boolean(state.settings.emergencyFundGoalOverride);
    state.settings.emergencyFundInteracted = Boolean(state.settings.emergencyFundInteracted);
    state.settings.overrideDebtEmergencyFundLock = parsed.settings?.overrideDebtEmergencyFundLock === true;
    state.settings.treatSavingsAsTotalIncome = parsed.settings?.treatSavingsAsTotalIncome === true;
    state.settings.treatSavingsAsIncomeInZbb = false;
    const orderChanged = normalizeCategoryCustomOrder();
    const arrayChanged = applyCustomOrderToCategoryArray();
    return orderChanged || arrayChanged || categoryLoad.changed || giftCardsChanged;
}

// Local vault helpers are gated by LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG.
// With the flag off, the app keeps the existing plaintext bb_data path.
export async function writeBudgetDataToLocalVault(payload = getDurablePayload(), key, options = {}) {
    const target = getAppBudgetStorageTarget();
    const Vault = await getLocalVaultStorageModule();
    const envelope = await Vault.writeEncryptedLocalVaultRecord(target.storage, payload, key, {
        ...options,
        storageKey: target.key
    });
    const localUpdatedAt = options.localUpdatedAt || options.updatedAt || new Date().toISOString();
    setLocalUpdatedAt(localUpdatedAt);
    return envelope;
}

export async function readBudgetDataFromLocalVault(key, options = {}) {
    const target = getAppBudgetStorageTarget();
    const Vault = await getLocalVaultStorageModule();
    return Vault.readEncryptedLocalVaultRecord(target.storage, key, {
        ...options,
        storageKey: target.key
    });
}

export async function applyBudgetDataFromLocalVault(key, options = {}) {
    const payload = await readBudgetDataFromLocalVault(key, options);
    const rollbackTransactions = [...state.transactions];
    const rollbackCategories = [...state.categories];
    const rollbackSettings = { ...state.settings };

    try {
        applyLoadedPayload(payload || {});
    } catch (error) {
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        throw error;
    }

    return payload;
}

function getCurrentLocalVaultUserId() {
    return typeof window !== 'undefined' ? String(window.currentUser?.id || '').trim() : '';
}

async function getLocalVaultKeyForCurrentContext(options = {}) {
    const Provider = await getLocalVaultKeyProviderModule();
    const keyId = options.keyId || Provider.getLocalVaultKeyId({
        userId: options.userId ?? getCurrentLocalVaultUserId(),
        scope: options.scope || 'primary'
    });
    const keyResult = await Provider.getOrCreateLocalVaultKey(keyId);

    if (!await Provider.verifyLocalVaultKeyRoundtrip(keyResult.key)) {
        throw new Error('Local vault key roundtrip verification failed.');
    }

    return { key: keyResult.key, keyId, created: keyResult.created };
}

function applyLoadedPayloadWithRollback(payload = {}) {
    const rollbackTransactions = [...state.transactions];
    const rollbackCategories = [...state.categories];
    const rollbackSettings = { ...state.settings };

    try {
        return applyLoadedPayload(payload || {});
    } catch (error) {
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        throw error;
    }
}

function safeJsonParseBudgetPayload(rawValue) {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('Plaintext budget payload must be an object.');
    }
    return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
    };
}

function isLocalVaultEnvelopePayload(parsed) {
    return Boolean(parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && parsed.kind === LOCAL_VAULT_ENVELOPE_KIND
        && typeof parsed.ciphertext === 'string'
        && typeof parsed.iv === 'string');
}

function getLocalVaultDisabledEnvelopeError() {
    return new Error('Encrypted local budget storage is present, but local vault storage is disabled. Re-enable local vault storage or recover this budget through Cloud Sync before continuing.');
}

async function persistEncryptedBudgetPayload(payload = getDurablePayload(), options = {}) {
    const { key, keyId, created } = await getLocalVaultKeyForCurrentContext(options);
    const updatedAt = options.updatedAt || options.localUpdatedAt || new Date().toISOString();
    await writeBudgetDataToLocalVault(payload, key, {
        ...options,
        keyId,
        updatedAt
    });
    return { keyId, keyCreated: created, localUpdatedAt: updatedAt };
}

function enqueueEncryptedBudgetPersistence(payload = getDurablePayload(), options = {}) {
    const targetMode = getBudgetStorage().mode;
    const shouldQueueCloud = !suppressCloudQueue
        && targetMode !== 'demo'
        && typeof window !== 'undefined'
        && typeof window.BuddyCloud?.queuePush === 'function';

    const queuedPayload = JSON.parse(JSON.stringify(payload || {}));
    const queuedOptions = { ...options };
    localVaultLastWriteError = null;

    const nextWrite = localVaultWriteQueue
        .catch(() => false)
        .then(async () => {
            try {
                const result = await persistEncryptedBudgetPayload(queuedPayload, queuedOptions);
                if (shouldQueueCloud) {
                    window.BuddyCloud.queuePush('Budget synced to Cloud Sync.', { localUpdatedAt: result.localUpdatedAt });
                }
                return true;
            } catch (error) {
                localVaultLastWriteError = error;
                console.error('[State] CRITICAL: Encrypted browser storage write failed', error);
                notifyBrowserStorageBlocked();
                return false;
            }
        });

    localVaultWriteQueue = nextWrite;
    return nextWrite;
}

export async function flushLocalVaultSaveQueue() {
    return localVaultWriteQueue;
}

export function getLastLocalVaultSaveError() {
    return localVaultLastWriteError;
}

export async function migrateBudgetDataToLocalVault(options = {}) {
    const target = getAppBudgetStorageTarget();
    const Vault = await getLocalVaultStorageModule();
    const rawValue = readStorageValue(target.storage, target.key, '');
    const classification = Vault.classifyLocalBudgetRecord(rawValue);

    if (classification.kind === 'empty') {
        return { migrated: false, reason: 'empty' };
    }

    if (classification.kind === 'encrypted') {
        return { migrated: false, reason: 'already_encrypted' };
    }

    if (classification.kind !== 'plaintext') {
        return { migrated: false, reason: classification.kind };
    }

    const plaintextBeforeMigration = rawValue;
    const parsedPayload = safeJsonParseBudgetPayload(plaintextBeforeMigration);
    const { key, keyId, created } = await getLocalVaultKeyForCurrentContext(options);
    const updatedAt = options.updatedAt || getLocalUpdatedAt() || new Date().toISOString();
    const envelope = await Vault.encryptLocalVaultPayload(parsedPayload, key, {
        createdAt: options.createdAt || updatedAt,
        updatedAt
    });
    const serializedEnvelope = Vault.serializeLocalVaultEnvelope(envelope);
    const verifiedPayload = await Vault.decryptLocalVaultEnvelope(serializedEnvelope, key);

    if (JSON.stringify(verifiedPayload) !== JSON.stringify(parsedPayload)) {
        throw new Error('Local vault migration verification failed.');
    }

    if (!writeBudgetData(serializedEnvelope)) {
        throw new Error('Browser storage is unavailable.');
    }

    const writtenPayload = await Vault.readEncryptedLocalVaultRecord(target.storage, key, { storageKey: target.key });
    if (JSON.stringify(writtenPayload) !== JSON.stringify(parsedPayload)) {
        writeBudgetData(plaintextBeforeMigration);
        throw new Error('Local vault migration readback failed.');
    }

    setLocalUpdatedAt(updatedAt);

    return {
        migrated: true,
        keyId,
        keyCreated: created,
        envelopeKind: envelope.kind,
        version: envelope.version
    };
}

export async function initStateAsync(options = {}) {
    if (!isLocalVaultStorageExperimentEnabled() || getBudgetStorage().mode !== 'app') {
        initState();
        return { mode: 'plaintext_default' };
    }

    isBrowserStorageAvailable({ refresh: true });
    await migrateBudgetDataToLocalVault(options);

    const target = getAppBudgetStorageTarget();
    const Vault = await getLocalVaultStorageModule();
    const rawValue = readStorageValue(target.storage, target.key, '');
    const classification = Vault.classifyLocalBudgetRecord(rawValue);

    if (classification.kind === 'empty') {
        console.log('[State] Engine initialized.');
        return { mode: 'encrypted_empty' };
    }

    if (classification.kind !== 'encrypted') {
        throw new Error(`Local vault init expected encrypted bb_data, found ${classification.kind}.`);
    }

    const { key, keyId } = await getLocalVaultKeyForCurrentContext(options);
    const payload = await Vault.readEncryptedLocalVaultRecord(target.storage, key, { storageKey: target.key });
    const loadedPayloadChanged = applyLoadedPayloadWithRollback(payload || {});

    if (loadedPayloadChanged) {
        await writeBudgetDataToLocalVault(getDurablePayload(), key, {
            ...options,
            keyId,
            updatedAt: new Date().toISOString()
        });
    } else if (!getLocalUpdatedAt()) {
        setLocalUpdatedAt(new Date().toISOString());
    }

    console.log('[State] Engine initialized.');
    return { mode: 'encrypted', keyId };
}

export async function saveAsync(options = {}) {
    if (!isLocalVaultStorageExperimentEnabled() || getBudgetStorage().mode !== 'app') {
        return save(options);
    }

    const { allowSignedOutWrite = false, action = '' } = options || {};
    if (!allowSignedOutWrite && !canWriteBudgetData()) {
        notifySignedOutBudgetWriteBlocked(action || 'save budget data', { toast: Boolean(action) });
        return false;
    }

    return enqueueEncryptedBudgetPersistence(getDurablePayload(), {
        ...options,
        updatedAt: new Date().toISOString()
    });
}

// ==========================================
// PERSISTENCE ENGINE
// ==========================================
export function initState() {
    isBrowserStorageAvailable({ refresh: true });
    const saved = readBudgetData();
    let loadedSavedPayload = false;
    let loadedPayloadChanged = false;
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (isLocalVaultEnvelopePayload(parsed)) {
                throw getLocalVaultDisabledEnvelopeError();
            }
            loadedPayloadChanged = applyLoadedPayload(parsed);
            loadedSavedPayload = true;
        } catch (e) {
            console.error('[State] Failed to parse local state:', e);
            if (e?.message?.includes('Encrypted local budget storage is present')) throw e;
        }
    }
    if (loadedSavedPayload) {
        if (loadedPayloadChanged) {
            try {
                if (!writeBudgetData(JSON.stringify(getDurablePayload()))) {
                    throw new Error('Browser storage is unavailable.');
                }
                setLocalUpdatedAt();
            } catch (e) {
                console.error('[State] CRITICAL: Browser storage prevented state correction on boot', e);
            }
        } else if (!getLocalUpdatedAt()) {
            try {
                setLocalUpdatedAt();
            } catch (e) {
                console.warn('[State] Could not write missing local update timestamp on boot.', e);
            }
        }
    }
    console.log('[State] Engine initialized.');
}

export function save(options = {}) {
    const { allowSignedOutWrite = false, action = '' } = options || {};
    if (!allowSignedOutWrite && !canWriteBudgetData()) {
        notifySignedOutBudgetWriteBlocked(action || 'save budget data', { toast: Boolean(action) });
        return false;
    }

    if (isLocalVaultStorageExperimentEnabled() && getBudgetStorage().mode === 'app') {
        enqueueEncryptedBudgetPersistence(getDurablePayload(), {
            ...options,
            updatedAt: new Date().toISOString()
        });
        return true;
    }

    try {
        const payload = JSON.stringify(getDurablePayload());
        if (!writeBudgetData(payload)) {
            throw new Error('Browser storage is unavailable.');
        }
        const localUpdatedAt = setLocalUpdatedAt();

        if (!suppressCloudQueue && getBudgetStorage().mode !== 'demo' && window.BuddyCloud?.queuePush) {
            window.BuddyCloud.queuePush('Budget synced to Cloud Sync.', { localUpdatedAt });
        }
        return true;
    } catch (e) {
        console.error('[State] CRITICAL: Browser storage write failed', e);
        notifyBrowserStorageBlocked();
        return false;
    }
}

export function getSnapshot() {
    return {
        transactions: state.transactions,
        categories: state.categories,
        settings: getCloudSafeSettings(),
        meta: {
            localUpdatedAt: getLocalUpdatedAt(),
            schemaVersion: 1
        }
    };
}

export function replaceSnapshot(snapshot = {}, options = {}) {
    const currentBilling = {
        isPro: state.settings.isPro,
        premiumSinceUTC: state.settings.premiumSinceUTC,
        stripeCheckoutSessionId: state.settings.stripeCheckoutSessionId,
        billingSubscriptionStatus: state.settings.billingSubscriptionStatus,
        billingCurrentPeriodEnd: state.settings.billingCurrentPeriodEnd,
        billingCancelAtPeriodEnd: state.settings.billingCancelAtPeriodEnd
    };
    const rollbackTransactions = [...state.transactions];
    const rollbackCategories = [...state.categories];
    const rollbackSettings = { ...state.settings };

    suppressCloudQueue = true;

    try {
        applyLoadedPayload({
            transactions: snapshot.transactions || [],
            categories: snapshot.categories || [],
            settings: {
                ...snapshot.settings,
                ...currentBilling
            }
        });
    } catch (e) {
        console.error('[State] CRITICAL: Failed to apply snapshot payload to memory. Rolling back memory state.', e);
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        suppressCloudQueue = false;
        throw e;
    }

    const remoteUpdatedAt = options.remoteUpdatedAt || snapshot.meta?.localUpdatedAt || new Date().toISOString();
    let queuedEncryptedSnapshotWrite = false;

    try {
        if (isLocalVaultStorageExperimentEnabled() && getBudgetStorage().mode === 'app') {
            enqueueEncryptedBudgetPersistence(getDurablePayload(), {
                ...options,
                updatedAt: remoteUpdatedAt
            });
            queuedEncryptedSnapshotWrite = true;
        } else if (!writeBudgetData(JSON.stringify(getDurablePayload()))) {
            throw new Error('Browser storage is unavailable.');
        }
    } catch (e) {
        console.error('[State] CRITICAL: Snapshot replacement failed disk write. Rolling back memory state.', e);
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        suppressCloudQueue = false;
        throw e;
    }

    if (queuedEncryptedSnapshotWrite) {
        suppressCloudQueue = false;
        return true;
    }

    try {
        setLocalUpdatedAt(remoteUpdatedAt);
    } catch (e) {
        console.warn('[State] WARNING: Snapshot written to disk, but metadata timestamp failed.', e);
    } finally {
        suppressCloudQueue = false;
    }

    return true;
}

export async function replaceSnapshotAsync(snapshot = {}, options = {}) {
    if (!isLocalVaultStorageExperimentEnabled() || getBudgetStorage().mode !== 'app') {
        replaceSnapshot(snapshot, options);
        return true;
    }

    const currentBilling = {
        isPro: state.settings.isPro,
        premiumSinceUTC: state.settings.premiumSinceUTC,
        stripeCheckoutSessionId: state.settings.stripeCheckoutSessionId,
        billingSubscriptionStatus: state.settings.billingSubscriptionStatus,
        billingCurrentPeriodEnd: state.settings.billingCurrentPeriodEnd,
        billingCancelAtPeriodEnd: state.settings.billingCancelAtPeriodEnd
    };
    const rollbackTransactions = [...state.transactions];
    const rollbackCategories = [...state.categories];
    const rollbackSettings = { ...state.settings };

    suppressCloudQueue = true;

    try {
        applyLoadedPayload({
            transactions: snapshot.transactions || [],
            categories: snapshot.categories || [],
            settings: {
                ...snapshot.settings,
                ...currentBilling
            }
        });
    } catch (e) {
        console.error('[State] CRITICAL: Failed to apply encrypted snapshot payload to memory. Rolling back memory state.', e);
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        suppressCloudQueue = false;
        throw e;
    }

    try {
        const remoteUpdatedAt = options.remoteUpdatedAt || snapshot.meta?.localUpdatedAt || new Date().toISOString();
        const saved = await enqueueEncryptedBudgetPersistence(getDurablePayload(), {
            ...options,
            updatedAt: remoteUpdatedAt
        });
        if (!saved) throw localVaultLastWriteError || new Error('Encrypted snapshot write failed.');
    } catch (e) {
        console.error('[State] CRITICAL: Encrypted snapshot replacement failed disk write. Rolling back memory state.', e);
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        suppressCloudQueue = false;
        throw e;
    } finally {
        suppressCloudQueue = false;
    }

    return true;
}

// ==========================================
// TRANSACTIONS
// ==========================================
export const getTransactions = () => state.transactions;

function normalizeTransaction(tx, fillMissingTimestamp = true) {
    const normalized = { ...(tx || {}) };
    const nowUtc = new Date().toISOString();
    const createdUtc = normalized.serverLoggedAtUTC || normalized.createdAtUTC || normalized.createdAt || (fillMissingTimestamp ? nowUtc : '');

    if (!createdUtc) return normalized;

    normalized.createdAt = normalized.createdAt || createdUtc;
    normalized.createdAtUTC = normalized.createdAtUTC || createdUtc;
    normalized.serverLoggedAtUTC = normalized.serverLoggedAtUTC || createdUtc;
    normalized.updatedAtUTC = nowUtc;

    return normalized;
}

export const addTransaction = (tx) => {
    if (!requireBudgetWriteAccess('add transaction')) return false;
    state.transactions.push(normalizeTransaction(tx));
    return save({ action: 'add transaction' });
};

export const getGiftCards = () => getMutableGiftCards()
    .filter(card => card.archived !== true)
    .map(card => ({ ...card }));

export const getAllGiftCards = () => getMutableGiftCards()
    .map(card => ({ ...card }));

function findMutableGiftCard(giftCardId) {
    return getMutableGiftCards().find(item => String(item.id) === String(giftCardId)) || null;
}

function validateGiftCardDraft(card = {}) {
    const originalAmount = Number.parseFloat(card.originalAmount ?? card.totalAmount);
    const amountLeftSource = card.amountLeft ?? card.currentBalance;
    const amountLeft = amountLeftSource === '' || amountLeftSource === undefined || amountLeftSource === null
        ? originalAmount
        : Number.parseFloat(amountLeftSource);
    const reloadable = card.reloadable === true;

    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        return { success: false, error: 'Original amount must be greater than 0.' };
    }
    if (!Number.isFinite(amountLeft) || amountLeft < 0) {
        return { success: false, error: 'Amount left must be 0 or greater.' };
    }
    if (!reloadable && amountLeft > originalAmount) {
        return { success: false, error: 'Amount left cannot exceed original amount unless the card is reloadable.' };
    }
    if (card.issuedDate && !normalizeGiftCardDate(card.issuedDate)) {
        return { success: false, error: 'Choose a valid issued date.' };
    }
    if (card.expirationDate && !normalizeGiftCardDate(card.expirationDate)) {
        return { success: false, error: 'Choose a valid expiration date.' };
    }

    return { success: true };
}

export const addGiftCard = (card = {}) => {
    if (!requireBudgetWriteAccess('add gift card')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const validation = validateGiftCardDraft(card);
    if (!validation.success) return validation;

    const normalized = normalizeGiftCard(card);

    getMutableGiftCards().push(normalized);
	    const saved = save({ action: 'add gift card' });
	    return saved ? { success: true, card: { ...normalized } } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
	};

export const updateGiftCard = (giftCardId, updates = {}) => {
    if (!requireBudgetWriteAccess('edit gift card')) return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };

    const card = findMutableGiftCard(giftCardId);
    if (!card) return { success: false, error: 'Gift card not found.' };
    if (card.archived === true) return { success: false, error: 'Archived gift cards cannot be edited.' };

    const next = {
        ...card,
        ...updates,
        id: card.id,
        createdAt: card.createdAt,
        updatedAt: new Date().toISOString()
    };
    const validation = validateGiftCardDraft(next);
    if (!validation.success) return validation;

    const normalized = normalizeGiftCard(next);
    Object.assign(card, normalized);
    const saved = save({ action: 'edit gift card' });
    return saved ? { success: true, card: { ...card } } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const archiveGiftCard = (giftCardId) => {
    if (!requireBudgetWriteAccess('archive gift card')) return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };

    const card = findMutableGiftCard(giftCardId);
    if (!card) return { success: false, error: 'Gift card not found.' };
    const nowUtc = new Date().toISOString();
    card.archived = true;
    card.archivedAt = nowUtc;
    card.updatedAt = nowUtc;
    const saved = save({ action: 'archive gift card' });
    return saved ? { success: true, card: { ...card } } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const deleteGiftCard = (giftCardId) => {
    if (!requireBudgetWriteAccess('remove gift card')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const card = findMutableGiftCard(giftCardId);
    if (!card) return { success: false, error: 'Gift card not found.' };

    const hasTransactionHistory = state.transactions.some(tx => String(tx.giftCardId || '') === String(card.id));
    if (hasTransactionHistory) return archiveGiftCard(giftCardId);

    state.settings.giftCards = getMutableGiftCards().filter(item => String(item.id) !== String(card.id));
    const saved = save({ action: 'remove gift card' });
    return saved ? { success: true } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const addTransactionWithGiftCard = (tx, giftCardId) => {
    if (!requireBudgetWriteAccess('add gift card transaction')) return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };

	    const card = findMutableGiftCard(giftCardId);
	    if (!card || card.archived === true) return { success: false, error: 'Choose an active gift card.' };

    const amount = Math.max(0, Number.parseFloat(tx?.amount) || 0);
    if (amount <= 0) return { success: false, error: 'Enter an amount greater than 0.' };
    if (amount > card.amountLeft + 0.005) {
        return { success: false, error: 'Gift card balance is too low.' };
    }

    const balanceBefore = card.amountLeft;
    const balanceAfter = Math.max(0, balanceBefore - amount);
    const nowUtc = new Date().toISOString();
    card.amountLeft = balanceAfter;
    card.updatedAt = nowUtc;

    state.transactions.push(normalizeTransaction({
        ...tx,
        paymentMethod: 'gift_card',
        giftCardId: card.id,
        giftCardName: card.displayName,
        giftCardLast4: card.lastFour || '',
        giftCardBalanceBefore: balanceBefore,
        giftCardBalanceAfter: balanceAfter
    }));

    const saved = save({ action: 'add gift card transaction' });
    return saved ? { success: true, card: { ...card } } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const saveTransactions = (txArray) => {
    if (!requireBudgetWriteAccess('save transactions')) return false;
    state.transactions = Array.isArray(txArray) ? txArray.map(normalizeTransaction) : [];
    return save({ action: 'save transactions' });
};

export const updateTransaction = (id, updates = {}) => {
    if (!requireBudgetWriteAccess('edit transaction')) return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };

    const index = state.transactions.findIndex(t => String(t.id) === String(id));
    if (index === -1) return { success: false, error: 'Transaction not found.' };

    const previous = state.transactions[index] || {};
    const next = {
        ...previous,
        ...updates,
        updatedAt: new Date().toISOString()
    };
    const previousWasGiftCard = previous.paymentMethod === 'gift_card' && previous.giftCardId;
    const nextIsGiftCard = next.paymentMethod === 'gift_card';
    const previousAmount = Math.max(0, Number.parseFloat(previous.amount) || 0);
    const nextAmount = Math.max(0, Number.parseFloat(next.amount) || 0);

    if (nextIsGiftCard && !previousWasGiftCard) {
        return { success: false, error: 'Use the Add tab to choose a tracked gift card.' };
    }

    if (previousWasGiftCard) {
        const card = findMutableGiftCard(previous.giftCardId);
        if (!card) return { success: false, error: 'Tracked gift card was not found.' };

        const restoredBalance = (Number(card.amountLeft) || 0) + previousAmount;
        const availableBeforeEdit = card.reloadable === true || card.originalAmount <= 0
            ? Math.max(0, restoredBalance)
            : Math.min(card.originalAmount, Math.max(0, restoredBalance));

        if (nextIsGiftCard) {
            if (String(next.giftCardId || '') !== String(previous.giftCardId)) {
                return { success: false, error: 'Choose the gift card from the Add tab before changing cards.' };
            }
            if (next.type !== 'expense') {
                return { success: false, error: 'Gift card tracking is for expenses.' };
            }
            if (nextAmount > availableBeforeEdit + 0.005) {
                return { success: false, error: 'Gift card balance is too low.' };
            }

            const balanceAfter = Math.max(0, availableBeforeEdit - nextAmount);
            card.amountLeft = balanceAfter;
            card.updatedAt = new Date().toISOString();
            next.giftCardName = card.displayName;
            next.giftCardLast4 = card.lastFour || '';
            next.giftCardBalanceBefore = availableBeforeEdit;
            next.giftCardBalanceAfter = balanceAfter;
        } else {
            card.amountLeft = availableBeforeEdit;
            card.updatedAt = new Date().toISOString();
            next.giftCardId = '';
            next.giftCardName = '';
            next.giftCardLast4 = '';
            delete next.giftCardBalanceBefore;
            delete next.giftCardBalanceAfter;
        }
    }

    state.transactions[index] = normalizeTransaction(next);
    const saved = save({ action: 'edit transaction' });
    return saved ? { success: true, transaction: { ...state.transactions[index] } } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const deleteTransaction = (id) => {
    if (!requireBudgetWriteAccess('delete transaction')) return false;
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (tx?.paymentMethod === 'gift_card' && tx.giftCardId && Number(tx.amount) > 0) {
        const card = findMutableGiftCard(tx.giftCardId);
        if (card) {
            const restoredBalance = (Number(card.amountLeft) || 0) + (Number(tx.amount) || 0);
            card.amountLeft = card.reloadable === true || card.originalAmount <= 0
                ? Math.max(0, restoredBalance)
                : Math.min(card.originalAmount, Math.max(0, restoredBalance));
            card.updatedAt = new Date().toISOString();
        }
    }
    state.transactions = state.transactions.filter(t => t.id !== id);
    return save({ action: 'delete transaction' });
};

// ==========================================
// CATEGORIES (v2.0 Module)
// ==========================================
export const getCategories = () => state.categories;

const CATEGORY_SORT_TYPES = new Set([
    'manual',
    'alpha_asc',
    'alpha_desc',
    'created_new',
    'created_old',
    'spending_high',
    'spending_low'
]);

const CATEGORY_REORDER_EXCLUDED_TYPES = new Set(['income', 'debt', 'savings', 'sinking_fund']);

function getValidCategorySort(type) {
    return CATEGORY_SORT_TYPES.has(type) ? type : 'manual';
}

function canReorderCategory(cat = {}) {
    return Boolean(cat?.name && !CATEGORY_REORDER_EXCLUDED_TYPES.has(cat.type));
}

function getCategoryOrderNumber(cat = {}) {
    const order = Number(cat.customOrder);
    return Number.isFinite(order) && order > 0 ? order : Number.POSITIVE_INFINITY;
}

function sortByCustomOrder(categories = state.categories) {
    const stateIndex = new Map(state.categories.map((cat, index) => [cat, index]));
    return categories.slice().sort((a, b) => {
        const orderDiff = getCategoryOrderNumber(a) - getCategoryOrderNumber(b);
        if (Number.isFinite(orderDiff) && orderDiff !== 0) return orderDiff;
        return (stateIndex.get(a) ?? 0) - (stateIndex.get(b) ?? 0);
    });
}

function normalizeCategoryCustomOrder() {
    const reorderable = state.categories.filter(canReorderCategory);
    if (reorderable.length === 0) return false;

    let changed = false;
    const ordered = sortByCustomOrder(reorderable);
    ordered.forEach((cat, index) => {
        const nextOrder = index + 1;
        if (cat.customOrder !== nextOrder) {
            cat.customOrder = nextOrder;
            changed = true;
        }
    });

    return changed;
}

function applyCustomOrderToCategoryArray() {
    const ordered = sortByCustomOrder(state.categories.filter(canReorderCategory));
    if (ordered.length === 0) return false;

    let nextReorderableIndex = 0;
    let changed = false;
    state.categories = state.categories.map(cat => {
        if (!canReorderCategory(cat)) return cat;

        const next = ordered[nextReorderableIndex];
        nextReorderableIndex += 1;
        if (next !== cat) changed = true;
        return next;
    });

    return changed;
}

function getNextCategoryCustomOrder() {
    normalizeCategoryCustomOrder();
    return state.categories
        .filter(canReorderCategory)
        .reduce((max, cat) => Math.max(max, Number(cat.customOrder) || 0), 0) + 1;
}

function commitCustomCategoryOrder(orderedReorderable) {
    orderedReorderable.forEach((cat, index) => {
        cat.customOrder = index + 1;
    });
    applyCustomOrderToCategoryArray();
    state.settings.lastCategorySort = 'manual';
    save({ action: 'reorder categories' });
}

/**
 * Validates and sanitizes category names based on v2 specs
 */
const sanitizeCategoryName = (rawName) => {
    if (!rawName) return '';
    return String(rawName).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 24);
};

export const addCategory = (rawName, icon = '📁', type = 'expense', budget = 0) => {
    const cleanName = sanitizeCategoryName(rawName);

    if (!requireBudgetWriteAccess('create category')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    if (!cleanName) {
        console.warn('[State] Invalid category name rejected.');
        return { success: false, error: 'Invalid Category Name' };
    }

    // Case-insensitive duplicate check
    const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
        console.warn('[State] Duplicate category blocked:', cleanName);
        return { success: false, error: 'Category Already Exists' };
    }

    const newCategory = {
        name: cleanName,
        icon: icon,
        type: type,
        budget: Math.max(0, parseFloat(budget) || 0),
        createdAt: new Date().toISOString()
    };
    if (canReorderCategory(newCategory)) newCategory.customOrder = getNextCategoryCustomOrder();

    state.categories.push(newCategory);

    const saved = save({ action: 'create category' });
    return saved ? { success: true, name: cleanName } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const saveCategories = (categoryArray) => {
    if (!requireBudgetWriteAccess('save categories')) return false;
    state.categories = Array.isArray(categoryArray)
        ? categoryArray.filter(Boolean).map(cat => ({ ...cat }))
        : [];
    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    return save({ action: 'save categories' });
};

export const addIncomeSource = (rawName, icon = '💵', plannedAmount = 0) => {
    if (!requireBudgetWriteAccess('create income source')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const cleanName = sanitizeCategoryName(rawName);

    if (!cleanName) {
        console.warn('[State] Invalid income source rejected.');
        return { success: false, error: 'Invalid Income Source' };
    }

    const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
        console.warn('[State] Duplicate income source blocked:', cleanName);
        return { success: false, error: 'Income Source Already Exists' };
    }

    state.categories.push({
        id: 'income_' + Date.now(),
        type: 'income',
        name: cleanName,
        icon,
        budget: Math.max(0, parseFloat(plannedAmount) || 0),
        createdAt: new Date().toISOString()
    });

    const saved = save({ action: 'create income source' });
    return saved ? { success: true, name: cleanName } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const editIncomeSource = (oldName, rawNewName, icon = '💵', plannedAmount = 0) => {
    if (!requireBudgetWriteAccess('edit income source')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const source = state.categories.find(c => c.name === oldName && c.type === 'income');
    if (!source) return { success: false, error: 'Income Source Not Found' };

    const cleanName = sanitizeCategoryName(rawNewName);
    if (!cleanName) return { success: false, error: 'Invalid Income Source' };

    if (cleanName.toLowerCase() !== oldName.toLowerCase()) {
        const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
        if (isDuplicate) return { success: false, error: 'Income Source Already Exists' };
    }

    source.name = cleanName;
    source.icon = icon || source.icon || '💵';
    source.budget = Math.max(0, parseFloat(plannedAmount) || 0);

    if (cleanName !== oldName) {
        state.transactions.forEach(tx => {
            if (tx.category === oldName && tx.type === 'income') tx.category = cleanName;
        });
    }

    const saved = save({ action: 'edit income source' });
    return saved ? { success: true, name: cleanName } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const deleteIncomeSource = (name) => {
    if (!requireBudgetWriteAccess('delete income source')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    state.categories = state.categories.filter(c => !(c.name === name && c.type === 'income'));
    state.transactions.forEach(tx => {
        if (tx.category === name && tx.type === 'income') {
            tx.category = '';
        }
    });
    const saved = save({ action: 'delete income source' });
    return saved ? { success: true } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const addSavingsGoal = (rawName, icon = '💰', targetAmount = 0) => {
    const cleanName = sanitizeCategoryName(rawName);

    if (!requireBudgetWriteAccess('create savings goal')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    if (!cleanName) {
        console.warn('[State] Invalid savings goal rejected.');
        return { success: false, error: 'Invalid Savings Goal' };
    }

    const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
        console.warn('[State] Duplicate savings goal blocked:', cleanName);
        return { success: false, error: 'Savings Goal Already Exists' };
    }

    state.categories.push({
        id: 'savings_' + Date.now(),
        type: 'savings',
        name: cleanName,
        icon,
        budget: Math.max(0, parseFloat(targetAmount) || 0),
        balance: 0,
        createdAt: new Date().toISOString()
    });

    const saved = save({ action: 'create savings goal' });
    return saved ? { success: true, name: cleanName } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const addDebtAccount = ({ name, balance, apr = 0, minPayment = 0, dueDate = '', icon = '💳' }) => {
    const cleanName = sanitizeCategoryName(name);

    if (!requireBudgetWriteAccess('create debt account')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    if (!cleanName) {
        console.warn('[State] Invalid debt name rejected.');
        return { success: false, error: 'Invalid Debt Name' };
    }

    const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
        console.warn('[State] Duplicate debt blocked:', cleanName);
        return { success: false, error: 'Debt Already Exists' };
    }

    const cleanBalance = Math.max(0, parseFloat(balance) || 0);
    state.categories.push({
        id: 'debt_' + Date.now(),
        type: 'debt',
        name: cleanName,
        icon,
        balance: cleanBalance,
        startingBalance: cleanBalance,
        apr: Math.max(0, parseFloat(apr) || 0),
        minPayment: Math.max(0, parseFloat(minPayment) || 0),
        dueDate,
        createdAt: new Date().toISOString()
    });

    const saved = save({ action: 'create debt account' });
    return saved ? { success: true, name: cleanName } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const editCategory = (oldName, rawNewName, newIcon, newType, budget) => {
    if (!requireBudgetWriteAccess('edit category')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const cat = state.categories.find(c => c.name === oldName);
    if (!cat) return { success: false, error: 'Category not found' };

    const cleanName = sanitizeCategoryName(rawNewName);
    if (!cleanName) return { success: false, error: 'Invalid Category Name' };

    // Check for duplicates if the name is being changed
    if (cleanName.toLowerCase() !== oldName.toLowerCase()) {
        const isDuplicate = state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
        if (isDuplicate) return { success: false, error: 'Category Already Exists' };
    }

    cat.name = cleanName;
    cat.icon = newIcon || cat.icon || '📁';
    if (newType) cat.type = newType;
    if (budget !== undefined) cat.budget = Math.max(0, parseFloat(budget) || 0);

    // Cascade name update to historical transactions safely
    if (cleanName !== oldName) {
        state.transactions.forEach(tx => {
            if (tx.category === oldName) tx.category = cleanName;
        });
    }

    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    const saved = save({ action: 'edit category' });
    return saved ? { success: true } : { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
};

export const deleteCategory = (name, replacement = null) => {
    if (!requireBudgetWriteAccess('delete category')) return false;
    state.categories = state.categories.filter(c => c.name !== name);

    if (replacement) {
        state.transactions.forEach(tx => {
            if (tx.category === name) tx.category = replacement;
        });
    } else {
        state.transactions.forEach(tx => {
            if (tx.category === name) tx.category = '';
        });
    }

    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    return save({ action: 'delete category' });
};

export const deleteCategoriesBatch = (nameArray) => {
    if (!Array.isArray(nameArray) || nameArray.length === 0) return;
    if (!requireBudgetWriteAccess('delete categories')) return false;
    state.categories = state.categories.filter(c => !nameArray.includes(c.name));
    state.transactions.forEach(tx => {
        if (nameArray.includes(tx.category)) tx.category = '';
    });
    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    return save({ action: 'delete categories' });
};

export const changeCategoriesIconBatch = (nameArray, newIcon) => {
    if (!Array.isArray(nameArray) || nameArray.length === 0 || !newIcon) return;
    if (!requireBudgetWriteAccess('change category icons')) return false;

    state.categories.forEach(c => {
        if (nameArray.includes(c.name)) {
            c.icon = newIcon;
        }
    });

    return save({ action: 'change category icons' });
};

export const updateCategoryBudget = (categoryName, newBudgetAmount) => {
    if (!requireBudgetWriteAccess('update category budget')) return false;
    const cat = state.categories.find(c => c.name === categoryName);
    if (cat) {
        cat.budget = newBudgetAmount;
        return save({ action: 'update category budget' });
    }
    return false;
};

export const moveCategory = (name, direction = 'down') => {
    if (!requireBudgetWriteAccess('reorder categories')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    const step = direction === 'up' ? -1 : 1;
    normalizeCategoryCustomOrder();
    const reorderable = sortByCustomOrder(state.categories.filter(canReorderCategory));
    const currentIndex = reorderable.findIndex(c => c.name === name);
    if (currentIndex < 0) {
        return { success: false, error: 'Category not found' };
    }

    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= reorderable.length) {
        return { success: false, error: 'Category cannot move farther' };
    }

    const [category] = reorderable.splice(currentIndex, 1);
    reorderable.splice(targetIndex, 0, category);
    commitCustomCategoryOrder(reorderable);
    return { success: true };
};

export const moveCategoryToPosition = (name, position = 1) => {
    if (!requireBudgetWriteAccess('reorder categories')) {
        return { success: false, error: SIGNED_OUT_WRITE_MESSAGE };
    }

    normalizeCategoryCustomOrder();
    const reorderable = sortByCustomOrder(state.categories.filter(canReorderCategory));
    const currentPosition = reorderable.findIndex(c => c.name === name);
    if (currentPosition < 0) {
        return { success: false, error: 'Category not found' };
    }

    const targetPosition = Math.min(
        reorderable.length - 1,
        Math.max(0, (parseInt(position, 10) || 1) - 1)
    );
    if (targetPosition === currentPosition) {
        return { success: true, position: currentPosition + 1 };
    }

    const [category] = reorderable.splice(currentPosition, 1);
    reorderable.splice(targetPosition, 0, category);

    commitCustomCategoryOrder(reorderable);
    return { success: true, position: targetPosition + 1 };
};

// ==========================================
// HIGH PERFORMANCE SORTING ENGINE
// ==========================================
export const getCategoriesForSort = (type = state.settings.lastCategorySort) => {
    const sortType = getValidCategorySort(type);
    const categories = state.categories.slice();

    switch(sortType) {
        case 'manual':
            return sortByCustomOrder(categories);
        case 'alpha_asc':
            return categories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        case 'alpha_desc':
            return categories.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        case 'created_new':
            return categories.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        case 'created_old':
            return categories.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        case 'spending_high':
        case 'spending_low': {
            const spendingMap = new Map(state.categories.map(c => [c.name, 0]));

            state.transactions.forEach(t => {
                if (t.type === 'expense' && spendingMap.has(t.category)) {
                    spendingMap.set(t.category, spendingMap.get(t.category) + (Number(t.amount) || 0));
                }
            });

            const direction = sortType === 'spending_high' ? -1 : 1;
            return categories.sort((a, b) => {
                const spendA = spendingMap.get(a.name) || 0;
                const spendB = spendingMap.get(b.name) || 0;
                const spendDiff = (spendA - spendB) * direction;
                if (spendDiff !== 0) return spendDiff;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        }
        default:
            return sortByCustomOrder(categories);
    }
};

export const setCategorySort = (type) => {
    if (!requireBudgetWriteAccess('change category sort')) return false;
    const nextSort = getValidCategorySort(type);
    if (state.settings.lastCategorySort === nextSort) return;
    state.settings.lastCategorySort = nextSort;
    return save({ action: 'change category sort' });
};

export const getCategorySort = () => getValidCategorySort(state.settings.lastCategorySort);

// ==========================================
// SETTINGS & RUNTIME
// ==========================================
export const getSymbol = () => state.settings.currency;
export const setSymbol = (sym) => { state.settings.currency = sym; save(); };

export const getDefaultType = () => state.settings.defaultType || 'expense';
export const setDefaultType = (val) => { state.settings.defaultType = val; save(); };

export const getDefaultPayment = () => state.settings.defaultPayment || '';
export const setDefaultPayment = (val) => { state.settings.defaultPayment = val; save(); };

export const getShowGiftCardManager = () => state.settings.showGiftCardManager !== false;
export const setShowGiftCardManager = (val) => {
    state.settings.showGiftCardManager = Boolean(val);
    save();
};

export const getSavingsGoal = () => state.settings.savingsGoal || 1000;
export const setSavingsGoal = (val) => { state.settings.savingsGoal = Math.max(1000, parseFloat(val) || 1000); save(); };
export const hasEmergencyFundGoalOverride = () => Boolean(state.settings.emergencyFundGoalOverride);
export const setEmergencyFundGoalOverride = (val) => { state.settings.emergencyFundGoalOverride = Boolean(val); save(); };
export const hasEmergencyFundInteraction = () => Boolean(state.settings.emergencyFundInteracted);
export const setEmergencyFundInteracted = (val = true) => { state.settings.emergencyFundInteracted = Boolean(val); save(); };
export const getOverrideDebtEmergencyFundLock = () => Boolean(state.settings.overrideDebtEmergencyFundLock);
export const setOverrideDebtEmergencyFundLock = (val) => { state.settings.overrideDebtEmergencyFundLock = Boolean(val); save(); };
export const setEmergencyFundGoal = (val, hasOverride = false) => {
    if (!requireBudgetWriteAccess('change emergency fund target')) return false;

    const previousGoal = state.settings.savingsGoal;
    const previousOverride = state.settings.emergencyFundGoalOverride;
    state.settings.savingsGoal = Math.max(1000, parseFloat(val) || 1000);
    state.settings.emergencyFundGoalOverride = Boolean(hasOverride);

    const saved = save({ action: 'change emergency fund target' });
    if (!saved) {
        state.settings.savingsGoal = previousGoal;
        state.settings.emergencyFundGoalOverride = previousOverride;
    }
    return saved;
};
export const getEmergencyFundMonths = () => Math.min(6, Math.max(3, parseInt(state.settings.emergencyFundMonths, 10) || 3));
export const setEmergencyFundMonths = (val) => { state.settings.emergencyFundMonths = Math.min(6, Math.max(3, parseInt(val, 10) || 3)); save(); };

export const getDashboardSummaryCollapsed = () => Boolean(state.settings.dashboardSummaryCollapsed);
export const setDashboardSummaryCollapsed = (val) => { state.settings.dashboardSummaryCollapsed = Boolean(val); save(); };

export const getTreatSavingsAsIncomeInZbb = () => Boolean(state.settings.treatSavingsAsTotalIncome);
export const setTreatSavingsAsIncomeInZbb = (val) => {
    state.settings.treatSavingsAsTotalIncome = Boolean(val);
    state.settings.treatSavingsAsIncomeInZbb = false;
    save();
};

export const getIsPro = () => Boolean(state.settings.isPro);
export const getBillingStatus = () => ({
    subscriptionStatus: state.settings.billingSubscriptionStatus || '',
    currentPeriodEnd: state.settings.billingCurrentPeriodEnd || '',
    cancelAtPeriodEnd: Boolean(state.settings.billingCancelAtPeriodEnd)
});
export const setIsPro = (val, metadata = {}) => {
    const previous = {
        isPro: Boolean(state.settings.isPro),
        premiumSinceUTC: state.settings.premiumSinceUTC || '',
        stripeCheckoutSessionId: state.settings.stripeCheckoutSessionId || '',
        billingSubscriptionStatus: state.settings.billingSubscriptionStatus || '',
        billingCurrentPeriodEnd: state.settings.billingCurrentPeriodEnd || '',
        billingCancelAtPeriodEnd: Boolean(state.settings.billingCancelAtPeriodEnd)
    };

    state.settings.isPro = Boolean(val);
    if (metadata.sessionId) state.settings.stripeCheckoutSessionId = metadata.sessionId;
    if (Object.prototype.hasOwnProperty.call(metadata, 'subscriptionStatus')) {
        state.settings.billingSubscriptionStatus = metadata.subscriptionStatus || '';
    }
    if (Object.prototype.hasOwnProperty.call(metadata, 'currentPeriodEnd')) {
        state.settings.billingCurrentPeriodEnd = metadata.currentPeriodEnd || '';
    }
    if (Object.prototype.hasOwnProperty.call(metadata, 'cancelAtPeriodEnd')) {
        state.settings.billingCancelAtPeriodEnd = Boolean(metadata.cancelAtPeriodEnd);
    }
    if (val && !state.settings.premiumSinceUTC) state.settings.premiumSinceUTC = new Date().toISOString();
    if (!val) {
        state.settings.premiumSinceUTC = '';
        state.settings.stripeCheckoutSessionId = '';
        state.settings.billingSubscriptionStatus = metadata.subscriptionStatus || '';
        state.settings.billingCurrentPeriodEnd = metadata.currentPeriodEnd || '';
        state.settings.billingCancelAtPeriodEnd = Boolean(metadata.cancelAtPeriodEnd);
    }

    const changed = previous.isPro !== Boolean(state.settings.isPro)
        || previous.premiumSinceUTC !== (state.settings.premiumSinceUTC || '')
        || previous.stripeCheckoutSessionId !== (state.settings.stripeCheckoutSessionId || '')
        || previous.billingSubscriptionStatus !== (state.settings.billingSubscriptionStatus || '')
        || previous.billingCurrentPeriodEnd !== (state.settings.billingCurrentPeriodEnd || '')
        || previous.billingCancelAtPeriodEnd !== Boolean(state.settings.billingCancelAtPeriodEnd);
    if (changed) save();
};

export const getCurrentType = () => state.currentType;
export const setCurrentType = (t) => state.currentType = t;
export const getCurrentTag = () => state.currentTag;
export const setCurrentTag = (t) => state.currentTag = t;
export const getCurrentDrilldownCat = () => state.currentDrilldownCat;
export const setCurrentDrilldownCat = (c) => state.currentDrilldownCat = c;

export const factoryReset = () => {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('bb_') || key.startsWith('zam_')) secureRemove(key);
        });
    } catch (error) {
        markBrowserStorageBlocked(error);
    }

    try {
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('bb_') || key.startsWith('zam_')) secureRemoveSession(key);
        });
    } catch {
        // If session storage is blocked, there is nothing else to clear.
    }

    window.location.reload();
};
