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
        stripeCheckoutSessionId: ''
    },
    // Runtime helpers
    currentType: 'expense',
    currentTag: 'transaction',
    currentDrilldownCat: null,
    selectedDate: new Date()
};

let suppressCloudQueue = false;

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
    return localStorage.getItem('bb_local_updated_at') || '';
}

function setLocalUpdatedAt(value = new Date().toISOString()) {
    localStorage.setItem('bb_local_updated_at', value);
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
        ...safeSettings
    } = settings || {};

    return safeSettings;
}

function applyLoadedPayload(parsed = {}) {
    state.transactions = (parsed.transactions || []).map(tx => normalizeTransaction(tx, false));
    state.categories = parsed.categories || [];
    state.settings = { ...state.settings, ...parsed.settings };
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
    return orderChanged || arrayChanged;
}

// ==========================================
// PERSISTENCE ENGINE
// ==========================================
export function initState() {
    const saved = localStorage.getItem('bb_data');
    let loadedSavedPayload = false;
    let loadedPayloadChanged = false;
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            loadedPayloadChanged = applyLoadedPayload(parsed);
            loadedSavedPayload = true;
        } catch (e) {
            console.error('[State] Failed to parse local state:', e);
        }
    }
    if (loadedSavedPayload) {
        if (loadedPayloadChanged) {
            try {
                localStorage.setItem('bb_data', JSON.stringify(getDurablePayload()));
                setLocalUpdatedAt();
            } catch (e) {
                console.error('[State] CRITICAL: Storage limits prevented state correction on boot', e);
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

export function save() {
    try {
        const payload = JSON.stringify(getDurablePayload());
        localStorage.setItem('bb_data', payload);
        const localUpdatedAt = setLocalUpdatedAt();

        if (!suppressCloudQueue && window.BuddyCloud?.queuePush) {
            window.BuddyCloud.queuePush('Budget synced to Buddy Cloud.', { localUpdatedAt });
        }
    } catch (e) {
        console.error('[State] CRITICAL: Storage Quota Exceeded or Write Error', e);
        if (window.showToast) window.showToast('⚠️ Storage limit reached. Cannot save data.');
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
        stripeCheckoutSessionId: state.settings.stripeCheckoutSessionId
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

    try {
        localStorage.setItem('bb_data', JSON.stringify(getDurablePayload()));
    } catch (e) {
        console.error('[State] CRITICAL: Snapshot replacement failed disk write. Rolling back memory state.', e);
        state.transactions = rollbackTransactions;
        state.categories = rollbackCategories;
        state.settings = rollbackSettings;
        suppressCloudQueue = false;
        throw e;
    }

    try {
        const remoteUpdatedAt = options.remoteUpdatedAt || snapshot.meta?.localUpdatedAt || new Date().toISOString();
        setLocalUpdatedAt(remoteUpdatedAt);
    } catch (e) {
        console.warn('[State] WARNING: Snapshot written to disk, but metadata timestamp failed.', e);
    } finally {
        suppressCloudQueue = false;
    }
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
    state.transactions.push(normalizeTransaction(tx));
    save();
};

export const saveTransactions = (txArray) => {
    state.transactions = Array.isArray(txArray) ? txArray.map(normalizeTransaction) : [];
    save();
};

export const deleteTransaction = (id) => {
    state.transactions = state.transactions.filter(t => t.id !== id);
    save();
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
    save();
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

    save();
    return { success: true, name: cleanName };
};

export const saveCategories = (categoryArray) => {
    state.categories = Array.isArray(categoryArray)
        ? categoryArray.filter(Boolean).map(cat => ({ ...cat }))
        : [];
    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    save();
};

export const addIncomeSource = (rawName, icon = '💵', plannedAmount = 0) => {
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

    save();
    return { success: true, name: cleanName };
};

export const editIncomeSource = (oldName, rawNewName, icon = '💵', plannedAmount = 0) => {
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

    save();
    return { success: true, name: cleanName };
};

export const deleteIncomeSource = (name) => {
    state.categories = state.categories.filter(c => !(c.name === name && c.type === 'income'));
    state.transactions.forEach(tx => {
        if (tx.category === name && tx.type === 'income') {
            tx.category = '';
        }
    });
    save();
    return { success: true };
};

export const addSavingsGoal = (rawName, icon = '💰', targetAmount = 0) => {
    const cleanName = sanitizeCategoryName(rawName);

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

    save();
    return { success: true, name: cleanName };
};

export const addDebtAccount = ({ name, balance, apr = 0, minPayment = 0, dueDate = '', icon = '💳' }) => {
    const cleanName = sanitizeCategoryName(name);

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

    save();
    return { success: true, name: cleanName };
};

export const editCategory = (oldName, rawNewName, newIcon, newType, budget) => {
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
    save();
    return { success: true };
};

export const deleteCategory = (name, replacement = null) => {
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
    save();
};

export const deleteCategoriesBatch = (nameArray) => {
    if (!Array.isArray(nameArray) || nameArray.length === 0) return;
    state.categories = state.categories.filter(c => !nameArray.includes(c.name));
    state.transactions.forEach(tx => {
        if (nameArray.includes(tx.category)) tx.category = '';
    });
    normalizeCategoryCustomOrder();
    applyCustomOrderToCategoryArray();
    save();
};

export const changeCategoriesIconBatch = (nameArray, newIcon) => {
    if (!Array.isArray(nameArray) || nameArray.length === 0 || !newIcon) return;

    state.categories.forEach(c => {
        if (nameArray.includes(c.name)) {
            c.icon = newIcon;
        }
    });

    save();
};

export const updateCategoryBudget = (categoryName, newBudgetAmount) => {
    const cat = state.categories.find(c => c.name === categoryName);
    if (cat) {
        cat.budget = newBudgetAmount;
        save();
    }
};

export const moveCategory = (name, direction = 'down') => {
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
    const nextSort = getValidCategorySort(type);
    if (state.settings.lastCategorySort === nextSort) return;
    state.settings.lastCategorySort = nextSort;
    save();
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

export const getSavingsGoal = () => state.settings.savingsGoal || 1000;
export const setSavingsGoal = (val) => { state.settings.savingsGoal = Math.max(1000, parseFloat(val) || 1000); save(); };
export const hasEmergencyFundGoalOverride = () => Boolean(state.settings.emergencyFundGoalOverride);
export const setEmergencyFundGoalOverride = (val) => { state.settings.emergencyFundGoalOverride = Boolean(val); save(); };
export const hasEmergencyFundInteraction = () => Boolean(state.settings.emergencyFundInteracted);
export const setEmergencyFundInteracted = (val = true) => { state.settings.emergencyFundInteracted = Boolean(val); save(); };
export const getOverrideDebtEmergencyFundLock = () => Boolean(state.settings.overrideDebtEmergencyFundLock);
export const setOverrideDebtEmergencyFundLock = (val) => { state.settings.overrideDebtEmergencyFundLock = Boolean(val); save(); };
export const setEmergencyFundGoal = (val, hasOverride = false) => {
    state.settings.savingsGoal = Math.max(1000, parseFloat(val) || 1000);
    state.settings.emergencyFundGoalOverride = Boolean(hasOverride);
    save();
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
export const setIsPro = (val, metadata = {}) => {
    const previous = {
        isPro: Boolean(state.settings.isPro),
        premiumSinceUTC: state.settings.premiumSinceUTC || '',
        stripeCheckoutSessionId: state.settings.stripeCheckoutSessionId || ''
    };

    state.settings.isPro = Boolean(val);
    if (metadata.sessionId) state.settings.stripeCheckoutSessionId = metadata.sessionId;
    if (val && !state.settings.premiumSinceUTC) state.settings.premiumSinceUTC = new Date().toISOString();
    if (!val) {
        state.settings.premiumSinceUTC = '';
        state.settings.stripeCheckoutSessionId = '';
    }

    const changed = previous.isPro !== Boolean(state.settings.isPro)
        || previous.premiumSinceUTC !== (state.settings.premiumSinceUTC || '')
        || previous.stripeCheckoutSessionId !== (state.settings.stripeCheckoutSessionId || '');
    if (changed) save();
};

export const getCurrentType = () => state.currentType;
export const setCurrentType = (t) => state.currentType = t;
export const getCurrentTag = () => state.currentTag;
export const setCurrentTag = (t) => state.currentTag = t;
export const getCurrentDrilldownCat = () => state.currentDrilldownCat;
export const setCurrentDrilldownCat = (c) => state.currentDrilldownCat = c;

export const factoryReset = () => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('bb_')) secureRemove(key);
    });

    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('bb_')) secureRemoveSession(key);
    });

    window.location.reload();
};
