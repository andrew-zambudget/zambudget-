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
        dashboardSummaryCollapsed: true,
        treatSavingsAsIncomeInZbb: false,
        treatSavingsAsTotalIncome: false,
        lastCategorySort: 'alpha_asc',
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
    state.settings.treatSavingsAsTotalIncome = parsed.settings?.treatSavingsAsTotalIncome === true;
    state.settings.treatSavingsAsIncomeInZbb = false;
}

// ==========================================
// PERSISTENCE ENGINE
// ==========================================
export function initState() {
    const saved = localStorage.getItem('bb_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            applyLoadedPayload(parsed);
        } catch (e) {
            console.error('[State] Failed to parse local state:', e);
        }
    }
    if (!getLocalUpdatedAt()) setLocalUpdatedAt();
    console.log('[State] Engine initialized.');
}

export function save() {
    try {
        const localUpdatedAt = setLocalUpdatedAt();
        localStorage.setItem('bb_data', JSON.stringify(getDurablePayload()));
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
        const remoteUpdatedAt = options.remoteUpdatedAt || snapshot.meta?.localUpdatedAt || new Date().toISOString();
        setLocalUpdatedAt(remoteUpdatedAt);
        localStorage.setItem('bb_data', JSON.stringify(getDurablePayload()));
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

    state.categories.push({
        name: cleanName,
        icon: icon,
        type: type,
        budget: Math.max(0, parseFloat(budget) || 0),
        createdAt: new Date().toISOString()
    });

    save();
    return { success: true, name: cleanName };
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

    save();
};

export const deleteCategoriesBatch = (nameArray) => {
    if (!Array.isArray(nameArray) || nameArray.length === 0) return;
    state.categories = state.categories.filter(c => !nameArray.includes(c.name));
    state.transactions.forEach(tx => {
        if (nameArray.includes(tx.category)) tx.category = '';
    });
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

// ==========================================
// HIGH PERFORMANCE SORTING ENGINE
// ==========================================
export const setCategorySort = (type) => {
    state.settings.lastCategorySort = type;

    switch(type) {
        case 'alpha_asc':
            state.categories.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'alpha_desc':
            state.categories.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'created_new':
            state.categories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'created_old':
            state.categories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;

        // O(N) Pre-calculated Hash Map approach (100x faster than running filter/reduce inside sort)
        case 'spending_high':
        case 'spending_low': {
            const spendingMap = new Map();

            // Initialize map
            state.categories.forEach(c => spendingMap.set(c.name, 0));

            // Single O(N) pass to tally all spending
            state.transactions.forEach(t => {
                if (t.type === 'expense' && spendingMap.has(t.category)) {
                    spendingMap.set(t.category, spendingMap.get(t.category) + t.amount);
                }
            });

            // O(N log N) sort using the fast O(1) Map lookups
            const direction = type === 'spending_high' ? -1 : 1;
            state.categories.sort((a, b) => {
                const spendA = spendingMap.get(a.name) || 0;
                const spendB = spendingMap.get(b.name) || 0;
                return (spendA - spendB) * direction;
            });
            break;
        }
        default:
            state.categories.sort((a, b) => a.name.localeCompare(b.name));
    }
    save();
};

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
    state.settings.isPro = Boolean(val);
    if (metadata.sessionId) state.settings.stripeCheckoutSessionId = metadata.sessionId;
    if (val && !state.settings.premiumSinceUTC) state.settings.premiumSinceUTC = new Date().toISOString();
    if (!val) {
        state.settings.premiumSinceUTC = '';
        state.settings.stripeCheckoutSessionId = '';
    }
    save();
};

export const getCurrentType = () => state.currentType;
export const setCurrentType = (t) => state.currentType = t;
export const getCurrentTag = () => state.currentTag;
export const setCurrentTag = (t) => state.currentTag = t;
export const getCurrentDrilldownCat = () => state.currentDrilldownCat;
export const setCurrentDrilldownCat = (c) => state.currentDrilldownCat = c;

export const factoryReset = () => {
    localStorage.removeItem('bb_data');
    localStorage.removeItem('bb_local_updated_at');
    localStorage.removeItem('bb_cloud_sync_enabled');
    localStorage.removeItem('bb_cloud_last_pushed_at');
    localStorage.removeItem('bb_cloud_last_remote_at');
    localStorage.removeItem('bb_cloud_last_error');
    localStorage.removeItem('bb_cloud_device_id');
    Object.keys(localStorage)
        .filter(key => key.startsWith('bb_cloud_key_') || key.startsWith('bb_cloud_sync_slot_') || key.startsWith('bb_browser_access_token_') || key.startsWith('bb_cloud_recovery_key_saved_'))
        .forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('bb_skip_cat_warn');
    localStorage.removeItem('bb_skip_tx_warn');
    localStorage.removeItem('bb_sync_history');
    localStorage.removeItem('bb_pro_status');
    localStorage.removeItem('bb_premium_active');
    localStorage.removeItem('bb_stripe_checkout_session_id');
    localStorage.removeItem('bb_premium_activated_at');
    localStorage.removeItem('bb_stripe_redirect_acknowledged');
    localStorage.removeItem('bb_accent_color');
    window.location.reload();
};
