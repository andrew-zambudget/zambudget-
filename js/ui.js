// js/ui.js

import * as State from './state.js';
import { esc, generateId, formatMoney, formatDate, validateCategoryName, getIconFromName } from './utils.js';

// --- State Variables ---
let rawAmountString = "";
let morphTimeout = null;
let lastSavedTxId = null;
let lastMobileCommandTab = 'income';
let mobileCommandNavInitialized = false;
let addDatePickerRequestAt = 0;
const privacyTimers = new Map();
const privacyScrambleTimers = new Map();
const PRIVACY_SCRAMBLE_INTERVAL_MS = 900;
const INCOME_INITIAL_RENDER_COUNT = 2;
const INCOME_LAZY_BATCH_SIZE = 2;
let visibleIncomeSourceCount = INCOME_INITIAL_RENDER_COUNT;
const STARTER_EMERGENCY_FUND_GOAL = 1000;
const EMERGENCY_FUND_CARD_NAME = 'Emergency Fund';
const CATEGORY_SHEET_EXPANDED_TOP_RATIO = 0.25;
const PLACEHOLDER_EXAMPLE_PREFIX = 'Example: ';
const PLACEHOLDER_ROLLOVER_CYCLE_MS = 5000;
const PLACEHOLDER_TYPE_MS = 75;
const PLACEHOLDER_BACKSPACE_MS = 35;
const PLACEHOLDER_RANDOM_SALT = 'BudgetRollover::silent-observer::f8c4b29d7a61e305';
const DESCRIPTION_ROLLOVER_MAX_LENGTH = 24;
const ADD_TX_MAX_AMOUNT = 999999999.99;
const ADD_TX_DESCRIPTION_MAX_LENGTH = 80;
const ADD_TX_NOTES_MAX_LENGTH = 54;
const ADD_TX_PAYMENT_METHODS = new Set(['', 'card', 'cash', 'bank']);
const COMMAND_TAB_NAMES = new Set(['income', 'savings', 'debt', 'add', 'calendar', 'recent']);
const EMERGENCY_FUND_RECOMMENDATION_TOLERANCE = 0.005;
const BUDDY_CLOUD_RECENT_RESTORE_PREFIX = 'bb_cloud_recent_restore_';
const BUDDY_CLOUD_MANUAL_SYNC_PREFIX = 'bb_cloud_manual_sync_at_';
const BUDDY_CLOUD_MANUAL_SYNC_COOLDOWN_MS = 60 * 1000;
let viewportRepairTimer = null;
let calendarCursorDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDateKey = '';
const DESCRIPTION_ROLLOVER_SUGGESTIONS = [
    'Rent',
    'Mortgage',
    'Property Taxes',
    'Homeowners Insurance',
    'Renters Insurance',
    'HOA Fees',
    'Home Maintenance',
    'Furniture & Decor',
    'Electricity',
    'Water & Sewer',
    'Gas / Heating Oil',
    'Trash & Recycling',
    'Internet',
    'Mobile Phone Plan',
    'Streaming Services',
    'Cable / Satellite TV',
    'Groceries',
    'Restaurants & Dining Out',
    'Fast Food',
    'Coffee Shops & Cafes',
    'Bars & Alcohol',
    'Meal Kits & Delivery',
    'Car Payment',
    'Gasoline & Fuel',
    'Car Insurance',
    'Auto Maintenance',
    'Tolls',
    'Parking Fees',
    'Public Transit',
    'Ridesharing',
    'Vehicle Registration',
    'Health Insurance',
    'Doctor Visits & Co-pays',
    'Dental Care',
    'Vision Care',
    'Prescriptions',
    'Gym Memberships',
    'Therapy & Mental Health',
    'Vitamins & Supplements',
    'Haircuts & Salon',
    'Nail Care & Spa',
    'Cosmetics & Makeup',
    'Skincare & Toiletries',
    'Clothing',
    'Shoes & Accessories',
    'Laundry & Dry Cleaning',
    'Concerts & Live Events',
    'Movies & Theater',
    'Hobbies',
    'Books & Magazines',
    'Electronics & Gadgets',
    'Sporting Goods',
    'Memberships & Clubs',
    'Credit Card Payments',
    'Student Loans',
    'Personal Loans',
    'Tax Debt / IRS Payments',
    'Child Support / Alimony',
    'Tuition',
    'Textbooks & Supplies',
    'Student Fees',
    'Online Courses',
    'Professional Dues',
    'Conferences & Workshops',
    'Daycare & Childcare',
    'Babysitting',
    'Diapers & Formula',
    "Children's Clothing",
    'School Lunches',
    'Toys & Games',
    'Extracurriculars',
    'Allowance',
    'Pet Food & Treats',
    'Veterinary Care',
    'Pet Insurance',
    'Grooming',
    'Pet Toys & Supplies',
    'Dog Walking',
    'Flights & Airfare',
    'Hotels & Airbnb',
    'Car Rentals',
    'Vacation Dining',
    'Luggage & Travel Gear',
    'Souvenirs',
    'Charitable Donations',
    'Birthday Gifts',
    'Holiday Gifts',
    'Anniversary Gifts',
    'Flowers & Cards',
    'Sinking Fund: General',
    'Cash / ATM Fees',
    'Legal Fees',
    'Bank Charges',
    'Postage & Shipping',
    'Household Supplies',
    'Software & App Purchases',
    'Unexpected Expenses'
].filter(item => item.length <= DESCRIPTION_ROLLOVER_MAX_LENGTH);
const INCOME_CELEBRATION_QUOTE_MS = 32 * 60 * 1000;
const INCOME_CELEBRATION_COLLAPSED_KEY = 'bb_income_celebration_hidden';
const INCOME_CELEBRATION_QUOTES = [
    'I have accounted for every dollar, and I am in total control of my financial future.',
    'My budget is 100% accurate, and it serves my goals perfectly.',
    'I am the master of my income; every cent has a purpose.',
    'Completing my budget gives me a sense of peace I have earned through discipline.',
    'I have mapped out my financial journey with total precision.',
    'My money is working for me because I took the time to account for 100% of it.',
    'I am disciplined, thorough, and completely aligned with my financial priorities.',
    'Every dollar accounted for is a step closer to my financial freedom.',
    'I celebrate the clarity that comes from knowing exactly where my money goes.',
    'I am proud to be a person who tracks and manages their income with 100% honesty.',
    'My budget is a reflection of my values, and I have fulfilled it completely.',
    'I have successfully closed the loop on my finances for this period.',
    'Precision in my budgeting today leads to prosperity in my future tomorrow.',
    'I am capable of managing any amount of income with this level of detail.',
    'I have reached 100% completion, and I feel empowered by my progress.',
    'My financial dashboard is a testament to my commitment and consistency.',
    'I have mastered the math of my life, and I am thriving because of it.',
    'There is no guesswork left; I have accounted for everything.',
    'I trust my ability to steward my income with complete integrity.',
    'Reaching 100% shows that I respect my own hard work.',
    'I have turned my financial chaos into an organized, powerful structure.',
    'I am a budgeter who finishes the job, no matter how complex the numbers are.',
    'My financial life is transparent, organized, and fully under my command.',
    'I celebrate this achievement of balance, knowing I am prepared for everything.',
    '100% accounted for - I am fully prepared to make this my best financial month yet.'
];
let incomeCelebrationQuoteTimer = null;
const SYNC_HISTORY_KEY = 'bb_sync_history';
const SYNC_HISTORY_VISIBLE_LIMIT = 5;
const BUDDY_CLOUD_MULTI_DEVICE_LIMIT_CODE = 'BUDDY_CLOUD_MULTI_DEVICE_LIMIT';
const BROWSER_ACCESS_TABLE = 'buddy_cloud_browser_access';
const BROWSER_ACCESS_TOKEN_PREFIX = 'bb_browser_access_token_';
const BROWSER_ACCESS_CHECK_MS = 60 * 1000;
const BROWSER_ACCESS_PRIVACY_COPY = 'Device management uses privacy-minimal BudgetBuddy browser access records: opaque browser hashes and timestamps only. No device names, user agents, IP-derived locations, or readable budget data are stored.';
let syncStatusTimer = null;
let syncObserverInitialized = false;
let browserAccessTimer = null;
let currentSyncStatus = 'local';
let currentSyncStatusMessage = 'Saved partially';
let syncStatusAlternateTimer = null;
let syncStatusAlternateKeyNeeded = false;

const NAME_MAX_LENGTH = 24;

function cleanNameInput(value) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, NAME_MAX_LENGTH);
}

function getSyncStatusLabel(status) {
    if (status === 'local') return 'Partial';
    if (status === 'syncing') return 'Partial';
    if (status === 'paused') return 'Paused';
    if (status === 'error') return navigator.onLine === false ? 'Offline' : 'Paused';
    return 'Saved';
}

function needsRecoveryKeyForSyncStatus() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    return Boolean(status.signedIn && status.enabled && !status.hasKey);
}

function getSyncStatusDisplayLabel(status = currentSyncStatus) {
    return needsRecoveryKeyForSyncStatus() && syncStatusAlternateKeyNeeded
        ? 'Recovery key needed'
        : getSyncStatusLabel(status);
}

function getSyncStatusMessage(status) {
    if (status === 'local') return 'Saved partially';
    if (status === 'syncing') return 'Saved partially';
    if (status === 'paused') return 'Buddy Cloud paused';
    if (status === 'error') return navigator.onLine === false ? 'Offline - changes saved partially' : 'Buddy Cloud paused';
    return 'Saved';
}

function applySyncStatusDisplay() {
    const button = document.getElementById('syncStatusBtn');
    const text = document.getElementById('syncStatusText');
    const badge = document.getElementById('syncHistoryStatusBadge');
    const displayLabel = getSyncStatusDisplayLabel(currentSyncStatus);
    const statusMessage = needsRecoveryKeyForSyncStatus()
        ? syncStatusAlternateKeyNeeded
            ? 'Recovery key needed'
            : 'Saved partially'
        : currentSyncStatusMessage || getSyncStatusMessage(currentSyncStatus);

    if (button) {
        button.setAttribute('aria-label', `Buddy Cloud sync status: ${statusMessage}. Open sync history.`);
        button.dataset.syncTooltip = statusMessage;
        if (!isSyncHistoryPanelOpen()) button.dataset.tooltip = statusMessage;
    }
    if (text) text.textContent = statusMessage;
    if (badge) badge.textContent = displayLabel;
}

function syncRecoveryKeyStatusAlternation() {
    if (!needsRecoveryKeyForSyncStatus()) {
        syncStatusAlternateKeyNeeded = false;
        if (syncStatusAlternateTimer) {
            clearInterval(syncStatusAlternateTimer);
            syncStatusAlternateTimer = null;
        }
        applySyncStatusDisplay();
        return;
    }

    if (!syncStatusAlternateTimer) {
        syncStatusAlternateTimer = setInterval(() => {
            if (!needsRecoveryKeyForSyncStatus()) {
                syncRecoveryKeyStatusAlternation();
                return;
            }
            syncStatusAlternateKeyNeeded = !syncStatusAlternateKeyNeeded;
            applySyncStatusDisplay();
        }, 2200);
    }
    applySyncStatusDisplay();
}

function isPausedSyncMessage(message = '') {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('free tier allows')
        || normalized.includes('device limit')
        || normalized.includes('local and cloud changes')
        || normalized.includes('competing saved versions')
        || normalized.includes('review saved versions')
        || normalized.includes('use this browser instead');
}

function getSyncHistory() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SYNC_HISTORY_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveSyncHistory(events) {
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(events.slice(0, SYNC_HISTORY_VISIBLE_LIMIT)));
}

function formatSyncTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--:--';
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function getSafeSyncEventStatus(status) {
    return ['synced', 'local', 'syncing', 'error', 'paused'].includes(status) ? status : 'local';
}

function getSyncEventStatusTooltip(status) {
    if (status === 'synced') return 'Success';
    if (status === 'syncing') return 'Informational';
    if (status === 'error') return 'Failed';
    return 'Warning';
}

function renderSyncHistory() {
    const list = document.getElementById('syncHistoryList');
    const badge = document.getElementById('syncHistoryStatusBadge');
    const history = getSyncHistory();

    if (list) {
        list.innerHTML = history.length
            ? history.slice(0, SYNC_HISTORY_VISIBLE_LIMIT).map(event => {
                const eventStatus = getSafeSyncEventStatus(event.status);
                const eventMessage = event.message || 'Local data saved.';
                return `
                <div class="sync-history-item sync-history-item-${eventStatus}">
                    <span class="sync-history-time">${esc(formatSyncTime(event.time))}</span>
                    <span class="sync-history-event"><span class="sync-history-status-dot sync-history-status-dot-${eventStatus}" data-tooltip="${esc(getSyncEventStatusTooltip(eventStatus))}" aria-label="${esc(getSyncEventStatusTooltip(eventStatus))}" tabindex="0"></span><span class="sync-history-event-text">${esc(eventMessage)}</span></span>
                </div>
            `}).join('')
            : '<div class="sync-history-empty">No sync activity yet.</div>';
    }

    if (badge) {
        const status = currentSyncStatus || history[0]?.status || 'synced';
        badge.className = `sync-history-badge sync-history-badge-${status}`;
        badge.textContent = getSyncStatusDisplayLabel(status);
    }

    syncCloudActionButtons();
}

function getManualSyncCloudIconHtml() {
    return `
        <span class="sync-cloud-manual-cloud" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M17.5 19H8a5 5 0 0 1-.86-9.93A6.5 6.5 0 0 1 19.42 11.5H20a3.75 3.75 0 0 1 0 7.5h-2.5"></path>
            </svg>
        </span>
    `;
}

function renderManualSyncButtonSyncing(button) {
    if (!button) return;
    button.classList.add('is-syncing');
    button.innerHTML = getManualSyncCloudIconHtml();
    button.setAttribute('aria-label', 'Buddy Cloud is syncing.');
}

function syncCloudActionButtons() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const signedIn = Boolean(status.signedIn);
    const enabled = Boolean(status.enabled);
    const syncing = Boolean(status.syncing);
    const isPremium = Boolean(status.isPremium || State.getIsPro?.());
    const hasConflict = hasBuddyCloudConflict(status);
    const freeLimit = Number(status.freeDeviceLimit || status.syncSlotLimit || 2);
    const usedFreeSlots = signedIn && enabled
        ? Math.max(1, Math.min(Number(status.syncSlotDeviceCount) || 1, freeLimit))
        : 0;
    const humanStatus = getBuddyCloudHumanStatus(status);
    const enableBtn = document.getElementById('syncEnableBtn');
    const keyBtn = document.getElementById('syncKeyBtn');
    const manualBtn = document.getElementById('syncManualBtn');
    const actions = document.getElementById('syncCloudActions');
    const nudge = document.getElementById('syncCloudNudge');
    const deviceCount = document.getElementById('syncDeviceCountFineprint');

    if (actions) {
        actions.classList.toggle('is-cloud-active', signedIn && enabled);
    }

    if (enableBtn) {
        const shouldHideEnable = signedIn && enabled;
        enableBtn.hidden = shouldHideEnable;
        enableBtn.textContent = signedIn ? 'Set Up' : 'Sign In';
        enableBtn.disabled = shouldHideEnable || syncing;
    }
    if (keyBtn) {
        const canUseRecoveryKeyAction = signedIn && enabled;
        keyBtn.textContent = !canUseRecoveryKeyAction
            ? 'Recovery Key'
            : !status.hasKey
            ? 'Import Key'
            : !hasRecoveryKeyBackedUpFlag()
            ? 'Save Key'
            : isRecoveryKeyDisplayUnlocked()
            ? 'Recovery Key'
            : 'Unlock Key';
        keyBtn.disabled = !canUseRecoveryKeyAction || syncing;
    }
    if (manualBtn) {
        const canShowManualSync = signedIn && enabled;
        const canUseManualSync = canShowManualSync && Boolean(status.hasKey) && Boolean(status.canUseCloud) && !syncing;
        manualBtn.hidden = !canShowManualSync;
        manualBtn.classList.toggle('is-syncing', syncing);
        if (syncing) {
            renderManualSyncButtonSyncing(manualBtn);
        } else {
            manualBtn.textContent = hasConflict ? 'Review versions' : 'Sync now';
        }
        manualBtn.disabled = !canUseManualSync;
        manualBtn.setAttribute('aria-label', syncing
            ? 'Buddy Cloud is syncing.'
            : hasConflict
            ? 'Review saved Buddy Cloud versions before sync continues.'
            : 'Manually check Buddy Cloud sync status.');
    }
    if (deviceCount) {
        deviceCount.textContent = isPremium
            ? 'Premium - Unlimited syncs'
            : signedIn && enabled
            ? `Free - Device ${usedFreeSlots} of ${freeLimit}`
            : signedIn
            ? `Free - Device 0 of ${freeLimit}`
            : `Free - ${freeLimit} devices included`;
        deviceCount.removeAttribute('data-tooltip');
        deviceCount.setAttribute('aria-label', deviceCount.textContent);
        deviceCount.removeAttribute('tabindex');
    }

    if (nudge) {
        if (enabled && signedIn) {
            const showKeyReminder = needsRecoveryKeySaveReminder();
            const grace = getRecoveryKeyGraceState();
            const nudgeSeverity = showKeyReminder && grace.expired
                ? 'error'
                : showKeyReminder
                ? 'warning'
                : humanStatus.severity;
            nudge.classList.toggle('is-synced', nudgeSeverity === 'synced');
            nudge.classList.toggle('is-warning', nudgeSeverity === 'warning');
            nudge.classList.toggle('is-error', nudgeSeverity === 'error');
            nudge.innerHTML = `
                <span class="sync-cloud-lock" role="img" tabindex="0" aria-label="Encrypted with AES-GCM-256">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <rect x="5" y="10" width="14" height="10" rx="2"></rect>
                        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
                    </svg>
                </span>
                <span class="sync-cloud-lock-tooltip" role="tooltip"><span class="sync-cloud-lock-tooltip-encrypted">Encrypted</span> with <span class="sync-cloud-lock-tooltip-cipher">AES-GCM-256</span></span>
                <div class="sync-cloud-nudge-title">${showKeyReminder && grace.expired ? 'Recovery key not saved' : esc(humanStatus.title)}</div>
                <p>${showKeyReminder
                    ? grace.expired
                        ? 'Save your recovery key before relying on Buddy Cloud as your backup. If this browser is lost or cleared, we cannot recover your encrypted cloud budget.'
                        : `Save your recovery key within ${formatGraceHours(grace.remainingMs)}. Signing out or clearing this browser removes local key access.`
                    : esc(humanStatus.detail)}</p>
            `;
        } else if (signedIn) {
            nudge.classList.remove('is-synced', 'is-warning', 'is-error');
            nudge.innerHTML = `
                <div class="sync-cloud-nudge-title">${esc(humanStatus.title)}</div>
                <p>${esc(humanStatus.detail)}</p>
            `;
        } else {
            nudge.classList.remove('is-synced', 'is-warning', 'is-error');
            nudge.innerHTML = `
                <div class="sync-cloud-nudge-title">${esc(humanStatus.title)}</div>
                <p>${esc(humanStatus.detail)}</p>
            `;
        }
    }

    syncAccountRecoveryUi();
}

function getBuddyCloudTierTooltip(isPremium = Boolean(State.getIsPro?.()), freeLimit = 2) {
    return isPremium
        ? 'Premium Tier includes unlimited Buddy Cloud device syncs, encrypted backup, recovery tools, and version history.'
        : `Free Tier includes ${freeLimit} active Buddy Cloud synced browsers. Premium unlocks unlimited Buddy Cloud device syncs.`;
}

function isSyncHistoryPanelOpen() {
    const panel = document.getElementById('syncHistoryPanel');
    return Boolean(panel && !panel.hidden && panel.classList.contains('is-open'));
}

function positionSyncHistoryPanel() {
    const panel = document.getElementById('syncHistoryPanel');
    const anchor = document.getElementById('syncStatusBtn');
    if (!panel) return;

    const anchorRect = anchor?.getBoundingClientRect?.();
    const headerRect = document.querySelector('.app-header')?.getBoundingClientRect?.();
    const top = headerRect ? headerRect.bottom + 8 : (anchorRect ? anchorRect.bottom + 8 : 72);
    const right = anchorRect ? Math.max(12, window.innerWidth - anchorRect.right) : 12;

    panel.style.setProperty('--sync-menu-top', `${Math.round(top)}px`);
    panel.style.setProperty('--sync-menu-right', `${Math.round(right)}px`);
}

function setSyncStatusTooltipSuppressed(suppressed) {
    const button = document.getElementById('syncStatusBtn');
    if (!button) return;

    button.classList.toggle('is-panel-open', Boolean(suppressed));
    if (suppressed) {
        button.removeAttribute('data-tooltip');
        return;
    }

    const tooltip = button.dataset.syncTooltip || getSyncStatusMessage(currentSyncStatus);
    if (tooltip) button.dataset.tooltip = tooltip;
}

function setSyncStatus(status = 'local', message = '') {
    const requestedStatus = status === 'error' && navigator.onLine !== false && isPausedSyncMessage(message)
        ? 'paused'
        : status;
    const safeStatus = ['synced', 'local', 'syncing', 'error', 'paused'].includes(requestedStatus) ? requestedStatus : 'local';
    currentSyncStatus = safeStatus;
    const statusMessage = message || getSyncStatusMessage(safeStatus);
    currentSyncStatusMessage = statusMessage;
    const button = document.getElementById('syncStatusBtn');
    const text = document.getElementById('syncStatusText');

    if (button) {
        button.classList.remove('sync-status-synced', 'sync-status-local', 'sync-status-syncing', 'sync-status-error', 'sync-status-paused');
        button.classList.add(`sync-status-${safeStatus}`);
        button.setAttribute('aria-label', `Buddy Cloud sync status: ${statusMessage}. Open sync history.`);
        button.dataset.syncTooltip = statusMessage;
        if (isSyncHistoryPanelOpen()) {
            button.removeAttribute('data-tooltip');
        } else {
            button.dataset.tooltip = statusMessage;
        }
    }
    if (text) text.textContent = statusMessage;

    renderSyncHistory();
    syncRecoveryKeyStatusAlternation();
}

function recordSyncEvent(message, status = 'local') {
    const requestedStatus = status === 'error' && navigator.onLine !== false && isPausedSyncMessage(message)
        ? 'paused'
        : status;
    const safeStatus = ['synced', 'local', 'syncing', 'error', 'paused'].includes(requestedStatus) ? requestedStatus : 'local';
    const nextHistory = [{
        id: generateId(),
        time: new Date().toISOString(),
        status: safeStatus,
        message: message || getSyncStatusMessage(safeStatus)
    }, ...getSyncHistory()];

    saveSyncHistory(nextHistory);
    setSyncStatus(safeStatus, safeStatus === 'syncing' ? getSyncStatusMessage(safeStatus) : message);
}

function observeLocalSave(message = 'Saved partially.') {
    clearTimeout(syncStatusTimer);
    setSyncStatus('local', 'Saved partially');
    syncStatusTimer = setTimeout(() => {
        if (navigator.onLine === false) {
            recordSyncEvent('Offline - changes saved partially.', 'error');
        } else if (window.BuddyCloud?.getStatus?.().enabled) {
            recordSyncEvent('Saved partially. Buddy Cloud backup pending.', 'local');
        } else {
            recordSyncEvent(message, 'local');
        }
    }, 360);
}

function initSyncObserver() {
    if (syncObserverInitialized) return;
    syncObserverInitialized = true;

    if (getSyncHistory().length === 0) {
        recordSyncEvent(navigator.onLine === false ? 'Offline - changes saved partially.' : 'Saved partially.', navigator.onLine === false ? 'error' : 'local');
    } else {
        setSyncStatus(navigator.onLine === false ? 'error' : 'local', navigator.onLine === false ? 'Offline - changes saved partially' : 'Saved partially');
    }

    window.addEventListener('offline', () => {
        recordSyncEvent('Device offline. Changes remain partially saved until Buddy Cloud verifies backup.', 'error');
    });
    window.addEventListener('online', () => {
        recordSyncEvent('Back online. Buddy Cloud backup pending.', 'local');
    });
}

window.closeSyncHistoryPanel = function() {
    const panel = document.getElementById('syncHistoryPanel');
    const button = document.getElementById('syncStatusBtn');
    if (!panel) return;

    panel.hidden = true;
    panel.classList.remove('is-open', 'is-highlighted');
    panel.setAttribute('aria-hidden', 'true');
    panel.style.removeProperty('--sync-menu-top');
    panel.style.removeProperty('--sync-menu-right');
    if (button) button.setAttribute('aria-expanded', 'false');
    setSyncStatusTooltipSuppressed(false);
};

window.openSyncHistoryPanel = function(event) {
    event?.stopPropagation?.();
    const panel = document.getElementById('syncHistoryPanel');
    const button = document.getElementById('syncStatusBtn');
    if (!panel) return;

    const shouldOpen = panel.hidden || !panel.classList.contains('is-open');
    if (!shouldOpen) {
        window.closeSyncHistoryPanel();
        return;
    }

    renderSyncHistory();
    positionSyncHistoryPanel();
    panel.hidden = false;
    panel.classList.add('is-open', 'is-highlighted');
    panel.setAttribute('aria-hidden', 'false');
    panel.tabIndex = -1;
    if (button) button.setAttribute('aria-expanded', 'true');
    setSyncStatusTooltipSuppressed(true);
    requestAnimationFrame(() => {
        positionSyncHistoryPanel();
        try {
            panel.focus({ preventScroll: true });
        } catch {
            panel.focus();
        }
    });
    setTimeout(() => panel.classList.remove('is-highlighted'), 900);
};

document.addEventListener('click', (event) => {
    const panel = document.getElementById('syncHistoryPanel');
    if (!panel || panel.hidden) return;
    if (event.target.closest?.('.sync-status-wrap')) return;
    window.closeSyncHistoryPanel();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const panel = document.getElementById('syncHistoryPanel');
    if (!panel || panel.hidden) return;
    window.closeSyncHistoryPanel();
    document.getElementById('syncStatusBtn')?.focus();
});

window.addEventListener('resize', () => {
    if (isSyncHistoryPanelOpen()) positionSyncHistoryPanel();
});

window.recordSyncEvent = recordSyncEvent;
window.observeLocalSave = observeLocalSave;
window.setSyncStatus = setSyncStatus;

window.addEventListener('buddy-cloud-status', (event) => {
    const status = event.detail || {};
    const humanStatus = getBuddyCloudHumanStatus(status);
    if (status.syncing) {
        setSyncStatus('syncing', humanStatus.title);
    } else if (isBuddyCloudMultiDeviceLimit(status) || hasBuddyCloudConflict(status)) {
        setSyncStatus('paused', humanStatus.title);
    } else if (status.enabled && status.signedIn && !status.hasKey) {
        setSyncStatus('local', 'Saved partially');
    } else if (status.lastError) {
        setSyncStatus('error', humanStatus.title);
    } else if (status.enabled && status.signedIn) {
        setSyncStatus('synced', humanStatus.title);
    } else {
        setSyncStatus(navigator.onLine === false ? 'error' : 'local', navigator.onLine === false ? 'Offline - changes saved partially' : humanStatus.title);
    }
    syncCloudActionButtons();
});

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    return false;
}

const RECOVERY_KEY_CLIPBOARD_CLEAR_MS = 60000;
const RECOVERY_KEY_SAVED_PREFIX = 'bb_cloud_recovery_key_saved_';
const RECOVERY_KEY_BACKED_UP_PREFIX = 'bb_cloud_recovery_key_backed_up_';
const RECOVERY_KEY_GRACE_STARTED_PREFIX = 'bb_cloud_recovery_key_grace_started_';
const RECOVERY_KEY_UNLOCK_PREFIX = 'bb_cloud_recovery_key_unlocked_until_';
const BUDDY_CLOUD_DEFAULT_SETUP_PREFIX = 'bb_cloud_default_setup_attempted_';
const RECOVERY_KEY_GRACE_MS = 72 * 60 * 60 * 1000;
const RECOVERY_KEY_UNLOCK_MS = 5 * 60 * 1000;
let recoveryKeyClipboardClearTimer = null;
let recoveryKeyUnlockTimer = null;
let recoveryKeyCountdownTimer = null;

function getRecoveryKeySavedFlagName() {
    return window.currentUser?.id ? `${RECOVERY_KEY_SAVED_PREFIX}${window.currentUser.id}` : '';
}

function getRecoveryKeyBackedUpFlagName() {
    return window.currentUser?.id ? `${RECOVERY_KEY_BACKED_UP_PREFIX}${window.currentUser.id}` : '';
}

function getRecoveryKeyGraceStartedName() {
    return window.currentUser?.id ? `${RECOVERY_KEY_GRACE_STARTED_PREFIX}${window.currentUser.id}` : '';
}

function getRecoveryKeyUnlockName() {
    return window.currentUser?.id ? `${RECOVERY_KEY_UNLOCK_PREFIX}${window.currentUser.id}` : '';
}

function getBuddyCloudDefaultSetupAttemptName() {
    return window.currentUser?.id ? `${BUDDY_CLOUD_DEFAULT_SETUP_PREFIX}${window.currentUser.id}` : '';
}

function hasAttemptedBuddyCloudDefaultSetup() {
    const keyName = getBuddyCloudDefaultSetupAttemptName();
    if (!keyName) return true;
    try {
        return sessionStorage.getItem(keyName) === 'true';
    } catch {
        return false;
    }
}

function markBuddyCloudDefaultSetupAttempted() {
    const keyName = getBuddyCloudDefaultSetupAttemptName();
    if (!keyName) return;
    try {
        sessionStorage.setItem(keyName, 'true');
    } catch {
        // Session storage can be unavailable in some hardened browsers.
    }
}

function markRecoveryKeySaved() {
    const keyName = getRecoveryKeySavedFlagName();
    if (keyName) localStorage.setItem(keyName, 'true');
    const graceName = getRecoveryKeyGraceStartedName();
    if (graceName) localStorage.removeItem(graceName);
}

function hasRecoveryKeySavedFlag() {
    const keyName = getRecoveryKeySavedFlagName();
    return Boolean(keyName && localStorage.getItem(keyName) === 'true');
}

function markRecoveryKeyBackedUp() {
    const keyName = getRecoveryKeyBackedUpFlagName();
    if (keyName) localStorage.setItem(keyName, 'true');
    markRecoveryKeySaved();
}

function hasRecoveryKeyBackedUpFlag() {
    const keyName = getRecoveryKeyBackedUpFlagName();
    return Boolean(keyName && localStorage.getItem(keyName) === 'true');
}

function isRecoveryKeyDisplayUnlocked() {
    const keyName = getRecoveryKeyUnlockName();
    if (!keyName) return false;
    try {
        const unlockedUntil = Number(sessionStorage.getItem(keyName) || 0);
        return unlockedUntil > Date.now();
    } catch {
        return false;
    }
}

function maskEmailForSecurity(email = '') {
    const clean = String(email || '').trim();
    const [name = '', domain = ''] = clean.split('@');
    if (!name || !domain) return 'your email';
    const maskedName = name.length <= 2
        ? `${name.charAt(0)}*`
        : `${name.charAt(0)}${'*'.repeat(Math.min(name.length - 2, 4))}${name.charAt(name.length - 1)}`;
    return `${maskedName}@${domain}`;
}

function closeOpenRecoveryKeyDisplayModal() {
    const modal = document.getElementById('buddyCloudModal');
    if (modal?.querySelector('.buddy-cloud-recovery-key-display-modal')) {
        closeBuddyCloudModal({ action: 'locked', value: '' });
    }
}

function getRecoveryKeyUnlockedUntil() {
    const keyName = getRecoveryKeyUnlockName();
    try {
        return keyName ? Number(sessionStorage.getItem(keyName) || 0) : 0;
    } catch {
        return 0;
    }
}

function formatRecoveryKeyCountdown(ms = 0) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function stopRecoveryKeyCountdown() {
    window.clearInterval(recoveryKeyCountdownTimer);
    recoveryKeyCountdownTimer = null;
}

function startRecoveryKeyCountdown(modal) {
    stopRecoveryKeyCountdown();
    const countdown = modal?.querySelector('[data-recovery-key-countdown]');
    const bar = modal?.querySelector('.buddy-cloud-key-countdown-bar span');
    if (!countdown || !bar) return;

    const render = () => {
        const remainingMs = Math.max(0, getRecoveryKeyUnlockedUntil() - Date.now());
        countdown.textContent = formatRecoveryKeyCountdown(remainingMs);
        const percent = Math.max(0, Math.min(100, (remainingMs / RECOVERY_KEY_UNLOCK_MS) * 100));
        bar.style.width = `${percent}%`;
        if (!remainingMs) {
            stopRecoveryKeyCountdown();
        }
    };

    render();
    recoveryKeyCountdownTimer = window.setInterval(render, 1000);
}

function scheduleRecoveryKeyAutoLock() {
    window.clearTimeout(recoveryKeyUnlockTimer);
    const unlockedUntil = getRecoveryKeyUnlockedUntil();
    const remainingMs = Math.max(0, unlockedUntil - Date.now());
    if (!remainingMs) return;
    recoveryKeyUnlockTimer = window.setTimeout(() => {
        lockRecoveryKeyDisplay({ silent: true });
        closeOpenRecoveryKeyDisplayModal();
        syncCloudActionButtons();
    }, remainingMs + 250);
}

function unlockRecoveryKeyDisplay() {
    const keyName = getRecoveryKeyUnlockName();
    if (!keyName) return;
    try {
        sessionStorage.setItem(keyName, String(Date.now() + RECOVERY_KEY_UNLOCK_MS));
        scheduleRecoveryKeyAutoLock();
        syncCloudActionButtons();
    } catch {
        // Session storage can be unavailable in some hardened browsers.
    }
}

function lockRecoveryKeyDisplay(options = {}) {
    const keyName = getRecoveryKeyUnlockName();
    if (!keyName) return;
    try {
        sessionStorage.removeItem(keyName);
        window.clearTimeout(recoveryKeyUnlockTimer);
        recoveryKeyUnlockTimer = null;
        stopRecoveryKeyCountdown();
        closeOpenRecoveryKeyDisplayModal();
        if (!options.silent) syncCloudActionButtons();
    } catch {
        // Session storage can be unavailable in some hardened browsers.
    }
}

async function authorizeRecoveryKeyDisplayWithLocalUnlock() {
    if (isRecoveryKeyDisplayUnlocked()) return true;

    const result = await showBuddyCloudModal({
        eyebrow: 'Account Security',
        title: 'Unlock Recovery Key?',
        body: 'Local unlock is a temporary v1 guardrail.',
        assurance: 'The key stays local. BudgetBuddy still cannot read your synced budget.',
        inputLabel: 'Type UNLOCK to continue',
        inputPlaceholder: 'UNLOCK',
        inputSingleLine: true,
        inputAutoUppercase: true,
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'unlock', label: 'Unlock Key', className: 'btn-create', persistent: true }
        ],
        onAction: ({ action, value, input }) => {
            if (action !== 'unlock') return false;
            if (value.toUpperCase() === 'UNLOCK') return false;

            if (input) {
                input.classList.remove('buddy-cloud-input-error', 'buddy-cloud-input-shake');
                void input.offsetWidth;
                input.classList.add('buddy-cloud-input-error', 'buddy-cloud-input-shake');
                input.focus({ preventScroll: true });
                window.setTimeout(() => input.classList.remove('buddy-cloud-input-shake'), 420);
                window.setTimeout(() => input.classList.remove('buddy-cloud-input-error'), 1400);
            }
            if (window.showToast) window.showToast('Type UNLOCK to view the recovery key.');
            return true;
        }
    });

    if (result.action === 'unlock' && result.value.toUpperCase() === 'UNLOCK') {
        unlockRecoveryKeyDisplay();
        return true;
    }

    if (result.action === 'unlock' && window.showToast) {
        window.showToast('Type UNLOCK to view the recovery key.');
    }
    return false;
}

function canUseSupabaseRecoveryKeyReauth() {
    return Boolean(
        window.currentUser?.email
        && window.sb?.auth?.reauthenticate
        && window.sb?.auth?.verifyOtp
    );
}

async function authorizeRecoveryKeyDisplayWithSupabase() {
    if (!canUseSupabaseRecoveryKeyReauth()) return false;

    const email = window.currentUser.email;
    try {
        const { error } = await window.sb.auth.reauthenticate();
        if (error) throw error;
    } catch (error) {
        console.warn('[Buddy Cloud] Recovery key re-auth request failed:', error);
        return false;
    }

    const result = await showBuddyCloudModal({
        eyebrow: 'Account Security',
        title: 'Verify Login',
        body: `Enter the one-time code sent to ${maskEmailForSecurity(email)}.`,
        assurance: 'This unlocks recovery-key display on this browser.',
        warning: 'This is a v1 reveal guardrail. v1.1 will add PIN/passkey-protected local key storage.',
        inputLabel: 'One-time code',
        inputPlaceholder: '123456',
        inputSingleLine: true,
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'verify', label: 'Verify Login', className: 'btn-create' }
        ]
    });

    if (result.action !== 'verify') return false;
    const token = String(result.value || '').trim();
    if (!token) {
        if (window.showToast) window.showToast('Enter the verification code to unlock the recovery key.');
        return false;
    }

    try {
        const { error } = await window.sb.auth.verifyOtp({
            email,
            token,
            type: 'reauthentication'
        });
        if (error) throw error;
        unlockRecoveryKeyDisplay();
        return true;
    } catch (error) {
        console.warn('[Buddy Cloud] Recovery key re-auth verify failed:', error);
        if (window.showToast) window.showToast('Could not verify login code. Use local unlock for now.');
        return false;
    }
}

async function authorizeRecoveryKeyDisplay() {
    if (isRecoveryKeyDisplayUnlocked()) return true;
    const reauthOk = await authorizeRecoveryKeyDisplayWithSupabase();
    if (reauthOk) return true;
    return authorizeRecoveryKeyDisplayWithLocalUnlock();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecoveryKeyDisplayUnlocked()) {
        lockRecoveryKeyDisplay({ silent: true });
    }
});

window.addEventListener('pagehide', () => {
    if (isRecoveryKeyDisplayUnlocked()) {
        lockRecoveryKeyDisplay({ silent: true });
    }
});

function startRecoveryKeyGracePeriod() {
    const keyName = getRecoveryKeyGraceStartedName();
    if (keyName && !localStorage.getItem(keyName)) {
        localStorage.setItem(keyName, new Date().toISOString());
    }
}

function getRecoveryKeyGraceState() {
    const keyName = getRecoveryKeyGraceStartedName();
    const startedAt = keyName ? localStorage.getItem(keyName) || '' : '';
    const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;

    if (!startedAt || Number.isNaN(startedMs)) {
        return {
            startedAt: '',
            expired: false,
            remainingMs: RECOVERY_KEY_GRACE_MS
        };
    }

    const elapsedMs = Math.max(0, Date.now() - startedMs);
    return {
        startedAt,
        expired: elapsedMs >= RECOVERY_KEY_GRACE_MS,
        remainingMs: Math.max(0, RECOVERY_KEY_GRACE_MS - elapsedMs)
    };
}

function formatGraceHours(ms) {
    const hours = Math.ceil(Math.max(0, ms) / (60 * 60 * 1000));
    if (hours <= 1) return 'less than 1 hour';
    return `${hours} hours`;
}

function needsRecoveryKeySaveReminder() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const needsReminder = Boolean(status.signedIn && status.enabled && status.hasKey && !hasRecoveryKeySavedFlag());
    if (needsReminder) startRecoveryKeyGracePeriod();
    return needsReminder;
}

function resetRecoveryKeyCopyButtonLabels() {
    document.querySelectorAll('#buddyCloudModal .buddy-cloud-action[data-action="copy"]').forEach(button => {
        button.textContent = 'Copy Key';
        button.classList.remove('is-copied');
    });
}

function markRecoveryKeyCopyButtonCopied(button) {
    if (!button) return;
    button.textContent = 'Copy Key - Copied';
    button.classList.add('is-copied');
}

function scheduleRecoveryKeyClipboardClear(recoveryKey) {
    clearTimeout(recoveryKeyClipboardClearTimer);
    recoveryKeyClipboardClearTimer = setTimeout(async () => {
        try {
            if (!navigator.clipboard?.readText || !navigator.clipboard?.writeText) return;
            const currentText = await navigator.clipboard.readText();
            if (currentText === recoveryKey) {
                await navigator.clipboard.writeText('');
            }
        } catch {
            // Clipboard reads can be blocked by the browser; never overwrite blindly.
        } finally {
            resetRecoveryKeyCopyButtonLabels();
        }
    }, RECOVERY_KEY_CLIPBOARD_CLEAR_MS);
}

async function copyRecoveryKeyToClipboard(recoveryKey) {
    const copied = await copyTextToClipboard(recoveryKey);
    if (copied) scheduleRecoveryKeyClipboardClear(recoveryKey);
    return copied;
}

async function downloadRecoveryKeyFile(recoveryKey) {
    const filename = `BudgetBuddy_Recovery_Key_${new Date().toISOString().slice(0, 10)}.txt`;
    const body = [
        'BudgetBuddy Buddy Cloud Recovery Key',
        '',
        'Keep this key private. It decrypts your synced BudgetBuddy cloud vault on another device.',
        'If you lose this key and no signed-in device still has access, BudgetBuddy cannot recover your synced budget.',
        '',
        recoveryKey,
        ''
    ].join('\n');
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BUDDY_CLOUD_MODAL_TRANSITION_MS = 180;

function getBuddyCloudModalTransitionMs() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 0
        : BUDDY_CLOUD_MODAL_TRANSITION_MS;
}

function closeBuddyCloudModal(result = { action: 'cancel', value: '' }) {
    const modal = document.getElementById('buddyCloudModal');
    if (!modal || modal._closing) return;

    modal._closing = true;
    modal.classList.add('closing');
    modal.querySelectorAll('.buddy-cloud-action, .buddy-cloud-close').forEach(button => {
        button.disabled = true;
    });

    window.setTimeout(() => {
        if (modal._resolve) modal._resolve(result);
        modal.remove();
    }, getBuddyCloudModalTransitionMs());
}

function showBuddyCloudModal({
    title,
    eyebrow = 'Buddy Cloud Sync',
    body = '',
    assurance = '',
    warning = '',
    detailRows = [],
    compact = false,
    inputLabel = '',
    inputPlaceholder = '',
    inputValue = '',
    inputReadonly = false,
    inputRevealable = false,
    selectLabel = '',
    selectOptions = [],
    customHtml = '',
    modalClass = '',
    inputSingleLine = false,
    inputAutoUppercase = false,
    actions = [],
    onAction = null,
    onReady = null
}) {
    document.getElementById('buddyCloudModal')?.remove();

    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'buddyCloudModal';
        modal.className = 'modal-overlay buddy-cloud-modal-overlay';
        modal._resolve = resolve;

        const modalActions = actions.length ? actions : customHtml ? [] : [{ id: 'ok', label: 'OK', className: 'btn-create' }];
        const actionButtons = modalActions
            .map(action => `
                <button type="button" class="${esc(action.className || 'btn-cancel')} buddy-cloud-action" data-action="${esc(action.id)}" data-persistent="${action.persistent ? 'true' : 'false'}">
                    ${esc(action.label)}
                </button>
            `).join('');
        const actionsSection = actionButtons ? `
            <div class="modal-actions buddy-cloud-modal-actions">
                ${actionButtons}
            </div>
        ` : '';

        const keyField = inputLabel ? `
            <label class="buddy-cloud-key-field">
                <span>${esc(inputLabel)}</span>
                ${inputRevealable ? `
                    <div class="buddy-cloud-key-control">
                        <input id="buddyCloudModalInput" type="password" ${inputReadonly ? 'readonly' : ''} placeholder="${esc(inputPlaceholder)}" value="${esc(inputValue)}" autocomplete="off" spellcheck="false">
                        <button type="button" class="buddy-cloud-key-toggle" aria-label="Click to reveal recovery key" data-tooltip="Click to reveal" aria-pressed="false">
                            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                                <path class="eye-open" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path>
                                <circle class="eye-open" cx="12" cy="12" r="3"></circle>
                                <path class="eye-hidden" d="M3 3l18 18"></path>
                                <path class="eye-hidden" d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6"></path>
                                <path class="eye-hidden" d="M6.5 6.7C3.7 8.5 2 12 2 12s3.5 6 10 6c1.6 0 3-.35 4.2-.9"></path>
                                <path class="eye-hidden" d="M17.5 17.3C20.3 15.5 22 12 22 12s-3.5-6-10-6c-1.6 0-3 .35-4.2.9"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="buddy-cloud-key-note" aria-live="polite">Click the eye to reveal.</div>
                ` : inputSingleLine ? `
                    <input id="buddyCloudModalInput" class="${inputAutoUppercase ? 'buddy-cloud-uppercase-input' : ''}" type="text" ${inputReadonly ? 'readonly' : ''} placeholder="${esc(inputPlaceholder)}" value="${esc(inputValue)}" autocomplete="off" autocapitalize="characters" spellcheck="false">
                ` : `
                    <textarea id="buddyCloudModalInput" ${inputReadonly ? 'readonly' : ''} placeholder="${esc(inputPlaceholder)}">${esc(inputValue)}</textarea>
                `}
            </label>
        ` : '';
        const selectField = selectLabel && Array.isArray(selectOptions) && selectOptions.length ? `
            <label class="buddy-cloud-select-field">
                <span>${esc(selectLabel)}</span>
                <select id="buddyCloudModalSelect">
                    ${selectOptions.map(option => `
                        <option value="${esc(option.value || '')}">${esc(option.label || '')}</option>
                    `).join('')}
                </select>
            </label>
        ` : '';
        const detailList = Array.isArray(detailRows) && detailRows.length ? `
            <div class="buddy-cloud-review-grid">
                ${detailRows.map(row => `
                    <div class="buddy-cloud-review-row">
                        <span>${esc(row.label || '')}</span>
                        <strong>${esc(row.value || '')}</strong>
                    </div>
                `).join('')}
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="modal-box modal-box-medium buddy-cloud-modal${compact ? ' buddy-cloud-modal-compact' : ''}${modalClass ? ` ${esc(modalClass)}` : ''}" role="dialog" aria-modal="true" aria-labelledby="buddyCloudModalTitle" onclick="event.stopPropagation()">
                <button type="button" class="modal-close buddy-cloud-close" aria-label="Close Buddy Cloud dialog">&times;</button>
                <div class="buddy-cloud-modal-header">
                    <div class="buddy-cloud-modal-icon" aria-hidden="true">BC</div>
                    <div>
                        <div class="sync-history-kicker">${esc(eyebrow)}</div>
                        <h3 id="buddyCloudModalTitle" class="modal-title">${esc(title)}</h3>
                    </div>
                </div>
                ${body ? `<p class="buddy-cloud-modal-copy">${esc(body)}</p>` : ''}
                ${assurance ? `<div class="buddy-cloud-assurance">${esc(assurance)}</div>` : ''}
                ${detailList}
                ${customHtml && !inputLabel ? customHtml : ''}
                ${selectField}
                ${warning ? `<div class="warning-box buddy-cloud-warning"><p>${esc(warning)}</p></div>` : ''}
                ${keyField}
                ${customHtml && inputLabel ? customHtml : ''}
                ${actionsSection}
            </div>
        `;

        const finish = (result) => closeBuddyCloudModal(result);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) finish({ action: 'cancel', value: '' });
        });
        modal.querySelector('.buddy-cloud-close')?.addEventListener('click', () => finish({ action: 'cancel', value: '' }));
        const setRecoveryKeyVisible = (visible) => {
            const input = modal.querySelector('#buddyCloudModalInput');
            const toggle = modal.querySelector('.buddy-cloud-key-toggle');
            if (!input || !toggle) return;
            input.type = visible ? 'text' : 'password';
            toggle.classList.toggle('is-visible', visible);
            toggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
            toggle.setAttribute('aria-label', visible ? 'Click to hide recovery key' : 'Click to reveal recovery key');
            toggle.setAttribute('data-tooltip', visible ? 'Click to hide' : 'Click to reveal');
            const note = modal.querySelector('.buddy-cloud-key-note');
            if (note && !note.dataset.locked) note.textContent = visible ? 'Click the eye to hide.' : 'Click the eye to reveal.';
        };
        modal.querySelector('.buddy-cloud-key-toggle')?.addEventListener('click', () => {
            const input = modal.querySelector('#buddyCloudModalInput');
            setRecoveryKeyVisible(input?.type === 'password');
        });
        if (inputAutoUppercase) {
            modal.querySelector('#buddyCloudModalInput')?.addEventListener('input', (event) => {
                const input = event.currentTarget;
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.toUpperCase();
                input.setSelectionRange?.(start, end);
            });
        }
        modal.querySelectorAll('.buddy-cloud-action').forEach(button => {
            button.addEventListener('click', async () => {
                const input = modal.querySelector('#buddyCloudModalInput');
                const select = modal.querySelector('#buddyCloudModalSelect');
                const result = {
                    action: button.dataset.action || 'ok',
                    value: input ? input.value.trim() : select ? select.value : ''
                };
                button.classList.add('is-activating');
                button.setAttribute('aria-busy', 'true');
                button.closest('.buddy-cloud-device-row')?.classList.add('is-leaving');
                if (button.dataset.persistent === 'true') {
                    const handled = await onAction?.({ ...result, modal, button, input, setRecoveryKeyVisible });
                    if (handled !== false) {
                        button.classList.remove('is-activating');
                        button.removeAttribute('aria-busy');
                        button.closest('.buddy-cloud-device-row')?.classList.remove('is-leaving');
                        return;
                    }
                }
                finish(result);
            });
        });

        document.body.appendChild(modal);
        requestAnimationFrame(() => {
            modal.classList.add('active');
            requestAnimationFrame(() => {
                onReady?.({ modal });
                const input = modal.querySelector('#buddyCloudModalInput');
                const select = modal.querySelector('#buddyCloudModalSelect');
                if (input && !inputReadonly) {
                    input.focus({ preventScroll: true });
                } else if (select) {
                    select.focus({ preventScroll: true });
                } else {
                    modal.querySelector('.buddy-cloud-action')?.focus({ preventScroll: true });
                }
            });
        });
    });
}

async function askForRecoveryKey() {
    const result = await showBuddyCloudModal({
        title: 'Enter Recovery Key',
        modalClass: 'buddy-cloud-recovery-key-modal',
        body: 'Enter your Buddy Cloud recovery key to unlock this browser.',
        assurance: 'The key stays local. BudgetBuddy cannot read your synced budget.',
        warning: 'Use only on a trusted device.',
        inputLabel: 'Recovery key',
        inputPlaceholder: 'Paste your Buddy Cloud recovery key',
        customHtml: '<div class="buddy-cloud-key-confirm-error" data-recovery-key-error hidden></div>',
        actions: [
            { id: 'cancel', label: 'Cancel', className: 'btn-cancel' },
            { id: 'recovery-help', label: 'Recovery Help', className: 'btn-cancel' },
            { id: 'reset-cloud', label: 'Reset Buddy Cloud', className: 'btn-danger' },
            { id: 'import', label: 'Import Key', className: 'btn-create', persistent: true }
        ],
        onAction: ({ action, value, modal, input }) => {
            if (action !== 'import') return false;
            const pastedKey = String(value || '').trim();
            if (pastedKey) return false;

            const error = modal?.querySelector('[data-recovery-key-error]');
            if (error) {
                error.hidden = false;
                error.textContent = 'Paste your recovery key to continue.';
            }
            if (input) {
                input.classList.remove('buddy-cloud-input-shake');
                input.classList.add('buddy-cloud-input-error', 'buddy-cloud-input-shake');
                input.focus({ preventScroll: true });
                window.setTimeout(() => input.classList.remove('buddy-cloud-input-shake'), 450);
            }
            if (window.showToast) window.showToast('Paste your recovery key to continue.');
            return true;
        },
        onReady: ({ modal }) => {
            const input = modal?.querySelector('#buddyCloudModalInput');
            const error = modal?.querySelector('[data-recovery-key-error]');
            input?.addEventListener('input', () => {
                input.classList.remove('buddy-cloud-input-error');
                if (error) error.hidden = true;
            });
        }
    });

    if (result.action === 'recovery-help') {
        await handleBuddyCloudRecoveryHelp();
        return '';
    }

    if (result.action === 'reset-cloud') {
        await handleDeleteAccount();
        return '';
    }

    return result.action === 'import' ? result.value : '';
}

function formatBuddyCloudReviewTime(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function getBuddyCloudHumanStatus(status = window.BuddyCloud?.getStatus?.() || {}) {
    const signedIn = Boolean(status.signedIn);
    const enabled = Boolean(status.enabled);
    const hasKey = Boolean(status.hasKey);
    const lastError = String(status.lastError || '').trim();
    const lastVerifiedAt = status.lastRemoteAt || status.lastPushedAt || '';
    const lastVerifiedText = formatBuddyCloudReviewTime(lastVerifiedAt);

    if (!signedIn) {
        return {
            severity: 'local',
            title: 'Sign in to protect this budget',
            detail: 'This budget is saved only in this browser. Sign in to enable encrypted Buddy Cloud backup.',
            recommendedNextStep: 'Sign in to protect this budget with Buddy Cloud.'
        };
    }

    if (!enabled) {
        return {
            severity: 'local',
            title: 'Buddy Cloud setup needed',
            detail: 'This budget is saved only in this browser. Sign in to protect it with encrypted Buddy Cloud backup.',
            recommendedNextStep: 'Sign in to protect this budget with Buddy Cloud.'
        };
    }

    if (!status.canUseCloud) {
        return {
            severity: 'error',
            title: 'Buddy Cloud cannot connect',
            detail: 'The browser is signed in, but the cloud client is unavailable. Refresh and check the Supabase configuration.',
            recommendedNextStep: 'Refresh the app, then export diagnostics if this continues.'
        };
    }

    if (!hasKey) {
        return {
            severity: 'error',
            title: 'Recovery key required',
            detail: 'Import your recovery key to reconnect this browser to Buddy Cloud.',
            recommendedNextStep: 'Import your saved recovery key, or reset Buddy Cloud if the key is permanently lost.'
        };
    }

    if (isBuddyCloudMultiDeviceLimit(status)) {
        const freeLimit = Number(status.freeDeviceLimit || status.syncSlotLimit || 2);
        return {
            severity: 'warning',
            title: 'Free device limit reached',
            detail: `Free Tier allows ${freeLimit} active synced browsers. Upgrade for unlimited syncs or replace an existing Free device.`,
            recommendedNextStep: 'Open Devices and choose Upgrade or Use This Browser Instead.'
        };
    }

    if (hasBuddyCloudConflict(status)) {
        return {
            severity: 'warning',
            title: 'Review saved versions',
            detail: 'Buddy Cloud found both local and cloud changes. Choose which encrypted version to keep before sync continues.',
            recommendedNextStep: 'Open Devices and review the version timestamps.'
        };
    }

    if (status.syncing) {
        return {
            severity: 'warning',
            title: 'Verifying encrypted backup',
            detail: 'Buddy Cloud is checking or updating the encrypted vault for this browser.',
            recommendedNextStep: 'Keep the app open until the status returns to Saved.'
        };
    }

    if (lastError) {
        return {
            severity: 'error',
            title: 'Buddy Cloud needs attention',
            detail: lastError,
            recommendedNextStep: 'Open Recovery Help or export diagnostics if the same error repeats.'
        };
    }

    return {
        severity: 'synced',
        title: status.isPremium ? 'Buddy Cloud active - unlimited syncs' : 'Buddy Cloud active - Free Tier',
        detail: lastVerifiedAt
            ? `Encrypted backup verified. Last verified sync: ${lastVerifiedText}.`
            : 'Encrypted backup is active. Keep your recovery key somewhere safe for another trusted device.',
        recommendedNextStep: needsRecoveryKeySaveReminder()
            ? 'Save your recovery key.'
            : 'No action needed.'
    };
}

function getBuddyCloudRecoveryRows(status = window.BuddyCloud?.getStatus?.() || {}) {
    const humanStatus = getBuddyCloudHumanStatus(status);
    const recommendedStep = status.signedIn && status.enabled && !status.hasKey
        ? 'Import your saved recovery key'
        : humanStatus.recommendedNextStep;
    return [
        { label: 'Current status', value: humanStatus.title },
        { label: 'Recommended step', value: recommendedStep },
        { label: 'Recovery key here', value: status.hasKey ? 'Present locally' : 'Not present' },
        { label: 'Recovery key backup', value: hasRecoveryKeyBackedUpFlag() ? 'Verified' : 'Not verified' },
        { label: 'Last verified sync', value: formatBuddyCloudReviewTime(status.lastRemoteAt || status.lastPushedAt || '') }
    ];
}

function getBuddyCloudReviewDetails(details = {}) {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const remoteUpdatedAt = details.remoteUpdatedAt || status.conflictRemoteAt || status.lastRemoteAt || '';
    const localUpdatedAt = details.localUpdatedAt || status.conflictLocalAt || localStorage.getItem('bb_local_updated_at') || '';
    const lastSyncedAt = details.lastSyncedAt
        || status.conflictLastSyncedAt
        || status.lastPushedAt
        || status.lastRemoteAt
        || '';

    return {
        remoteUpdatedAt,
        localUpdatedAt,
        lastSyncedAt,
        remoteTime: formatBuddyCloudReviewTime(remoteUpdatedAt),
        localTime: formatBuddyCloudReviewTime(localUpdatedAt),
        lastSyncedTime: formatBuddyCloudReviewTime(lastSyncedAt)
    };
}

function getBuddyCloudReviewRows(details = {}) {
    const review = getBuddyCloudReviewDetails(details);

    return [
        { label: 'Buddy Cloud changed', value: review.remoteTime },
        { label: 'Local copy changed', value: review.localTime },
        { label: 'Last verified sync', value: review.lastSyncedTime }
    ];
}

function buildBuddyCloudConflictComparisonHtml(details = {}) {
    const review = getBuddyCloudReviewDetails(details);

    return `
        <section class="buddy-cloud-conflict-compare" aria-label="Saved version comparison">
            <div class="buddy-cloud-conflict-head">
                <strong>Compare changes</strong>
                <span>Choose which encrypted version should continue.</span>
            </div>
            <div class="buddy-cloud-conflict-options">
                <div class="buddy-cloud-conflict-card is-recommended">
                    <div class="buddy-cloud-conflict-card-title">
                        <span>Buddy Cloud Version</span>
                        <em>Recommended</em>
                    </div>
                    <small>Changed</small>
                    <strong>${esc(review.remoteTime)}</strong>
                </div>
                <div class="buddy-cloud-conflict-card">
                    <div class="buddy-cloud-conflict-card-title">
                        <span>Local Copy</span>
                    </div>
                    <small>Changed</small>
                    <strong>${esc(review.localTime)}</strong>
                </div>
            </div>
            <div class="buddy-cloud-conflict-sync">
                <span>Last verified sync</span>
                <strong>${esc(review.lastSyncedTime)}</strong>
            </div>
        </section>
    `;
}

async function chooseBuddyCloudSource(details = {}) {
    const result = await showBuddyCloudModal({
        title: 'Review Saved Versions',
        body: 'Buddy Cloud found both local and cloud changes. Choose which encrypted version to keep before sync continues.',
        assurance: 'No readable budget data is sent to BudgetBuddy during this choice. The selected copy is decrypted or encrypted locally in your browser.',
        customHtml: buildBuddyCloudConflictComparisonHtml(details),
        actions: [
            { id: 'cancel', label: 'Cancel', className: 'btn-cancel' },
            { id: 'local', label: 'Local Copy', className: 'btn-cancel buddy-cloud-choice-secondary' },
            { id: 'remote', label: 'Buddy Cloud Version', className: 'btn-create buddy-cloud-choice-primary' }
        ]
    });

    return ['remote', 'local'].includes(result.action) ? result.action : '';
}

function normalizeRecoveryKeyForConfirm(value = '') {
    return String(value || '').replace(/\s+/g, '');
}

async function confirmRecoveryKeySaved(recoveryKey) {
    const expectedKey = normalizeRecoveryKeyForConfirm(recoveryKey);
    const result = await showBuddyCloudModal({
        title: 'Important: We Cannot Recover This Key',
        modalClass: 'buddy-cloud-recovery-key-modal buddy-cloud-recovery-key-confirm-modal',
        body: 'Your Recovery Key protects your synced budget. Save it somewhere private before continuing.',
        warning: 'Paste the key below to confirm you saved it. If you lose this key and no signed-in device still has access, your synced budget cannot be recovered by us.',
        inputLabel: 'Paste your Recovery Key here to continue',
        inputPlaceholder: 'Paste the recovery key you just saved',
        customHtml: '<div class="buddy-cloud-key-confirm-error" data-key-confirm-error hidden></div>',
        actions: [
            { id: 'back', label: 'Back', className: 'btn-cancel' },
            { id: 'confirm', label: 'I saved my Recovery Key', className: 'btn-create buddy-cloud-action-nowrap', persistent: true }
        ],
        onAction: ({ action, value, modal }) => {
            if (action !== 'confirm') return false;

            const error = modal?.querySelector('[data-key-confirm-error]');
            const pastedKey = normalizeRecoveryKeyForConfirm(value);
            if (pastedKey && pastedKey === expectedKey) {
                markRecoveryKeyBackedUp();
                if (window.showToast) window.showToast('Recovery key saved.');
                return false;
            }

            if (error) {
                error.hidden = false;
                error.textContent = pastedKey
                    ? 'That does not match this Recovery Key. Paste the key you just saved.'
                    : 'Paste your Recovery Key to continue.';
            }
            if (window.showToast) window.showToast('Paste the matching Recovery Key to continue.');
            return true;
        }
    });

    if (result.action === 'back') return 'back';
    return result.action === 'confirm' && hasRecoveryKeyBackedUpFlag() ? 'confirmed' : 'cancel';
}

async function showRecoveryKeyNotice(recoveryKey, { copied = false, initial = false, requireDownload = false } = {}) {
    let keyCopied = copied;
    let keyDownloaded = hasRecoveryKeyBackedUpFlag();

    while (true) {
    const result = await showBuddyCloudModal({
        title: initial ? 'Save Your Recovery Key' : 'Recovery Key',
        modalClass: !initial && !requireDownload ? 'buddy-cloud-recovery-key-display-modal' : '',
        body: initial
            ? 'Buddy Cloud is enabled. This recovery key is required to decrypt your cloud budget on another device.'
            : 'This recovery key decrypts your Buddy Cloud budget on another device; your budget is encrypted before upload.',
        assurance: initial ? 'Detailed privacy protections are covered in the Privacy Policy.' : '',
        warning: requireDownload
            ? 'Download this recovery key before continuing. If you lose this key and no signed-in device still has access, we cannot recover your synced budget.'
            : keyCopied
            ? 'The key was copied to your clipboard. It will be cleared in about 60 seconds if it still contains this key. Store it somewhere private. If you lose this key and no signed-in device still has access, we cannot recover your synced budget.'
            : 'Store this key somewhere private. If you lose this key and no signed-in device still has access, we cannot recover your synced budget.',
        customHtml: !initial && !requireDownload ? `
            <div class="buddy-cloud-key-countdown" role="status" aria-live="polite">
                <span>Key display locks in</span>
                <strong data-recovery-key-countdown>${formatRecoveryKeyCountdown(Math.max(0, getRecoveryKeyUnlockedUntil() - Date.now()))}</strong>
                <div class="buddy-cloud-key-countdown-bar" aria-hidden="true"><span></span></div>
            </div>
        ` : '',
        inputLabel: 'Recovery key',
        inputValue: recoveryKey,
        inputReadonly: true,
        inputRevealable: true,
        actions: [
            { id: 'download', label: 'Download Key', className: 'btn-cancel', persistent: true },
            { id: 'copy', label: 'Copy Key', className: 'btn-cancel', persistent: true },
            { id: 'done', label: 'I saved my Recovery Key', className: 'btn-create buddy-cloud-action-nowrap', persistent: requireDownload },
            ...(!initial && !requireDownload ? [{ id: 'lock-key', label: 'Lock Key', className: 'btn-cancel', persistent: true }] : [])
        ],
        onAction: async ({ action, modal, button, setRecoveryKeyVisible }) => {
            const note = modal?.querySelector('.buddy-cloud-key-note');
            const setNote = (message) => {
                if (note) {
                    note.dataset.locked = 'true';
                    note.textContent = message;
                }
            };

            if (action === 'copy') {
                keyCopied = await copyRecoveryKeyToClipboard(recoveryKey);
                if (keyCopied) {
                    markRecoveryKeyCopyButtonCopied(button);
                } else {
                    resetRecoveryKeyCopyButtonLabels();
                }
                setRecoveryKeyVisible?.(false);
                setNote(keyCopied
                    ? 'Copied. Clipboard clears in about 60 seconds if it still contains this key.'
                    : 'Clipboard copy was not available. Use Download Key instead.');
                if (window.showToast) window.showToast(keyCopied ? 'Recovery key copied.' : 'Clipboard copy was not available.');
                return true;
            }

            if (action === 'download') {
                await downloadRecoveryKeyFile(recoveryKey);
                keyDownloaded = true;
                keyCopied = await copyRecoveryKeyToClipboard(recoveryKey);
                setRecoveryKeyVisible?.(false);
                setNote(keyCopied
                    ? 'Downloaded and copied. Clipboard clears in about 60 seconds if it still contains this key.'
                    : 'Downloaded. Clipboard copy was not available.');
                if (window.showToast) window.showToast(keyCopied ? 'Recovery key downloaded and copied.' : 'Recovery key downloaded.');
                return true;
            }

            if (action === 'done') {
                if (requireDownload && !keyDownloaded) {
                    setRecoveryKeyVisible?.(false);
                    setNote('Download the recovery key before continuing. This prevents losing access after this browser is cleared.');
                    if (window.showToast) window.showToast('Download the recovery key before continuing.');
                    return true;
                }
                return false;
            }

            if (action === 'lock-key') {
                lockRecoveryKeyDisplay();
                setRecoveryKeyVisible?.(false);
                if (window.showToast) window.showToast('Recovery key display locked.');
                return false;
            }

            return false;
        },
        onReady: ({ modal }) => {
            if (!initial && !requireDownload) startRecoveryKeyCountdown(modal);
        }
    });

    if (result.action === 'done') {
        const confirmResult = await confirmRecoveryKeySaved(recoveryKey);
        if (confirmResult === 'back') continue;
        return confirmResult === 'confirmed';
    }
    return hasRecoveryKeyBackedUpFlag();
    }
}

async function confirmBuddyCloudDownload() {
    const result = await showBuddyCloudModal({
        title: 'Buddy Cloud Version?',
        body: 'BudgetBuddy will save this local copy as an encrypted safety snapshot, then decrypt and use the cloud version locally.',
        assurance: 'The cloud vault remains encrypted with our cloud provider. Decryption happens only on this device with your recovery key.',
        detailRows: getBuddyCloudReviewRows(),
        warning: 'Use this unless you know the local copy has newer changes.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'download', label: 'Buddy Cloud Version', className: 'btn-create buddy-cloud-choice-primary' }
        ]
    });

    return result.action === 'download';
}

async function confirmBuddyCloudUpload() {
    const result = await showBuddyCloudModal({
        title: 'Local Copy?',
        body: 'This will encrypt the local saved version and replace the current encrypted cloud version.',
        assurance: 'BudgetBuddy still cannot read the budget contents. Encryption happens locally before upload.',
        detailRows: getBuddyCloudReviewRows(),
        warning: 'Only use this if you know what you are doing.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'upload', label: 'Local Copy', className: 'btn-danger buddy-cloud-choice-secondary' }
        ]
    });

    return result.action === 'upload';
}

function isBuddyCloudMultiDeviceLimit(errorOrStatus = {}) {
    const message = String(errorOrStatus?.message || errorOrStatus?.lastError || '').toLowerCase();
    return errorOrStatus?.code === BUDDY_CLOUD_MULTI_DEVICE_LIMIT_CODE
        || Boolean(errorOrStatus?.syncSlotBlocked)
        || message.includes('active synced browser');
}

function getBuddyCloudSyncSlotRows(details = {}) {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const freeLimit = Number(details.slotLimit || details.freeDeviceLimit || status.freeDeviceLimit || status.syncSlotLimit || 2);
    const usedSlots = Number(details.slotCount || status.syncSlotDeviceCount || freeLimit);
    return [
        {
            label: 'Free device slots',
            value: `${Math.min(Math.max(usedSlots || freeLimit, 0), freeLimit)} of ${freeLimit}`
        },
        {
            label: 'Oldest slot started',
            value: formatBuddyCloudReviewTime(details.slotClaimedAt || status.syncSlotClaimedAt || '')
        },
        {
            label: 'Oldest slot last seen',
            value: formatBuddyCloudReviewTime(details.slotLastSeenAt || status.syncSlotLastSeenAt || '')
        }
    ];
}

async function confirmBuddyCloudSyncSlotTransfer(details = {}) {
    const freeLimit = Number(details.slotLimit || details.freeDeviceLimit || window.BuddyCloud?.getStatus?.()?.freeDeviceLimit || 2);
    const result = await showBuddyCloudModal({
        eyebrow: 'Buddy Cloud Sync Plus',
        title: 'Multi-Device Sync Plus',
        body: `Free Tier includes ${freeLimit} active synced browsers. This account has reached that limit.`,
        assurance: 'Budget contents remain encrypted. BudgetBuddy does not store device names, user agents, IP-derived locations, or readable budget data for this limit.',
        detailRows: getBuddyCloudSyncSlotRows(details),
        warning: 'Use This Browser Instead replaces the oldest Free device slot with this browser. That browser will stop syncing until it is made active again.',
        actions: [
            { id: 'cancel', label: 'Cancel', className: 'btn-cancel' },
            { id: 'upgrade', label: 'Upgrade', className: 'btn-create' },
            { id: 'replace-slot', label: 'Use This Browser Instead', className: 'btn-danger' }
        ]
    });

    return result.action;
}

function getApproxByteRange(value = '') {
    const bytes = new Blob([String(value || '')]).size;
    if (bytes === 0) return '0 bytes';
    if (bytes < 10 * 1024) return '<10 KB';
    if (bytes < 50 * 1024) return '10-50 KB';
    if (bytes < 250 * 1024) return '50-250 KB';
    if (bytes < 1024 * 1024) return '250 KB-1 MB';
    if (bytes < 5 * 1024 * 1024) return '1-5 MB';
    return '>5 MB';
}

function getBrowserDiagnosticSummary() {
    if (navigator.userAgentData?.brands) {
        return {
            brands: navigator.userAgentData.brands.map(item => ({
                brand: item.brand,
                majorVersion: String(item.version || '').split('.')[0] || ''
            })),
            platform: navigator.userAgentData.platform || 'unknown'
        };
    }

    return {
        brands: [],
        platform: 'not collected'
    };
}

function encodeBrowserAccessBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getBrowserAccessKeyName() {
    return window.currentUser?.id ? `${BROWSER_ACCESS_TOKEN_PREFIX}${window.currentUser.id}` : '';
}

function getOrCreateBrowserAccessToken() {
    const keyName = getBrowserAccessKeyName();
    if (!keyName) return '';

    const existing = localStorage.getItem(keyName);
    if (existing) return existing;

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = encodeBrowserAccessBase64Url(bytes);
    localStorage.setItem(keyName, token);
    return token;
}

async function getBrowserAccessHash() {
    if (!crypto?.subtle) return '';
    const token = getOrCreateBrowserAccessToken();
    if (!token) return '';

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return encodeBrowserAccessBase64Url(new Uint8Array(digest));
}

function getBrowserAccessLabel(browserHash = '', currentHash = '') {
    if (browserHash && browserHash === currentHash) return 'This browser';
    const suffix = String(browserHash || '').slice(0, 6).toUpperCase() || 'UNKNOWN';
    return `Browser ${suffix}`;
}

function isBrowserAccessActive(row = {}) {
    if (row.revoked_at) return false;
    const lastSeenMs = new Date(row.last_seen_at || row.created_at || '').getTime();
    if (Number.isNaN(lastSeenMs)) return true;
    return Date.now() - lastSeenMs < 30 * 24 * 60 * 60 * 1000;
}

function formatBrowserAccessStatus(row = {}) {
    if (row.revoked_at) return `Revoked ${formatBuddyCloudReviewTime(row.revoked_at)}`;
    if (!row.last_seen_at) return 'Active status unknown';
    return `Last seen ${formatBuddyCloudReviewTime(row.last_seen_at)}`;
}

function getBrowserAccessErrorMessage(error) {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();
    if (
        code === 'PGRST205'
        || code === 'PGRST204'
        || message.includes(BROWSER_ACCESS_TABLE)
        || message.toLowerCase().includes('schema cache')
    ) {
        return 'Device management is not ready yet. Apply supabase/migrations/202606100005_buddy_cloud_browser_access.sql in Supabase, then retry.';
    }
    return message || 'Device management is temporarily unavailable.';
}

async function getCurrentBrowserAccessContext() {
    if (!window.currentUser?.id || !window.sb?.from || !crypto?.subtle) {
        return { available: false, currentHash: '', rows: [], error: '' };
    }

    const currentHash = await getBrowserAccessHash();
    if (!currentHash) return { available: false, currentHash: '', rows: [], error: '' };

    const now = new Date().toISOString();
    const { data: currentRow, error: currentError } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .select('browser_hash, created_at, last_seen_at, revoked_at, revoked_by_hash')
        .eq('user_id', window.currentUser.id)
        .eq('browser_hash', currentHash)
        .maybeSingle();

    if (currentError) throw currentError;

    if (currentRow?.revoked_at) {
        await handleCurrentBrowserAccessRevoked();
        return { available: true, currentHash, rows: [currentRow], revoked: true };
    }

    const { error: upsertError } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .upsert({
            user_id: window.currentUser.id,
            browser_hash: currentHash,
            last_seen_at: now,
            revoked_at: null,
            revoked_by_hash: null
        }, { onConflict: 'user_id,browser_hash' });

    if (upsertError) throw upsertError;

    const { data, error } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .select('browser_hash, created_at, last_seen_at, revoked_at, revoked_by_hash')
        .eq('user_id', window.currentUser.id)
        .order('last_seen_at', { ascending: false });

    if (error) throw error;

    return { available: true, currentHash, rows: Array.isArray(data) ? data : [], error: '' };
}

async function handleCurrentBrowserAccessRevoked() {
    const keyName = getBrowserAccessKeyName();
    if (keyName) localStorage.removeItem(keyName);
    showSessionClearingScreen('Clearing Session...', 'This browser was signed out from Account > Devices.');
    try {
        await window.sb?.auth?.signOut?.({ scope: 'local' });
    } catch {
        // Continue local cleanup even if the token is already invalid.
    }
    await clearBrowserSessionAndRefresh({ target: 'index.html', message: 'Clearing Session...' });
}

export async function refreshBrowserAccessRegistry(options = {}) {
    const { silent = true } = options;
    if (!window.currentUser?.id || !window.sb?.from || !crypto?.subtle) return true;
    try {
        const context = await getCurrentBrowserAccessContext();
        return !context.revoked;
    } catch (error) {
        if (!silent && window.showToast) window.showToast(getBrowserAccessErrorMessage(error));
        return true;
    }
}

function startBrowserAccessWatcher() {
    if (browserAccessTimer) return;
    browserAccessTimer = setInterval(() => {
        refreshBrowserAccessRegistry({ silent: true });
    }, BROWSER_ACCESS_CHECK_MS);
}

function buildBrowserAccessRows(context = {}) {
    const currentHash = context.currentHash || '';
    const activeRows = (context.rows || []).filter(isBrowserAccessActive);
    if (!context.available) {
        return [{ label: 'Device list', value: context.error || 'Apply the Device Management Supabase migration.' }];
    }

    return activeRows.length
        ? activeRows.map(row => ({
            label: getBrowserAccessLabel(row.browser_hash, currentHash),
            value: formatBrowserAccessStatus(row)
        }))
        : [{ label: 'This browser', value: 'Active now' }];
}

function getBrowserAccessIconSvg() {
    return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M7 20h10"></path><path d="M12 18v2"></path></svg>';
}

function buildBrowserAccessDeviceListHtml(context = {}, { includeGlobalSignOut = false } = {}) {
    const currentHash = context.currentHash || '';
    const activeRows = context.available
        ? (context.rows || []).filter(isBrowserAccessActive)
        : [];
    const rows = activeRows.length
        ? activeRows
        : context.available
        ? [{ browser_hash: currentHash, last_seen_at: new Date().toISOString(), created_at: new Date().toISOString() }]
        : [];

    if (!context.available) {
        return `
            <div class="buddy-cloud-device-list" role="list" aria-label="Known Buddy Cloud browsers">
                <div class="buddy-cloud-device-empty">${esc(context.error || 'Apply the Device Management Supabase migration.')}</div>
            </div>
        `;
    }

    const deviceRows = rows.map(row => {
        const isCurrent = row.browser_hash === currentHash;
        const label = getBrowserAccessLabel(row.browser_hash, currentHash);
        const status = isCurrent ? 'Current browser' : formatBrowserAccessStatus(row);
        const action = isCurrent
            ? '<span class="buddy-cloud-device-current">Current</span>'
            : `<button type="button" class="btn-cancel buddy-cloud-action buddy-cloud-device-signout-btn" data-action="revoke-browser:${esc(row.browser_hash || '')}" data-persistent="false">Sign Out</button>`;

        return `
            <div class="buddy-cloud-device-row" role="listitem">
                <div class="buddy-cloud-device-main">
                    <span class="buddy-cloud-device-icon" aria-hidden="true">${getBrowserAccessIconSvg()}</span>
                    <span class="buddy-cloud-device-copy">
                        <strong>${esc(label)}</strong>
                        <span>${esc(status)}</span>
                    </span>
                </div>
                ${action}
            </div>
        `;
    }).join('');

    return `
        <div class="buddy-cloud-device-list" role="list" aria-label="Known Buddy Cloud browsers">
            ${deviceRows}
        </div>
        <div class="buddy-cloud-device-privacy">
            <button type="button" class="buddy-cloud-action buddy-cloud-privacy-details-btn" data-action="privacy-details" data-persistent="false" aria-label="Privacy details for device management">
                Privacy details
            </button>
        </div>
        ${includeGlobalSignOut ? `
            <button type="button" class="btn-danger buddy-cloud-action buddy-cloud-device-global-signout" data-action="signout-all" data-persistent="false">
                Sign Out All Devices
            </button>
        ` : ''}
    `;
}

async function revokeBrowserAccess(browserHash) {
    const currentHash = await getBrowserAccessHash();
    if (!browserHash || !window.currentUser?.id) throw new Error('No browser selected.');
    if (browserHash === currentHash) throw new Error('Use Logout to sign out this browser.');

    const { error } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .update({
            revoked_at: new Date().toISOString(),
            revoked_by_hash: currentHash || null
        })
        .eq('user_id', window.currentUser.id)
        .eq('browser_hash', browserHash);

    if (error) throw error;
    return true;
}

async function revokeOtherBrowserAccess() {
    const currentHash = await getBrowserAccessHash();
    if (!currentHash || !window.currentUser?.id) return false;

    const { error } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .update({
            revoked_at: new Date().toISOString(),
            revoked_by_hash: currentHash
        })
        .eq('user_id', window.currentUser.id)
        .neq('browser_hash', currentHash)
        .is('revoked_at', null);

    if (error) throw error;
    return true;
}

async function revokeAllBrowserAccess() {
    const currentHash = await getBrowserAccessHash();
    if (!window.currentUser?.id) return false;

    const { error } = await window.sb
        .from(BROWSER_ACCESS_TABLE)
        .update({
            revoked_at: new Date().toISOString(),
            revoked_by_hash: currentHash || null
        })
        .eq('user_id', window.currentUser.id)
        .is('revoked_at', null);

    if (error) throw error;
    return true;
}

function buildBuddyCloudDiagnosticReport() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const humanStatus = getBuddyCloudHumanStatus(status);
    const localBudgetPayload = localStorage.getItem('bb_data') || '';
    const lastError = localStorage.getItem('bb_cloud_last_error') || '';

    return {
        reportType: 'BudgetBuddy Buddy Cloud diagnostic',
        reportVersion: 1,
        generatedAt: new Date().toISOString(),
        privacy: {
            generatedLocally: true,
            userSubmitted: true,
            oneTimeUserInitiatedExport: true,
            doesNotEnableTrackingOrMonitoring: true,
            doesNotOptUserIntoFutureDiagnostics: true,
            reviewBeforeSharing: true,
            sharingNotice: 'This diagnostic report is generated locally. Review it before sending. Sharing it is a one-time user-initiated support action and does not opt you into tracking, monitoring, analytics, support access, or future diagnostics.',
            mayInclude: [
                'Buddy Cloud status',
                'recent sync messages',
                'sync timestamps',
                'app page',
                'browser brand/platform summary',
                'local storage size ranges'
            ],
            excludesBudgetContents: true,
            excludesTransactions: true,
            excludesTransactionCounts: true,
            excludesBalances: true,
            excludesBudgets: true,
            excludesCategories: true,
            excludesDescriptions: true,
            excludesNotes: true,
            excludesAmounts: true,
            excludesRecoveryKey: true,
            excludesAccessTokens: true,
            excludesEmail: true
        },
        app: {
            name: 'BudgetBuddy',
            page: window.location.pathname || '/index.html',
            protocol: window.location.protocol
        },
        browser: getBrowserDiagnosticSummary(),
        buddyCloud: {
            enabled: Boolean(status.enabled),
            signedIn: Boolean(status.signedIn),
            hasLocalRecoveryKey: Boolean(status.hasKey),
            canUseCloud: Boolean(status.canUseCloud),
            syncing: Boolean(status.syncing),
            humanReadableStatus: humanStatus.title,
            humanReadableDetail: humanStatus.detail,
            recommendedNextStep: humanStatus.recommendedNextStep,
            isPremium: Boolean(status.isPremium),
            multiDeviceAllowed: Boolean(status.multiDeviceAllowed),
            syncSlotBlocked: Boolean(status.syncSlotBlocked),
            versionHistoryLastSnapshotAt: status.versionHistoryLastSnapshotAt || '',
            versionHistoryError: status.versionHistoryError || '',
            lastError: lastError || '',
            localUpdatedAt: localStorage.getItem('bb_local_updated_at') || '',
            lastPushedAt: localStorage.getItem('bb_cloud_last_pushed_at') || '',
            lastRemoteAt: localStorage.getItem('bb_cloud_last_remote_at') || '',
            localBudgetPayloadSizeRange: getApproxByteRange(localBudgetPayload),
            syncHistoryRetainedEvents: SYNC_HISTORY_VISIBLE_LIMIT,
            recentSyncEvents: getSyncHistory().slice(0, SYNC_HISTORY_VISIBLE_LIMIT).map(event => ({
                time: event.time || '',
                status: event.status || '',
                message: event.message || ''
            }))
        },
        recovery: {
            recoveryKeyPresentInThisBrowser: Boolean(status.hasKey),
            recoveryKeySavedFlag: hasRecoveryKeySavedFlag(),
            recoveryKeyBackupVerified: hasRecoveryKeyBackedUpFlag(),
            recoveryKeyGrace: getRecoveryKeyGraceState(),
            conflictDetected: hasBuddyCloudConflict(status),
            freeDeviceLimitBlocked: isBuddyCloudMultiDeviceLimit(status),
            canRecoverLostKey: false,
            lostKeyGuidance: 'BudgetBuddy cannot recover a lost Buddy Cloud recovery key. If the key is permanently lost and no trusted browser still has access, reset Buddy Cloud to create a new encrypted vault.'
        },
        browserAccess: {
            hasLocalBrowserAccessToken: Boolean(getBrowserAccessKeyName() && localStorage.getItem(getBrowserAccessKeyName())),
            registryTable: BROWSER_ACCESS_TABLE,
            checkInIntervalMs: BROWSER_ACCESS_CHECK_MS,
            supportsIndividualBudgetBuddyBrowserRevoke: true,
            storesDeviceNames: false,
            storesUserAgents: false,
            storesIpDerivedLocation: false
        },
        storage: {
            hasLocalBudgetPayload: Boolean(localBudgetPayload),
            hasLegacyTransactionsStore: localStorage.getItem('bb_transactions') !== null,
            hasLegacyCategoriesStore: localStorage.getItem('bb_categories') !== null,
            hasDescriptionSuggestionBuffer: localStorage.getItem('bb_circular_buffer') !== null
        }
    };
}

function downloadBuddyCloudDiagnosticReport() {
    const report = buildBuddyCloudDiagnosticReport();
    const filename = `BudgetBuddy_Diagnostic_Report_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function confirmDiagnosticExport() {
    const result = await showBuddyCloudModal({
        eyebrow: 'Diagnostics',
        title: 'Export Diagnostic Report?',
        compact: true,
        customHtml: '<p class="buddy-cloud-modal-copy buddy-cloud-diagnostics-copy">BudgetBuddy will download a local diagnostic JSON file. Review it before sending it to support. No budget contents, transactions, balances, recovery keys, access tokens, or email are included. <a href="privacypolicy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms</a>.</p>',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'export', label: 'Export Report', className: 'btn-create' }
        ]
    });

    return result.action === 'export';
}

async function runAccountDiagnosticsFlow() {
    const confirmed = await confirmDiagnosticExport();
    if (!confirmed) return false;
    downloadBuddyCloudDiagnosticReport();
    recordSyncEvent('Diagnostic report exported locally.', 'local');
    if (window.showToast) window.showToast('Diagnostic report downloaded.');
    return true;
}

export async function handleAccountDiagnostics(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeAccountModal();
    await runAccountDiagnosticsFlow();
}

function getBuddyCloudVersionRows(snapshot = {}) {
    const rows = [
        { label: 'Snapshot saved', value: formatBuddyCloudReviewTime(snapshot.created_at || '') },
        { label: 'Budget changed', value: formatBuddyCloudReviewTime(snapshot.client_updated_at || '') },
        { label: 'Recovery key', value: 'Same Buddy Cloud key' }
    ];
    const tag = getBuddyCloudSnapshotTag(snapshot);
    if (tag) rows.splice(2, 0, { label: 'Snapshot tag', value: tag });
    return rows;
}

const BUDDY_CLOUD_RESTORE_MIN_SCREEN_MS = 5400;

function showBuddyCloudRestoreScreen(title = 'Restoring Budget...', detail = 'Creating a safety snapshot and restoring your encrypted budget.') {
    let overlay = document.getElementById('buddyCloudRestoreOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'buddyCloudRestoreOverlay';
        overlay.className = 'budget-restore-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="budget-restore-card">
                <div class="budget-restore-vault" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                    <i></i>
                </div>
                <h3 id="buddyCloudRestoreTitle">Restoring Budget...</h3>
                <p id="buddyCloudRestoreDetail">Creating a safety snapshot and restoring your encrypted budget.</p>
                <div class="budget-restore-steps" aria-hidden="true">
                    <span>Safety snapshot</span>
                    <span>Decrypt locally</span>
                    <span>Restore budget</span>
                </div>
                <div class="budget-restore-progress" aria-hidden="true"><span></span></div>
                <button type="button" id="buddyCloudRestoreContinue" class="btn-create budget-restore-continue" hidden>Continue</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    overlay.classList.remove('is-complete', 'is-error');
    const titleEl = overlay.querySelector('#buddyCloudRestoreTitle');
    const detailEl = overlay.querySelector('#buddyCloudRestoreDetail');
    const continueBtn = overlay.querySelector('#buddyCloudRestoreContinue');
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
    if (continueBtn) {
        continueBtn.hidden = true;
        continueBtn.onclick = null;
    }
    overlay.classList.add('active');
    document.body.classList.add('budget-restore-active');
    return Date.now();
}

async function completeBuddyCloudRestoreScreen(startedAt, { title = 'Budget Restored', detail = 'Your selected Buddy Cloud version is ready.', error = false } = {}) {
    const overlay = document.getElementById('buddyCloudRestoreOverlay');
    if (!overlay) return;

    const elapsed = Date.now() - startedAt;
    if (elapsed < BUDDY_CLOUD_RESTORE_MIN_SCREEN_MS) {
        await wait(BUDDY_CLOUD_RESTORE_MIN_SCREEN_MS - elapsed);
    }

    const titleEl = overlay.querySelector('#buddyCloudRestoreTitle');
    const detailEl = overlay.querySelector('#buddyCloudRestoreDetail');
    const continueBtn = overlay.querySelector('#buddyCloudRestoreContinue');
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
    overlay.classList.add('is-complete');
    overlay.classList.toggle('is-error', Boolean(error));

    await new Promise(resolve => {
        if (!continueBtn) {
            resolve();
            return;
        }
        continueBtn.hidden = false;
        continueBtn.onclick = () => {
            overlay.classList.remove('active', 'is-complete', 'is-error');
            document.body.classList.remove('budget-restore-active');
            resolve();
        };
        continueBtn.focus({ preventScroll: true });
    });
}

function getBuddyCloudVersionActionLabel(snapshot = {}, index = 0) {
    const value = snapshot.client_updated_at || snapshot.created_at || '';
    const date = new Date(value);
    const tag = getBuddyCloudSnapshotTag(snapshot);
    const suffix = tag ? ` - ${tag}` : '';
    if (Number.isNaN(date.getTime())) return `${index === 0 ? 'Restore Latest' : `Restore Version ${index + 1}`}${suffix}`;
    const label = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
    return `${index === 0 ? `Restore Latest (${label})` : `Restore ${label}`}${suffix}`;
}

function getBuddyCloudRecentRestoreKeyName() {
    return window.currentUser?.id ? `${BUDDY_CLOUD_RECENT_RESTORE_PREFIX}${window.currentUser.id}` : '';
}

function markBuddyCloudSnapshotRecentlyUsed(snapshotId = '') {
    const keyName = getBuddyCloudRecentRestoreKeyName();
    if (!keyName || !snapshotId) return;
    localStorage.setItem(keyName, JSON.stringify({
        snapshotId,
        restoredAt: new Date().toISOString()
    }));
}

function getBuddyCloudRecentlyUsedSnapshotId() {
    const keyName = getBuddyCloudRecentRestoreKeyName();
    if (!keyName) return '';
    try {
        const parsed = JSON.parse(localStorage.getItem(keyName) || '{}');
        return parsed?.snapshotId || '';
    } catch {
        return '';
    }
}

function getBuddyCloudSnapshotTag(snapshot = {}) {
    const reason = String(snapshot.snapshot_reason || '').toLowerCase();
    if (snapshot.snapshot_id && snapshot.snapshot_id === getBuddyCloudRecentlyUsedSnapshotId()) return 'Recently used';
    if (reason.includes('before keeping cloud version')) return 'Saved local version';
    if (reason.includes('before restoring buddy cloud version')) return 'Before restore';
    if (reason.includes('restored buddy cloud version')) return 'Restored';
    return '';
}

function formatBuddyCloudSnapshotRetention(limit = 1) {
    const count = Math.max(1, Number(limit) || 1);
    return count === 1 ? 'Newest 1 snapshot' : `Newest ${count} snapshots`;
}

async function showBuddyCloudVersionHistoryModal() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const versionHistoryLimit = Math.max(1, Number(status.versionHistoryLimit) || 1);
    if (!status.signedIn || !status.enabled) {
        await showBuddyCloudModal({
            eyebrow: 'Buddy Cloud',
            title: 'Cloud Version History',
            body: 'Set up Buddy Cloud before using encrypted version history.',
            assurance: 'Version history stores encrypted vault snapshots only after Buddy Cloud uploads have verified.',
            actions: [{ id: 'close', label: 'Back', className: 'btn-cancel' }]
        });
        return { action: 'close', snapshots: [] };
    }

    if (!status.hasKey) {
        const result = await showBuddyCloudModal({
            eyebrow: 'Buddy Cloud',
            title: 'Recovery Key Required',
            compact: true,
            customHtml: '<p class="buddy-cloud-modal-copy">Import your Buddy Cloud recovery key to view or restore encrypted snapshots. Snapshots decrypt locally in this browser. BudgetBuddy cannot read them or recover a lost key.</p>',
            actions: [
                { id: 'close', label: 'Back', className: 'btn-cancel' },
                { id: 'recovery-help', label: 'Recovery Help', className: 'btn-create' }
            ]
        });
        return { action: result.action, snapshots: [] };
    }

    let snapshots = [];
    try {
        snapshots = await window.BuddyCloud.listVersionHistory(versionHistoryLimit);
    } catch (error) {
        await showBuddyCloudModal({
            eyebrow: 'Buddy Cloud',
            title: 'Version History Unavailable',
            body: getBuddyCloudErrorMessage(error),
            assurance: 'Current Buddy Cloud sync can still work even if version history has not been deployed yet.',
            actions: [{ id: 'close', label: 'Back', className: 'btn-cancel' }]
        });
        return { action: 'close', snapshots: [] };
    }

    if (!snapshots.length) {
        await showBuddyCloudModal({
            eyebrow: 'Buddy Cloud',
            title: 'Cloud Version History',
            body: 'No encrypted snapshots are available yet.',
            assurance: `BudgetBuddy creates encrypted snapshots after verified Buddy Cloud uploads, then keeps the ${formatBuddyCloudSnapshotRetention(versionHistoryLimit).toLowerCase()}.`,
            actions: [{ id: 'close', label: 'Back', className: 'btn-cancel' }]
        });
        return { action: 'close', snapshots: [] };
    }

    const result = await showBuddyCloudModal({
        eyebrow: 'Buddy Cloud',
        title: 'Cloud Version History',
        body: 'Restore an earlier saved Buddy Cloud version.',
        assurance: 'BudgetBuddy saves a private backup of your current version first, and cannot read the contents of either version.',
        detailRows: [
            { label: 'Snapshots shown', value: String(snapshots.length) },
            { label: 'Retention', value: formatBuddyCloudSnapshotRetention(versionHistoryLimit) },
            { label: 'Snapshot spacing', value: 'At most hourly' },
            { label: 'Recovery key', value: 'Same key across versions' }
        ],
        selectLabel: 'Version to restore',
        selectOptions: snapshots.map((snapshot, index) => ({
            value: snapshot.snapshot_id,
            label: getBuddyCloudVersionActionLabel(snapshot, index).replace(/^Restore\s?/, '')
        })),
        warning: 'Advanced users only. Restore a previous version only if you know what you are doing or BudgetBuddy Support directed you here.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'restore-version', label: 'Restore Selected', className: 'btn-create' }
        ]
    });

    return {
        action: result.action === 'restore-version' ? `restore-version:${result.value}` : result.action,
        snapshots
    };
}

async function confirmBuddyCloudVersionRestore(snapshot = {}) {
    const result = await showBuddyCloudModal({
        eyebrow: 'Buddy Cloud',
        title: 'Restore This Version?',
        body: 'BudgetBuddy will decrypt this encrypted snapshot locally, replace this browser budget, and upload the restored encrypted vault as current.',
        assurance: 'The Buddy Cloud recovery key does not change, and the key is not sent to BudgetBuddy.',
        detailRows: getBuddyCloudVersionRows(snapshot),
        warning: 'Any unsynced changes in this browser will be replaced.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'restore', label: 'Restore Version', className: 'btn-danger' }
        ]
    });

    return result.action === 'restore';
}

async function runBuddyCloudVersionHistoryFlow() {
    const result = await showBuddyCloudVersionHistoryModal();
    if (result.action === 'recovery-help') return 'recovery-help';

    if (!String(result.action || '').startsWith('restore-version:')) return result.action || '';

    const snapshotId = String(result.action).replace('restore-version:', '');
    const snapshot = result.snapshots.find(item => item.snapshot_id === snapshotId);
    const confirmed = await confirmBuddyCloudVersionRestore(snapshot);
    if (!confirmed) return 'cancel';

    const restoreScreenStartedAt = showBuddyCloudRestoreScreen();
    try {
        await window.BuddyCloud.restoreVersion(snapshotId);
        markBuddyCloudSnapshotRecentlyUsed(snapshotId);
        await completeBuddyCloudRestoreScreen(restoreScreenStartedAt, {
            title: 'Budget Restored',
            detail: 'Safety snapshot saved. Your selected Buddy Cloud version is ready.'
        });
        if (window.showToast) window.showToast('Buddy Cloud version restored.');
        return 'restored';
    } catch (error) {
        const message = getBuddyCloudErrorMessage(error);
        recordSyncEvent(message, 'error');
        await completeBuddyCloudRestoreScreen(restoreScreenStartedAt, {
            title: 'Restore Could Not Finish',
            detail: message,
            error: true
        });
        if (window.showToast) window.showToast(message);
        return 'error';
    }
}

export async function handleBuddyCloudVersionHistory(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeAccountModal();

    const action = await runBuddyCloudVersionHistoryFlow();
    if (action === 'recovery-help') {
        await handleBuddyCloudRecoveryHelp();
    }
}

async function showBuddyCloudRecoveryHelpModal() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const humanStatus = getBuddyCloudHumanStatus(status);
    const actions = [];

    if (status.signedIn && status.enabled && !status.hasKey) {
        actions.push({ id: 'import-key', label: 'Import Key', className: 'btn-create' });
        actions.push({ id: 'lost-key', label: 'Lost Recovery Key', className: 'btn-danger' });
    }

    if (status.signedIn && status.enabled && status.hasKey) {
        actions.push({ id: 'save-key', label: 'Save Key', className: 'btn-create' });
        actions.push({ id: 'version-history', label: 'Version History', className: 'btn-cancel' });
    }

    if (status.signedIn) {
        actions.push({ id: 'devices', label: 'Devices', className: 'btn-cancel' });
    }

    actions.push({ id: 'diagnostics', label: 'Diagnostics', className: 'btn-cancel' });
    actions.push({ id: 'close', label: 'Back', className: 'btn-cancel' });

    const result = await showBuddyCloudModal({
        eyebrow: 'Priority Recovery',
        title: 'Recovery Help',
        body: humanStatus.detail,
        compact: true,
        modalClass: 'buddy-cloud-recovery-modal',
        assurance: 'Choose the next recovery step below. Diagnostics stay local unless you share them.',
        detailRows: getBuddyCloudRecoveryRows(status),
        actions
    });

    return result.action;
}

async function showLostRecoveryKeyModal() {
    const result = await showBuddyCloudModal({
        eyebrow: 'Priority Recovery',
        title: 'Lost Recovery Key',
        compact: true,
        modalClass: 'buddy-cloud-recovery-modal',
        body: 'If the recovery key is permanently lost, BudgetBuddy cannot decrypt the existing Buddy Cloud vault.',
        assurance: 'Use a saved key from another trusted place, or reset Buddy Cloud and start a new encrypted vault.',
        actions: [
            { id: 'back', label: 'Back', className: 'btn-cancel' },
            { id: 'import-key', label: 'Import Key', className: 'btn-create' },
            { id: 'reset-cloud', label: 'Reset Buddy Cloud', className: 'btn-danger' }
        ]
    });

    return result.action;
}

async function runRecoveryKeyImportFlow() {
    const recoveryKey = await askForRecoveryKey();
    if (!recoveryKey) return false;
    await window.BuddyCloud.importRecoveryKey(recoveryKey);
    markRecoveryKeyBackedUp();
    await completeBuddyCloudEnableFlow({ recoveryKey });
    return true;
}

export async function handleBuddyCloudRecoveryHelp(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeAccountModal();

    let keepOpen = true;
    let exitReason = 'back';
    while (keepOpen) {
        const action = await showBuddyCloudRecoveryHelpModal();

        if (action === 'diagnostics') {
            await runAccountDiagnosticsFlow();
            continue;
        }

        if (action === 'version-history') {
            await runBuddyCloudVersionHistoryFlow();
            continue;
        }

        if (action === 'save-key') {
            await window.showBuddyCloudRecoveryKey?.();
            continue;
        }

        if (action === 'import-key') {
            await runRecoveryKeyImportFlow();
            continue;
        }

        if (action === 'devices') {
            await showBuddyCloudDeviceManagementFlow();
            continue;
        }

        if (action === 'lost-key') {
            const lostKeyAction = await showLostRecoveryKeyModal();
            if (lostKeyAction === 'import-key') {
                await runRecoveryKeyImportFlow();
            }
            if (lostKeyAction === 'reset-cloud') {
                const resetStarted = await handleDeleteAccount();
                if (resetStarted) {
                    exitReason = 'reset-started';
                    keepOpen = false;
                }
            }
            continue;
        }

        keepOpen = false;
    }

    return exitReason;
}

async function showAccountSettingsModal() {
    const result = await showBuddyCloudModal({
        eyebrow: 'Account Settings',
        title: 'Settings',
        compact: true,
        modalClass: 'buddy-cloud-settings-modal',
        body: 'Manage guided recovery, version history, support exports, and Buddy Cloud account recovery tools.',
        assurance: 'Version history stores encrypted snapshots only. Diagnostics are generated locally and require confirmation.',
        actions: [
            { id: 'recovery-help', label: 'Recovery Help', className: 'btn-create' },
            { id: 'version-history', label: 'Version History', className: 'btn-cancel' },
            { id: 'diagnostics', label: 'Diagnostics', className: 'btn-cancel' },
            { id: 'reset-cloud', label: 'Reset Buddy Cloud', className: 'btn-danger' },
            { id: 'close', label: 'Close', className: 'btn-cancel' }
        ]
    });

    return result.action;
}

export async function handleAccountSettings(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeAccountModal();

    let keepOpen = true;
    while (keepOpen) {
        const action = await showAccountSettingsModal();

        if (action === 'recovery-help') {
            const recoveryResult = await handleBuddyCloudRecoveryHelp();
            if (recoveryResult === 'reset-started') keepOpen = false;
            continue;
        }

        if (action === 'diagnostics') {
            await runAccountDiagnosticsFlow();
            continue;
        }

        if (action === 'version-history') {
            const versionResult = await runBuddyCloudVersionHistoryFlow();
            if (versionResult === 'recovery-help') {
                const recoveryResult = await handleBuddyCloudRecoveryHelp();
                if (recoveryResult === 'reset-started') keepOpen = false;
            }
            continue;
        }

        if (action === 'reset-cloud') {
            const resetStarted = await handleDeleteAccount();
            if (resetStarted) keepOpen = false;
            continue;
        }

        keepOpen = false;
    }
}

export function handleAccountSupport(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeAccountModal();
    window.location.href = 'support.html';
}

async function confirmSignOutAllDevices() {
    const browserSummary = getBrowserDiagnosticSummary();
    const cloudStatus = window.BuddyCloud?.getStatus?.() || {};
    const needsRecoveryKeyBackup = Boolean(cloudStatus.enabled && cloudStatus.hasKey && !hasRecoveryKeyBackedUpFlag());
    const platform = browserSummary.platform && browserSummary.platform !== 'not collected'
        ? browserSummary.platform
        : 'Not collected';
    const browserBrands = Array.isArray(browserSummary.brands) && browserSummary.brands.length
        ? browserSummary.brands.map(item => `${item.brand} ${item.majorVersion}`.trim()).join(', ')
        : 'Not collected';
    const result = await showBuddyCloudModal({
        title: 'Sign Out All Devices?',
        body: `Current browser summary: ${browserBrands}. Platform: ${platform}.`,
        assurance: 'Supabase will revoke account sessions, and BudgetBuddy will mark known browser access records as revoked. Your encrypted Buddy Cloud vault is not deleted, and BudgetBuddy still cannot read it.',
        warning: needsRecoveryKeyBackup
            ? 'This clears this browser. BudgetBuddy will require a recovery key download before continuing so this account is not locked out of the encrypted cloud budget.'
            : 'This clears this browser after sync verification. Other browsers may still have local data until their storage is cleared, but they will be forced out when BudgetBuddy checks their access record.',
        inputLabel: 'Type SIGN OUT to confirm',
        inputPlaceholder: 'SIGN OUT',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'signout-all', label: 'Sign Out All Devices', className: 'btn-danger' }
        ]
    });

    return result.action === 'signout-all' && result.value.toUpperCase() === 'SIGN OUT';
}

async function confirmSignOutOtherDevices() {
    const result = await showBuddyCloudModal({
        title: 'Sign Out Other Devices?',
        body: 'This signs out every other Supabase session for this account and marks known BudgetBuddy browser access records as revoked.',
        assurance: 'This browser stays signed in. Your encrypted Buddy Cloud vault is not deleted, and BudgetBuddy still cannot read it.',
        warning: 'Other browsers may keep local data until their browser storage is cleared, but BudgetBuddy will force them out when they check in.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'signout-others', label: 'Sign Out Others', className: 'btn-danger' }
        ]
    });

    return result.action === 'signout-others';
}

async function confirmRevokeBrowserAccess(label = 'that browser') {
    const result = await showBuddyCloudModal({
        title: 'Sign Out This Browser?',
        body: `BudgetBuddy will sign out ${label} the next time it opens or refreshes BudgetBuddy.`,
        assurance: 'We only store an opaque browser hash and timestamps for this list. No device name, user agent, IP-derived location, or readable budget data is stored.',
        warning: 'The cloud revoke is immediate. That browser clears itself the next time it contacts BudgetBuddy.',
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'revoke', label: 'Sign Out Browser', className: 'btn-danger' }
        ]
    });

    return result.action === 'revoke';
}

async function showDeviceManagementPrivacyDetails() {
    await showBuddyCloudModal({
        eyebrow: 'Privacy',
        title: 'Device Privacy Details',
        compact: true,
        modalClass: 'buddy-cloud-privacy-modal',
        body: BROWSER_ACCESS_PRIVACY_COPY,
        assurance: 'These records only help BudgetBuddy recognize known browser access and process sign-out requests.',
        detailRows: [
            { label: 'Stored', value: 'Opaque browser hash, timestamps' },
            { label: 'Not stored', value: 'Device names, user agents, IP location' },
            { label: 'Budget data', value: 'Never readable here' }
        ],
        actions: [
            { id: 'close', label: 'Back', className: 'btn-create' }
        ]
    });
}

async function showBuddyCloudDeviceManagementFlow() {
    let keepOpen = true;
    while (keepOpen) {
        const action = await showBuddyCloudDeviceManagementModal();
        if (action === 'privacy-details') {
            await showDeviceManagementPrivacyDetails();
            continue;
        }

        if (!action || action === 'cancel' || action === 'close') return;

        const result = await handleBuddyCloudDeviceAction(action);
        keepOpen = result === 'back-to-devices';
    }
}

function getBuddyCloudDeviceStatusCopy() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const freeLimit = Number(status.freeDeviceLimit || status.syncSlotLimit || 2);
    if (!status.signedIn) return 'Sign in to manage Buddy Cloud on this browser.';
    if (!status.enabled || !status.hasKey) return 'Manage known BudgetBuddy browsers for this account.';
    if (isBuddyCloudMultiDeviceLimit(status)) return `Free Tier allows ${freeLimit} active synced browsers. Upgrade to Premium for unlimited Buddy Cloud devices, or replace an existing Free device with this browser.`;
    if (hasBuddyCloudConflict(status)) return 'Buddy Cloud found both local and cloud changes. Compare the saved versions before sync continues.';
    if (status.lastError) return status.lastError;
    if (status.syncing) return 'Buddy Cloud is syncing on this browser.';
    return status.isPremium
        ? 'Buddy Cloud is active with Multi-Device Sync Plus.'
        : 'Buddy Cloud is active on this browser.';
}

function hasBuddyCloudConflict(status = window.BuddyCloud?.getStatus?.() || {}) {
    return Boolean(status.hasConflict)
        || String(status.lastError || '').toLowerCase().includes('competing saved versions')
        || String(status.lastError || '').toLowerCase().includes('local and cloud changes')
        || String(status.lastError || '').toLowerCase().includes('changes on another device');
}

function getBuddyCloudManualSyncKey() {
    return window.currentUser?.id
        ? `${BUDDY_CLOUD_MANUAL_SYNC_PREFIX}${window.currentUser.id}`
        : `${BUDDY_CLOUD_MANUAL_SYNC_PREFIX}anonymous`;
}

function getBuddyCloudManualSyncCooldownMs() {
    try {
        const lastSyncAt = Number(localStorage.getItem(getBuddyCloudManualSyncKey()) || 0);
        if (!lastSyncAt) return 0;
        return Math.max(0, BUDDY_CLOUD_MANUAL_SYNC_COOLDOWN_MS - (Date.now() - lastSyncAt));
    } catch {
        return 0;
    }
}

function markBuddyCloudManualSyncStarted() {
    try {
        localStorage.setItem(getBuddyCloudManualSyncKey(), String(Date.now()));
    } catch {
        // Manual sync still works if localStorage is unavailable.
    }
}

function formatBuddyCloudManualSyncCooldown(ms = 0) {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

async function showBuddyCloudDeviceManagementModal() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const signedIn = Boolean(status.signedIn);
    const enabled = Boolean(status.enabled);
    const hasKey = Boolean(status.hasKey);
    const hasConflict = hasBuddyCloudConflict(status);
    const hasMultiDeviceLimit = isBuddyCloudMultiDeviceLimit(status);
    const canResolveConflict = signedIn && enabled && hasKey && hasConflict && !status.syncing;
    const canMoveFreeSlot = signedIn && enabled && hasKey && hasMultiDeviceLimit && !status.syncing;
    let browserContext = { available: false, currentHash: '', rows: [], error: '' };
    try {
        browserContext = signedIn
            ? await getCurrentBrowserAccessContext()
            : browserContext;
    } catch (error) {
        browserContext.error = getBrowserAccessErrorMessage(error);
    }
    const activeBrowserRows = browserContext.available
        ? browserContext.rows.filter(isBrowserAccessActive)
        : [];
    const otherBrowserRows = activeBrowserRows.filter(row => row.browser_hash !== browserContext.currentHash);
    const actions = [];

    if (canMoveFreeSlot) {
        actions.push(
            { id: 'upgrade', label: 'Upgrade', className: 'btn-create' },
            { id: 'replace-slot', label: 'Use This Browser Instead', className: 'btn-danger' }
        );
    }

    if (canResolveConflict) {
        actions.push(
            { id: 'download', label: 'Buddy Cloud Version', className: 'btn-create buddy-cloud-choice-primary' },
            { id: 'upload', label: 'Local Copy', className: 'btn-cancel buddy-cloud-choice-secondary' }
        );
    }

    actions.push({ id: 'close', label: 'Close', className: 'btn-cancel' });

    const syncRows = canMoveFreeSlot
        ? getBuddyCloudSyncSlotRows(status)
        : [];
    const conflictComparisonHtml = canResolveConflict
        ? buildBuddyCloudConflictComparisonHtml(status)
        : '';
    const deviceListHtml = signedIn
        ? buildBrowserAccessDeviceListHtml(browserContext, { includeGlobalSignOut: true })
        : '';

    const result = await showBuddyCloudModal({
        title: 'Buddy Cloud Devices',
        body: getBuddyCloudDeviceStatusCopy(),
        detailRows: syncRows,
        customHtml: `${conflictComparisonHtml}${deviceListHtml}`,
        warning: browserContext.error
            || (canMoveFreeSlot
            ? 'Use This Browser Instead replaces the oldest Free device slot with this browser. That browser will stop syncing until it is made active again.'
            : canResolveConflict
            ? ''
            : ''),
        actions
    });

    return result.action;
}

function getBuddyCloudErrorMessage(error) {
    const message = String(error?.message || error || '').trim();
    const code = String(error?.code || '').trim();

    if (code === BUDDY_CLOUD_MULTI_DEVICE_LIMIT_CODE) {
        return 'Free Tier allows 2 active synced browsers at a time. Upgrade to Premium for unlimited Buddy Cloud devices, or use this browser instead.';
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
        return 'Buddy Cloud database is not ready yet. Apply the Buddy Cloud Supabase migration, then retry sync.';
    }

    if (
        code === '42P01'
        || message.includes('buddy_cloud_vault_snapshots')
        || message.includes('202606100006_buddy_cloud_vault_snapshots')
    ) {
        return 'Buddy Cloud Version History is not ready yet. Apply supabase/migrations/202606100006_buddy_cloud_vault_snapshots.sql in Supabase, then retry.';
    }

    return message || 'Buddy Cloud action failed.';
}

async function runCloudAction(event, action) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const button = event?.currentTarget;
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    }

    try {
        await action();
    } catch (error) {
        console.error('[Buddy Cloud UI]', error);
        const message = getBuddyCloudErrorMessage(error);
        recordSyncEvent(message, 'error');
        if (window.showToast) window.showToast(message);
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
        syncCloudActionButtons();
    }
}

async function enableBuddyCloudStep(options = {}) {
    try {
        return await window.BuddyCloud.enableSync(options);
    } catch (error) {
        if (!isBuddyCloudMultiDeviceLimit(error)) throw error;

        const action = await confirmBuddyCloudSyncSlotTransfer(error);
        if (action === 'upgrade') {
            await window.startStripeCheckout?.();
            return null;
        }

        if (action !== 'replace-slot') {
            recordSyncEvent('Buddy Cloud sync stayed on the existing active browser.', 'local');
            return null;
        }

        return window.BuddyCloud.enableSync({
            ...options,
            replaceSyncSlot: true
        });
    }
}

async function completeBuddyCloudEnableFlow(initialOptions = {}) {
    let result = await enableBuddyCloudStep(initialOptions);
    if (!result) return null;

    if (result.needsKey) {
        const recoveryKey = await askForRecoveryKey();
        if (!recoveryKey) {
            recordSyncEvent('Buddy Cloud needs the recovery key before syncing this device.', 'error');
            return null;
        }
        await window.BuddyCloud.importRecoveryKey(recoveryKey);
        markRecoveryKeyBackedUp();
        result = await enableBuddyCloudStep({
            ...initialOptions,
            recoveryKey
        });
        if (!result) return null;
    }

    if (result.needsChoice) {
        const choice = await chooseBuddyCloudSource({
            remoteUpdatedAt: result.remoteUpdatedAt,
            localUpdatedAt: result.localUpdatedAt,
            lastSyncedAt: result.lastSyncedAt
        });
        if (!choice) return null;
        result = await enableBuddyCloudStep({
            ...initialOptions,
            recoveryKey: result.recoveryKey,
            prefer: choice
        });
        if (!result) return null;
    }

    if (result.recoveryKey && !result.remoteExisted) {
        startRecoveryKeyGracePeriod();
        const copied = await copyRecoveryKeyToClipboard(result.recoveryKey);
        const saved = await showRecoveryKeyNotice(result.recoveryKey, { copied, initial: true, requireDownload: false });
        if (!saved) {
            recordSyncEvent('Buddy Cloud recovery key reminder started.', 'local');
            if (window.showToast) window.showToast('Buddy Cloud is active. Save your recovery key within 72 hours.');
        }
    }

    syncCloudActionButtons();
    return result;
}

window.enableBuddyCloudSync = function(event) {
    return runCloudAction(event, async () => {
        if (!window.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        await completeBuddyCloudEnableFlow();
    });
};

window.manualBuddyCloudSync = function(event) {
    return runCloudAction(event, async () => {
        if (!window.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        if (!window.BuddyCloud?.getStatus) throw new Error('Buddy Cloud is not available yet.');

        const status = window.BuddyCloud.getStatus();
        if (!status.enabled) {
            await completeBuddyCloudEnableFlow();
            return;
        }

        if (!status.hasKey) {
            await runRecoveryKeyImportFlow();
            return;
        }

        if (hasBuddyCloudConflict(status)) {
            if (window.showToast) window.showToast('Review saved versions before sync continues.');
            await showBuddyCloudDeviceManagementFlow();
            return;
        }

        const remainingMs = getBuddyCloudManualSyncCooldownMs();
        if (remainingMs > 0) {
            if (window.showToast) {
                window.showToast(`Manual sync is available again in ${formatBuddyCloudManualSyncCooldown(remainingMs)}.`);
            }
            return;
        }

        markBuddyCloudManualSyncStarted();
        renderManualSyncButtonSyncing(event?.currentTarget);
        await window.BuddyCloud.syncNow();

        if (hasBuddyCloudConflict(window.BuddyCloud.getStatus())) {
            if (window.showToast) window.showToast('Review saved versions before sync continues.');
            await showBuddyCloudDeviceManagementFlow();
            return;
        }

        if (window.showToast) window.showToast('Buddy Cloud sync checked.');
    });
};

export async function ensureBuddyCloudDefaultProtection() {
    if (!window.currentUser || !window.BuddyCloud?.getStatus || !window.BuddyCloud?.enableSync) return null;

    const status = window.BuddyCloud.getStatus();
    if (status.enabled || status.syncing) return null;
    if (hasAttemptedBuddyCloudDefaultSetup()) return null;

    markBuddyCloudDefaultSetupAttempted();
    return runCloudAction(null, async () => {
        recordSyncEvent('Setting up Buddy Cloud protection...', 'syncing');
        await completeBuddyCloudEnableFlow({ defaultProtection: true });
    });
}

window.showBuddyCloudRecoveryKey = function(event) {
    return runCloudAction(event, async () => {
        if (!window.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        const status = window.BuddyCloud?.getStatus?.() || {};
        if (!status.enabled) {
            await completeBuddyCloudEnableFlow();
            return;
        }

        if (!status.hasKey) {
            await runRecoveryKeyImportFlow();
            return;
        }

        const authorized = await authorizeRecoveryKeyDisplay();
        if (!authorized) return;

        const recoveryKey = window.BuddyCloud.exportRecoveryKey();
        await showRecoveryKeyNotice(recoveryKey, { copied: false, initial: false });
    });
};

async function handleBuddyCloudDeviceAction(action) {
    if (action === 'privacy-details') {
        await showDeviceManagementPrivacyDetails();
        return;
    }

    if (String(action || '').startsWith('revoke-browser:')) {
        const browserHash = String(action).replace('revoke-browser:', '');
        const currentHash = await getBrowserAccessHash();
        const label = getBrowserAccessLabel(browserHash, currentHash);
        const ok = await confirmRevokeBrowserAccess(label);
        if (!ok) return 'back-to-devices';
        await revokeBrowserAccess(browserHash);
        if (window.showToast) window.showToast(`${label} will sign out the next time it opens BudgetBuddy.`);
        return 'back-to-devices';
    }

    if (action === 'upgrade') {
        await window.startStripeCheckout?.();
        return;
    }

    if (action === 'replace-slot') {
        const transferAction = await confirmBuddyCloudSyncSlotTransfer();
        if (transferAction === 'upgrade') {
            await window.startStripeCheckout?.();
            return;
        }
        if (transferAction !== 'replace-slot') return;
        const result = await completeBuddyCloudEnableFlow({ replaceSyncSlot: true });
        if (result && window.showToast) window.showToast('This browser is now the active Buddy Cloud browser.');
        return;
    }

    if (action === 'download') {
        const ok = await confirmBuddyCloudDownload();
        if (!ok) return 'back-to-devices';
        await window.BuddyCloud.forcePull();
        if (window.showToast) window.showToast('Cloud version is now active.');
        return;
    }

    if (action === 'upload') {
        const ok = await confirmBuddyCloudUpload();
        if (!ok) return 'back-to-devices';
        await window.BuddyCloud.forcePush();
        if (window.showToast) window.showToast('This browser version is now synced to Buddy Cloud.');
        return;
    }

    if (action === 'signout-others') {
        const ok = await confirmSignOutOtherDevices();
        if (!ok) return 'back-to-devices';
        try {
            await revokeOtherBrowserAccess();
        } catch (error) {
            console.warn('[Device Management] Could not mark other browser access records revoked:', error);
        }
        if (!window.sb?.auth?.signOut) throw new Error('Sign out is not available.');
        await window.sb.auth.signOut({ scope: 'others' });
        if (window.showToast) window.showToast('Other devices were signed out.');
        return 'back-to-devices';
    }

    if (action === 'signout-all') {
        const ok = await confirmSignOutAllDevices();
        if (!ok) {
            return 'back-to-devices';
        }
        if (!window.sb?.auth?.signOut) throw new Error('Sign out is not available.');
        const keySafe = await requireRecoveryKeySavedBeforeLocalClear();
        if (!keySafe) throw new Error('Recovery key download is required before this browser can be cleared.');
        showSessionClearingScreen('Clearing Session...', 'Signing out all devices and clearing this browser.');
        try {
            await verifyBuddyCloudBeforeLogout();
            try {
                await window.BuddyCloud?.clearSyncSlots?.();
            } catch (error) {
                console.warn('[Device Management] Could not clear Buddy Cloud sync slots:', error);
            }
            try {
                await revokeAllBrowserAccess();
            } catch (error) {
                console.warn('[Device Management] Could not mark browser access records revoked:', error);
            }
            await window.sb.auth.signOut({ scope: 'global' });
            await clearBrowserSessionAndRefresh({ target: 'index.html', message: 'Clearing Session...' });
        } catch (error) {
            hideSessionClearingScreen();
            throw error;
        }
    }
}

window.openBuddyCloudDeviceManagement = function(event) {
    return runCloudAction(event, async () => {
        window.closeAccountModal?.();
        await showBuddyCloudDeviceManagementFlow();
    });
};

function initAccountSecurityObservers() {
    initSyncObserver();
    startBrowserAccessWatcher();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountSecurityObservers);
} else {
    initAccountSecurityObservers();
}

let descriptionRolloverController = null;
let categoryNameRolloverController = null;

function stopPlaceholderTypewriter(controller) {
    if (!controller) return;
    controller.stopped = true;
    if (controller.timer) clearTimeout(controller.timer);
}

function stopPlaceholderController(controller) {
    stopPlaceholderTypewriter(controller);
}

function hashPlaceholderString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getPlaceholderRandomUnit(scope = '') {
    const randomValues = globalThis.crypto?.getRandomValues ? new Uint32Array(1) : null;
    if (randomValues) {
        globalThis.crypto.getRandomValues(randomValues);
        return randomValues[0] / 0x100000000;
    }

    const salt = [
        PLACEHOLDER_RANDOM_SALT,
        scope,
        Date.now(),
        globalThis.performance?.now?.() ?? 0,
        Math.random()
    ].join(':');
    const mixed = hashPlaceholderString(salt) ^ Math.floor(Math.random() * 0x100000000);
    return (mixed >>> 0) / 0x100000000;
}

function getRandomizedPlaceholderSuggestions(suggestions, scope = '') {
    const cleanSuggestions = suggestions
        .map(item => String(item || '').trim())
        .filter(item => item && item.length <= DESCRIPTION_ROLLOVER_MAX_LENGTH);

    for (let i = cleanSuggestions.length - 1; i > 0; i--) {
        const randomUnit = getPlaceholderRandomUnit(`${scope}:${i}:${cleanSuggestions[i]}`);
        const swapIndex = Math.floor(randomUnit * (i + 1));
        [cleanSuggestions[i], cleanSuggestions[swapIndex]] = [cleanSuggestions[swapIndex], cleanSuggestions[i]];
    }

    return cleanSuggestions;
}

function advancePlaceholderSuggestion(controller) {
    controller.index += 1;
    if (controller.index < controller.suggestions.length) return;

    controller.suggestions = getRandomizedPlaceholderSuggestions(
        controller.suggestions,
        `${controller.scope}:cycle:${Date.now()}`
    );
    controller.index = 0;
}

function createPlaceholderTypewriter({ inputId, suggestions, ariaLabel, className }) {
    const input = document.getElementById(inputId);
    const cleanSuggestions = getRandomizedPlaceholderSuggestions(suggestions, inputId);

    if (!input || cleanSuggestions.length === 0) return null;

    const controller = {
        input,
        suggestions: cleanSuggestions,
        scope: inputId,
        index: 0,
        timer: null,
        stopped: false
    };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    input.classList.add(className, 'placeholder-typewriter-input');
    input.setAttribute('aria-label', input.getAttribute('aria-label') || ariaLabel);
    input.placeholder = '';

    const schedule = (callback, delay) => {
        controller.timer = window.setTimeout(callback, delay);
    };

    const setPlaceholder = (value) => {
        if (!document.body.contains(input)) {
            controller.stopped = true;
            return;
        }
        input.placeholder = value;
    };

    const startNext = () => {
        if (controller.stopped) return;

        const suggestion = controller.suggestions[controller.index];
        const fullText = `${PLACEHOLDER_EXAMPLE_PREFIX}${suggestion}`;
        const typeDelay = reduceMotion ? 0 : PLACEHOLDER_TYPE_MS;

        if (reduceMotion) {
            setPlaceholder(fullText);
            schedule(() => {
                advancePlaceholderSuggestion(controller);
                startNext();
            }, PLACEHOLDER_ROLLOVER_CYCLE_MS);
            return;
        }

        typeText(fullText, 0, typeDelay);
    };

    const typeText = (fullText, position, typeDelay) => {
        if (controller.stopped) return;

        setPlaceholder(fullText.slice(0, position));
        if (position < fullText.length) {
            schedule(() => typeText(fullText, position + 1, typeDelay), typeDelay);
            return;
        }

        const typeDuration = fullText.length * PLACEHOLDER_TYPE_MS;
        const exampleLength = Math.max(0, fullText.length - PLACEHOLDER_EXAMPLE_PREFIX.length);
        const backspaceDuration = exampleLength * PLACEHOLDER_BACKSPACE_MS;
        const holdDelay = Math.max(1200, PLACEHOLDER_ROLLOVER_CYCLE_MS - typeDuration - backspaceDuration);
        schedule(() => backspaceText(fullText, fullText.length), holdDelay);
    };

    const backspaceText = (fullText, position) => {
        if (controller.stopped) return;

        setPlaceholder(fullText.slice(0, position));
        if (position > PLACEHOLDER_EXAMPLE_PREFIX.length) {
            schedule(() => backspaceText(fullText, position - 1), PLACEHOLDER_BACKSPACE_MS);
            return;
        }

        advancePlaceholderSuggestion(controller);
        schedule(startNext, 0);
    };

    startNext();
    return controller;
}

function createPlaceholderFadeRollover({ inputId, suggestions, ariaLabel, className }) {
    const input = document.getElementById(inputId);
    const cleanSuggestions = getRandomizedPlaceholderSuggestions(suggestions, inputId);

    if (!input || cleanSuggestions.length === 0) return null;

    const controller = {
        input,
        suggestions: cleanSuggestions,
        scope: inputId,
        index: 0,
        timer: null,
        stopped: false
    };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    input.classList.add(className, 'placeholder-fade-input');
    input.classList.remove('placeholder-typewriter-input');
    input.setAttribute('aria-label', input.getAttribute('aria-label') || ariaLabel);
    input.placeholder = PLACEHOLDER_EXAMPLE_PREFIX.trimEnd();

    let valueEl = document.getElementById(`${inputId}FadeValue`);
    if (!valueEl) {
        valueEl = document.createElement('span');
        valueEl.id = `${inputId}FadeValue`;
        valueEl.className = 'placeholder-fade-value';
        valueEl.setAttribute('aria-hidden', 'true');
        input.insertAdjacentElement('afterend', valueEl);
    } else {
        valueEl.classList.add('placeholder-fade-value');
    }

    if (input.__placeholderFadeSync) {
        input.removeEventListener('input', input.__placeholderFadeSync);
        input.removeEventListener('focus', input.__placeholderFadeSync);
        input.removeEventListener('blur', input.__placeholderFadeSync);
    }

    const syncFadeVisibility = () => {
        valueEl.classList.toggle('is-hidden', String(input.value || '').length > 0);
    };

    input.__placeholderFadeSync = syncFadeVisibility;
    input.addEventListener('input', syncFadeVisibility);
    input.addEventListener('focus', syncFadeVisibility);
    input.addEventListener('blur', syncFadeVisibility);
    syncFadeVisibility();

    const schedule = (callback, delay) => {
        controller.timer = window.setTimeout(callback, delay);
    };

    const setPlaceholder = (suggestion) => {
        if (!document.body.contains(input)) {
            controller.stopped = true;
            return;
        }
        valueEl.textContent = suggestion;
    };

    const showNext = () => {
        if (controller.stopped) return;

        const suggestion = controller.suggestions[controller.index];
        if (reduceMotion) {
            setPlaceholder(suggestion);
            advancePlaceholderSuggestion(controller);
            schedule(showNext, PLACEHOLDER_ROLLOVER_CYCLE_MS);
            return;
        }

        valueEl.classList.add('placeholder-fade-out');
        schedule(() => {
            if (controller.stopped) return;
            setPlaceholder(suggestion);
            valueEl.classList.remove('placeholder-fade-out');
            valueEl.classList.add('placeholder-fade-in');
            schedule(() => valueEl.classList.remove('placeholder-fade-in'), 360);
            advancePlaceholderSuggestion(controller);
            schedule(showNext, PLACEHOLDER_ROLLOVER_CYCLE_MS);
        }, 260);
    };

    showNext();
    return controller;
}

export function initDescriptionRollover() {
    stopPlaceholderTypewriter(descriptionRolloverController);
    descriptionRolloverController = createPlaceholderTypewriter({
        inputId: 'txDescription',
        suggestions: DESCRIPTION_ROLLOVER_SUGGESTIONS,
        ariaLabel: 'Transaction description',
        className: 'description-rollover-input'
    });
}

export function initCategoryNameRollover() {
    stopPlaceholderController(categoryNameRolloverController);
    categoryNameRolloverController = createPlaceholderFadeRollover({
        inputId: 'catInputName',
        suggestions: DESCRIPTION_ROLLOVER_SUGGESTIONS,
        ariaLabel: 'Category name',
        className: 'category-name-rollover-input'
    });
}

function setTransactionDescription(value) {
    const descInput = document.getElementById('txDescription');
    if (!descInput) return;

    descInput.value = value;
    descInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function cleanNameTyping(value) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').substring(0, NAME_MAX_LENGTH);
}

function jsArg(value) {
    return JSON.stringify(String(value ?? ''))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatPayFrequency(value) {
    const labels = {
        daily: 'Daily',
        weekly: 'Weekly',
        'bi-weekly': 'Bi-Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly'
    };
    return labels[value] || '';
}

function getPrivacyValueElement(container) {
    return container?.querySelector('.blur-value') || null;
}

function scramblePrivacyText(text) {
    return String(text || '').replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
}

function stopPrivacyScramble(container) {
    if (!container) return;
    const valueEl = getPrivacyValueElement(container);
    if (!valueEl) return;

    const blurId = container.dataset.blurId;
    if (blurId && privacyScrambleTimers.has(blurId)) {
        clearInterval(privacyScrambleTimers.get(blurId));
        privacyScrambleTimers.delete(blurId);
    }

    const realText = container.dataset.realValue ?? valueEl.textContent ?? '';
    valueEl.textContent = realText;
}

function startPrivacyScramble(container) {
    if (!container) return;
    const valueEl = getPrivacyValueElement(container);
    if (!valueEl) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        stopPrivacyScramble(container);
        return;
    }

    const blurId = container.dataset.blurId || (container.dataset.blurId = generateId());
    if (privacyScrambleTimers.has(blurId)) return;

    const tick = () => {
        if (container.classList.contains('revealed')) return;
        const realText = container.dataset.realValue ?? valueEl.textContent ?? '';
        valueEl.textContent = scramblePrivacyText(realText);
    };

    tick();
    privacyScrambleTimers.set(blurId, setInterval(tick, PRIVACY_SCRAMBLE_INTERVAL_MS));
}

function syncPrivacyDisplay(container, nextText = null) {
    if (!container) return;
    const valueEl = getPrivacyValueElement(container);
    if (!valueEl) return;

    if (nextText !== null && nextText !== undefined) {
        container.dataset.realValue = String(nextText);
    } else if (!container.dataset.realValue) {
        container.dataset.realValue = String(valueEl.textContent || '');
    }

    if (container.classList.contains('revealed')) {
        stopPrivacyScramble(container);
    } else {
        startPrivacyScramble(container);
    }
}

// V2 Bulk Edit State
let selectedCategories = new Set();
let isCategoryEditMode = false;

// ==========================================
// 1. RENDERING ENGINE
// ==========================================

export function render() {
    renderZBBDashboard();
    renderCategoryList();
    renderRecentTransactions();
    renderBudgetCalendar();
    renderSavingsTab();
    renderIncomeTab();
    renderFormCategories();
}

function getCategoryTransactionSummary(categoryName, categoryType = 'expense') {
    const normalizedType = categoryType || 'expense';
    const txs = State.getTransactions ? State.getTransactions() : [];
    const matchingTransactions = txs.filter(tx =>
        tx &&
        !tx.isDeleted &&
        tx.category === categoryName &&
        (tx.type || 'expense') === normalizedType
    );
    const total = matchingTransactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    return {
        count: matchingTransactions.length,
        total
    };
}

function getCategoryBudgetSummary(category) {
    const budget = Math.max(0, parseFloat(category?.budget) || 0);
    const txSummary = getCategoryTransactionSummary(category?.name || '', category?.type || 'expense');
    const spent = txSummary.total;
    const left = budget - spent;

    return {
        budget,
        spent,
        left,
        transactionCount: txSummary.count
    };
}

function getCategoryMetricMode() {
    return window.currentDrillDownMetricMode === 'left' ? 'left' : 'spent';
}

function getCategoryMetricDisplay({ budget = 0, spent = 0 } = {}) {
    const budgetAmount = Math.max(0, parseFloat(budget) || 0);
    const spentAmount = Math.max(0, parseFloat(spent) || 0);
    const leftAmount = budgetAmount - spentAmount;
    const mode = getCategoryMetricMode();
    const value = mode === 'left' ? leftAmount : spentAmount;
    const colorValue = mode === 'left'
        ? leftAmount
        : (spentAmount <= 0.005 ? 0 : (leftAmount < -0.005 ? -spentAmount : spentAmount));

    return {
        mode,
        label: mode === 'left' ? 'Left' : 'Spent',
        prefix: mode === 'left' && leftAmount < -0.005 ? '-' : '',
        amount: Math.abs(value),
        color: getBudgetMetricColor(colorValue)
    };
}

// ==========================================
// 2. CATEGORY LIST & BULK EDIT (Fixed)
// ==========================================

export function toggleCategoryEditMode() {
    isCategoryEditMode = !isCategoryEditMode;
    selectedCategories.clear();
    renderCategoryList();
}

export function toggleCategorySelection(name, isChecked) {
    if (isChecked) {
        selectedCategories.add(name);
    } else {
        selectedCategories.delete(name);
    }
    renderCategoryList();
}

export function renderCategoryList() {
    const listContainer = document.getElementById('categoryList');
    const countEl = document.getElementById('sortCatCount');
    if (!listContainer) return;

    // Grab all categories, but ONLY keep the ones that are NOT income
        const allCategories = State.getCategories() || [];
        const categories = allCategories.filter(cat =>
    cat.type !== 'income' &&
    cat.type !== 'debt' &&
    cat.type !== 'savings' &&
    cat.type !== 'sinking_fund'
);    if (countEl) countEl.textContent = `${categories.length} categories`;

    // 1. EMPTY STATE
    if (categories.length === 0) {
        isCategoryEditMode = false;
        listContainer.innerHTML = `
            <div class="empty-state-container" style="text-align: center; padding: 2rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.8;">📁</div>
                <p style="color: var(--text-dim); margin-bottom: 1.25rem; font-size: 0.95rem;">No categories yet. Create one or use Quick Add to get started.</p>
                <button class="btn-primary-dashed" onclick="window.openCategoryModal('create')">
                    + Create Category
                </button>
            </div>
        `;
        return;
    }

    // 2. CATEGORY ITEMS (Reactive Version)
    const categoriesHTML = categories.map(cat => {
        // ... [Keep your checkbox/edit mode logic exactly as before] ...
        const isChecked = selectedCategories.has(cat.name) ? 'checked' : '';
        const checkboxHTML = isCategoryEditMode
            ? `<input type="checkbox" class="bulk-select-cb" data-cat-name="${esc(cat.name)}" ${isChecked} onclick="event.stopPropagation()" onchange="window.toggleCategorySelection(${jsArg(cat.name)}, this.checked)">`
            : '';
        const rowAttrs = isCategoryEditMode
            ? `onclick="const cb=this.querySelector('.bulk-select-cb'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); this.click();}" role="button" tabindex="0" aria-label="Select ${esc(cat.name)}"`
            : `onclick="window.openCategoryDrillDown(${jsArg(cat.name)}, ${jsArg(cat.icon || '')})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); this.click();}" role="button" tabindex="0" aria-label="Open ${esc(cat.name)}"`;
        const cursorStyle = 'pointer';
        const chevronDisplay = isCategoryEditMode ? 'none' : 'block';

        // --- Calculate Data for Render ---
        const { budget, spent, left: remaining, transactionCount } = getCategoryBudgetSummary(cat);
        const symbol = State.getSymbol ? State.getSymbol() : '$';
        const metric = getCategoryMetricDisplay({ budget, spent });

        let pct = budget > 0 ? (spent / budget) * 100 : 0;
        let barColor = 'var(--green)';
        let barClass = 'budget-safe';
        if (pct > 100) { barColor = 'var(--red)'; barClass = 'budget-danger'; }
        else if (pct > 80) { barColor = '#f59e0b'; barClass = 'budget-warn'; }
        pct = Math.min(pct, 100);

        const createdDate = cat.createdAt ? formatDate(cat.createdAt.split('T')[0]) : '';

        return `
        <div class="category-item" id="cat-card-${esc(cat.name.replace(/\s+/g, '-'))}" style="display: flex; align-items: center; padding-left: ${isCategoryEditMode ? '0.5rem' : '0'};" ${rowAttrs}>
            ${checkboxHTML}
            <div style="flex: 1; display: flex; align-items: center; cursor: ${cursorStyle}; transition: transform 0.1s ease; border: 1px solid transparent; padding: 0.5rem 0;">
                <div class="category-icon-box ${barClass}" id="icon-${esc(cat.name.replace(/\s+/g, '-'))}">
                    <span class="category-icon">${esc(cat.icon || '📁')}</span>
                </div>
                <div class="category-body">
                    <div class="category-header">
                        <div class="category-name-text">${esc(cat.name)}</div>
                    </div>

                    <!-- Added IDs for Reactivity -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; font-size: 0.8rem;">
                        <span style="color: var(--text-dim); font-weight: 500;">Budgeted: <span style="color: var(--text); font-weight: 700;" id="budget-val-${esc(cat.name.replace(/\s+/g, '-'))}">${symbol}${formatMoney(budget)}</span></span>
                        <span style="color: var(--text-dim); font-weight: 500;"><span id="metric-label-${esc(cat.name.replace(/\s+/g, '-'))}">${metric.label}</span>: <span style="color: ${metric.color}; font-weight: 700;" id="spent-val-${esc(cat.name.replace(/\s+/g, '-'))}">${metric.prefix}${symbol}${formatMoney(metric.amount)}</span></span>
                    </div>

                    <!-- Added ID for Bar Width & Color -->
                    <div class="budget-bar-container" style="width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 0.35rem;">
                        <div class="budget-bar-fill ${barClass}" id="bar-${esc(cat.name.replace(/\s+/g, '-'))}" style="height: 100%; width: ${pct}%; background-color: ${barColor}; border-radius: 3px; transition: width 0.3s ease, background-color 0.3s ease;"></div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-size: 0.65rem; color: var(--text-dim); opacity: 0.78;">
                        <span>${createdDate ? `Created ${createdDate}` : ''}</span>
                        <span style="font-weight: 700; opacity: 0.95;">Transactions: ${transactionCount}</span>
                    </div>
                </div>
                <div style="color: var(--text-dim); font-size: 1.5rem; padding-right: 0.5rem; opacity: 0.5; display: ${chevronDisplay};">
                    ›
                </div>
            </div>
        </div>
        `;
    }).join('');

    // 3. DYNAMIC BOTTOM BAR
    let bottomBarHTML = '';

    if (isCategoryEditMode) {
        const selectedCount = selectedCategories.size;
        const btnDisabledStyle = selectedCount === 0 ? 'opacity: 0.5; cursor: not-allowed; border-color: var(--border); color: var(--text-dim);' : 'cursor: pointer;';
        const delClick = selectedCount === 0 ? '' : 'onclick="window.executeBulkDelete()"';
        const iconClick = selectedCount === 0 ? '' : 'onclick="window.openBatchIconPicker()"';

        bottomBarHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1.5rem 0 2rem 0; margin-top: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-hover); border: 1px dashed var(--border); border-radius: 8px; padding: 0.75rem 1rem;">
                    <span style="font-weight: 600; color: var(--text);">${selectedCount} Selected</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-small" style="${btnDisabledStyle} background: transparent; color: var(--text); border: 1px solid var(--border); transition: all 0.2s ease; padding: 0.4rem 0.8rem;" ${iconClick}>
                            🎨 Icon
                        </button>
                        <button class="btn-small" style="${btnDisabledStyle} ${selectedCount > 0 ? 'color: white; background: var(--red); border-color: var(--red);' : ''} transition: all 0.2s ease; padding: 0.4rem 0.8rem;" ${delClick}>
                            Delete
                        </button>
                    </div>
                </div>
                <button class="btn-edit-mode" style="width: 100%; text-align: center; padding: 0.75rem; background: transparent; border: 1px solid var(--text-dim); color: var(--text); font-weight: 600; border-radius: 8px; cursor: pointer;" onclick="window.toggleCategoryEditMode()">
                    Done Editing
                </button>
            </div>
        `;
    } else {
        bottomBarHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; padding: 1.5rem 0 2rem 0; margin-top: auto;">
                <button class="btn-primary-dashed" onclick="window.openCategoryModal('create')">
                    + Create Category
                </button>
                <button class="btn-edit-mode" style="padding: 0.75rem 1.2rem; background: transparent; border: 1px solid var(--border); color: var(--text); border-radius: 8px; font-weight: 600; cursor: pointer;" onclick="window.toggleCategoryEditMode()">
                    Edit
                </button>
            </div>
        `;
    }

    listContainer.innerHTML = categoriesHTML + bottomBarHTML;
}

// --- BULK ACTION OVERLAYS ---

export function executeBulkDelete() {
    if (selectedCategories.size === 0) return;

    const panel = document.querySelector('.category-panel') || document.body;
    let existingOverlay = document.getElementById('bulkDeleteOverlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bulkDeleteOverlay';
    overlay.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; border-radius: inherit;
        opacity: 0; transition: opacity 0.2s ease;
    `;

    const categoryWord = selectedCategories.size === 1 ? 'Category' : 'Categories';

    overlay.innerHTML = `
        <div style="background: var(--surface); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); width: 85%; max-width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: translateY(20px); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="color: var(--text); font-weight: 700; font-size: 1.15rem; margin-bottom: 0.5rem;">Delete ${categoryWord}?</div>
            <div style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 1.5rem; line-height: 1.4;">
                You are about to delete <span style="color: var(--red); font-weight: 700;">${selectedCategories.size}</span> ${categoryWord.toLowerCase()}. This action cannot be undone.
            </div>
            <div style="display: flex; gap: 0.75rem;">
                <button onclick="window.confirmBulkDelete()" style="flex: 1; padding: 0.65rem; background: var(--red); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">Delete</button>
                <button onclick="window.cancelBulkDelete()" style="flex: 1; padding: 0.65rem; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Cancel</button>
            </div>
        </div>
    `;
    panel.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.firstElementChild.style.transform = 'translateY(0)';
    });
}

export function confirmBulkDelete() {
    if (selectedCategories.size === 0) return;

    // Instead of deleting directly, use the new batch delete function in State
    if (State.deleteCategoriesBatch) {
        State.deleteCategoriesBatch(Array.from(selectedCategories));
    } else {
        // Fallback if state.js isn't updated
        Array.from(selectedCategories).forEach(cat => State.deleteCategory(cat));
    }

    selectedCategories.clear();
    isCategoryEditMode = false;

    const overlay = document.getElementById('bulkDeleteOverlay');
    if (overlay) overlay.remove();

    render();
    if (window.showToast) window.showToast('✅ Deletion complete');
}

export function cancelBulkDelete() {
    const overlay = document.getElementById('bulkDeleteOverlay');
    if (!overlay) return;

    overlay.style.opacity = '0';
    overlay.firstElementChild.style.transform = 'translateY(20px)';
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 200);
}

export function openBatchIconPicker() {
    if (selectedCategories.size === 0) return;

    const panel = document.querySelector('.category-panel') || document.body;
    let existingOverlay = document.getElementById('batchIconOverlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'batchIconOverlay';
    overlay.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; border-radius: inherit;
        opacity: 0; transition: opacity 0.2s ease;
    `;

    overlay.innerHTML = `
        <div style="background: var(--surface); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); width: 85%; max-width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: translateY(20px); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="color: var(--text); font-weight: 700; font-size: 1.15rem; margin-bottom: 0.5rem;">Change Icon</div>
            <div style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 1.5rem;">
                Set a new icon for <span style="color: var(--accent); font-weight: 700;">${selectedCategories.size}</span> categories.
            </div>

            <div style="position: relative; display: inline-block; margin-bottom: 1.5rem;">
                <input type="text" id="batchIconInput" placeholder="📁" style="font-size: 2.5rem; width: 80px; height: 80px; text-align: center; background: var(--bg); border: 2px dashed var(--border); border-radius: 12px; color: var(--text); outline: none; transition: border-color 0.2s; cursor: pointer;" readonly>
            </div>

            <div style="display: flex; gap: 0.75rem;">
                <button onclick="window.confirmBatchIcon()" style="flex: 1; padding: 0.65rem; background: var(--accent); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">Apply</button>
                <button onclick="window.cancelBatchIcon()" style="flex: 1; padding: 0.65rem; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Cancel</button>
            </div>
        </div>
    `;
    panel.appendChild(overlay);

    const input = document.getElementById('batchIconInput');
    input.addEventListener('focus', () => input.style.borderColor = 'var(--accent)');
    input.addEventListener('blur', () => input.style.borderColor = 'var(--border)');

    // Attach the interactive grid!
    attachEmojiPicker('batchIconInput');

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.firstElementChild.style.transform = 'translateY(0)';
    });
}

export function confirmBatchIcon() {
    const input = document.getElementById('batchIconInput');
    const newIcon = input ? input.value.trim() : '';

    if (!newIcon) {
        if (window.showToast) window.showToast('⚠️ Please enter an emoji icon');
        return;
    }

    if (State.changeCategoriesIconBatch) {
        State.changeCategoriesIconBatch(Array.from(selectedCategories), newIcon);
    } else {
        // Fallback if state.js isn't updated
        Array.from(selectedCategories).forEach(catName => {
           State.editCategory(catName, catName, newIcon);
        });
    }

    selectedCategories.clear();
    isCategoryEditMode = false;
    cancelBatchIcon();
    render();
    if (window.showToast) window.showToast('✅ Icons updated successfully');
}

export function cancelBatchIcon() {
    const overlay = document.getElementById('batchIconOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.firstElementChild.style.transform = 'translateY(20px)';
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 200);
}

// ==========================================
// 3. ZBB DASHBOARD & PRIVACY BLUR
// ==========================================

export function renderZBBDashboard() {
    const incEl = document.getElementById('zbbIncome');
    const tbbEl = document.getElementById('zbbTBB');
    const assEl = document.getElementById('zbbAssigned');
    if (!incEl || !tbbEl || !assEl) return;

    const allTxs = State.getTransactions() || [];
    const categories = State.getCategories() || [];
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyIncome = allTxs
        .filter(tx => tx.type === 'income')
        .filter(tx => {
            const txDate = new Date(tx.date || tx.createdAt);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        })
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const budgetCategories = categories.filter(cat => cat.type !== 'income');
    const assignedFunds = budgetCategories.reduce((sum, cat) => sum + (Number(cat.budget) || 0), 0);
    const tbb = monthlyIncome - assignedFunds;

    incEl.textContent = `${symbol}${formatMoney(monthlyIncome)}`;
    assEl.textContent = `${symbol}${formatMoney(assignedFunds)}`;
    tbbEl.textContent = `${tbb < 0 ? '-' : ''}${symbol}${formatMoney(Math.abs(tbb))}`;

    const tbbContainer = tbbEl.closest('.money-container');
    if (tbbContainer) {
        tbbContainer.classList.remove('positive', 'negative', 'neutral');
        tbbContainer.classList.add(tbb > 0.01 ? 'positive' : (tbb < -0.01 ? 'negative' : 'neutral'));
    }

    const tbbSub = document.getElementById('zbbTBBSub');
    if (tbbSub) {
        if (tbb > 0.01) tbbSub.textContent = "You still have money to assign.";
        else if (tbb < -0.01) tbbSub.textContent = "Over budget! Move funds from other categories.";
        else tbbSub.textContent = "Perfect! You've given every dollar a job.";
    }

    const barEl = document.getElementById('zbbAssignedBar');
    if (barEl) {
        let pct = monthlyIncome > 0 ? (assignedFunds / monthlyIncome) * 100 : 0;
        barEl.style.width = `${Math.min(pct, 100)}%`;
        barEl.style.backgroundColor = tbb < -0.01 ? 'var(--red)' : (tbb > 0.01 ? 'var(--accent)' : 'var(--green)');
    }

    const statusIcon = document.getElementById('zbbStatusIcon');
    const statusText = document.getElementById('zbbStatusText');
    if (statusIcon && statusText) {
        if (Math.abs(tbb) <= 0.01 && monthlyIncome > 0) {
            statusIcon.textContent = '🎯';
            statusText.textContent = 'Your budget is ready. Track your spending below.';
        } else if (monthlyIncome === 0) {
            statusIcon.textContent = '💰';
            statusText.textContent = 'Add your monthly income to start budgeting.';
        } else {
            statusIcon.textContent = '⚠️';
            statusText.textContent = `Fix Left to Budget (${symbol}${formatMoney(Math.abs(tbb))}) before tracking.`;
        }
    }

    if (typeof window.zbbSummaryCollapsed === 'undefined') {
        window.zbbSummaryCollapsed = State.getDashboardSummaryCollapsed ? State.getDashboardSummaryCollapsed() : true;
    }

    applyDashboardSummaryState();
    setupDashboardSummaryGestureToggle();
    setupPrivacyBlur();
}

function isDesktopPointer() {
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function applyDashboardSummaryState() {
    const card = document.getElementById('zbbSummaryCard');
    const body = document.getElementById('zbbSummaryBody');
    const toggle = document.getElementById('zbbSummaryToggle');
    if (!card || !body || !toggle) return;

    const collapsed = Boolean(window.zbbSummaryCollapsed);
    card.classList.toggle('is-collapsed', collapsed);
    body.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    if (body.toggleAttribute) {
        body.toggleAttribute('inert', collapsed);
    } else if (collapsed) {
        body.setAttribute('inert', '');
    } else {
        body.removeAttribute('inert');
    }

    body.querySelectorAll('.money-container').forEach(container => {
        container.tabIndex = collapsed ? -1 : 0;
    });

    const textEl = toggle.querySelector('.zbb-summary-toggle-text');
    if (textEl) textEl.textContent = collapsed ? '+' : '-';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? 'Show budget snapshot' : 'Hide budget snapshot');
}

export function toggleZBBSummary() {
    const current = typeof window.zbbSummaryCollapsed === 'undefined'
        ? (State.getDashboardSummaryCollapsed ? State.getDashboardSummaryCollapsed() : true)
        : Boolean(window.zbbSummaryCollapsed);

    window.zbbSummaryCollapsed = !current;
    applyDashboardSummaryState();
}

function setupDashboardSummaryGestureToggle() {
    const card = document.getElementById('zbbSummaryCard');
    const header = card?.querySelector('.zbb-summary-header');
    if (!card || !header || header.dataset.gestureInit) return;

    header.dataset.gestureInit = 'true';
    header.addEventListener('click', (event) => {
        if (isDesktopPointer()) return;
        if (event.target.closest('button, a, input, select, textarea')) return;
        window.toggleZBBSummary();
    });
    header.addEventListener('keydown', (event) => {
        if (isDesktopPointer()) return;
        if (event.target.closest('button, a, input, select, textarea')) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        window.toggleZBBSummary();
    });
}

function setupPrivacyBlur() {
    document.querySelectorAll('.money-container').forEach(container => {
        const valueEl = getPrivacyValueElement(container);
        if (!valueEl) return;

        const card = container.closest('.zbb-card');
        const labelText = container.dataset.revealLabel || card?.querySelector('.card-label')?.textContent || "Amount";
        const blurId = container.dataset.blurId || (container.dataset.blurId = generateId());

        if (!container.dataset.blurInit) {
            container.dataset.blurInit = "true";

            if (card && !card.querySelector('.timer-svg')) {
                card.insertAdjacentHTML('beforeend', `
                    <svg class="timer-svg" xmlns="http://www.w3.org/2000/svg">
                        <rect class="timer-track" pathLength="100"></rect>
                        <rect class="timer-rect" pathLength="100"></rect>
                    </svg>
                `);
            }

            const hide = () => {
                container.classList.remove('revealed');
                container.setAttribute('aria-pressed', 'false');
                container.setAttribute('aria-label', `Show ${labelText}. Currently hidden for privacy.`);

                if (card) {
                    const anyRevealed = card.querySelector('.money-container.revealed');
                    if (!anyRevealed) {
                        card.classList.remove('reveal-active');
                        const rect = card.querySelector('.timer-rect');
                        if (rect) {
                            rect.style.animation = 'none';
                            void rect.offsetWidth;
                            rect.style.animation = null;
                        }
                    }
                }

                if (privacyTimers.has(blurId)) {
                    clearTimeout(privacyTimers.get(blurId).hide);
                    clearTimeout(privacyTimers.get(blurId).warn);
                }
                privacyTimers.delete(blurId);
                syncPrivacyDisplay(container);
            };

            const toggleReveal = () => {
                if (container.classList.contains('revealed')) {
                    hide();
                    return;
                }

                container.classList.add('revealed');
                container.setAttribute('aria-pressed', 'true');
                container.setAttribute('aria-label', `${labelText} revealed. Will hide automatically in 15 seconds.`);

                if (card) card.classList.add('reveal-active');
                if (navigator.vibrate) navigator.vibrate(50);

                if (privacyTimers.has(blurId)) {
                    clearTimeout(privacyTimers.get(blurId).hide);
                    clearTimeout(privacyTimers.get(blurId).warn);
                }

                const warnTimer = setTimeout(() => {
                    container.setAttribute('aria-label', `${labelText} will hide in 5 seconds.`);
                }, 10000);

                const hideTimer = setTimeout(() => { hide(); }, 15000);
                privacyTimers.set(blurId, { warn: warnTimer, hide: hideTimer });
                syncPrivacyDisplay(container);
            };

            container.addEventListener('click', toggleReveal);
            container.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleReveal();
                }
            });
        }

        syncPrivacyDisplay(container, valueEl.textContent);
    });
}

// ==========================================
// 4. SAVINGS & INCOME TABS
// ==========================================
function getTotalSavingsAmount() {
    const txs = State.getTransactions ? State.getTransactions() : [];
    return txs.reduce((sum, tx) => {
        if (tx.tag !== 'savings' && tx.type !== 'savings') return sum;
        const amount = Math.abs(parseFloat(tx.amount) || 0);
        return sum + (tx.type === 'expense' ? -amount : amount);
    }, 0);
}

function hasActiveDebt() {
    const categories = State.getCategories ? State.getCategories() : [];
    return categories.some(c => c.type === 'debt' && (parseFloat(c.balance) || 0) > 0);
}

function getMonthlyEmergencyFundBase() {
    const categories = State.getCategories ? State.getCategories() : [];
    return categories.reduce((sum, cat) => {
        const type = cat.type || 'expense';
        if (type !== 'expense') return sum;
        return sum + Math.max(0, parseFloat(cat.budget) || 0);
    }, 0);
}

function hasEmergencyFundUserInteraction(totalSavings = getTotalSavingsAmount()) {
    if (State.hasEmergencyFundInteraction && State.hasEmergencyFundInteraction()) return true;

    const categories = State.getCategories ? State.getCategories() : [];
    const transactions = State.getTransactions ? State.getTransactions() : [];
    return categories.length > 0 ||
        transactions.length > 0 ||
        Math.abs(parseFloat(totalSavings) || 0) > EMERGENCY_FUND_RECOMMENDATION_TOLERANCE;
}

function markEmergencyFundInteracted() {
    if (State.setEmergencyFundInteracted && !State.hasEmergencyFundInteraction?.()) {
        State.setEmergencyFundInteracted(true);
    }
    document.querySelector('#view-savings .savings-total-summary')?.classList.remove('is-starter-fund');
}

function getSavingsFundStage(totalSavings) {
    const savedGoal = State.getSavingsGoal ? State.getSavingsGoal() : STARTER_EMERGENCY_FUND_GOAL;
    const hasUserInteraction = hasEmergencyFundUserInteraction(totalSavings);
    const savedEmergencyFundMonths = State.getEmergencyFundMonths ? State.getEmergencyFundMonths() : 3;
    const emergencyFundMonths = hasUserInteraction ? savedEmergencyFundMonths : 3;
    const monthlyEmergencyFundBase = getMonthlyEmergencyFundBase();
    const recommendedEmergencyGoal = Math.max(STARTER_EMERGENCY_FUND_GOAL, monthlyEmergencyFundBase * emergencyFundMonths);
    const debtIsActive = hasActiveDebt();
    const goalOverride = hasEmergencyFundGoalOverride();
    const isStarterFund = !hasUserInteraction && !debtIsActive && !goalOverride;
    const emergencyGoal = goalOverride
        ? Math.max(STARTER_EMERGENCY_FUND_GOAL, parseFloat(savedGoal) || STARTER_EMERGENCY_FUND_GOAL)
        : (isStarterFund ? STARTER_EMERGENCY_FUND_GOAL : recommendedEmergencyGoal);
    const countedSavings = debtIsActive ? Math.min(totalSavings, STARTER_EMERGENCY_FUND_GOAL) : totalSavings;
    const isEmergencyFund = !debtIsActive;

    return {
        isEmergencyFund,
        title: isEmergencyFund ? 'Month Emergency Fund:' : 'Emergency Fund:',
        goal: isEmergencyFund ? emergencyGoal : STARTER_EMERGENCY_FUND_GOAL,
        emergencyGoal,
        emergencyFundMonths,
        monthlyEmergencyFundBase,
        recommendedEmergencyGoal,
        goalOverride,
        isStarterFund,
        hasActiveDebt: debtIsActive,
        countedSavings
    };
}

function getEmergencyFundGoalValidation(fundStage, amount = fundStage?.emergencyGoal) {
    const months = parseInt(fundStage?.emergencyFundMonths, 10) || 3;
    const monthlyBase = Math.max(0, parseFloat(fundStage?.monthlyEmergencyFundBase) || 0);
    const expected = Math.max(STARTER_EMERGENCY_FUND_GOAL, monthlyBase * months);
    const currentAmount = Math.max(0, parseFloat(amount) || 0);
    const canValidate = Boolean(fundStage?.isEmergencyFund) && monthlyBase > 0;
    const isValid = !canValidate || Math.abs(currentAmount - expected) < EMERGENCY_FUND_RECOMMENDATION_TOLERANCE;

    return { canValidate, isValid, expected, monthlyBase, months };
}

function hasEmergencyFundGoalOverride() {
    return State.hasEmergencyFundGoalOverride ? State.hasEmergencyFundGoalOverride() : false;
}

function setEmergencyFundGoalState(amount, hasOverride = false) {
    if (State.setEmergencyFundGoal) {
        State.setEmergencyFundGoal(amount, hasOverride);
        return;
    }

    if (State.setSavingsGoal) State.setSavingsGoal(amount);
    if (State.setEmergencyFundGoalOverride) State.setEmergencyFundGoalOverride(hasOverride);
}

function getRecommendedEmergencyFundGoal(fundStage = getSavingsFundStage(getTotalSavingsAmount())) {
    const validation = getEmergencyFundGoalValidation(fundStage);
    return validation.canValidate
        ? Math.max(STARTER_EMERGENCY_FUND_GOAL, validation.expected)
        : STARTER_EMERGENCY_FUND_GOAL;
}

function isEmergencyFundFullyFunded(fundStage, totalSavings = getTotalSavingsAmount()) {
    const goal = Math.max(0, parseFloat(fundStage?.goal) || STARTER_EMERGENCY_FUND_GOAL);
    const countedSavings = Math.max(0, parseFloat(fundStage?.countedSavings ?? totalSavings) || 0);
    return goal > 0 && countedSavings >= goal - EMERGENCY_FUND_RECOMMENDATION_TOLERANCE;
}

function getDebtLockedEmergencyFundMessage(symbol = State.getSymbol ? State.getSymbol() : '$') {
    return `Currently capped at ${symbol}${STARTER_EMERGENCY_FUND_GOAL.toLocaleString()} when debt is displayed.`;
}

window.showDebtLockedSavingsMessage = function(event) {
    event?.preventDefault?.();
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const message = getDebtLockedEmergencyFundMessage(symbol);
    if (window.showToast) window.showToast(message);
};

function wouldExceedDebtSavingsCap(nextSavingsAmount) {
    const nextAmount = parseFloat(nextSavingsAmount) || 0;
    return hasActiveDebt() && nextAmount > STARTER_EMERGENCY_FUND_GOAL + 0.005;
}

function getSavingsTransactionDelta(tx) {
    if (!tx || (tx.tag !== 'savings' && tx.type !== 'savings')) return 0;

    const amount = Math.abs(parseFloat(tx.amount) || 0);
    return tx.type === 'expense' ? -amount : amount;
}

function blockDebtLockedSavingsIncreaseIfNeeded(tx, event) {
    const savingsDelta = getSavingsTransactionDelta(tx);
    if (savingsDelta <= 0) return false;

    if (!wouldExceedDebtSavingsCap(getTotalSavingsAmount() + savingsDelta)) return false;

    window.showDebtLockedSavingsMessage(event);
    if (window.renderSavingsTab) window.renderSavingsTab();
    return true;
}

function shouldShowEmergencyFundCard(totalSavings = getTotalSavingsAmount()) {
    return (parseFloat(totalSavings) || 0) > 0.005;
}

function getEmergencyFundCardData(totalSavings = getTotalSavingsAmount(), fundStage = getSavingsFundStage(totalSavings)) {
    const amount = Math.max(0, parseFloat(totalSavings) || 0);
    const goal = Math.max(0, parseFloat(fundStage?.goal) || STARTER_EMERGENCY_FUND_GOAL);
    const percent = goal > 0 ? Math.min(100, Math.max(0, (amount / goal) * 100)) : 0;

    return {
        amount,
        goal,
        percent,
        hasCard: shouldShowEmergencyFundCard(amount)
    };
}

function generateEmergencyFundCardHTML(totalSavings = getTotalSavingsAmount(), fundStage = getSavingsFundStage(totalSavings)) {
    const card = getEmergencyFundCardData(totalSavings, fundStage);
    if (!card.hasCard) return '';

    const symbol = State.getSymbol ? State.getSymbol() : '$';

    return `
        <div class="savings-goal-card emergency-fund-auto-card" role="button" tabindex="0" aria-label="Open ${EMERGENCY_FUND_CARD_NAME} withdrawal panel" onclick="window.openEmergencyFundPanel(event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openEmergencyFundPanel(event);}">
            <div class="emergency-fund-card-head">
                <div class="emergency-fund-card-icon" aria-hidden="true">&#128737;</div>
                <div class="emergency-fund-card-title-wrap">
                    <div class="emergency-fund-card-title">${EMERGENCY_FUND_CARD_NAME}</div>
                    <div class="emergency-fund-card-subtitle">Withdrawals only</div>
                </div>
                <span class="emergency-fund-card-badge">Out only</span>
            </div>
            <div class="savings-card-amount">${symbol}${formatMoney(card.amount)}</div>
            <div class="savings-card-progress" aria-hidden="true">
                <div class="savings-card-progress-fill emergency-fund-card-progress-fill" style="width: ${card.percent}%;"></div>
            </div>
            <div class="savings-card-progress-label">${card.percent.toFixed(0)}% of ${symbol}${formatMoney(card.goal)}</div>
        </div>
    `;
}

function createEmergencyFundCardElement(totalSavings = getTotalSavingsAmount(), fundStage = getSavingsFundStage(totalSavings)) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = generateEmergencyFundCardHTML(totalSavings, fundStage).trim();
    return wrapper.firstElementChild;
}

function getEmergencyFundActivity() {
    const txs = State.getTransactions ? State.getTransactions() : [];
    return txs
        .filter(tx => tx.tag === 'savings' || tx.type === 'savings')
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
}

function renderEmergencyFundPanelContent() {
    const panel = document.getElementById('emergencyFundPanel');
    if (!panel) return;

    const totalSavings = getTotalSavingsAmount();
    const fundStage = getSavingsFundStage(totalSavings);
    const card = getEmergencyFundCardData(totalSavings, fundStage);
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const balanceEl = document.getElementById('emergencyFundPanelBalance');
    const goalEl = document.getElementById('emergencyFundPanelGoal');
    const percentEl = document.getElementById('emergencyFundPanelPercent');
    const barEl = document.getElementById('emergencyFundPanelBar');
    const inputEl = document.getElementById('emergencyFundWithdrawAmount');
    const listEl = document.getElementById('emergencyFundPanelTxList');

    if (balanceEl) balanceEl.textContent = `${symbol}${formatMoney(card.amount)}`;
    if (goalEl) goalEl.textContent = `${symbol}${formatMoney(card.goal)}`;
    if (percentEl) percentEl.textContent = `${card.percent.toFixed(1)}% Funded`;
    if (barEl) {
        barEl.style.width = `${card.percent}%`;
        barEl.setAttribute('aria-valuenow', card.percent.toFixed(1));
        barEl.setAttribute('aria-valuetext', `${card.percent.toFixed(1)} percent funded`);
    }
    if (inputEl) {
        inputEl.placeholder = '0.00';
        inputEl.setAttribute('aria-label', `Withdrawal amount. Current balance ${symbol}${formatMoney(card.amount)}.`);
    }

    if (!listEl) return;

    const activity = getEmergencyFundActivity().slice(0, 8);
    if (activity.length === 0) {
        listEl.innerHTML = `
            <div class="drilldown-empty">
                No emergency fund activity yet.
            </div>
        `;
        return;
    }

    listEl.innerHTML = activity.map(tx => createTransactionCardHTML(tx, symbol)).join('');
}

window.openEmergencyFundPanel = function(event) {
    event?.preventDefault?.();

    if (!shouldShowEmergencyFundCard()) {
        if (window.showToast) window.showToast('Emergency fund card appears after money is saved.');
        if (window.renderSavingsTab) window.renderSavingsTab();
        return;
    }

    document.getElementById('emergencyFundOverlay')?.remove();
    document.getElementById('emergencyFundPanel')?.remove();

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const overlay = document.createElement('div');
    overlay.id = 'emergencyFundOverlay';
    overlay.className = 'drill-down-overlay emergency-fund-overlay';
    overlay.onclick = () => window.closeEmergencyFundPanel();

    const panel = document.createElement('aside');
    panel.id = 'emergencyFundPanel';
    panel.className = 'drill-down-panel emergency-fund-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'emergencyFundPanelTitle');
    panel.onclick = (panelEvent) => panelEvent.stopPropagation();
    panel.onkeydown = (panelEvent) => {
        if (panelEvent.key === 'Escape') {
            panelEvent.preventDefault();
            window.closeEmergencyFundPanel();
        }
    };
    panel.innerHTML = `
        <button type="button" class="btn-close-panel" onclick="window.closeEmergencyFundPanel()" aria-label="Close emergency fund panel">&times;</button>

        <div class="drill-down-hero emergency-fund-panel-hero">
            <div class="drill-down-icon emergency-fund-panel-icon" aria-hidden="true">&#128737;</div>
            <h2 class="drill-down-title" id="emergencyFundPanelTitle">${EMERGENCY_FUND_CARD_NAME}</h2>
            <p class="emergency-fund-panel-subtitle">Withdrawals only. Use this when money leaves the fund.</p>
        </div>

        <div class="drill-down-metrics emergency-fund-panel-metrics">
            <div class="metric-group">
                <span class="metric-label">Saved</span>
                <div class="metric-value" id="emergencyFundPanelBalance">${symbol}0.00</div>
            </div>

            <div class="metric-group emergency-fund-goal-metric">
                <span class="metric-label">Goal</span>
                <div class="emergency-fund-goal-value" id="emergencyFundPanelGoal">${symbol}0.00</div>
            </div>

            <div class="savings-progress-bar emergency-fund-panel-progress" role="progressbar" aria-label="Emergency fund progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div id="emergencyFundPanelBar" class="savings-bar-fill" style="width: 0%;" aria-hidden="true"></div>
                <span class="income-progress-tick" style="--divider-left: 10%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 20%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 30%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 40%;" aria-hidden="true"></span>
                <span class="income-progress-tick income-progress-tick-strong" style="--divider-left: 50%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 60%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 70%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 80%;" aria-hidden="true"></span>
                <span class="income-progress-tick" style="--divider-left: 90%;" aria-hidden="true"></span>
            </div>
            <div id="emergencyFundPanelPercent" class="savings-percent">0.0% Funded</div>
        </div>

        <form class="emergency-fund-withdraw-form" onsubmit="window.withdrawEmergencyFund(event)">
            <div class="add-form-group">
                <label for="emergencyFundWithdrawAmount">Withdraw Amount</label>
                <div class="budgeted-input-shell">
                    <span>${symbol}</span>
                    <input type="text" id="emergencyFundWithdrawAmount" class="form-input" inputmode="decimal" placeholder="0.00" autocomplete="off" oninput="window.sanitizeMoneyInput(this)" required>
                </div>
            </div>

            <div class="add-form-group">
                <label for="emergencyFundWithdrawNotes">Note</label>
                <textarea id="emergencyFundWithdrawNotes" class="notes-textarea" maxlength="54" placeholder="Optional reason for the withdrawal"></textarea>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="window.closeEmergencyFundPanel()">Cancel</button>
                <button type="submit" class="btn-danger">Withdraw</button>
            </div>
        </form>

        <div class="drill-down-history emergency-fund-panel-history">
            <div class="emergency-fund-history-heading">
                <h3 class="history-title">Recent Savings Activity</h3>
            </div>
            <div id="emergencyFundPanelTxList" class="drill-down-tx-list"></div>
        </div>
    `;

    document.body.append(overlay, panel);
    renderEmergencyFundPanelContent();

    requestAnimationFrame(() => {
        overlay.classList.add('active');
        panel.classList.add('active');
        syncOverlayScrollTopState();
        document.getElementById('emergencyFundWithdrawAmount')?.focus();
    });
};

window.closeEmergencyFundPanel = function() {
    const overlay = document.getElementById('emergencyFundOverlay');
    const panel = document.getElementById('emergencyFundPanel');
    if (!overlay && !panel) return;

    overlay?.classList.remove('active');
    panel?.classList.remove('active');
    window.setTimeout(() => {
        overlay?.remove();
        panel?.remove();
        syncOverlayScrollTopState();
    }, 300);
};

window.withdrawEmergencyFund = function(event) {
    event?.preventDefault?.();

    const input = document.getElementById('emergencyFundWithdrawAmount');
    const notesInput = document.getElementById('emergencyFundWithdrawNotes');
    if (!input) return;

    input.value = sanitizeMoneyValue(input.value);
    const amount = parseFloat(input.value);
    const currentAmount = Math.max(0, getTotalSavingsAmount());
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    if (!Number.isFinite(amount) || amount <= 0) {
        if (window.showToast) window.showToast('Enter a valid withdrawal amount.');
        input.focus();
        return;
    }

    if (amount > currentAmount + 0.005) {
        if (window.showToast) window.showToast(`Withdrawal cannot exceed ${symbol}${formatMoney(currentAmount)}.`);
        input.focus();
        input.select();
        return;
    }

    const newTx = {
        id: generateId(),
        type: 'expense',
        description: 'Emergency Fund Withdrawal',
        category: EMERGENCY_FUND_CARD_NAME,
        amount,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: State.getDefaultPayment ? State.getDefaultPayment() : '',
        notes: notesInput?.value.trim() || 'Emergency fund withdrawal.',
        tag: 'savings',
        createdAt: new Date().toISOString()
    };

    State.addTransaction(newTx);
    observeLocalSave('Emergency fund withdrawal saved partially.');
    if (window.showToast) window.showToast(`Withdrew ${symbol}${formatMoney(amount)} from Emergency Fund.`);
    refreshRecentDependents();

    const remaining = getTotalSavingsAmount();
    if (remaining <= 0.005) {
        window.closeEmergencyFundPanel();
        return;
    }

    input.value = '';
    if (notesInput) notesInput.value = '';
    renderEmergencyFundPanelContent();
    input.focus();
};

function applyDebtLockedSavingsState(fundStage) {
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const message = getDebtLockedEmergencyFundMessage(symbol);
    const isLocked = Boolean(fundStage?.hasActiveDebt);
    const currentEl = document.getElementById('savingsTotalDisplay');
    const goalEl = document.getElementById('savingsGoalDisplay');

    if (currentEl) {
        currentEl.classList.toggle('is-debt-locked', isLocked);
        if (isLocked) {
            currentEl.setAttribute('aria-description', message);
        } else {
            currentEl.classList.remove('is-debt-locked');
            currentEl.removeAttribute('aria-description');
        }
    }

    if (!goalEl) return;

    goalEl.classList.toggle('is-debt-locked', isLocked);
    if (isLocked) {
        goalEl.setAttribute('role', 'button');
        goalEl.tabIndex = 0;
        goalEl.setAttribute('aria-label', message);
        goalEl.onclick = window.showDebtLockedSavingsMessage;
        goalEl.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                window.showDebtLockedSavingsMessage(event);
            }
        };
    } else {
        goalEl.classList.remove('is-debt-locked');
        goalEl.removeAttribute('role');
        goalEl.removeAttribute('tabindex');
        goalEl.removeAttribute('aria-label');
        goalEl.onclick = null;
        goalEl.onkeydown = null;
    }
}

function applyEmergencyFundValidationState(fundStage) {
    const totalSummaryEl = document.querySelector('#view-savings .savings-total-summary');
    const goalEditEl = document.getElementById('emergencyGoalEdit');
    const monthDisplay = document.getElementById('emergencyFundMonthsDisplay');
    if (!goalEditEl) return;

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const validation = getEmergencyFundGoalValidation(fundStage);
    const isComplete = isEmergencyFundFullyFunded(fundStage);
    const hasOverride = Boolean(fundStage?.isEmergencyFund && fundStage?.goalOverride);
    const isOverride = hasOverride && !isComplete;
    const isStarter = Boolean(fundStage?.isStarterFund);
    const isRecommended = Boolean(fundStage?.isEmergencyFund && !isStarter && !isOverride);

    totalSummaryEl?.classList.toggle('is-starter-fund', isStarter);
    totalSummaryEl?.classList.toggle('is-goal-override', isOverride);
    totalSummaryEl?.classList.toggle('is-goal-recommended', isRecommended);
    totalSummaryEl?.classList.toggle('is-goal-complete', isComplete);
    goalEditEl.classList.toggle('is-validation-pending', isOverride);
    goalEditEl.classList.toggle('is-validation-valid', isRecommended);
    monthDisplay?.classList.toggle('is-goal-override', isOverride);
    monthDisplay?.classList.toggle('is-goal-complete', isComplete || isRecommended);

    if (!fundStage?.isEmergencyFund) {
        goalEditEl.removeAttribute('title');
        goalEditEl.setAttribute('aria-label', 'Edit emergency fund target amount');
        goalEditEl.removeAttribute('data-tooltip');
        return;
    }

    const message = validation.canValidate
        ? `${validation.months} month emergency fund target should be ${symbol}${formatMoney(validation.expected)} based on ${symbol}${formatMoney(validation.monthlyBase)} monthly expense budgets.`
        : 'Set monthly expense budgets to validate this emergency fund target.';

    const tooltip = hasOverride
        ? 'Click to reset.'
        : 'Click to edit.';

    goalEditEl.removeAttribute('title');
    goalEditEl.setAttribute('data-tooltip', tooltip);
    goalEditEl.setAttribute('aria-label', `${hasOverride ? 'Emergency fund override active. Click to reset.' : 'Edit emergency fund target amount.'} ${message}`);
}

function sanitizeMoneyValue(value) {
    const clean = String(value ?? '').replace(/[^\d.]/g, '');
    const dotIndex = clean.indexOf('.');
    if (dotIndex === -1) return clean;

    const whole = clean.slice(0, dotIndex);
    const decimals = clean.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
    return `${whole}.${decimals}`;
}

window.sanitizeMoneyInput = function(input) {
    if (!input) return;
    const sanitized = sanitizeMoneyValue(input.value);
    if (input.value !== sanitized) input.value = sanitized;
};

function setSavingsCurrentAmountDisplay(amount, options = {}) {
    const displayEl = document.getElementById('savingsCurrentAmountText');
    const input = document.getElementById('savingsCurrentAmountInput');
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const formattedAmount = formatMoney(amount);
    const inputAmount = options.inputAmount ?? amount;
    const formattedInputAmount = formatMoney(inputAmount);

    if (displayEl) displayEl.textContent = `${symbol}${formattedAmount}`;
    if (input && (options.forceInput || document.activeElement !== input)) input.value = formattedInputAmount;
}

function setSavingsCurrentEditMode(isEditing, shouldFocus = false) {
    const wrapper = document.getElementById('savingsTotalDisplay');
    const editor = document.getElementById('savingsCurrentEditor');
    const input = document.getElementById('savingsCurrentAmountInput');

    if (!wrapper || !input) return;

    wrapper.classList.toggle('is-editing', isEditing);
    wrapper.setAttribute('aria-expanded', isEditing ? 'true' : 'false');
    wrapper.setAttribute('aria-label', isEditing ? 'Editing current emergency fund amount' : 'Edit current emergency fund amount');
    input.tabIndex = isEditing ? 0 : -1;
    if (editor) editor.setAttribute('aria-hidden', isEditing ? 'false' : 'true');

    if (shouldFocus) {
        window.setTimeout(() => {
            input.value = String(input.value || '').replace(/,/g, '');
            input.focus();
            input.select();
        }, 0);
    }
}

window.openSavingsCurrentAmountEdit = function(event, shouldFocus = true) {
    const input = document.getElementById('savingsCurrentAmountInput');
    if (!input) return;

    const targetIsInput = event?.target === input;
    if (!targetIsInput) {
        event?.preventDefault?.();
    }

    markEmergencyFundInteracted();
    setSavingsCurrentEditMode(true, targetIsInput ? false : shouldFocus);
};

window.cancelSavingsCurrentAmountEdit = function() {
    const currentAmount = getTotalSavingsAmount();
    const fundStage = getSavingsFundStage(currentAmount);
    setSavingsCurrentAmountDisplay(fundStage.countedSavings, { inputAmount: currentAmount, forceInput: true });
    setSavingsCurrentEditMode(false);
};

function setEmergencyFundGoalDisplay(amount, options = {}) {
    const displayEl = document.getElementById('emergencyGoalAmountText');
    const input = document.getElementById('emergencyFundGoalInput');
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const formattedAmount = formatMoney(amount);

    if (displayEl) displayEl.textContent = `${symbol}${formattedAmount}`;
    if (input && (options.forceInput || document.activeElement !== input)) input.value = formattedAmount;
}

function setEmergencyFundGoalEditMode(isEditing, shouldFocus = false) {
    const wrapper = document.getElementById('emergencyGoalEdit');
    const editor = document.getElementById('emergencyGoalEditor');
    const input = document.getElementById('emergencyFundGoalInput');

    if (!wrapper || !input) return;

    wrapper.classList.toggle('is-editing', isEditing);
    wrapper.setAttribute('aria-expanded', isEditing ? 'true' : 'false');
    wrapper.setAttribute('aria-label', isEditing ? 'Editing emergency fund target amount' : 'Edit emergency fund target amount');
    input.tabIndex = isEditing ? 0 : -1;
    if (editor) editor.setAttribute('aria-hidden', isEditing ? 'false' : 'true');

    if (shouldFocus) {
        window.setTimeout(() => {
            input.value = String(input.value || '').replace(/,/g, '');
            input.focus();
            input.select();
        }, 0);
    }
}

function closeEmergencyFundRecommendationModal() {
    const modal = document.getElementById('emergencyFundRecommendationModal');
    if (!modal) return;
    modal.classList.add('closing');
    window.setTimeout(() => modal.remove(), 220);
}

function saveRecommendedEmergencyFundGoal(recommendedAmount, message = 'Emergency fund target reset to Budget Buddy recommendation.') {
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    setEmergencyFundGoalState(recommendedAmount, false);
    observeLocalSave('Emergency fund recommendation saved partially.');
    setEmergencyFundGoalDisplay(recommendedAmount, { forceInput: true });
    setEmergencyFundGoalEditMode(false);
    renderSavingsTab();
    if (window.showToast) window.showToast(`${message} ${symbol}${formatMoney(recommendedAmount)}.`);
}

function saveEmergencyFundGoalOverride(amount) {
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    setEmergencyFundGoalState(amount, true);
    observeLocalSave('Emergency fund target override saved partially.');
    setEmergencyFundGoalDisplay(amount, { forceInput: true });
    setEmergencyFundGoalEditMode(false);
    renderSavingsTab();
    if (window.showToast) window.showToast(`Emergency fund override set to ${symbol}${formatMoney(amount)}.`);
}

function openEmergencyFundRecommendationModal(amount, fundStage) {
    const validation = getEmergencyFundGoalValidation(fundStage, amount);
    const recommendedAmount = getRecommendedEmergencyFundGoal(fundStage);
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    document.getElementById('emergencyFundRecommendationModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'emergencyFundRecommendationModal';
    modal.className = 'modal-overlay active emergency-recommendation-modal';
    modal.onclick = (event) => {
        if (event.target === modal) {
            setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: true });
            setEmergencyFundGoalEditMode(false);
            closeEmergencyFundRecommendationModal();
        }
    };
    modal.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            window.cancelEmergencyFundRecommendation();
        }
    };

    modal.innerHTML = `
        <div class="modal-box modal-box-medium emergency-recommendation-box" role="dialog" aria-modal="true" aria-labelledby="emergencyRecommendationTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.cancelEmergencyFundRecommendation()" aria-label="Close emergency fund recommendation">&times;</button>
            <h3 id="emergencyRecommendationTitle" class="modal-title">Budget Buddy Recommendation</h3>
            <p class="emergency-recommendation-copy">
                Based on ${validation.months} months and ${symbol}${formatMoney(validation.monthlyBase)} in monthly expense budgets, Budget Buddy recommends:
            </p>
            <div class="emergency-recommendation-values">
                <div>
                    <span class="emergency-recommendation-label">Recommended</span>
                    <strong>${symbol}${formatMoney(recommendedAmount)}</strong>
                </div>
                <div>
                    <span class="emergency-recommendation-label">Your override</span>
                    <strong>${symbol}${formatMoney(amount)}</strong>
                </div>
            </div>
            <div class="modal-actions emergency-recommendation-actions">
                <button type="button" class="btn-create" onclick="window.confirmEmergencyFundRecommendation()">Use Recommendation</button>
                <button type="button" class="btn-cancel" onclick="window.confirmEmergencyFundOverride()">Keep Override</button>
            </div>
        </div>
    `;

    modal.dataset.recommendedAmount = String(recommendedAmount);
    modal.dataset.overrideAmount = String(amount);
    modal.dataset.previousAmount = String(fundStage.emergencyGoal);
    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    modal.querySelector('.btn-create')?.focus();
}

window.cancelEmergencyFundRecommendation = function() {
    const modal = document.getElementById('emergencyFundRecommendationModal');
    const previousAmount = parseFloat(modal?.dataset.previousAmount);
    if (Number.isFinite(previousAmount)) {
        setEmergencyFundGoalDisplay(previousAmount, { forceInput: true });
    }
    setEmergencyFundGoalEditMode(false);
    closeEmergencyFundRecommendationModal();
    syncOverlayScrollTopState();
};

window.confirmEmergencyFundRecommendation = function() {
    const modal = document.getElementById('emergencyFundRecommendationModal');
    const recommendedAmount = parseFloat(modal?.dataset.recommendedAmount);
    if (!Number.isFinite(recommendedAmount)) return;

    closeEmergencyFundRecommendationModal();
    syncOverlayScrollTopState();
    saveRecommendedEmergencyFundGoal(recommendedAmount, 'Emergency fund target set to Budget Buddy recommendation.');
};

window.confirmEmergencyFundOverride = function() {
    const modal = document.getElementById('emergencyFundRecommendationModal');
    const overrideAmount = parseFloat(modal?.dataset.overrideAmount);
    if (!Number.isFinite(overrideAmount)) return;

    closeEmergencyFundRecommendationModal();
    syncOverlayScrollTopState();
    saveEmergencyFundGoalOverride(overrideAmount);
};

function closeEmergencyFundResetModal() {
    const modal = document.getElementById('emergencyFundResetOverrideModal');
    if (!modal) return;
    modal.classList.add('closing');
    window.setTimeout(() => {
        modal.remove();
        syncOverlayScrollTopState();
    }, 220);
}

function resetEmergencyFundGoalOverrideNow() {
    const fundStage = getSavingsFundStage(getTotalSavingsAmount());
    const recommendedAmount = getRecommendedEmergencyFundGoal(fundStage);
    closeEmergencyFundResetModal();
    saveRecommendedEmergencyFundGoal(recommendedAmount);
}

window.openEmergencyFundResetOverrideModal = function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const fundStage = getSavingsFundStage(getTotalSavingsAmount());
    const recommendedAmount = getRecommendedEmergencyFundGoal(fundStage);
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    document.getElementById('emergencyFundResetOverrideModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'emergencyFundResetOverrideModal';
    modal.className = 'modal-overlay active emergency-recommendation-modal';
    modal.onclick = (modalEvent) => {
        if (modalEvent.target === modal) closeEmergencyFundResetModal();
    };
    modal.onkeydown = (keyEvent) => {
        if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault();
            closeEmergencyFundResetModal();
        }
    };

    modal.innerHTML = `
        <div class="modal-box modal-box-medium emergency-recommendation-box" role="dialog" aria-modal="true" aria-labelledby="emergencyResetOverrideTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.closeEmergencyFundResetOverrideModal()" aria-label="Close reset override">&times;</button>
            <h3 id="emergencyResetOverrideTitle" class="modal-title">Reset Override?</h3>
            <p class="emergency-recommendation-copy">
                This will replace your custom emergency fund goal with Budget Buddy's current recommendation.
            </p>
            <div class="emergency-recommendation-values">
                <div>
                    <span class="emergency-recommendation-label">Recommended</span>
                    <strong>${symbol}${formatMoney(recommendedAmount)}</strong>
                </div>
                <div>
                    <span class="emergency-recommendation-label">Current override</span>
                    <strong>${symbol}${formatMoney(fundStage.emergencyGoal)}</strong>
                </div>
            </div>
            <div class="modal-actions emergency-recommendation-actions">
                <button type="button" class="btn-cancel" onclick="window.closeEmergencyFundResetOverrideModal()">Cancel</button>
                <button type="button" class="btn-create" onclick="window.confirmEmergencyFundResetOverride()">Reset to Recommendation</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    modal.querySelector('.btn-create')?.focus();
};

window.closeEmergencyFundResetOverrideModal = function() {
    closeEmergencyFundResetModal();
};

window.confirmEmergencyFundResetOverride = function() {
    resetEmergencyFundGoalOverrideNow();
};

window.resetEmergencyFundGoalOverride = function(event) {
    window.openEmergencyFundResetOverrideModal(event);
};

window.openEmergencyFundGoalEdit = function(event, shouldFocus = true) {
    const input = document.getElementById('emergencyFundGoalInput');
    if (!input) return;

    const targetIsInput = event?.target === input;
    if (!targetIsInput) {
        event?.preventDefault?.();
    }

    markEmergencyFundInteracted();
    setEmergencyFundGoalEditMode(true, targetIsInput ? false : shouldFocus);
};

window.handleEmergencyFundGoalClick = function(event) {
    event?.preventDefault?.();

    const input = document.getElementById('emergencyFundGoalInput');
    if (event?.target === input) {
        window.openEmergencyFundGoalEdit(event, false);
        return;
    }

    const fundStage = getSavingsFundStage(getTotalSavingsAmount());
    if (fundStage.isEmergencyFund && fundStage.goalOverride) {
        window.openEmergencyFundResetOverrideModal(event);
        return;
    }

    window.openEmergencyFundGoalEdit(event);
};

window.cancelEmergencyFundGoalEdit = function() {
    const fundStage = getSavingsFundStage(getTotalSavingsAmount());
    setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: true });
    setEmergencyFundGoalEditMode(false);
};

function renderSavingsFundTitle(fundStage) {
    const titleEl = document.getElementById('savingsFundTitle');
    const titleTextEl = document.getElementById('savingsFundTitleText');
    const monthDisplay = document.getElementById('emergencyFundMonthsDisplay');
    const monthEditor = document.getElementById('emergencyFundMonthsEditor');
    const monthSelect = document.getElementById('emergencyFundMonthsSelect');

    if (!titleEl) return;

    titleEl.classList.toggle('is-emergency-month-mode', Boolean(fundStage.isEmergencyFund));
    if (!fundStage.isEmergencyFund) {
        titleEl.classList.remove('is-editing-months');
    }

    if (titleTextEl) {
        titleTextEl.textContent = fundStage.title;
    } else {
        titleEl.textContent = fundStage.isEmergencyFund
            ? `${fundStage.emergencyFundMonths} ${fundStage.title}`
            : fundStage.title;
    }

    if (monthDisplay) {
        monthDisplay.hidden = !fundStage.isEmergencyFund;
        monthDisplay.textContent = String(fundStage.emergencyFundMonths);
        monthDisplay.setAttribute('aria-label', `Edit ${fundStage.emergencyFundMonths} month emergency fund. Choose how many months this emergency fund should cover.`);
        monthDisplay.setAttribute('aria-expanded', titleEl.classList.contains('is-editing-months') ? 'true' : 'false');
        monthDisplay.setAttribute('data-tooltip', `Click to edit ${fundStage.emergencyFundMonths} month emergency fund`);
    }
    if (monthEditor && !titleEl.classList.contains('is-editing-months')) {
        monthEditor.hidden = true;
        monthEditor.setAttribute('aria-hidden', 'true');
    }
    if (monthSelect) {
        monthSelect.value = String(fundStage.emergencyFundMonths);
    }
}

window.openEmergencyFundMonthsEdit = function(event) {
    event?.preventDefault?.();
    if (hasActiveDebt()) {
        window.showDebtLockedSavingsMessage(event);
        return;
    }

    const titleEl = document.getElementById('savingsFundTitle');
    const monthDisplay = document.getElementById('emergencyFundMonthsDisplay');
    const monthEditor = document.getElementById('emergencyFundMonthsEditor');
    const monthSelect = document.getElementById('emergencyFundMonthsSelect');
    if (!titleEl || !monthDisplay || !monthEditor || !monthSelect) return;

    markEmergencyFundInteracted();
    titleEl.classList.add('is-editing-months');
    monthDisplay.setAttribute('aria-expanded', 'true');
    monthDisplay.hidden = true;
    monthEditor.hidden = false;
    monthEditor.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => monthSelect.focus(), 0);
};

window.closeEmergencyFundMonthsEdit = function() {
    const titleEl = document.getElementById('savingsFundTitle');
    const monthDisplay = document.getElementById('emergencyFundMonthsDisplay');
    const monthEditor = document.getElementById('emergencyFundMonthsEditor');
    if (!titleEl || !monthDisplay || !monthEditor) return;

    titleEl.classList.remove('is-editing-months');
    const isEmergencyFund = titleEl.classList.contains('is-emergency-month-mode');
    monthDisplay.setAttribute('aria-expanded', 'false');
    monthDisplay.hidden = !isEmergencyFund;
    monthEditor.hidden = true;
    monthEditor.setAttribute('aria-hidden', 'true');
};

window.saveEmergencyFundMonths = function(value) {
    if (hasActiveDebt()) {
        window.showDebtLockedSavingsMessage();
        renderSavingsTab();
        return;
    }

    if (State.setEmergencyFundMonths) State.setEmergencyFundMonths(value);
    if (typeof observeLocalSave === 'function') observeLocalSave('Emergency fund month target saved partially.');
    window.closeEmergencyFundMonthsEdit();
    const fundStage = getSavingsFundStage(getTotalSavingsAmount());
    const recommendedAmount = getRecommendedEmergencyFundGoal(fundStage);
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    if (!hasEmergencyFundGoalOverride()) {
        setEmergencyFundGoalState(recommendedAmount, false);
    } else if (Math.abs((parseFloat(fundStage.emergencyGoal) || 0) - recommendedAmount) < EMERGENCY_FUND_RECOMMENDATION_TOLERANCE) {
        setEmergencyFundGoalState(recommendedAmount, false);
    }

    if (window.showToast && hasEmergencyFundGoalOverride()) {
        window.showToast(`Override kept. Budget Buddy recommends ${symbol}${formatMoney(recommendedAmount)}.`);
    }
    renderSavingsTab();
};

export function renderSavingsTab() {
    const totalEl = document.getElementById('savingsTotalDisplay');
    const currentSymbolEl = document.getElementById('savingsCurrentSymbol');
    const goalEl = document.getElementById('savingsGoalDisplay');
    const goalEditEl = document.getElementById('emergencyGoalEdit');
    const goalSymbolEl = document.getElementById('emergencyGoalSymbol');
    const barEl = document.getElementById('globalSavingsBar');
    const percentEl = document.getElementById('globalSavingsPercent');
    const progressTrack = barEl?.parentElement;
    const grid = document.getElementById('savingsBucketsGrid');

    if (!totalEl || !goalEl || !barEl || !percentEl) return;

    const txs = State.getTransactions() || [];
    const categories = State.getCategories ? State.getCategories() : [];
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const totalSavings = getTotalSavingsAmount();

    const fundStage = getSavingsFundStage(totalSavings);
    const goal = fundStage.goal;
    const countedSavings = fundStage.countedSavings;
    const percent = goal > 0 ? Math.min(100, Math.max(0, (countedSavings / goal) * 100)) : 0;

    renderSavingsFundTitle(fundStage);
    if (currentSymbolEl) currentSymbolEl.textContent = symbol;
    setSavingsCurrentAmountDisplay(countedSavings, { inputAmount: totalSavings });
    goalEl.textContent = `${symbol}${formatMoney(goal)}`;
    goalEl.hidden = fundStage.isEmergencyFund;
    if (goalEditEl) {
        goalEditEl.hidden = !fundStage.isEmergencyFund;
        if (!fundStage.isEmergencyFund) setEmergencyFundGoalEditMode(false);
    }
    if (goalSymbolEl) goalSymbolEl.textContent = symbol;
    setEmergencyFundGoalDisplay(fundStage.emergencyGoal);
    applyDebtLockedSavingsState(fundStage);
    applyEmergencyFundValidationState(fundStage);
    barEl.style.width = `${percent}%`;
    barEl.setAttribute('aria-hidden', 'true');
    if (progressTrack) {
        progressTrack.setAttribute('aria-valuenow', percent.toFixed(1));
        progressTrack.setAttribute('aria-valuetext', `${percent.toFixed(1)} percent funded`);
        progressTrack.setAttribute('aria-label', fundStage.hasActiveDebt
            ? `Emergency fund progress capped at ${symbol}${formatMoney(STARTER_EMERGENCY_FUND_GOAL)} while active debt exists`
            : 'Emergency fund progress');
    }
    percentEl.textContent = `${percent.toFixed(1)}% Funded`;

    if (!grid) return;

    const savingsBuckets = categories.filter(c => ['savings', 'sinking_fund', 'external'].includes(c.type));
    const emergencyFundCardHTML = generateEmergencyFundCardHTML(totalSavings, fundStage);
    grid.innerHTML = '';

    if (savingsBuckets.length === 0 && !emergencyFundCardHTML) {
        grid.innerHTML = `
            <div class="savings-empty-state">
                <div class="savings-empty-icon" aria-hidden="true">&#128176;</div>
                <div class="savings-empty-title">No savings goals yet</div>
                <div class="savings-empty-copy">Create a goal to start tracking money you are setting aside.</div>
                <button type="button" class="btn-primary-dashed" onclick="window.openSavingsGoalModal()">+ Create Savings Goal</button>
            </div>
        `;
        return;
    }

    currentSavingsVisibleCount = Math.max(SAVINGS_INITIAL_RENDER, Math.min(currentSavingsVisibleCount, savingsBuckets.length));
    const visibleBuckets = savingsBuckets.slice(0, Math.min(currentSavingsVisibleCount, savingsBuckets.length));
    grid.innerHTML = `
        ${emergencyFundCardHTML}
        ${visibleBuckets.map(cat => `
            <div class="savings-goal-card" role="button" tabindex="0" aria-label="Open ${esc(cat.name)} savings goal" onclick="window.openCategoryDrillDown(${jsArg(cat.name)}, ${jsArg(cat.icon || '')})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openCategoryDrillDown(${jsArg(cat.name)}, ${jsArg(cat.icon || '')});}">
                ${generateSavingsCardHTML(cat.id, cat)}
            </div>
        `).join('')}
        ${visibleBuckets.length < savingsBuckets.length ? `
            <div class="savings-action-row">
                <button type="button" class="income-show-more-btn" onclick="window.loadMoreSavingsGoals()" aria-label="Show more savings goals">
                    Show ${Math.min(SAVINGS_LAZY_BATCH, savingsBuckets.length - visibleBuckets.length)} More
                </button>
            </div>
        ` : ''}
        <div class="savings-action-row">
            <button type="button" class="btn-primary-dashed" onclick="window.openSavingsGoalModal()">+ Create Savings Goal</button>
        </div>
    `;
}

window.loadMoreSavingsGoals = function() {
    currentSavingsVisibleCount += SAVINGS_LAZY_BATCH;
    renderSavingsTab();
};

window.saveEmergencyFundGoal = function(options = {}) {
    const input = document.getElementById('emergencyFundGoalInput');
    if (!input) return;
    if (document.getElementById('emergencyFundRecommendationModal')) return;

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const shouldCloseEditor = options?.closeEditor !== false;
    const fundStage = getSavingsFundStage(getTotalSavingsAmount());

    if (hasActiveDebt()) {
        window.showDebtLockedSavingsMessage();
        setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: true });
        setEmergencyFundGoalEditMode(false);
        renderSavingsTab();
        return;
    }

    input.value = sanitizeMoneyValue(input.value);
    const rawValue = String(input.value || '').trim();
    if (!rawValue) {
        setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: true });
        if (shouldCloseEditor) setEmergencyFundGoalEditMode(false);
        return;
    }

    const amount = parseFloat(rawValue);

    if (!Number.isFinite(amount) || amount < STARTER_EMERGENCY_FUND_GOAL) {
        if (window.showToast) {
            window.showToast(`Emergency fund target must be at least ${symbol}${formatMoney(STARTER_EMERGENCY_FUND_GOAL)}.`);
        }
        setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: true });
        setEmergencyFundGoalEditMode(!shouldCloseEditor, !shouldCloseEditor);
        return;
    }

    if (Math.abs(amount - fundStage.emergencyGoal) < EMERGENCY_FUND_RECOMMENDATION_TOLERANCE) {
        setEmergencyFundGoalDisplay(fundStage.emergencyGoal, { forceInput: shouldCloseEditor });
        if (shouldCloseEditor) setEmergencyFundGoalEditMode(false);
        applyEmergencyFundValidationState(fundStage);
        return;
    }

    const validation = getEmergencyFundGoalValidation(fundStage, amount);
    const recommendedAmount = getRecommendedEmergencyFundGoal(fundStage);
    const isRecommendation = Math.abs(amount - recommendedAmount) < EMERGENCY_FUND_RECOMMENDATION_TOLERANCE;

    if (validation.canValidate && !isRecommendation) {
        openEmergencyFundRecommendationModal(amount, fundStage);
        return;
    }

    setEmergencyFundGoalState(amount, false);
    observeLocalSave('Emergency fund target saved partially.');
    setEmergencyFundGoalDisplay(amount, { forceInput: shouldCloseEditor });
    if (shouldCloseEditor) setEmergencyFundGoalEditMode(false);
    if (window.showToast) window.showToast(`Emergency fund target set to ${symbol}${formatMoney(amount)}.`);
    renderSavingsTab();
};

window.saveSavingsCurrentAmount = function(options = {}) {
    const input = document.getElementById('savingsCurrentAmountInput');
    if (!input) return;

    input.value = sanitizeMoneyValue(input.value);
    const rawValue = String(input.value || '').trim();
    const desiredAmount = parseFloat(rawValue);
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const shouldCloseEditor = options?.closeEditor !== false;

    if (!Number.isFinite(desiredAmount) || desiredAmount < 0) {
        if (window.showToast) window.showToast('Emergency fund amount cannot be negative.');
        const currentAmount = getTotalSavingsAmount();
        const fundStage = getSavingsFundStage(currentAmount);
        setSavingsCurrentAmountDisplay(fundStage.countedSavings, { inputAmount: currentAmount, forceInput: true });
        setSavingsCurrentEditMode(!shouldCloseEditor, !shouldCloseEditor);
        return;
    }

    const currentAmount = getTotalSavingsAmount();
    const currentFundStage = getSavingsFundStage(currentAmount);
    if (wouldExceedDebtSavingsCap(desiredAmount)) {
        window.showDebtLockedSavingsMessage();
        setSavingsCurrentAmountDisplay(currentFundStage.countedSavings, { inputAmount: currentAmount, forceInput: true });
        if (shouldCloseEditor) setSavingsCurrentEditMode(false);
        return;
    }

    const adjustment = desiredAmount - currentAmount;

    if (Math.abs(adjustment) < 0.005) {
        setSavingsCurrentAmountDisplay(currentFundStage.countedSavings, { inputAmount: currentAmount, forceInput: shouldCloseEditor });
        if (shouldCloseEditor) setSavingsCurrentEditMode(false);
        return;
    }

    const isDeposit = adjustment > 0;
    const newTx = {
        id: generateId(),
        type: isDeposit ? 'income' : 'expense',
        description: isDeposit ? 'Emergency Fund Deposit' : 'Emergency Fund Adjustment',
        category: 'Emergency Fund',
        amount: Math.abs(adjustment),
        date: new Date().toISOString().split('T')[0],
        paymentMethod: State.getDefaultPayment ? State.getDefaultPayment() : '',
        notes: `Manual emergency fund balance set to ${symbol}${formatMoney(desiredAmount)}.`,
        tag: 'savings',
        createdAt: new Date().toISOString()
    };

    State.addTransaction(newTx);
    observeLocalSave('Emergency fund balance adjustment saved partially.');
    const fundStage = getSavingsFundStage(desiredAmount);
    setSavingsCurrentAmountDisplay(fundStage.countedSavings, { inputAmount: desiredAmount, forceInput: shouldCloseEditor });
    if (shouldCloseEditor) setSavingsCurrentEditMode(false);
    renderSavingsTab();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
    if (window.renderZBBDashboard) window.renderZBBDashboard();
    if (window.showToast) {
        window.showToast(`Emergency fund updated to ${symbol}${formatMoney(desiredAmount)}.`);
    }
};

document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    const currentWrapper = document.getElementById('savingsTotalDisplay');
    if (currentWrapper?.classList.contains('is-editing')) {
        if (!(target instanceof Node) || !currentWrapper.contains(target)) {
            window.saveSavingsCurrentAmount({ closeEditor: true });
        }
    }

    const goalWrapper = document.getElementById('emergencyGoalEdit');
    if (goalWrapper?.classList.contains('is-editing')) {
        if (!(target instanceof Node) || !goalWrapper.contains(target)) {
            window.saveEmergencyFundGoal({ closeEditor: true });
        }
    }

    const monthWrapper = document.getElementById('savingsFundTitle');
    if (monthWrapper?.classList.contains('is-editing-months')) {
        if (!(target instanceof Node) || !monthWrapper.contains(target)) {
            window.closeEmergencyFundMonthsEdit();
        }
    }
}, true);

function getIncomeCelebrationQuote() {
    const index = Math.floor(Date.now() / INCOME_CELEBRATION_QUOTE_MS) % INCOME_CELEBRATION_QUOTES.length;
    return INCOME_CELEBRATION_QUOTES[index];
}

function updateIncomeCelebrationQuote() {
    const quoteEl = document.getElementById('incomeTotalCelebrationQuote');
    if (!quoteEl) return;
    quoteEl.textContent = getIncomeCelebrationQuote();
}

function stopIncomeCelebrationQuoteRotation() {
    if (!incomeCelebrationQuoteTimer) return;
    clearTimeout(incomeCelebrationQuoteTimer);
    incomeCelebrationQuoteTimer = null;
}

function scheduleIncomeCelebrationQuoteRotation() {
    updateIncomeCelebrationQuote();
    if (incomeCelebrationQuoteTimer) return;

    const delay = INCOME_CELEBRATION_QUOTE_MS - (Date.now() % INCOME_CELEBRATION_QUOTE_MS);
    incomeCelebrationQuoteTimer = setTimeout(() => {
        incomeCelebrationQuoteTimer = null;
        scheduleIncomeCelebrationQuoteRotation();
    }, delay || INCOME_CELEBRATION_QUOTE_MS);
}

function isIncomeCelebrationCollapsed() {
    return localStorage.getItem(INCOME_CELEBRATION_COLLAPSED_KEY) === 'true';
}

function setIncomeCelebrationCollapsed(collapsed) {
    localStorage.setItem(INCOME_CELEBRATION_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}

function applyIncomeCelebrationCollapsedState() {
    const celebrationEl = document.getElementById('incomeTotalCelebration');
    const toggleBtn = document.getElementById('incomeTotalCelebrationToggle');
    const quoteEl = document.getElementById('incomeTotalCelebrationQuote');
    const collapsed = isIncomeCelebrationCollapsed();

    if (celebrationEl) {
        celebrationEl.classList.toggle('is-collapsed', collapsed);
        celebrationEl.tabIndex = collapsed ? -1 : 0;
        celebrationEl.setAttribute('aria-label', collapsed ? 'Positive Affirmation hidden' : 'Hide Positive Affirmation');
    }
    if (quoteEl) quoteEl.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    if (toggleBtn) {
        toggleBtn.textContent = collapsed ? 'Show' : 'Hide';
        toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggleBtn.setAttribute('aria-label', collapsed ? 'Show Positive Affirmation' : 'Hide Positive Affirmation');
    }

    return collapsed;
}

window.toggleIncomeCelebration = function() {
    const nextCollapsed = !isIncomeCelebrationCollapsed();
    setIncomeCelebrationCollapsed(nextCollapsed);
    const collapsed = applyIncomeCelebrationCollapsedState();
    const celebrationEl = document.getElementById('incomeTotalCelebration');

    if (collapsed) {
        stopIncomeCelebrationQuoteRotation();
    } else if (celebrationEl && !celebrationEl.hidden) {
        scheduleIncomeCelebrationQuoteRotation();
    }
};

window.hideIncomeCelebration = function(event) {
    event?.preventDefault?.();
    if (isIncomeCelebrationCollapsed()) return;
    setIncomeCelebrationCollapsed(true);
    applyIncomeCelebrationCollapsedState();
    stopIncomeCelebrationQuoteRotation();
};

function updateIncomeProgressSummary(logged, expected) {
    const loggedEl = document.getElementById('incomeTotalLogged');
    const expectedEl = document.getElementById('incomeTotalExpected');
    const progressBar = document.getElementById('incomeTotalProgress');
    const progressTrack = document.getElementById('incomeTotalProgressTrack');
    const fillPctLabel = document.getElementById('incomeTotalProgressFillPct');
    const trackPctLabel = document.getElementById('incomeTotalProgressTrackPct');
    const fillPctButton = document.getElementById('incomeTotalProgressFillBtn');
    const trackPctButton = document.getElementById('incomeTotalProgressTrackBtn');
    const celebrationEl = document.getElementById('incomeTotalCelebration');
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    if (loggedEl) loggedEl.textContent = `${symbol}${formatMoney(logged)}`;
    if (expectedEl) expectedEl.textContent = `${symbol}${formatMoney(expected)}`;
    if (!progressBar || !progressTrack) return;

    const resetButton = (button) => {
        if (!button) return;
        button.disabled = true;
        button.setAttribute('aria-pressed', 'false');
        button.onpointerdown = null;
        button.onclick = null;
        button.onfocus = null;
        button.onblur = null;
        button.onkeydown = null;
    };
    const setCelebrationVisible = (visible) => {
        if (!celebrationEl) return;
        const collapsed = applyIncomeCelebrationCollapsedState();
        celebrationEl.hidden = !visible;
        celebrationEl.classList.toggle('is-visible', visible);
        celebrationEl.setAttribute('aria-hidden', visible && !collapsed ? 'false' : 'true');
        if (visible && !collapsed) {
            scheduleIncomeCelebrationQuoteRotation();
        } else {
            stopIncomeCelebrationQuoteRotation();
        }
    };
    const hideTips = () => {
        progressTrack.classList.remove('show-fill-tip', 'show-track-tip');
        if (fillPctButton) fillPctButton.setAttribute('aria-pressed', 'false');
        if (trackPctButton) trackPctButton.setAttribute('aria-pressed', 'false');
    };
    const showTip = (segment) => {
        const isFill = segment === 'fill';
        progressTrack.classList.toggle('show-fill-tip', isFill);
        progressTrack.classList.toggle('show-track-tip', !isFill);
        if (fillPctButton) fillPctButton.setAttribute('aria-pressed', isFill ? 'true' : 'false');
        if (trackPctButton) trackPctButton.setAttribute('aria-pressed', isFill ? 'false' : 'true');
    };
    const isTipOpen = (segment) => segment === 'fill'
        ? progressTrack.classList.contains('show-fill-tip')
        : progressTrack.classList.contains('show-track-tip');
    const toggleTip = (segment) => isTipOpen(segment) ? hideTips() : showTip(segment);

    progressBar.style.width = '0%';
    progressBar.style.backgroundColor = '';
    progressTrack.style.backgroundColor = '';
    progressTrack.classList.remove('show-fill-tip', 'show-track-tip');
    progressTrack.style.setProperty('--progress-fill-label-left', '0%');
    progressTrack.style.setProperty('--progress-track-label-left', '100%');
    progressTrack.style.setProperty('--progress-fill-segment-width', '0%');
    progressTrack.style.setProperty('--progress-track-segment-width', '100%');
    resetButton(fillPctButton);
    resetButton(trackPctButton);
    if (fillPctLabel) fillPctLabel.textContent = '0%';
    if (trackPctLabel) trackPctLabel.textContent = '100%';

    if (expected <= 0 && logged <= 0) {
        progressTrack.style.backgroundColor = 'var(--text-dim, #64748b)';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = 'var(--text-dim, #64748b)';
        progressTrack.setAttribute('aria-label', 'Total income progress unavailable. Expected and logged are both zero.');
        setCelebrationVisible(false);
        return;
    }

    const loggedPercent = expected > 0 ? (logged / expected) * 100 : 100;
    const clampedLoggedPercent = Math.min(Math.max(loggedPercent, 0), 100);
    const expectedRemainderPercent = 100 - clampedLoggedPercent;
    const roundedLoggedPercent = Math.round(clampedLoggedPercent);
    const roundedExpectedPercent = Math.round(expectedRemainderPercent);
    const isFullyAccounted = expected > 0 && logged >= (expected - 0.005);

    progressTrack.style.backgroundColor = 'var(--yellow, #f59e0b)';
    progressBar.style.width = `${clampedLoggedPercent}%`;
    progressBar.style.backgroundColor = 'var(--green, #10b981)';
    progressTrack.style.setProperty('--progress-fill-label-left', `${Math.max(5, Math.min(clampedLoggedPercent / 2, 95))}%`);
    progressTrack.style.setProperty('--progress-track-label-left', `${Math.max(5, Math.min(clampedLoggedPercent + (expectedRemainderPercent / 2), 95))}%`);
    progressTrack.style.setProperty('--progress-fill-segment-width', `${clampedLoggedPercent}%`);
    progressTrack.style.setProperty('--progress-track-segment-width', `${expectedRemainderPercent}%`);
    progressTrack.setAttribute('aria-label', `Total income progress: ${roundedLoggedPercent} percent logged, ${roundedExpectedPercent} percent expected.`);
    setCelebrationVisible(isFullyAccounted);

    progressTrack.onpointermove = (event) => {
        if (event.pointerType !== 'mouse') return;
        const rect = progressTrack.getBoundingClientRect();
        const pointerPercent = ((event.clientX - rect.left) / rect.width) * 100;
        const isOverLogged = clampedLoggedPercent >= 100 || (clampedLoggedPercent > 0 && pointerPercent <= clampedLoggedPercent);
        showTip(isOverLogged ? 'fill' : 'track');
    };
    progressTrack.onpointerleave = (event) => {
        if (event.pointerType === 'mouse') hideTips();
    };

    const setAdaptiveLabel = (label, percent, suffix, segmentPercent) => {
        if (!label) return;
        const percentText = `${percent}%`;
        label.textContent = `${percentText} ${suffix}`;
        const segmentWidth = progressTrack.getBoundingClientRect().width * (segmentPercent / 100);
        if (!segmentWidth || label.scrollWidth > segmentWidth - 6) label.textContent = percentText;
    };
    const updateLabels = () => {
        setAdaptiveLabel(fillPctLabel, roundedLoggedPercent, 'Logged', clampedLoggedPercent);
        setAdaptiveLabel(trackPctLabel, roundedExpectedPercent, 'Expected', expectedRemainderPercent);
    };
    const keyHandler = (event) => {
        if (event.key === 'Escape') {
            hideTips();
            event.currentTarget.blur();
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleTip(event.currentTarget === fillPctButton ? 'fill' : 'track');
        }
    };

    if (fillPctButton && clampedLoggedPercent > 0) {
        fillPctButton.disabled = false;
        fillPctButton.setAttribute('aria-label', `Show logged income percentage: ${roundedLoggedPercent} percent`);
        fillPctButton.onpointerdown = (event) => {
            if (event.pointerType !== 'mouse') toggleTip('fill');
        };
        fillPctButton.onclick = (event) => {
            if (event.pointerType !== 'mouse') event.preventDefault();
        };
        fillPctButton.onfocus = () => showTip('fill');
        fillPctButton.onblur = hideTips;
        fillPctButton.onkeydown = keyHandler;
    }

    if (trackPctButton && expectedRemainderPercent > 0) {
        trackPctButton.disabled = false;
        trackPctButton.setAttribute('aria-label', `Show expected income percentage: ${roundedExpectedPercent} percent`);
        trackPctButton.onpointerdown = (event) => {
            if (event.pointerType !== 'mouse') toggleTip('track');
        };
        trackPctButton.onclick = (event) => {
            if (event.pointerType !== 'mouse') event.preventDefault();
        };
        trackPctButton.onfocus = () => showTip('track');
        trackPctButton.onblur = hideTips;
        trackPctButton.onkeydown = keyHandler;
    }

    updateLabels();
    requestAnimationFrame(updateLabels);
}

export function renderIncomeTab() {
    const breakdownEl = document.getElementById('incomeBreakdown');
    const totalEl = document.getElementById('tabIncomeTotal');
    const projectedEl = document.getElementById('tabIncomeProjected');
    if (!breakdownEl) return;

    const txs = State.getTransactions() || [];
    const categories = State.getCategories() || [];
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Calculate Monthly Logged Income
    const monthlyIncome = txs
        .filter(tx => tx.type === 'income')
        .filter(tx => {
            const txDate = new Date(tx.date || tx.createdAt);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

    if (totalEl) totalEl.textContent = `${symbol}${formatMoney(monthlyIncome)}`;

    // 2. Render Income Sources (Categories of type 'income')
    const incomeSources = categories.filter(c => c.type === 'income');

    // 3. Projected calculation (Simple V1: Expected Budgets vs Actual)
    const expectedIncome = incomeSources.reduce((sum, src) => sum + (src.budget || 0), 0);
    const projected = Math.max(monthlyIncome, expectedIncome);
    if (projectedEl) projectedEl.textContent = `${symbol}${formatMoney(projected)}`;
    updateIncomeProgressSummary(monthlyIncome, expectedIncome);
    const isFullyAccounted = expectedIncome > 0 && monthlyIncome >= (expectedIncome - 0.005);
    const celebrationToggleHtml = isFullyAccounted
        ? `<button type="button" id="incomeTotalCelebrationToggle" class="income-total-celebration-toggle income-total-celebration-inline-toggle" onclick="window.toggleIncomeCelebration()" aria-controls="incomeTotalCelebration" aria-expanded="${isIncomeCelebrationCollapsed() ? 'false' : 'true'}">${isIncomeCelebrationCollapsed() ? 'Show' : 'Hide'}</button>`
        : '';
    const actionArea = document.getElementById('incomeActionArea');

        // 4. Empty State
        if (incomeSources.length === 0) {
            visibleIncomeSourceCount = INCOME_INITIAL_RENDER_COUNT;
            breakdownEl.innerHTML = `
                <div class="empty-state-container income-empty-state">
                    <div class="empty-state-animated-icon" style="font-size: 3.5rem; margin-bottom: 1rem;">💸</div>
                    <p class="income-empty-copy">No income sources yet. Add one to start projecting your month.</p>
                    <button type="button" class="btn-primary-dashed income-empty-action" onclick="window.openAddSourceModal()">
                        + Add New Source
                    </button>
                </div>
            `;
            if (actionArea) actionArea.style.display = 'none';
            return;
        }

        if (actionArea) actionArea.style.display = 'block';

    visibleIncomeSourceCount = Math.max(INCOME_INITIAL_RENDER_COUNT, Math.min(visibleIncomeSourceCount, incomeSources.length));
    const visibleIncomeSources = incomeSources.slice(0, visibleIncomeSourceCount);
    const remainingIncomeSources = incomeSources.length - visibleIncomeSources.length;

    // 5. Build Source Cards
    const incomeSourceCards = visibleIncomeSources.map(src => {
        const expected = src.budget || 0;
        const logged = txs
            .filter(tx => tx.type === 'income' && tx.category === src.name)
            .filter(tx => {
                const txDate = new Date(tx.date || tx.createdAt);
                return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);
        const frequencyLabel = formatPayFrequency(src.payFrequency);
        return `
        <div class="category-item" style="display: flex; align-items: center; padding: 0.75rem; cursor: pointer; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 0.75rem;" onclick="window.openCategoryDrillDown(${jsArg(src.name)}, ${jsArg(src.icon || '')})">
            <div class="category-icon-box" style="margin-top: 0; margin-left: 0; width: 40px; height: 40px;">
                <span class="category-icon" style="font-size: 1.25rem;">${esc(src.icon || '🏦')}</span>
            </div>
            <div class="category-body" style="padding: 0 0.75rem;">
                <div style="font-weight: 600; color: var(--text); font-size: 0.95rem;">${esc(src.name)}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">
                    Expected: ${expected > 0 ? symbol + formatMoney(expected) : 'Variable'}${frequencyLabel ? ` ${frequencyLabel}` : ''} | Logged: ${symbol}${formatMoney(logged)}
                </div>
            </div>
            <div style="margin-left: auto; color: var(--text-dim); font-size: 1.2rem;">›</div>
        </div>
        `;
    }).join('');

    breakdownEl.innerHTML = `
        ${incomeSourceCards}
        ${remainingIncomeSources > 0 ? `
        <div style="display: flex; justify-content: center; padding: 0.25rem 0 0.5rem;">
            <button type="button" class="income-show-more-btn" onclick="window.loadMoreIncomeSources()" aria-label="Show ${Math.min(INCOME_LAZY_BATCH_SIZE, remainingIncomeSources)} more income sources. ${remainingIncomeSources} remaining.">
                Show ${Math.min(INCOME_LAZY_BATCH_SIZE, remainingIncomeSources)} More
            </button>
        </div>
        ` : ''}
        <div class="income-source-actions">
            <button type="button" class="btn-primary-dashed" onclick="window.openAddSourceModal()">
                + Add New Source
            </button>
            ${celebrationToggleHtml}
        </div>
    `;
    applyIncomeCelebrationCollapsedState();
}

window.loadMoreIncomeSources = function() {
    visibleIncomeSourceCount += INCOME_LAZY_BATCH_SIZE;
    renderIncomeTab();
};

// ==========================================
// 5. RECENT TRANSACTIONS & FILTERS
// ==========================================

window.currentTxFilter = window.currentTxFilter || 'all';

// Triggered by the search bar input
function legacyFilterRecentTransactionsV1() {
    window.renderRecentTransactions();
}

// Triggered by the All/Income/Savings/Expense pills
function legacyFilterTransactionsV1(filterType) {
    window.currentTxFilter = filterType;

    document.querySelectorAll('#view-recent .tag-pill, .tx-filters .tag-pill').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });

    const activeBtn = document.querySelector(`.tx-filters .tag-pill[data-filter="${filterType}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
    }

    window.renderRecentTransactions();
};

window.exportTransactions = function() {
  let txs = State.getTransactions() || [];

  // 1. Exclude soft-deleted items
  txs = txs.filter(tx => !tx.isDeleted);

  // 2. FILTER: Keep ONLY Expense Transactions
  // This excludes Income (type='income'), Savings (tag='savings' or type='savings'), and Debt (type='debt')
  txs = txs.filter(tx =>
      tx.type === 'expense' &&
      tx.tag !== 'savings' &&
      tx.tag !== 'debt' // Optional if debt txs have type='debt'
  );

    if (txs.length === 0) {
        if(typeof showToast === 'function') showToast('⚠️ No transactions to export');
        return;
    }

    const sorted = [...txs].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    const csvField = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    let csvContent = "Date,Description,Category,Type,Amount,Tag,Payment Method,Notes\n";

    sorted.forEach(tx => {
        const date = csvField(tx.date || '');
        const desc = csvField(tx.description || tx.name || '');
        const cat = csvField(tx.category || '');
        const type = csvField(tx.type || '');
        const amt = tx.amount || 0;
        const tag = csvField(tx.tag || '');
        const method = csvField(tx.paymentMethod || '');
        const notes = csvField(tx.notes || '');

        csvContent += `${date},${desc},${cat},${type},${amt},${tag},${method},${notes}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BudgetBuddy_Export_${window.currentTxFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if(typeof showToast === 'function') showToast('✅ Export downloaded successfully!');
};

function legacyRenderRecentTransactionsV3() {
    const listContainer = document.getElementById('recentTxList');
    if (!listContainer) return;

    let txs = State.getTransactions() || [];
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    // 1. Exclude soft-deleted items (Buddy Cloud)
    txs = txs.filter(tx => !tx.isDeleted);

    // 2. Apply Text Search Filter (Search Bar)
    const searchInput = document.getElementById('txSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (searchTerm) {
        txs = txs.filter(tx => {
            const safeDesc = tx.description ? String(tx.description).toLowerCase() : '';
            const safeCat = tx.category ? String(tx.category).toLowerCase() : '';
            const safeAmt = (tx.amount !== undefined && tx.amount !== null) ? String(tx.amount) : '';

            return safeDesc.includes(searchTerm) ||
                   safeCat.includes(searchTerm) ||
                   safeAmt.includes(searchTerm);
        });
    }

    // 3. APPLY PILL FILTERS (ONLY IF USER SELECTED ONE)
    // Default state 'all' shows EVERYTHING (Income, Expense, Savings, Debt mixed)
    const currentFilter = window.currentTxFilter || 'all';

    if (currentFilter === 'income') {
        txs = txs.filter(tx => tx.type === 'income');
    }
    else if (currentFilter === 'expense') {
        // ONLY filter if they explicitly clicked the "Expense" pill
        txs = txs.filter(tx => tx.type === 'expense' && tx.tag !== 'savings' && tx.tag !== 'debt');
    }
    else if (currentFilter === 'savings') {
        txs = txs.filter(tx => tx.tag === 'savings' || tx.type === 'savings');
    }
    else if (currentFilter === 'debt') {
        txs = txs.filter(tx => tx.type === 'debt' || tx.tag === 'debt');
    }
    // If 'all', we do NOTHING here. All transactions remain in the array.

    // 4. Handle Empty State
    if (txs.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state mt-lg">
                <div class="empty-folder-icon" style="opacity: 0.5;">📝</div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 0.5rem; font-size: 1.1rem;">No Transactions Found</div>
                <div style="font-size: 0.85rem; line-height: 1.4;">Try adding a transaction or changing your filter.</div>
            </div>
        `;
        return;
    }

    // 5. Sort & Render
    const sorted = [...txs].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    listContainer.innerHTML = sorted.map(tx => {
        const isIncome = tx.type === 'income';
        const sign = isIncome ? '+' : '-';
        // Color logic: Income=Green, Debt=Red, Expenses/Other=Normal
        const color = isIncome ? 'var(--positive)' : (tx.type === 'debt' ? 'var(--red)' : 'var(--text)');

        const displayLabel = tx.category ? `${esc(tx.category)}` : esc(tx.tag || 'Uncategorized');
        const displayDesc = tx.description || tx.name || 'Unnamed Transaction';

        const icon = window.getIconFromName ? window.getIconFromName(tx.category || tx.tag) : '📁';

        return `
        <div class="subcategory-item"
             onclick="window.openTxDetailPanel('${tx.id}')"
             style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s ease;"
             onmouseover="this.style.background='var(--surface-hover)'"
             onmouseout="this.style.background='transparent'">

            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
                    ${icon}
                </div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; font-size: 1rem;">${esc(displayDesc)}</span>
                    <span style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                        ${displayLabel} • ${formatDate(tx.date)}
                    </span>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 1.1rem; color: ${color}; text-align: right;">
                ${sign}${symbol}${formatMoney(tx.amount)}
            </div>
        </div>
        `;
    }).join('');
};

// ==========================================
// 6. EVENT HANDLERS & HELPERS
// ==========================================

export function quickAddSavings(amount) {
    const parsedAmount = parseFloat(amount) || 0;

    if (parsedAmount <= 0) {
        showToast('Please enter a valid savings amount.');
        return;
    }

    const newTx = {
        id: generateId(),
        type: 'income',
        description: 'Quick Savings Deposit',
        category: 'Savings',
        amount: parsedAmount,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: State.getDefaultPayment ? State.getDefaultPayment() : '',
        notes: '',
        tag: 'savings',
        createdAt: new Date().toISOString()
    };

    if (blockDebtLockedSavingsIncreaseIfNeeded(newTx)) return;

    State.addTransaction(newTx);
    observeLocalSave('1 savings transaction saved partially.');
    render();
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    showToast(`✅ Added ${symbol}${formatMoney(parsedAmount)} to Savings!`);
}

export function openSavingsAddModal() {
    switchTab('add');
    setType('income');
    const descInput = document.getElementById('txDescription');
    if (descInput) setTransactionDescription('Savings Deposit');
    document.getElementById('txAmount')?.focus();
    showToast('💡 Enter custom savings amount');
}

export function toggleQuickAddScroller() {
    const target = document.getElementById('quickAddGrid') || document.querySelector('.quick-add-scroll-wrapper');
    if (!target) return;

    const button = document.getElementById('toggleQuickAddLink');
    const currentDisplay = window.getComputedStyle(target).display;

    if (currentDisplay === 'none') {
        target.style.display = 'flex';
        if (button) {
            button.textContent = 'Hide Quick Add';
            button.setAttribute('aria-expanded', 'true');
        }
    } else {
        target.style.display = 'none';
        if (button) {
            button.textContent = 'Show Quick Add';
            button.setAttribute('aria-expanded', 'false');
        }
    }
}

export function applyCategorySort() {
    const select = document.getElementById('categorySortSelect');
    if (!select) return;
    State.setCategorySort(select.value);
    renderCategoryList();
}

export function closeModalOnOutsideClick(event) {
    if (event.target === event.currentTarget && event.currentTarget.classList.contains('modal-overlay')) {
        const modalId = event.target.id;
        if (modalId === 'deleteCategoryModal') closeDeleteCategoryModal();
        else if (modalId === 'deleteIncomeSourceModal') closeDeleteIncomeSourceModal();
        else if (modalId === 'deleteTxModal') window.closeDeleteTxModal?.();
        else if (modalId === 'settingsModal') closeSettingsModal();
        else if (modalId === 'accountModal') closeAccountModal();
        else if (modalId === 'resetConfirmModal') closeResetModal();
        else if (modalId === 'incomeSourceModal') window.closeIncomeSourceModal();
        else if (modalId === 'categoryModal') closeCategoryModal();
        else if (modalId === 'reassignCategoryModal') closeModal('reassignCategoryModal');
        else closeModal(modalId);
    }
}

function syncOverlayScrollTopState() {
    const hasActiveOverlay = Boolean(
        document.querySelector('.modal-overlay.active:not(#accountModal), #categoryDrillDownOverlay.active, #emergencyFundOverlay.active') ||
        document.querySelector('#categoryDrillDownPanel.active, #emergencyFundPanel.active') ||
        (document.getElementById('txDetailOverlay')?.style.pointerEvents === 'auto')
    );
    document.body.classList.toggle('ui-overlay-open', hasActiveOverlay);
}

function animateModalClose(modal, removeNode = false) {
    if (!modal) return;

    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
    }

    modal.classList.add('closing');
    modal.dataset.closing = 'true';

    modal._closeTimer = setTimeout(() => {
        modal.classList.remove('active', 'closing');
        delete modal.dataset.closing;
        modal._closeTimer = null;

        if (removeNode && modal.parentNode) {
            modal.remove();
        }

        syncOverlayScrollTopState();
    }, 300);
}

export function closeModal(id) {
    animateModalClose(document.getElementById(id), false);
}

export function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
    }

    modal.classList.remove('closing');
    delete modal.dataset.closing;
    modal.classList.add('active');
    syncOverlayScrollTopState();
}

function isMobileCommandNavLayout() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(max-width: 767px)').matches || window.innerWidth < 768;
}

function getActiveCommandTabName() {
    const activeTab = document.querySelector('.cmd-tab.active');
    return activeTab?.id?.replace('tab-', '') || '';
}

export function switchTab(viewName) {
    if (!COMMAND_TAB_NAMES.has(viewName)) return;

    const activeViewName = getActiveCommandTabName();
    if (viewName === 'add' && isMobileCommandNavLayout() && activeViewName && activeViewName !== 'add') {
        lastMobileCommandTab = activeViewName;
    } else if (viewName !== 'add') {
        lastMobileCommandTab = viewName;
        document.getElementById('view-add')?.classList.add('mobile-add-dismissed');
    }

    // 1. Deactivate all tabs/views immediately
    document.querySelectorAll('.cmd-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    const activeTab = document.getElementById(`tab-${viewName}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');
    }

    document.querySelectorAll('.cmd-view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewName}`);

    if (!targetView) return; // Safety exit

    targetView.classList.add('active');
    if (viewName === 'add') {
        targetView.classList.remove('mobile-add-dismissed');
    }
    if (viewName === 'income') {
        renderIncomeTab();
    }
    if (viewName === 'savings') {
        renderSavingsTab();
    }
    if (viewName === 'calendar') {
        renderBudgetCalendar();
    }
    if (viewName === 'recent' && window.renderRecentTransactions) {
        window.renderRecentTransactions();
    }

    // 2. Ensure the Add view has a mobile escape hatch.
    if (viewName === 'add') {
        createMobileCloseBar(targetView);
    }
}

// --- HELPER FUNCTION (Prevents duplication issues) ---
function createMobileCloseBar(container) {
    // Double check: Ensure container is still active (prevents race conditions)
    if (!container || !container.classList.contains('active')) return;
    const existingBar = container.querySelector('.mobile-close-bar');
    if (existingBar) {
        const existingBtn = existingBar.querySelector('.close-btn');
        if (existingBtn && !existingBtn.dataset.closeBound) {
            existingBtn.addEventListener('click', closeMobileAddOverlay);
            existingBtn.dataset.closeBound = 'true';
        }
        return;
    }

    const closeBar = document.createElement('div');
    closeBar.className = 'mobile-close-bar';
    closeBar.innerHTML = `
        <span class="close-title">Add Transaction</span>
        <button type="button" class="close-btn" aria-label="Close add transaction screen">Close</button>
    `;

    // Insert at top
    container.prepend(closeBar);

    // Bind event: Navigate DIRECTLY, don't call switchTab recursively
    const btn = closeBar.querySelector('.close-btn');
    if (btn) {
        btn.addEventListener('click', closeMobileAddOverlay);
        btn.dataset.closeBound = 'true';
    }
}

export function closeMobileAddOverlay() {
    const addView = document.getElementById('view-add');
    if (!addView) return;
    if (isMobileCommandNavLayout()) {
        const fallbackTab = lastMobileCommandTab && lastMobileCommandTab !== 'add' ? lastMobileCommandTab : 'income';
        if (document.getElementById(`view-${fallbackTab}`)) {
            switchTab(fallbackTab);
            return;
        }
    }
    addView.classList.add('mobile-add-dismissed');
}

export function initMobileCommandNav() {
    const tabList = document.querySelector('.command-tabs');
    if (!tabList) return;

    tabList.setAttribute('aria-label', 'Budget sections');
    document.querySelectorAll('.cmd-tab').forEach(tab => {
        const tabName = tab.id?.replace('tab-', '');
        if (tabName) tab.setAttribute('aria-controls', `view-${tabName}`);
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
    });

    const syncMobileDefault = () => {
        const addView = document.getElementById('view-add');
        if (!addView || !isMobileCommandNavLayout()) return;
        if (addView.classList.contains('active')) {
            switchTab(lastMobileCommandTab || 'income');
        }
    };

    syncMobileDefault();
    if (mobileCommandNavInitialized) return;
    mobileCommandNavInitialized = true;

    let resizeTimer = null;
    let wasMobileLayout = isMobileCommandNavLayout();
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const isMobileLayout = isMobileCommandNavLayout();
            if (isMobileLayout && !wasMobileLayout) syncMobileDefault();
            wasMobileLayout = isMobileLayout;
        }, 150);
    }, { passive: true });
}


export function setType(type) {
    State.setCurrentType(type);
    const btnIncome = document.getElementById('btnIncome');
    const btnExpense = document.getElementById('btnExpense');

    if(btnIncome) btnIncome.classList.remove('active-income', 'active-income-v2');
    if(btnExpense) btnExpense.classList.remove('active-expense', 'active-expense-v2');
    if(btnIncome) btnIncome.setAttribute('aria-pressed', 'false');
    if(btnExpense) btnExpense.setAttribute('aria-pressed', 'false');

    if (type === 'income') {
        if(btnIncome) {
            btnIncome.classList.add('active-income-v2', 'active-income');
            btnIncome.setAttribute('aria-pressed', 'true');
        }
    } else {
        if(btnExpense) {
            btnExpense.classList.add('active-expense-v2', 'active-expense');
            btnExpense.setAttribute('aria-pressed', 'true');
        }
    }

    renderFormCategories();
        const suggestionsRow = document.getElementById('smartSuggestionsRow');
        if (suggestionsRow) {
            suggestionsRow.style.display = 'none';
            suggestionsRow.innerHTML = '';
        }
    setAddFieldError('category', '');
}

// ==========================================
// 7. ADD FORM (V2) INTERACTIONS
// ==========================================

export function renderFormCategories() {
    const container = document.getElementById('addTxCategoryContainer');
    if (!container) return;

    const currentType = State.getCurrentType ? State.getCurrentType() : 'expense';
    const categories = getAddTransactionCategories(currentType);

    if (categories.length === 0) {
        const createAction = currentType === 'income'
            ? 'window.openAddSourceModal()'
            : "window.openCategoryModal('create')";
        const createLabel = currentType === 'income' ? '+ Add Income Source' : '+ Create Category';
        container.innerHTML = `
            <button type="button" class="cat-pill-v2" onclick="${createAction}" style="border-style: dashed; border-color: var(--text-dim);" aria-label="${esc(createLabel)}">
                ${createLabel}
            </button>
        `;
        const hiddenInput = document.getElementById('txCategory');
        if (hiddenInput) hiddenInput.value = '';
        return;
    }

    container.innerHTML = categories.map(cat => `
        <button type="button" class="cat-pill-v2" data-cat="${esc(cat.name)}" onclick="window.selectFormCategory(${jsArg(cat.name)})" aria-pressed="false">
            ${esc(cat.icon || '📁')} ${esc(cat.name)}
        </button>
    `).join('');

    const hiddenInput = document.getElementById('txCategory');
    const hiddenCategoryIsValid = hiddenInput && categories.some(cat => cat.name === hiddenInput.value);
    if (hiddenInput && !hiddenCategoryIsValid) {
        selectFormCategory(categories[0].name);
    } else if (hiddenInput) {
        selectFormCategory(hiddenInput.value);
    }
}

export function selectFormCategory(name) {
    const hiddenInput = document.getElementById('txCategory');
    if (hiddenInput) hiddenInput.value = name;
    document.querySelectorAll('.cat-pill-v2').forEach(pill => {
        pill.classList.remove('active');
        const isActive = pill.getAttribute('data-cat') === name;
        pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive) pill.classList.add('active');
    });
    setAddFieldError('category', '');
    centerSelectedFormCategoryPill(name);
    renderSmartSuggestions(name);
}

function centerSelectedFormCategoryPill(name) {
    const container = document.getElementById('addTxCategoryContainer');
    if (!container) return;

    requestAnimationFrame(() => {
        const selectedPill = Array.from(container.querySelectorAll('.cat-pill-v2'))
            .find(pill => pill.getAttribute('data-cat') === name);
        if (!selectedPill) return;

        const maxScroll = container.scrollWidth - container.clientWidth;
        const targetScroll = selectedPill.offsetLeft - ((container.clientWidth - selectedPill.offsetWidth) / 2);
        container.scrollTo({
            left: Math.max(0, Math.min(targetScroll, maxScroll)),
            behavior: 'smooth'
        });
    });
}

function getSmartSuggestionsRow() {
    return document.getElementById('smartSuggestionsRow');
}

function hideSmartSuggestions() {
    const row = getSmartSuggestionsRow();
    if (row) row.style.display = 'none';
}

function showSmartSuggestionsIfAvailable() {
    const row = getSmartSuggestionsRow();
    if (!row || !row.querySelector('.suggestion-chip, .tag-pill')) return;
    row.style.display = 'flex';
}

export function renderSmartSuggestions(categoryName) {
    const row = document.getElementById('smartSuggestionsRow');
    if (!row) return;

    const allTxs = State.getTransactions() || [];
    const currentType = State.getCurrentType();

    const categoryTxs = allTxs.filter(tx => tx.category === categoryName && tx.type === currentType);
    const names = categoryTxs
        .map(tx => String(tx.description || '').trim())
        .filter(Boolean);
    const uniqueNames = [...new Set(names)].slice(0, 5);

    if (uniqueNames.length === 0) {
        row.style.display = 'none';
        row.innerHTML = '';
    } else {
        row.style.display = 'none';
        row.innerHTML = `
            <span class="recently-used-label">Recently Used:</span>
            ${uniqueNames.map(name => `
            <button type="button" class="suggestion-chip" onclick="window.useSuggestion(${jsArg(name)})">
                ${esc(name)}
            </button>
        `).join('')}`;
    }
}

export function useSuggestion(name) {
    const descInput = document.getElementById('txDescription');
    if (descInput) setTransactionDescription(name);
}

export function toggleTxDetails() {
    const drawer = document.getElementById('txHiddenDetails');
    const icon = document.getElementById('detailsToggleIcon');
    if (!drawer) return;

    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
        drawer.classList.remove('open');
        document.getElementById('toggleDetailsBtn')?.setAttribute('aria-expanded', 'false');
        if (icon) icon.textContent = '▼';
    } else {
        drawer.classList.add('open');
        document.getElementById('toggleDetailsBtn')?.setAttribute('aria-expanded', 'true');
        if (icon) icon.textContent = '▲';
    }
}

export function numpadInput(val) {
    const container = document.getElementById('heroAmountContainer');

    if (val === '.') {
        if (rawAmountString.includes('.')) {
            if (container) {
                container.classList.remove('shake-error');
                void container.offsetWidth;
                container.classList.add('shake-error');
                setTimeout(() => container.classList.remove('shake-error'), 400);
            }
            return;
        }
        if (rawAmountString === "") rawAmountString = "0";
    }

    if (rawAmountString.includes('.')) {
        const parts = rawAmountString.split('.');
        if (parts[1] && parts[1].length >= 2) return;
    }

    rawAmountString += val;
    updateAmountDisplay();
    if (parseAddAmountInput(rawAmountString) > 0) setAddFieldError('amount', '');
}

export function numpadDelete() {
    if (rawAmountString.length > 0) {
        rawAmountString = rawAmountString.slice(0, -1);
        updateAmountDisplay();
        if (parseAddAmountInput(rawAmountString) > 0) setAddFieldError('amount', '');
    }
}

function updateAmountDisplay() {
    const amountInput = document.getElementById('txAmount');
    if (!amountInput) return;
    if (rawAmountString === "") {
        amountInput.value = "";
        return;
    }
    let parts = rawAmountString.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    amountInput.value = parts.join('.');
}

function getLocalISODate(date = new Date()) {
    const localDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(localDate.getTime())) return '';

    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isValidLocalISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;

    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2100) return false;

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

function sanitizeAddText(value, maxLength) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function parseAddAmountInput(value) {
    const sanitized = sanitizeMoneyValue(value);
    if (!sanitized || sanitized === '.') return NaN;
    return Number.parseFloat(sanitized);
}

function formatAddAmountInput() {
    const amountInput = document.getElementById('txAmount');
    if (!amountInput) return;

    const amount = parseAddAmountInput(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) return;

    amountInput.value = formatMoney(Math.min(amount, ADD_TX_MAX_AMOUNT));
    rawAmountString = sanitizeMoneyValue(amountInput.value);
}

function setAddFormStatus(message = '') {
    const statusEl = document.getElementById('addTxStatus');
    if (statusEl) statusEl.textContent = message;
}

function getAddFieldElements(field) {
    const map = {
        amount: {
            input: document.getElementById('txAmount'),
            error: document.getElementById('txAmountError'),
            group: document.getElementById('heroAmountContainer')
        },
        category: {
            input: document.getElementById('txCategory'),
            error: document.getElementById('txCategoryError'),
            group: document.getElementById('addTxCategoryContainer')?.closest('.add-form-group')
        },
        description: {
            input: document.getElementById('txDescription'),
            error: document.getElementById('txDescriptionError'),
            group: document.getElementById('txDescription')?.closest('.add-form-group')
        },
        date: {
            input: document.getElementById('txDateNative'),
            error: document.getElementById('txDateError'),
            group: document.getElementById('txDateNative')?.closest('.add-form-group')
        }
    };
    return map[field] || {};
}

function setAddFieldError(field, message = '') {
    const { input, error, group } = getAddFieldElements(field);
    const hasError = Boolean(message);

    if (error) error.textContent = message;
    if (input) input.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    if (group) {
        group.classList.toggle('add-field-invalid', hasError);
        if (hasError) {
            group.classList.remove('shake-error');
            void group.offsetWidth;
            group.classList.add('shake-error');
            setTimeout(() => group.classList.remove('shake-error'), 420);
        }
    }
}

function clearAddFormErrors() {
    ['amount', 'category', 'description', 'date'].forEach(field => setAddFieldError(field, ''));
}

function focusAddField(field) {
    const { input, group } = getAddFieldElements(field);
    const target = field === 'category'
        ? group?.querySelector('button:not([disabled])') || group
        : input;

    if (target && typeof target.focus === 'function') {
        try {
            target.focus({ preventScroll: true });
        } catch {
            target.focus();
        }
    }

    const scrollTarget = group || input;
    scrollTarget?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

function getAddTransactionCategories(type) {
    const categories = State.getCategories() || [];
    return categories.filter(cat => {
        if (type === 'income') return cat.type === 'income';
        return !cat.type || cat.type === 'expense';
    });
}

function updateAddTransactionDate(value) {
    const dateValue = isValidLocalISODate(value) ? value : getLocalISODate();
    const hiddenInput = document.getElementById('txDateHidden');
    const nativeInput = document.getElementById('txDateNative');
    const display = document.getElementById('selectedDateText');

    if (hiddenInput) hiddenInput.value = dateValue;
    if (nativeInput) nativeInput.value = dateValue;
    if (display) display.textContent = dateValue === getLocalISODate() ? 'Today' : formatDate(dateValue);
    setAddFieldError('date', '');
}

export function setAddTransactionDate(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + Number(offsetDays || 0));
    updateAddTransactionDate(getLocalISODate(date));
}

export function openAddDatePicker() {
    const dateInput = document.getElementById('txDateNative');
    if (!dateInput) return;

    try {
        dateInput.focus({ preventScroll: true });
    } catch {
        dateInput.focus();
    }

    if (typeof dateInput.showPicker === 'function') {
        try {
            dateInput.showPicker();
            return;
        } catch {
            // Browser may block showPicker if not user-triggered.
        }
    }

    dateInput.focus();
}

function bindAddDatePickerEvents() {
    const dateInput = document.getElementById('txDateNative');
    const dateShell = dateInput?.closest('.add-date-shell');
    if (!dateInput) return;

    if (!dateInput.dataset.nativePickerBound) {
        dateInput.dataset.nativePickerBound = 'true';
        dateInput.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'mouse') return;
            if (typeof dateInput.showPicker !== 'function') return;

            try {
                dateInput.showPicker();
            } catch {
                // Some mobile browsers only allow the default input tap behavior.
            }
        });
        dateInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openAddDatePicker();
        });
    }

    if (dateShell && !dateShell.dataset.nativePickerBound) {
        dateShell.dataset.nativePickerBound = 'true';
        dateShell.addEventListener('click', (event) => {
            if (event.target === dateInput) return;

            event.preventDefault();
            const now = Date.now();
            if (now - addDatePickerRequestAt < 300) return;
            addDatePickerRequestAt = now;

            openAddDatePicker();
            if (typeof dateInput.showPicker !== 'function') {
                dateInput.click();
            }
        });
    }
}

function handleAddAmountInput(event) {
    const input = event?.target || document.getElementById('txAmount');
    if (!input) return;

    const sanitized = sanitizeMoneyValue(input.value).slice(0, 13);
    if (input.value !== sanitized) input.value = sanitized;

    rawAmountString = sanitized;
    if (parseAddAmountInput(sanitized) > 0) setAddFieldError('amount', '');
}

function bindAddFormInputEvents() {
    const amountInput = document.getElementById('txAmount');
    if (amountInput && !amountInput.dataset.addTxBound) {
        amountInput.dataset.addTxBound = 'true';
        amountInput.addEventListener('input', handleAddAmountInput);
        amountInput.addEventListener('focus', () => {
            amountInput.value = sanitizeMoneyValue(amountInput.value);
            amountInput.select();
        });
        amountInput.addEventListener('blur', formatAddAmountInput);
    }

    const descInput = document.getElementById('txDescription');
    if (descInput && !descInput.dataset.addTxBound) {
        descInput.dataset.addTxBound = 'true';
        descInput.maxLength = ADD_TX_DESCRIPTION_MAX_LENGTH;
        descInput.addEventListener('focus', showSmartSuggestionsIfAvailable);
        descInput.addEventListener('click', showSmartSuggestionsIfAvailable);
        descInput.addEventListener('input', () => {
            if (sanitizeAddText(descInput.value, ADD_TX_DESCRIPTION_MAX_LENGTH)) {
                setAddFieldError('description', '');
            }
        });
    }

    const notesInput = document.getElementById('txNotes');
    if (notesInput) notesInput.maxLength = ADD_TX_NOTES_MAX_LENGTH;
}

export function initAddTransactionForm() {
    bindAddFormInputEvents();
    bindAddDatePickerEvents();
    const dateInput = document.getElementById('txDateNative');
    if (dateInput) {
        dateInput.min = '1900-01-01';
        dateInput.max = '2100-12-31';
    }
    updateAddTransactionDate(document.getElementById('txDateHidden')?.value || getLocalISODate());
    clearAddFormErrors();
}

// ==========================================
// 8. FORM SUBMISSION & FEEDBACK
// ==========================================

export function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function animateSlotText(element, finalText, options = {}) {
    if (!element) return;

    const text = String(finalText ?? '');
    const intervalMs = options.intervalMs || 55;
    const duration = options.duration || 850;
    const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (element._slotTimer) {
        clearInterval(element._slotTimer);
        element._slotTimer = null;
    }
    if (element._slotDoneTimer) {
        clearTimeout(element._slotDoneTimer);
        element._slotDoneTimer = null;
    }

    if (reduceMotion) {
        element.textContent = text;
        if (onComplete) onComplete();
        return;
    }

    const chars = Array.from(text);
    const digitPositions = [];
    chars.forEach((ch, idx) => {
        if (/\d/.test(ch)) digitPositions.push(idx);
    });

    if (digitPositions.length === 0) {
        element.textContent = text;
        if (onComplete) onComplete();
        return;
    }

    const digitOrder = new Map(digitPositions.map((idx, order) => [idx, order]));
    const totalTicks = Math.max(8, Math.ceil(duration / intervalMs));
    let tick = 0;

    const renderTick = (settledDigits) => {
        const threshold = digitPositions.length - settledDigits;
        element.textContent = chars.map((ch, idx) => {
            if (!/\d/.test(ch)) return ch;
            const order = digitOrder.get(idx) || 0;
            return order >= threshold ? ch : String(Math.floor(Math.random() * 10));
        }).join('');
    };

    element.classList.add('slot-roll-active');
    renderTick(0);

    element._slotTimer = setInterval(() => {
        tick += 1;
        const settledDigits = Math.min(digitPositions.length, Math.ceil((tick / totalTicks) * digitPositions.length));
        renderTick(settledDigits);

        if (tick >= totalTicks) {
            clearInterval(element._slotTimer);
            element._slotTimer = null;
            element.textContent = text;
            element.classList.remove('slot-roll-active');
            if (onComplete) {
                element._slotDoneTimer = setTimeout(() => {
                    element._slotDoneTimer = null;
                    onComplete();
                }, 40);
            }
        }
    }, intervalMs);
}

function playExpenseSlotMachine({ category, remaining, symbol, spent, budgetAmount }) {
    const feedbackText = document.getElementById('heroFeedbackText');
    const feedbackWrapper = document.getElementById('heroFeedbackWrapper');
    if (!feedbackText) return;

    const hasBudget = Number(budgetAmount) > 0;
    const isUnbudgeted = !hasBudget && remaining < 0;
    const isHealthy = remaining >= 0;
    const amountText = `${symbol}${formatMoney(Math.abs(remaining))}`;
    const labelText = isUnbudgeted ? 'Unbudgeted spend' : (isHealthy ? `Left in ${category}` : 'Overspent by');
    const tone = isHealthy ? 'var(--green)' : 'var(--red)';

    feedbackText.classList.add('slot-machine');
    feedbackText.style.color = tone;
    feedbackText.innerHTML = `
        <span class="slot-number" aria-live="polite"></span>
        <span class="slot-label"></span>
    `;

    const amountEl = feedbackText.querySelector('.slot-number');
    const labelEl = feedbackText.querySelector('.slot-label');
    if (labelEl) labelEl.textContent = labelText;

    animateSlotText(amountEl, amountText, { duration: 950, intervalMs: 50 });

    if (spent !== undefined) {
        const spentEl = document.getElementById(`spent-val-${String(category || '').replace(/\s+/g, '-')}`);
        const metricLabelEl = document.getElementById(`metric-label-${String(category || '').replace(/\s+/g, '-')}`);
        if (spentEl) {
            const metric = getCategoryMetricDisplay({ budget: budgetAmount, spent });
            if (metricLabelEl) metricLabelEl.textContent = metric.label;
            spentEl.style.color = metric.color;
            spentEl.classList.add('slot-roll-active');
            animateSlotText(spentEl, `${metric.prefix}${symbol}${formatMoney(metric.amount)}`, { duration: 900, intervalMs: 50 });

            const row = spentEl.closest('.category-item');
            if (row) {
                row.classList.add('expense-slot-highlight');
                setTimeout(() => row.classList.remove('expense-slot-highlight'), 900);
            }
        }
    }

    if (feedbackWrapper) {
        feedbackWrapper.classList.add('expense-slot-feedback');
        setTimeout(() => feedbackWrapper.classList.remove('expense-slot-feedback'), 1000);
    }
}

function clearSlotAnimations() {
    document.querySelectorAll('.slot-roll-active').forEach(el => {
        if (el._slotTimer) {
            clearInterval(el._slotTimer);
            el._slotTimer = null;
        }
        if (el._slotDoneTimer) {
            clearTimeout(el._slotDoneTimer);
            el._slotDoneTimer = null;
        }
        el.classList.remove('slot-roll-active');
    });

    document.querySelectorAll('.expense-slot-highlight').forEach(el => {
        el.classList.remove('expense-slot-highlight');
    });

    document.getElementById('heroFeedbackText')?.classList.remove('slot-machine');
    document.getElementById('heroFeedbackWrapper')?.classList.remove('expense-slot-feedback');
}

export function submitTransaction() {
    const descInput = document.getElementById('txDescription');
    const amtInput = document.getElementById('txAmount');
    const catInput = document.getElementById('txCategory');
    const dateInput = document.getElementById('txDateHidden');
    const methodInput = document.getElementById('txPaymentMethod');
    const notesInput = document.getElementById('txNotes');

    {
        clearAddFormErrors();
        setAddFormStatus('');

        const desc = sanitizeAddText(descInput?.value, ADD_TX_DESCRIPTION_MAX_LENGTH);
        const category = String(catInput?.value || '').trim();
        const amount = parseAddAmountInput(amtInput?.value || '0');
        const currentType = State.getCurrentType();
        const validCategories = getAddTransactionCategories(currentType);
        const categoryIsValid = validCategories.some(cat => cat.name === category);
        const dateValue = dateInput?.value || getLocalISODate();
        const paymentMethodRaw = methodInput?.value || '';
        const paymentMethod = ADD_TX_PAYMENT_METHODS.has(paymentMethodRaw) ? paymentMethodRaw : '';
        const notes = sanitizeAddText(notesInput?.value, ADD_TX_NOTES_MAX_LENGTH);

        if (!Number.isFinite(amount) || amount <= 0) {
            setAddFieldError('amount', 'Enter an amount greater than 0.');
            setAddFormStatus('Amount is required.');
            showToast('Enter an amount greater than 0.');
            focusAddField('amount');
            return;
        }

        if (amount > ADD_TX_MAX_AMOUNT) {
            const symbol = State.getSymbol ? State.getSymbol() : '$';
            setAddFieldError('amount', `Amount must be ${symbol}${formatMoney(ADD_TX_MAX_AMOUNT)} or less.`);
            setAddFormStatus('Amount is too large.');
            showToast('Amount is too large.');
            focusAddField('amount');
            return;
        }

        if (!desc) {
            setAddFieldError('description', 'Description is required.');
            setAddFormStatus('Description is required.');
            showToast('Description is required.');
            focusAddField('description');
            return;
        }

        if (!category || !categoryIsValid) {
            const label = currentType === 'income' ? 'income source' : 'category';
            setAddFieldError('category', `Select a valid ${label}.`);
            setAddFormStatus(`Select a valid ${label}.`);
            showToast(`Select a valid ${label}.`);
            focusAddField('category');
            return;
        }

        if (!isValidLocalISODate(dateValue)) {
            setAddFieldError('date', 'Choose a valid date.');
            setAddFormStatus('Choose a valid date.');
            showToast('Choose a valid date.');
            focusAddField('date');
            return;
        }

        const newTx = {
            id: generateId(),
            type: currentType,
            description: desc,
            category,
            amount,
            date: dateValue,
            paymentMethod,
            notes,
            tag: currentType,
            createdAt: new Date().toISOString()
        };

        if (blockDebtLockedSavingsIncreaseIfNeeded(newTx)) return;

        State.addTransaction(newTx);
        observeLocalSave('1 transaction saved partially.');
        lastSavedTxId = newTx.id;
        setAddFormStatus(`${currentType === 'income' ? 'Deposit' : 'Expense'} saved. Undo is available for a few seconds.`);
        showToast(`${currentType === 'income' ? 'Deposit' : 'Expense'} saved.`);
        render();

        const targetCategory = validCategories.find(c => c.name === category) || {};
        const budgetAmount = targetCategory.budget || 0;
        const spent = getCategoryTransactionSummary(category, 'expense').total;
        const remaining = budgetAmount - spent;
        const symbol = State.getSymbol ? State.getSymbol() : '$';

        triggerSuccessMorph(newTx, remaining, symbol, budgetAmount);
        return;
    }

    const desc = descInput?.value.trim();
    const category = catInput?.value.trim();

    const rawInputVal = amtInput?.value || "0";
    const cleanAmountString = rawInputVal.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleanAmountString);

    if (isNaN(amount) || amount <= 0) {
        showToast('⚠️ Please enter a valid amount');
        return;
    }
    if (!category) {
        showToast('⚠️ Please select a category');
        return;
    }
    if (!desc) {
        showToast('⚠️ Description is required');
        return;
    }

    const currentType = State.getCurrentType();
    const newTx = {
        id: generateId(),
        type: currentType,
        description: desc,
        category: category,
        amount: amount,
        date: dateInput?.value || new Date().toISOString().split('T')[0],
        paymentMethod: methodInput?.value || '',
        notes: notesInput?.value || '',
        tag: currentType === 'savings' || currentType === 'debt' ? currentType : 'transaction',
        createdAt: new Date().toISOString()
    };

    if (blockDebtLockedSavingsIncreaseIfNeeded(newTx)) return;

    State.addTransaction(newTx);
    observeLocalSave('1 transaction saved partially.');
    lastSavedTxId = newTx.id;
    render();

    const categories = State.getCategories() || [];
    const targetCategory = categories.find(c => c.name === category) || {};
    const budgetAmount = targetCategory.budget || 0;
    const spent = getCategoryTransactionSummary(category, 'expense').total;

    const remaining = budgetAmount - spent;
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    triggerSuccessMorph(newTx, remaining, symbol, budgetAmount);
}

function triggerSuccessMorph(tx, remaining, symbol, budgetAmount) {
    const inputWrapper = document.getElementById('heroInputWrapper');
    const feedbackWrapper = document.getElementById('heroFeedbackWrapper');
    const feedbackText = document.getElementById('heroFeedbackText');

    if (!inputWrapper || !feedbackWrapper || !feedbackText) {
        hardResetForm();
        return;
    }

    inputWrapper.style.opacity = '0';
    inputWrapper.style.visibility = 'hidden';
    inputWrapper.style.position = 'absolute';

    feedbackWrapper.style.opacity = '1';
    feedbackWrapper.style.visibility = 'visible';
    feedbackWrapper.style.position = 'relative';
    feedbackText.classList.remove('slot-machine');
    feedbackWrapper.classList.remove('expense-slot-feedback');

    if (tx.type === 'expense') {
        playExpenseSlotMachine({
            category: tx.category,
            remaining,
            symbol,
            spent: budgetAmount - remaining,
            budgetAmount
        });
    } else {
        feedbackText.classList.remove('slot-machine');
        feedbackText.innerHTML = `Deposited ${symbol}${formatMoney(tx.amount)}!`;
        feedbackText.style.color = 'var(--green)';
    }

    clearTimeout(morphTimeout);
    morphTimeout = setTimeout(() => { completeSaveAndReset(); }, 3000);
}

export function undoLastTransaction() {
    if (lastSavedTxId) {
        State.deleteTransaction(lastSavedTxId);
        lastSavedTxId = null;
        clearTimeout(morphTimeout);
        render();

        const inputWrapper = document.getElementById('heroInputWrapper');
        const feedbackWrapper = document.getElementById('heroFeedbackWrapper');
        if (inputWrapper) {
            inputWrapper.style.opacity = '1';
            inputWrapper.style.visibility = 'visible';
            inputWrapper.style.position = 'relative';
        }
        if (feedbackWrapper) {
            feedbackWrapper.style.opacity = '0';
            feedbackWrapper.style.visibility = 'hidden';
            feedbackWrapper.style.position = 'absolute';
        }
        clearSlotAnimations();

        showToast('↩️ Transaction undone');
    }
}

function completeSaveAndReset() {
    const inputWrapper = document.getElementById('heroInputWrapper');
    const feedbackWrapper = document.getElementById('heroFeedbackWrapper');

    if (inputWrapper) {
        inputWrapper.style.opacity = '1';
        inputWrapper.style.visibility = 'visible';
        inputWrapper.style.position = 'relative';
    }
    if (feedbackWrapper) {
        feedbackWrapper.style.opacity = '0';
        feedbackWrapper.style.visibility = 'hidden';
        feedbackWrapper.style.position = 'absolute';
    }
    clearSlotAnimations();
    lastSavedTxId = null;
    hardResetForm();
}

export function handleDateChange(event) {
    const selectedDate = event.target.value;
    if (!isValidLocalISODate(selectedDate)) {
        setAddFieldError('date', 'Choose a valid date.');
        setAddFormStatus('Choose a valid date.');
        return;
    }
    updateAddTransactionDate(selectedDate);
}

export function hardResetForm() {
    const form = document.getElementById('addTxForm');
    if (form) {
        form.reset();
        const defType = State.getDefaultType ? State.getDefaultType() : 'expense';
        const defMethod = State.getDefaultPayment ? State.getDefaultPayment() : '';

        setType(defType);
        rawAmountString = "";
        updateAmountDisplay();

        const categories = getAddTransactionCategories(defType);
        if (categories.length > 0) {
            selectFormCategory(categories[0].name);
        } else {
            const catInput = document.getElementById('txCategory');
            if(catInput) catInput.value = '';
            document.querySelectorAll('.cat-pill-v2').forEach(pill => pill.classList.remove('active'));
        }

        hideSmartSuggestions();

        const drawer = document.getElementById('txHiddenDetails');
        const detailsBtn = document.getElementById('toggleDetailsBtn');
        const icon = document.getElementById('detailsToggleIcon');
        if (drawer) drawer.classList.remove('open');
        if (detailsBtn) detailsBtn.setAttribute('aria-expanded', 'false');
        if (icon) icon.textContent = '▼';

        const methodSelect = document.getElementById('txPaymentMethod');
        if (methodSelect) methodSelect.value = defMethod;

        updateAddTransactionDate(getLocalISODate());
        clearAddFormErrors();
        setAddFormStatus('');
        bindAddFormInputEvents();
        initDescriptionRollover();
    }
}

// ==========================================
// 9. CATEGORY MANAGEMENT & MODALS
// ==========================================

export function initCategoryUI() {
    const grid = document.getElementById('quickAddGrid');
    if (!grid) return;

    grid.style.display = 'none';

    const defaultCategories = [
        { name: 'Groceries', icon: '🛒' },
        { name: 'Rent', icon: '🏠' },
        { name: 'Gas', icon: '⛽' },
        { name: 'Dining', icon: '🍔' },
        { name: 'Utilities', icon: '⚡' },
        { name: 'Internet', icon: '🌐' }
    ];

    grid.innerHTML = defaultCategories.map(cat => `
        <button type="button" class="quick-add-btn" onclick="window.quickAddCategory('${cat.name}', '${cat.icon}')">
            <div class="quick-add-icon">${cat.icon}</div>
            <div>${cat.name}</div>
        </button>
    `).join('');
}

export function quickAddCategory(name, icon) {
    if (State.addCategory) {
        State.addCategory(name, icon || '📁');
    }
    renderCategoryList();
    renderFormCategories();
    showToast(`✅ Category '${name}' added!`);
}

let categorySheetDragState = null;

function getCategorySheetParts() {
    const modal = document.getElementById('categoryModal');
    const sheet = modal?.querySelector('.modal-box');
    const handle = modal?.querySelector('.category-sheet-drag-handle');
    return { modal, sheet, handle };
}

function canSnapCategorySheet() {
    return true;
}

function setCategorySheetExpanded(isExpanded) {
    const { modal, sheet, handle } = getCategorySheetParts();
    if (!modal || !sheet) return;

    modal.style.setProperty('--category-sheet-expanded-top', `${CATEGORY_SHEET_EXPANDED_TOP_RATIO * 100}dvh`);
    modal.classList.toggle('category-sheet-expanded', Boolean(isExpanded));
    modal.classList.remove('category-sheet-dragging');
    sheet.style.removeProperty('--category-sheet-drag-offset');
    if (handle) {
        handle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        handle.setAttribute('aria-label', isExpanded ? 'Snap category form down' : 'Pull category form up');
    }
}

function resetCategorySheetSnap() {
    categorySheetDragState = null;
    setCategorySheetExpanded(false);
}

window.toggleCategorySheetSnap = function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canSnapCategorySheet()) return;

    const { modal } = getCategorySheetParts();
    setCategorySheetExpanded(!modal?.classList.contains('category-sheet-expanded'));
};

window.handleCategorySheetHandleKey = function(event) {
    if (!canSnapCategorySheet()) return;

    if (event.key === 'Enter' || event.key === ' ') {
        window.toggleCategorySheetSnap(event);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCategorySheetExpanded(true);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCategorySheetExpanded(false);
    }
};

window.startCategorySheetDrag = function(event) {
    if (!canSnapCategorySheet() || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const { modal, sheet } = getCategorySheetParts();
    if (!modal || !sheet) return;

    event.preventDefault();
    event.stopPropagation();

    const isExpanded = modal.classList.contains('category-sheet-expanded');
    categorySheetDragState = {
        startY: event.clientY,
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        isExpanded,
        didDrag: false
    };

    modal.classList.add('category-sheet-dragging');
    try {
        event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {}

    const handleMove = (moveEvent) => {
        if (!categorySheetDragState || moveEvent.pointerId !== categorySheetDragState.pointerId) return;

        const delta = moveEvent.clientY - categorySheetDragState.startY;
        categorySheetDragState.didDrag = categorySheetDragState.didDrag || Math.abs(delta) > 6;

        const offset = categorySheetDragState.isExpanded
            ? Math.max(0, Math.min(delta, 90))
            : Math.min(0, Math.max(delta, -90));

        sheet.style.setProperty('--category-sheet-drag-offset', `${offset}px`);
    };

    const handleEnd = (endEvent) => {
        if (!categorySheetDragState || endEvent.pointerId !== categorySheetDragState.pointerId) return;

        const delta = endEvent.clientY - categorySheetDragState.startY;
        const shouldToggleFromTap = !categorySheetDragState.didDrag;
        const shouldExpand = shouldToggleFromTap
            ? !categorySheetDragState.isExpanded
            : (!categorySheetDragState.isExpanded && delta < -40);
        const shouldCollapse = shouldToggleFromTap
            ? categorySheetDragState.isExpanded
            : (categorySheetDragState.isExpanded && delta > 40);

        try {
            categorySheetDragState.captureTarget?.releasePointerCapture?.(categorySheetDragState.pointerId);
        } catch {}
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleEnd);
        document.removeEventListener('pointercancel', handleEnd);

        const nextExpanded = shouldExpand || (categorySheetDragState.isExpanded && !shouldCollapse);
        categorySheetDragState = null;
        setCategorySheetExpanded(nextExpanded);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);
    document.addEventListener('pointercancel', handleEnd);
};

function getCategoryTypeLabel(type) {
    const labels = {
        expense: 'Expense',
        savings: 'Savings',
        sinking_fund: 'Savings',
        external: 'External',
        debt: 'Debt',
        income: 'Income'
    };

    return labels[type] || 'Category';
}

function getPreviewCategories(activeName = '') {
    const categories = (State.getCategories ? State.getCategories() : [])
        .filter(cat => cat && cat.name)
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (!activeName) return categories;

    const activeIndex = categories.findIndex(cat => cat.name === activeName);
    if (activeIndex <= 0) return categories;

    const [activeCategory] = categories.splice(activeIndex, 1);
    return [activeCategory, ...categories];
}

function updatePreviewRailState(list, total) {
    const hasOverflow = total > 2;
    list.classList.toggle('has-overflow', hasOverflow);
    list.tabIndex = hasOverflow ? 0 : -1;
    list.scrollLeft = 0;
    list.setAttribute(
        'aria-label',
        hasOverflow
            ? 'Existing categories. Scroll horizontally to see more.'
            : 'Existing categories.'
    );
}

function renderExistingCategoryPreview(mode = 'create', activeName = '') {
    const preview = document.getElementById('existingCategoryPreview');
    const list = document.getElementById('existingCategoryPreviewList');
    const count = document.getElementById('existingCategoryPreviewCount');
    if (!preview || !list || !count) return;

    const categories = getPreviewCategories(activeName);

    preview.hidden = false;

    const total = categories.length;
    updatePreviewRailState(list, total);
    count.textContent = `${total} ${total === 1 ? 'category' : 'categories'}`;

    if (!total) {
        list.innerHTML = '<div class="existing-category-empty">No categories yet.</div>';
        return;
    }

    list.innerHTML = categories.map(cat => {
        const activeClass = activeName && cat.name === activeName ? ' is-current' : '';
        return `
            <div class="existing-category-chip${activeClass}" role="listitem" title="${esc(cat.name)}">
                <span class="existing-category-chip-icon" aria-hidden="true">${esc(cat.icon || String.fromCodePoint(0x1F4C1))}</span>
                <span class="existing-category-chip-name">${esc(cat.name)}</span>
                <span class="existing-category-chip-type">${activeClass ? 'Current' : esc(getCategoryTypeLabel(cat.type))}</span>
            </div>
        `;
    }).join('');
    list.scrollLeft = 0;
}

export function openCategoryModal(mode = 'create', name = '', icon = '') {
    const titleEl = document.getElementById('categoryModalTitle');
    const nameInput = document.getElementById('catInputName');
    const iconInput = document.getElementById('catInputIcon');
    const budgetInput = document.getElementById('catInputBudget');
    const budgetSymbol = document.getElementById('catBudgetSymbol');
    const nameIconRow = document.querySelector('#categoryModal .category-name-icon-row');
    const nameTooltip = document.getElementById('catNameTooltip');
    const origInput = document.getElementById('catEditOriginalName');
    const charCount = document.getElementById('catNameCharCount');
    const existingCategory = (State.getCategories ? State.getCategories() : []).find(c => c.name === name);
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    if (budgetSymbol) budgetSymbol.textContent = symbol;
    if (nameTooltip) {
        nameTooltip.hidden = true;
        nameTooltip.classList.remove('visible');
    }

    // Reset Styles
    if (nameInput) {
        nameInput.classList.remove('shake-error', 'input-error');
        nameInput.style.color = 'var(--text)';
    }

    // Setup Mode
    if (mode === 'edit') {
        if (titleEl) titleEl.textContent = 'Edit Category';
        if (nameInput) nameInput.value = name;
        if (budgetInput) budgetInput.value = existingCategory && existingCategory.budget ? formatMoney(existingCategory.budget).replace(/,/g, '') : '';
        if (iconInput) iconInput.value = icon !== '📁' ? icon : '';
        if (origInput) origInput.value = name;
        if (iconInput) iconInput.dataset.userModified = 'true';
    } else {
        if (titleEl) titleEl.textContent = 'Create Category';
        if (nameInput) nameInput.value = '';
        if (budgetInput) budgetInput.value = '';
        if (iconInput) iconInput.value = '';
        if (origInput) origInput.value = '';
        if (iconInput) iconInput.dataset.userModified = 'false';
    }

    // Update Character Counter
    if (charCount && nameInput) {
        charCount.textContent = `${nameInput.value.length}/24`;
        charCount.style.color = nameInput.value.length === 24 ? 'var(--red)' : 'var(--text-dim)';
    }

    if (nameInput && nameIconRow && !nameInput.dataset.expandAttached) {
        let nameExpandTimer = null;
        nameInput.addEventListener('input', () => {
            nameIconRow.classList.add('category-name-active');
            clearTimeout(nameExpandTimer);
            nameExpandTimer = setTimeout(() => nameIconRow.classList.remove('category-name-active'), 900);
        });
        nameInput.addEventListener('blur', () => {
            clearTimeout(nameExpandTimer);
            setTimeout(() => nameIconRow.classList.remove('category-name-active'), 120);
        });
        nameInput.dataset.expandAttached = 'true';
    }

    if (budgetInput && !budgetInput.dataset.currencyFormatAttached) {
        budgetInput.addEventListener('blur', () => {
            const value = parseFloat(budgetInput.value);
            budgetInput.value = Number.isFinite(value) && value > 0 ? formatMoney(value).replace(/,/g, '') : '';
        });
        budgetInput.dataset.currencyFormatAttached = 'true';
    }

    // Attach Input Listener ONLY ONCE
    if (nameInput && !nameInput.dataset.v2Attached) {
        nameInput.addEventListener('input', (e) => {
            const originalVal = e.target.value;
            let val = cleanNameTyping(originalVal);

            if (val !== originalVal) {
                nameInput.classList.remove('shake-error');
                void nameInput.offsetWidth;
                nameInput.classList.add('shake-error');
                setTimeout(() => { nameInput.classList.remove('shake-error'); }, 400);

                const tooltip = document.getElementById('catNameTooltip');
                if (tooltip) {
                    tooltip.hidden = false;
                    tooltip.classList.add('visible');
                    clearTimeout(tooltip._hideTimer);
                    tooltip._hideTimer = setTimeout(() => {
                        tooltip.classList.remove('visible');
                        tooltip.hidden = true;
                    }, 2200);
                }
            }

            if (val.length > 24) val = val.substring(0, 24);
            e.target.value = val;

            if (charCount) {
                charCount.textContent = `${val.length}/24`;
                if (val.length === 24) {
                    charCount.style.color = 'var(--red)';
                    if (window.showToast) window.showToast('⚠️ Max character limit reached (24)');
                } else {
                    charCount.style.color = 'var(--text-dim)';
                }
            }
        });
        nameInput.dataset.v2Attached = 'true';
    }

    // FIX 1: Re-initialize Search EVERY time the modal opens
    initCategorySearchInModal();
    renderExistingCategoryPreview(mode, name);

    // Attach Emoji Picker
    attachEmojiPicker('catInputIcon');

    initCategoryNameRollover();
    resetCategorySheetSnap();
    openModal('categoryModal');

    // Focus Safety
    setTimeout(() => {
        if (nameInput && typeof nameInput.focus === 'function') {
            nameInput.focus();
        }
    }, 100);
}

    export function closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) modal.classList.remove('emoji-picker-open');
        resetCategorySheetSnap();
        document.querySelector('#categoryModal .category-name-icon-row')?.classList.remove('category-name-active', 'icon-picker-open');
        const tooltip = document.getElementById('catNameTooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
            tooltip.hidden = true;
        }
        closeModal('categoryModal');

        // Explicit Cleanup: Force hide floating UI elements so they don't ghost on reopen
        const autocompleteList = document.getElementById('catAutocompleteList');
        if (autocompleteList) {
            autocompleteList.style.display = 'none';
        }

        const iconInput = document.getElementById('catInputIcon');
        if (iconInput) {
            const pickerGrid = document.querySelector('#categoryModal .emoji-picker-grid');
            if (pickerGrid) pickerGrid.style.display = 'none';
        }
    }

    export function saveCategory() {
        const nameInputRaw = document.getElementById('catInputName').value.trim();
        const iconInputRaw = document.getElementById('catInputIcon').value.trim();
        const budgetInputRaw = document.getElementById('catInputBudget')?.value || '';
        const budgetAmount = Math.max(0, parseFloat(budgetInputRaw) || 0);
        const origName = document.getElementById('catEditOriginalName').value;

        const isValidName = cleanNameInput(nameInputRaw).length > 0 && nameInputRaw.length <= NAME_MAX_LENGTH;
        if (!isValidName) {
            if (window.showToast) window.showToast('Invalid name. Use 1-24 characters, no line breaks.');
            return;
        }

        let finalIcon = iconInputRaw || '📁';

        if (!origName) {
            // NEW CATEGORY: Check the return value from State.addCategory
            // Tell State to use 'income' if the flag is true, otherwise default to 'expense'
            const result = State.addCategory(nameInputRaw, finalIcon, 'expense', budgetAmount);
            if (result && result.success === false) {
                // Duplicate or invalid - show error and keep modal open
                if (window.showToast) window.showToast(`⚠️ ${result.error || 'Category Already Exists'}`);

                // Shake the input field for visual feedback
                const nameInput = document.getElementById('catInputName');
                if (nameInput) {
                    nameInput.classList.remove('shake-error');
                    void nameInput.offsetWidth; // Trigger reflow
                    nameInput.classList.add('shake-error');
                    setTimeout(() => nameInput.classList.remove('shake-error'), 400);
                }
                return; // DON'T close modal
            }

            if (window.showToast) window.showToast(`✅ Category '${nameInputRaw}' created!`);
        } else {
            // EXISTING CATEGORY: Edit mode
            const result = State.editCategory(origName, nameInputRaw, finalIcon, null, budgetAmount);

            if (result && result.success === false) {
                if (window.showToast) window.showToast(`⚠️ ${result.error || 'Failed to update'}`);

                const nameInput = document.getElementById('catInputName');
                if (nameInput) {
                    nameInput.classList.remove('shake-error');
                    void nameInput.offsetWidth;
                    nameInput.classList.add('shake-error');
                    setTimeout(() => nameInput.classList.remove('shake-error'), 400);
                }
                return;
            }

            if (window.showToast) window.showToast(`✅ Category updated!`);
        }

        renderCategoryList();
        renderFormCategories();
        renderIncomeTab();
        if (typeof renderZBBDashboard === 'function') {
            renderZBBDashboard();
        }
        closeCategoryModal();
    }

// --- DELETE & REASSIGN FLOW ---

let pendingCategoryDelete = null;
let deleteTimerInterval = null;
let pendingIncomeSourceDelete = null;
let incomeDeleteTimerInterval = null;

function updateCategoryDeleteWarningCount(count) {
    const safeCount = Math.max(0, parseInt(count, 10) || 0);
    const countEl = document.getElementById('deleteTxCount');
    const pluralEl = document.getElementById('deleteTxS');
    const pluralDetailEl = document.getElementById('deleteTxSDetail');
    const moveBtn = document.getElementById('deleteMoveTransactionsBtn');
    const noTxImpactEl = document.getElementById('deleteNoTxImpact');
    const txStayLine = document.getElementById('deleteTxStayLine');
    const txUncatLine = document.getElementById('deleteTxUncatLine');
    const hasTiedTransactions = safeCount > 0;

    if (countEl) countEl.textContent = safeCount;
    if (pluralEl) pluralEl.textContent = safeCount === 1 ? '' : 's';
    if (pluralDetailEl) pluralDetailEl.textContent = safeCount === 1 ? '' : 's';
    if (moveBtn) moveBtn.hidden = !hasTiedTransactions;
    if (noTxImpactEl) noTxImpactEl.hidden = !hasTiedTransactions;
    if (txStayLine) txStayLine.hidden = !hasTiedTransactions;
    if (txUncatLine) txUncatLine.hidden = !hasTiedTransactions;
}

export function removeCategory(name) {
    const skipWarning = localStorage.getItem('bb_skip_cat_warn') === 'true';
    const txList = State.getTransactions() || [];
    const count = txList.filter(t => t.category === name).length;

    if (skipWarning) {
        State.deleteCategory(name);
        renderCategoryList();
        renderFormCategories();
        render();
        showToast(`🗑️ Category '${name}' deleted.`);
        return;
    }

    pendingCategoryDelete = name;
    const nameEl = document.getElementById('deleteCatName');
    if (nameEl) nameEl.textContent = name;

    updateCategoryDeleteWarningCount(count);

    let timeLeft = 30;
    const timerEl = document.getElementById('deleteTimer');
    if (timerEl) timerEl.textContent = timeLeft;

    clearInterval(deleteTimerInterval);
    deleteTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) closeDeleteCategoryModal();
    }, 1000);

    openModal('deleteCategoryModal');
}

export function removeIncomeSource(name) {
    const skipWarning = localStorage.getItem('bb_skip_income_warn') === 'true';
    const txList = State.getTransactions() || [];
    const count = txList.filter(t => t.category === name && t.type === 'income').length;

    if (skipWarning) {
        executeIncomeSourceDelete(name);
        return;
    }

    pendingIncomeSourceDelete = name;

    const nameEl = document.getElementById('deleteIncomeSourceName');
    if (nameEl) nameEl.textContent = name;

    const countEl = document.getElementById('deleteIncomeTxCount');
    const pluralEl = document.getElementById('deleteIncomeTxS');
    if (countEl) countEl.textContent = count;
    if (pluralEl) pluralEl.textContent = count === 1 ? '' : 's';

    const skipCheckbox = document.getElementById('deleteIncomeSkipWarn');
    if (skipCheckbox) skipCheckbox.checked = false;

    let timeLeft = 30;
    const timerEl = document.getElementById('deleteIncomeTimer');
    if (timerEl) timerEl.textContent = timeLeft;

    clearInterval(incomeDeleteTimerInterval);
    incomeDeleteTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) closeDeleteIncomeSourceModal();
    }, 1000);

    openModal('deleteIncomeSourceModal');
}

export function closeDeleteCategoryModal() {
    clearInterval(deleteTimerInterval);
    pendingCategoryDelete = null;
    window.closeCategoryDeleteMoveModal?.();
    closeModal('deleteCategoryModal');
}

export function closeDeleteIncomeSourceModal() {
    clearInterval(incomeDeleteTimerInterval);
    pendingIncomeSourceDelete = null;
    closeModal('deleteIncomeSourceModal');
}

export function executeIncomeSourceDelete(directName = null) {
    const targetName = directName || pendingIncomeSourceDelete;
    if (!targetName) return;

    const skipCheckbox = document.getElementById('deleteIncomeSkipWarn');
    if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem('bb_skip_income_warn', 'true');
    }

    if (State.deleteIncomeSource) {
        State.deleteIncomeSource(targetName);
    } else {
        State.deleteCategory(targetName);
    }

    renderIncomeTab();
    renderFormCategories();
    renderZBBDashboard();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
    if (window.showToast) window.showToast(`Income source '${targetName}' deleted.`);

    closeDeleteIncomeSourceModal();
}

export function proceedToDelete() {
    executeCategoryDelete(pendingCategoryDelete, null);
}

function getCategoryDeleteMoveOptions(categoryName) {
    const categories = State.getCategories ? State.getCategories() : [];
    const sourceCategory = categories.find(cat => cat.name === categoryName) || { type: 'expense' };
    const sourceType = sourceCategory.type || 'expense';
    // Category delete move compatibility is intentionally centralized here for future rule changes.
    const compatibleCategoryTypes = {
        savings: new Set(['savings', 'sinking_fund', 'external']),
        sinking_fund: new Set(['savings', 'sinking_fund', 'external']),
        external: new Set(['savings', 'sinking_fund', 'external']),
        income: new Set(['income']),
        expense: new Set(['expense', '']),
        debt: new Set(['debt'])
    };
    const allowedTypes = compatibleCategoryTypes[sourceType] || compatibleCategoryTypes.expense;

    return categories
        .filter(cat => {
            if (!cat || !cat.name || cat.name === categoryName) return false;
            return allowedTypes.has(cat.type || 'expense');
        })
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function refreshCategoryDeleteTransactionCount(categoryName) {
    const txList = State.getTransactions ? State.getTransactions() : [];
    const count = txList.filter(t => t.category === categoryName).length;
    updateCategoryDeleteWarningCount(count);

    return count;
}

window.openCategoryDeleteMoveModal = function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const categoryName = pendingCategoryDelete;
    if (!categoryName) return;

    const count = refreshCategoryDeleteTransactionCount(categoryName);
    if (count === 0) {
        if (window.showToast) window.showToast('No transactions need to be moved.');
        return;
    }

    const categories = getCategoryDeleteMoveOptions(categoryName);
    if (categories.length === 0) {
        if (window.showToast) window.showToast('Create another compatible category before moving these transactions.');
        return;
    }

    document.getElementById('categoryDeleteMoveModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'categoryDeleteMoveModal';
    modal.className = 'modal-overlay active';
    modal.onclick = (modalEvent) => {
        if (modalEvent.target === modal) window.closeCategoryDeleteMoveModal();
    };

    modal.innerHTML = `
        <div class="modal-box modal-box-medium recent-move-modal" role="dialog" aria-modal="true" aria-labelledby="categoryDeleteMoveTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.closeCategoryDeleteMoveModal()" aria-label="Close move transactions">&times;</button>
            <h3 id="categoryDeleteMoveTitle" class="modal-title">Move Transactions</h3>
            <p class="recent-move-copy">Move ${count} transaction${count === 1 ? '' : 's'} out of ${esc(categoryName)} before deleting the category.</p>
            <div class="add-form-group">
                <label for="categoryDeleteMoveSelect">New Category</label>
                <select id="categoryDeleteMoveSelect" class="payment-method-select">
                    <option value="" selected disabled>Select a category...</option>
                    ${categories.map(cat => `<option value="${esc(cat.name)}">${esc(cat.icon || String.fromCodePoint(0x1F4C1))} ${esc(cat.name)}</option>`).join('')}
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="window.closeCategoryDeleteMoveModal()">Cancel</button>
                <button type="button" class="btn-create" onclick="window.confirmCategoryDeleteMove()">Move Transactions</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    requestAnimationFrame(() => document.getElementById('categoryDeleteMoveSelect')?.focus());
};

window.closeCategoryDeleteMoveModal = function() {
    const modal = document.getElementById('categoryDeleteMoveModal');
    if (!modal) return;
    modal.classList.add('closing');
    window.setTimeout(() => {
        modal.remove();
        syncOverlayScrollTopState();
    }, 220);
};

window.confirmCategoryDeleteMove = function() {
    const categoryName = pendingCategoryDelete;
    const select = document.getElementById('categoryDeleteMoveSelect');
    const nextCategory = select?.value || '';
    if (!categoryName || !nextCategory) {
        if (select) select.focus();
        return;
    }

    const txs = State.getTransactions ? State.getTransactions() : [];
    let movedCount = 0;
    txs.forEach(tx => {
        if (tx.category === categoryName) {
            tx.category = nextCategory;
            movedCount++;
        }
    });

    if (State.saveTransactions) {
        State.saveTransactions(txs);
    } else if (State.save) {
        State.save();
    }

    refreshCategoryDeleteTransactionCount(categoryName);
    renderCategoryList();
    renderFormCategories();
    render();
    window.closeCategoryDeleteMoveModal();
    if (window.showToast) window.showToast(`Moved ${movedCount} transaction${movedCount === 1 ? '' : 's'} to ${nextCategory}.`);
};

export function openReassignModal(categoryName, count) {
    const nameEl = document.getElementById('reassignCatName');
    const countEl = document.getElementById('reassignTxCount');
    const selectEl = document.getElementById('reassignCategorySelect');

    if (nameEl) nameEl.textContent = categoryName;
    if (countEl) countEl.textContent = count;

    if (selectEl) {
        const cats = State.getCategories() || [];

        // Find the type of the category being deleted
        const targetCat = cats.find(c => c.name === categoryName) || { type: 'expense' };
        const isIncome = targetCat.type === 'income';

        selectEl.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.text = isIncome ? 'Select an income source...' : 'Select a category...';
        defaultOpt.selected = true;
        defaultOpt.disabled = true;
        selectEl.appendChild(defaultOpt);

        cats.forEach(cat => {
            // ONLY show options that match the exact same type (income to income, expense to expense)
            if (cat.name !== categoryName && cat.type === targetCat.type) {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.text = `${cat.icon || '📁'} ${cat.name}`;
                selectEl.appendChild(opt);
            }
        });
    }
    openModal('reassignCategoryModal');
}

export function handleReassignConfirm() {
    const selectEl = document.getElementById('reassignCategorySelect');
    const forceOrphan = document.getElementById('deleteForceOrphan');
    const target = selectEl ? selectEl.value : '';

    if (!target && (!forceOrphan || !forceOrphan.checked)) {
        alert("Please select a category to move the transactions, or check the box to delete them.");
        return;
    }

    const replacement = target || null;
    executeCategoryDelete(document.getElementById('reassignCatName').textContent, replacement);
}

export function executeCategoryDelete(directName = null, targetReplacement = null) {
    const targetName = directName || pendingCategoryDelete;
    if (!targetName) return;
    const skipCheckbox = document.getElementById('deleteSkipWarn');
    if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem('bb_skip_cat_warn', 'true');
    }

    State.deleteCategory(targetName, targetReplacement);

    renderCategoryList();
    renderFormCategories();
    render();

    showToast(`🗑️ Category '${targetName}' deleted.${targetReplacement ? ' Transactions moved.' : ''}`);

    closeDeleteCategoryModal();
    pendingCategoryDelete = null;
}

// ==========================================
// 10. DRILL-DOWN LOGIC (UPDATED WITH INFINITE SCROLL)
// ==========================================

// Global state for lazy loading within the drill-down panel
let txScrollObserver = null;
const TX_SCROLL_TRIGGER_ID = 'drillDownScrollTrigger';

/**
 * NEW HELPER: Renders the transaction list with infinite scroll.
 * Shows first 3 transactions, then auto-loads more as user scrolls down.
 */
function renderDrillDownTransactionHistory(categoryName, categoryType, symbol) {
    const txHistoryList = document.getElementById('drillDownTxList');
    if (!txHistoryList) {
        console.warn('[DrillDown] #drillDownTxList element not found.');
        return;
    }

    // Disconnect any previous observer to prevent double-listeners
    if (txScrollObserver) {
        txScrollObserver.disconnect();
        txScrollObserver = null;
    }

    // 1. Get Data
    const allTxs = State.getTransactions() || [];

    // Filter for specific category AND specific type, EXCLUDING cross-contamination tags
    // This ensures that if you click "Groceries", you don't see savings deposits or debt payments tagged with Groceries
    let categoryTransactions = allTxs.filter(tx =>
        tx.category === categoryName &&
        tx.type === categoryType &&
        tx.tag !== 'savings' &&
        tx.tag !== 'debt'
    );

    // 2. Sort (Newest First)
    categoryTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    // Handle empty state immediately
    if (categoryTransactions.length === 0) {
        txHistoryList.innerHTML = `
            <div class="drilldown-empty" style="text-align:center; padding: 2rem; color: var(--text-dim);">
                No transactions yet for this category.
            </div>`;
        return;
    }

    // 3. Render Initial Batch (First 3)
    const initialLimit = Math.min(3, categoryTransactions.length);
    const initialTransactions = categoryTransactions.slice(0, initialLimit);

    txHistoryList.innerHTML = initialTransactions.map(tx => createTransactionCardHTML(tx, symbol)).join('');
    bindDrillDownSwipeActions(txHistoryList);

    // 4. Setup Infinite Scroll Trigger if there are more items
    if (initialTransactions.length < categoryTransactions.length) {
        const triggerDiv = document.createElement('div');
        triggerDiv.id = TX_SCROLL_TRIGGER_ID;
        triggerDiv.style.cssText = `
            height: 1px;
            width: 100%;
            opacity: 0;
            pointer-events: none;
            margin-top: 1rem;
        `;

        // Initialize Intersection Observer
        if ('IntersectionObserver' in window) {
            txScrollObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Unobserve to prevent re-firing immediately
                        txScrollObserver.unobserve(entry.target);

                        // Load next batch
                        loadNextBatch(categoryName, categoryType, symbol, categoryTransactions, txHistoryList, entry.target);
                    }
                });
            }, {
                root: txHistoryList,
                rootMargin: '50px', // Start loading 50px before bottom
                threshold: 0.1
            });

            txScrollObserver.observe(triggerDiv);
        } else {
            // Fallback for old browsers: Show a "Load More" button
            const fallbackBtn = document.createElement('button');
            fallbackBtn.textContent = 'Load More Transactions';
            fallbackBtn.style.cssText = `
                width: 100%; margin-top: 1rem; padding: 0.75rem;
                background: var(--accent); color: white; border: none;
                border-radius: 8px; font-weight: 600; cursor: pointer;
            `;
            fallbackBtn.onclick = () => {
                loadNextBatch(categoryName, categoryType, symbol, categoryTransactions, txHistoryList, null);
                fallbackBtn.remove();
            };
            txHistoryList.appendChild(fallbackBtn);
        }

        txHistoryList.appendChild(triggerDiv);
    }
}

/**
 * Helper: Renders a single transaction card HTML string.
 * Used by both initial render and infinite scroll.
 */
function createTransactionCardHTML(tx, symbol) {
    const amountClass = tx.type === 'income' ? 'var(--green)' : 'var(--text)';
    const sign = tx.type === 'income' ? '+' : '-';
    const txId = esc(String(tx.id || ''));

    // Use imported esc and formatDate directly if available, otherwise fallback
    const desc = typeof window !== 'undefined' && window.esc ? window.esc(tx.description || 'Unnamed') : (tx.description || 'Unnamed');
    const formattedDate = typeof window !== 'undefined' && window.formatDate ? window.formatDate(tx.date) : tx.date;

    return `
        <div class="subcategory-item drilldown-tx-card" data-tx-id="${txId}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg); border-radius: 8px; border: 1px solid var(--border); margin-bottom: 0.5rem;">
            <div class="drilldown-tx-swipe-bg" aria-hidden="true">Delete</div>
            <div class="drilldown-tx-main">
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text);">${desc}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${formattedDate}</div>
            </div>
            <div class="drilldown-tx-amount" style="font-weight: 700; font-size: 1rem; color: ${amountClass}">
                ${sign}${symbol}${formatMoney(tx.amount)}
            </div>
        </div>
    `;
}

function bindDrillDownSwipeActions(listContainer) {
    const cards = listContainer.querySelectorAll('.drilldown-tx-card:not([data-swipe-bound="true"])');
    cards.forEach(card => {
        card.dataset.swipeBound = 'true';
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let pointerId = null;
        let isSwiping = false;
        let suppressClick = false;

        const resetSwipe = () => {
            card.style.removeProperty('--drilldown-swipe-x');
            card.classList.remove('is-swiping-delete');
            window.setTimeout(() => { suppressClick = false; }, 0);
        };

        card.addEventListener('click', (event) => {
            if (suppressClick) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        card.addEventListener('pointerdown', (event) => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a')) return;

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            currentX = startX;
            isSwiping = false;
        });

        card.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (!isSwiping && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
                isSwiping = true;
                try { card.setPointerCapture(event.pointerId); } catch {}
            }

            if (!isSwiping) return;
            event.preventDefault();
            currentX = event.clientX;
            const offset = Math.max(-132, Math.min(0, deltaX));
            card.style.setProperty('--drilldown-swipe-x', `${offset}px`);
            card.classList.toggle('is-swiping-delete', offset < -18);
        });

        const endSwipe = (event) => {
            if (pointerId !== event.pointerId) return;

            const deltaX = currentX - startX;
            const txId = card.dataset.txId;
            const shouldDelete = isSwiping && deltaX < -118;
            suppressClick = isSwiping;
            pointerId = null;
            isSwiping = false;

            if (shouldDelete && txId) {
                card.style.setProperty('--drilldown-swipe-x', '-132px');
                card.classList.add('is-swiping-delete');
                window.setTimeout(() => {
                    resetSwipe();
                    openRecentDeleteTransactionModal(txId);
                }, 120);
                return;
            }

            resetSwipe();
        };

        card.addEventListener('pointerup', endSwipe);
        card.addEventListener('pointercancel', endSwipe);
    });
}

/**
 * Helper: Loads the next batch of transactions (5 at a time)
 */
function loadNextBatch(categoryName, categoryType, symbol, allCategoryTxs, container, triggerElement) {
    // Count existing cards to determine next slice position
    const existingCards = container.querySelectorAll('.subcategory-item').length;
    const batchSize = 5;

    // Safety check: Don't go out of bounds
    if (existingCards >= allCategoryTxs.length) {
        if (triggerElement) triggerElement.remove();
        return;
    }

    const endIdx = Math.min(existingCards + batchSize, allCategoryTxs.length);
    const newTransactions = allCategoryTxs.slice(existingCards, endIdx);

    // FIX: Use insertAdjacentHTML for strings instead of insertBefore with strings
    const newHTML = newTransactions.map(tx => createTransactionCardHTML(tx, symbol)).join('');

    if (triggerElement && container.contains(triggerElement)) {
        // Insert before the trigger element
        triggerElement.insertAdjacentHTML('beforebegin', newHTML);
    } else {
        // Append to end
        container.insertAdjacentHTML('beforeend', newHTML);
    }
    bindDrillDownSwipeActions(container);

    // If we reached the end, remove the trigger/stop observing
    if (endIdx >= allCategoryTxs.length && triggerElement) {
        triggerElement.remove();
        if (txScrollObserver) txScrollObserver.disconnect();
    }
}

function getBudgetMetricColor(value) {
    const amount = parseFloat(value) || 0;
    if (amount > 0.005) return 'var(--green, #10b981)';
    if (amount < -0.005) return 'var(--red, #ef4444)';
    return 'var(--text, #0f172a)';
}

function getBudgetMetricStatusClass(value) {
    const amount = parseFloat(value) || 0;
    if (amount > 0.005) return 'zbb-positive';
    if (amount < -0.005) return 'zbb-danger';
    return 'zbb-neutral';
}

function renderDrillDownBudgetMetrics({ budget = 0, spent = 0, catType = 'expense' } = {}) {
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const budgetAmount = Math.max(0, parseFloat(budget) || 0);
    const spentAmount = Math.max(0, parseFloat(spent) || 0);
    const leftAmount = budgetAmount - spentAmount;
    const mode = window.currentDrillDownMetricMode === 'left' ? 'left' : 'spent';
    const value = mode === 'left' ? leftAmount : spentAmount;
    const toggleBtn = document.getElementById('drillDownToggleMetric');
    const toggleLabel = document.getElementById('drillDownToggleLabel');
    const valueEl = document.getElementById('drillDownTotal');
    const zbbMessage = document.getElementById('zbbMessage');
    const budgetDisplay = document.getElementById('drillDownBudgetText');

    if (budgetDisplay) budgetDisplay.textContent = `${symbol}${formatMoney(budgetAmount)}`;

    if (catType !== 'expense') {
        const labels = {
            income: 'Logged',
            savings: 'Saved',
            debt: 'Paid So Far'
        };
        if (toggleLabel) toggleLabel.textContent = labels[catType] || 'Spent';
        if (valueEl) {
            valueEl.textContent = `${symbol}${formatMoney(spentAmount)}`;
            valueEl.style.color = getBudgetMetricColor(spentAmount);
        }
        if (toggleBtn) {
            toggleBtn.disabled = true;
            toggleBtn.removeAttribute('title');
            toggleBtn.setAttribute('aria-label', `${labels[catType] || 'Spent'} amount`);
        }
        if (zbbMessage) zbbMessage.hidden = true;
        return;
    }

    if (toggleLabel) toggleLabel.textContent = mode === 'left' ? 'Left' : 'Spent';
    if (valueEl) {
        const prefix = mode === 'left' && leftAmount < -0.005 ? '-' : '';
        valueEl.textContent = `${prefix}${symbol}${formatMoney(Math.abs(value))}`;
        const colorValue = mode === 'left'
            ? leftAmount
            : (spentAmount <= 0.005 ? 0 : (leftAmount < -0.005 ? -spentAmount : spentAmount));
        valueEl.style.color = getBudgetMetricColor(colorValue);
    }

    if (toggleBtn) {
        toggleBtn.dataset.metricMode = mode;
        toggleBtn.disabled = catType !== 'expense';
        toggleBtn.setAttribute('aria-label', mode === 'left' ? 'Show amount spent' : 'Show amount left');
        toggleBtn.title = mode === 'left' ? 'Click to show spent' : 'Click to show left';
    }

    if (zbbMessage) {
        const shouldShowStart = budgetAmount <= 0.005 && spentAmount <= 0.005;
        const statusMode = mode === 'left' ? 'spent' : 'left';
        const statusValue = statusMode === 'left' ? leftAmount : spentAmount;
        const statusColorValue = statusMode === 'left'
            ? leftAmount
            : (spentAmount <= 0.005 ? 0 : (leftAmount < -0.005 ? -spentAmount : spentAmount));
        const statusPrefix = statusMode === 'left' && leftAmount < -0.005 ? '-' : '';

        zbbMessage.hidden = false;
        zbbMessage.classList.remove('zbb-positive', 'zbb-neutral', 'zbb-danger', 'zbb-budget-status');

        if (shouldShowStart) {
            zbbMessage.textContent = 'Set a budget to get started';
            zbbMessage.classList.add('zbb-neutral');
        } else {
            zbbMessage.textContent = `Budgeted amount ${statusMode === 'left' ? 'left' : 'spent'} ${statusPrefix}${symbol}${formatMoney(Math.abs(statusValue))}`;
            zbbMessage.classList.add('zbb-budget-status', getBudgetMetricStatusClass(statusColorValue));
        }
    }
}

function updateDrillDownCategoryProgress({ budget = 0, spent = 0, catType = 'expense', category = null } = {}) {
    const progressBar = document.getElementById('drillDownProgress');
    const progressTrack = document.getElementById('drillDownProgressTrack');
    if (!progressBar || !progressTrack) return;

    const budgetAmount = Math.max(0, parseFloat(budget) || 0);
    const spentAmount = Math.max(0, parseFloat(spent) || 0);
    let percent = 0;
    let fillColor = 'var(--green, #10b981)';
    let trackColor = 'var(--border, #e2e8f0)';
    let ariaLabel = 'Category progress unavailable.';

    if (catType === 'expense') {
        percent = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : (spentAmount > 0 ? 100 : 0);
        if (percent > 100) fillColor = 'var(--red, #ef4444)';
        else if (percent > 80) fillColor = 'var(--yellow, #f59e0b)';

        const roundedPercent = Math.round(percent);
        if (budgetAmount <= 0 && spentAmount <= 0) {
            ariaLabel = 'Expense progress unavailable. Budgeted and spent are both zero.';
        } else if (budgetAmount <= 0) {
            ariaLabel = 'Expense progress: unbudgeted spending.';
        } else {
            ariaLabel = `Expense progress: ${roundedPercent} percent of budget spent.`;
        }
    } else if (catType === 'savings') {
        percent = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : (spentAmount > 0 ? 100 : 0);
        trackColor = 'var(--yellow, #f59e0b)';
        fillColor = percent >= 100 ? 'var(--green, #10b981)' : 'var(--accent, #14b8a6)';
        ariaLabel = budgetAmount <= 0 && spentAmount <= 0
            ? 'Savings progress unavailable. Goal and saved are both zero.'
            : `Savings progress: ${Math.round(percent)} percent of goal saved.`;
    } else if (catType === 'debt') {
        const starting = Math.max(0, parseFloat(category?.startingBalance || category?.balance) || 0);
        const current = Math.max(0, parseFloat(category?.balance) || 0);
        const paidOff = Math.max(0, starting - current);
        percent = starting > 0 ? (paidOff / starting) * 100 : 0;
        fillColor = 'var(--green, #10b981)';
        ariaLabel = starting > 0
            ? `Debt progress: ${Math.round(percent)} percent paid off.`
            : 'Debt progress unavailable. Starting balance is zero.';
    } else {
        return;
    }

    const clampedPercent = Math.min(Math.max(percent, 0), 100);
    progressTrack.style.backgroundColor = trackColor;
    progressTrack.setAttribute('aria-label', ariaLabel);
    progressBar.style.width = `${clampedPercent}%`;
    progressBar.style.backgroundColor = budgetAmount <= 0 && spentAmount <= 0 && catType !== 'debt'
        ? 'var(--text-dim, #64748b)'
        : fillColor;
}

window.toggleDrillDownMetric = function() {
    window.currentDrillDownMetricMode = window.currentDrillDownMetricMode === 'left' ? 'spent' : 'left';
    const categoryName = document.getElementById('drillDownTitle')?.textContent || '';
    const categories = State.getCategories ? State.getCategories() : [];
    const targetCategory = categories.find(c => c.name === categoryName) || { type: 'expense', budget: 0 };
    const catType = targetCategory.type || 'expense';
    const totalAmount = getCategoryTransactionSummary(categoryName, catType).total;

    renderDrillDownBudgetMetrics({
        budget: targetCategory.budget || 0,
        spent: totalAmount,
        catType
    });
    renderCategoryList();
};

window.openCategoryDrillDown = function(categoryName, categoryIcon) {
    if (isCategoryEditMode) return;

    const overlay = document.getElementById('categoryDrillDownOverlay');
    const panel = document.getElementById('categoryDrillDownPanel');

    document.getElementById('drillDownIcon').textContent = categoryIcon || '📁';
    document.getElementById('drillDownTitle').textContent = categoryName;

    const categories = State.getCategories() || [];

    // 1. Identify what type of category we are clicking
    const targetCategory = categories.find(c => c.name === categoryName) || { type: 'expense' };
    const catType = targetCategory.type || 'expense'; // Will be 'expense', 'income', 'savings', or 'debt'

    // 2. Sum up ONLY the transactions that match this category's type
    const totalAmount = getCategoryTransactionSummary(categoryName, catType).total;

    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const budgetDisplay = document.getElementById('drillDownBudgetText');
    const budgetInput = document.getElementById('drillDownBudget');
    const sourceBudget = targetCategory.budget || 0;
    if (budgetInput) budgetInput.value = sourceBudget ? sourceBudget.toFixed(2) : '';

    // 3. --- THE MAGIC: DYNAMIC LABELS ---
    const metricLabels = document.querySelectorAll('.drill-down-metrics .metric-label');
    if (metricLabels.length >= 2) {
        if (catType === 'income') {
            metricLabels[0].textContent = 'Expected';
            metricLabels[1].textContent = 'Logged';
        } else if (catType === 'savings') {
            metricLabels[0].textContent = 'Goal';
            metricLabels[1].textContent = 'Saved';
        } else if (catType === 'debt') {
            metricLabels[0].textContent = 'Starting Balance';
            metricLabels[1].textContent = 'Paid So Far';
        } else {
            metricLabels[0].textContent = 'Budgeted';
        }
    }
    renderDrillDownBudgetMetrics({ budget: sourceBudget, spent: totalAmount, catType });

    const editBtn = document.getElementById('drillDownEditBtn');
    const deleteBtn = document.getElementById('drillDownDeleteBtn');
    const logActionBtn = document.getElementById('drillDownLogExpenseBtn');

    if (editBtn) {
        editBtn.onclick = () => {
            window.closeCategoryDrillDown();
            if (catType === 'income') {
                window.openAddSourceModal(categoryName);
            } else {
                window.openCategoryModal('edit', categoryName, categoryIcon);
            }
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = () => {
            window.closeCategoryDrillDown();
            if (catType === 'income') {
                window.removeIncomeSource(categoryName);
            } else {
                window.removeCategory(categoryName);
            }
        };
    }

    // 4. --- THE MAGIC: DYNAMIC BUTTON ACTIONS ---
    if (logActionBtn) {
        if (catType === 'income') logActionBtn.textContent = '+ Log Income';
        else if (catType === 'savings') logActionBtn.textContent = '+ Log Savings';
        else if (catType === 'debt') logActionBtn.textContent = '+ Log Payment';
        else logActionBtn.textContent = '+ Log Expense';

        // FIX: Use arrow function to capture current values of categoryName & catType
        logActionBtn.onclick = () => {
            window.closeCategoryDrillDown();
            window.switchTab('add');
            window.setType(catType); // Sets Expense/Income mode correctly

            // Pre-select the correct category in the form
            if (window.selectFormCategory) {
                window.selectFormCategory(categoryName);
            }

            // Optional: Auto-focus amount input
            setTimeout(() => {
                const amtInput = document.getElementById('txAmount');
                if (amtInput) amtInput.focus();
            }, 300);
        };
    }

    // 5. --- PROGRESS BAR LOGIC ---
    const progressBar = document.getElementById('drillDownProgress');
    const progressTrack = progressBar?.parentElement;
    const fillPctLabel = document.getElementById('drillDownProgressFillPct');
    const trackPctLabel = document.getElementById('drillDownProgressTrackPct');
    const fillPctButton = document.getElementById('drillDownProgressFillBtn');
    const trackPctButton = document.getElementById('drillDownProgressTrackBtn');

    let progressPointerTarget = null;
    let progressPointerWasOpen = false;
    let progressPointerType = null;
    const isProgressTipOpen = (segment) => {
        if (!progressTrack) return false;
        return segment === 'fill'
            ? progressTrack.classList.contains('show-fill-tip')
            : progressTrack.classList.contains('show-track-tip');
    };
    const hideProgressTips = () => {
        if (progressTrack) progressTrack.classList.remove('show-fill-tip', 'show-track-tip');
        if (fillPctButton) fillPctButton.setAttribute('aria-pressed', 'false');
        if (trackPctButton) trackPctButton.setAttribute('aria-pressed', 'false');
    };
    const showProgressTip = (segment) => {
        const isFill = segment === 'fill';
        if (progressTrack) {
            progressTrack.classList.toggle('show-fill-tip', isFill);
            progressTrack.classList.toggle('show-track-tip', !isFill);
        }
        if (fillPctButton) fillPctButton.setAttribute('aria-pressed', isFill ? 'true' : 'false');
        if (trackPctButton) trackPctButton.setAttribute('aria-pressed', isFill ? 'false' : 'true');
    };
    const toggleProgressTip = (segment) => {
        if (isProgressTipOpen(segment)) {
            hideProgressTips();
        } else {
            showProgressTip(segment);
        }
    };
    const trackProgressPointerState = (segment, event) => {
        if (event.pointerType === 'mouse') {
            event.preventDefault();
            progressPointerTarget = null;
            progressPointerWasOpen = false;
            progressPointerType = null;
            hideProgressTips();
            return;
        }

        progressPointerTarget = segment;
        progressPointerType = event.pointerType;
        progressPointerWasOpen = isProgressTipOpen(segment);
    };
    const handleProgressPointerEnter = (event) => {
        if (event.pointerType === 'mouse') hideProgressTips();
    };
    const handleProgressClick = (segment) => {
        if (progressPointerType === 'mouse') {
            progressPointerTarget = null;
            progressPointerWasOpen = false;
            progressPointerType = null;
            return;
        }

        const shouldHide = progressPointerTarget === segment
            ? progressPointerWasOpen
            : isProgressTipOpen(segment);

        if (shouldHide) {
            hideProgressTips();
        } else {
            showProgressTip(segment);
        }

        progressPointerTarget = null;
        progressPointerWasOpen = false;
        progressPointerType = null;
    };
    const resetProgressButton = (button) => {
        if (!button) return;
        button.disabled = true;
        button.setAttribute('aria-pressed', 'false');
        button.onpointerdown = null;
        button.onpointerenter = null;
        button.onclick = null;
        button.onfocus = null;
        button.onblur = null;
        button.onkeydown = null;
    };

    if (progressBar && targetCategory) {
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '';
        if (progressTrack) {
            progressTrack.style.backgroundColor = '';
            progressTrack.classList.remove('show-fill-tip', 'show-track-tip');
            progressTrack.style.setProperty('--progress-fill-label-left', '0%');
            progressTrack.style.setProperty('--progress-track-label-left', '100%');
            progressTrack.style.setProperty('--progress-fill-segment-width', '0%');
            progressTrack.style.setProperty('--progress-track-segment-width', '100%');
            progressTrack.setAttribute('aria-label', 'Progress percentages');
            progressTrack.onpointermove = null;
            progressTrack.onpointerleave = null;
        }
        resetProgressButton(fillPctButton);
        resetProgressButton(trackPctButton);
        if (fillPctLabel) fillPctLabel.textContent = '0%';
        if (trackPctLabel) trackPctLabel.textContent = '100%';

        if (catType === 'income') {
            const expected = sourceBudget;
            const logged = totalAmount;

            if (expected <= 0 && logged <= 0) {
                if (progressTrack) progressTrack.style.backgroundColor = 'var(--text-dim, #64748b)';
                progressBar.style.width = '100%';
                progressBar.style.backgroundColor = 'var(--text-dim, #64748b)';
                if (progressTrack) progressTrack.setAttribute('aria-label', 'Income progress unavailable. Expected and logged are both zero.');
            } else {
                const loggedPercent = expected > 0 ? (logged / expected) * 100 : 100;
                const clampedLoggedPercent = Math.min(Math.max(loggedPercent, 0), 100);
                const expectedRemainderPercent = 100 - clampedLoggedPercent;
                const roundedLoggedPercent = Math.round(clampedLoggedPercent);
                const roundedExpectedPercent = Math.round(expectedRemainderPercent);
                if (progressTrack) progressTrack.style.backgroundColor = 'var(--yellow, #f59e0b)';
                progressBar.style.width = `${clampedLoggedPercent}%`;
                progressBar.style.backgroundColor = 'var(--green, #10b981)';
                if (progressTrack) {
                    progressTrack.style.setProperty('--progress-fill-label-left', `${Math.max(5, Math.min(clampedLoggedPercent / 2, 95))}%`);
                    progressTrack.style.setProperty('--progress-track-label-left', `${Math.max(5, Math.min(clampedLoggedPercent + (expectedRemainderPercent / 2), 95))}%`);
                    progressTrack.style.setProperty('--progress-fill-segment-width', `${clampedLoggedPercent}%`);
                    progressTrack.style.setProperty('--progress-track-segment-width', `${expectedRemainderPercent}%`);
                    progressTrack.setAttribute('aria-label', `Income progress: ${roundedLoggedPercent} percent logged, ${roundedExpectedPercent} percent expected.`);
                    progressTrack.onpointermove = (event) => {
                        if (event.pointerType !== 'mouse') return;

                        const rect = progressTrack.getBoundingClientRect();
                        const pointerPercent = ((event.clientX - rect.left) / rect.width) * 100;
                        const isOverLogged = clampedLoggedPercent >= 100 || (clampedLoggedPercent > 0 && pointerPercent <= clampedLoggedPercent);
                        showProgressTip(isOverLogged ? 'fill' : 'track');
                    };
                    progressTrack.onpointerleave = (event) => {
                        if (event.pointerType !== 'mouse') return;

                        progressPointerTarget = null;
                        progressPointerWasOpen = false;
                        progressPointerType = null;
                        hideProgressTips();
                    };
                }

                const setAdaptiveProgressLabel = (label, percent, suffix, segmentPercent) => {
                    if (!label) return;

                    const percentText = `${percent}%`;
                    const fullText = `${percentText} ${suffix}`;
                    label.textContent = fullText;

                    if (!progressTrack) {
                        label.textContent = percentText;
                        return;
                    }

                    const trackWidth = progressTrack.getBoundingClientRect().width;
                    const segmentWidth = trackWidth * (segmentPercent / 100);
                    if (!trackWidth || label.scrollWidth > segmentWidth - 6) {
                        label.textContent = percentText;
                    }
                };

                const updateAdaptiveProgressLabels = () => {
                    setAdaptiveProgressLabel(fillPctLabel, roundedLoggedPercent, 'Logged', clampedLoggedPercent);
                    setAdaptiveProgressLabel(trackPctLabel, roundedExpectedPercent, 'Expected', expectedRemainderPercent);
                };

                const handleProgressKeydown = (event) => {
                    if (event.key === 'Escape') {
                        hideProgressTips();
                        event.currentTarget.blur();
                    } else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleProgressTip(event.currentTarget === fillPctButton ? 'fill' : 'track');
                    } else if (event.key === 'ArrowLeft' && fillPctButton && !fillPctButton.disabled) {
                        event.preventDefault();
                        fillPctButton.focus();
                    } else if (event.key === 'ArrowRight' && trackPctButton && !trackPctButton.disabled) {
                        event.preventDefault();
                        trackPctButton.focus();
                    }
                };

                if (fillPctButton && clampedLoggedPercent > 0) {
                    fillPctButton.disabled = false;
                    fillPctButton.setAttribute('aria-label', `Show logged income percentage: ${roundedLoggedPercent} percent`);
                    fillPctButton.onpointerenter = handleProgressPointerEnter;
                    fillPctButton.onpointerdown = (event) => trackProgressPointerState('fill', event);
                    fillPctButton.onclick = () => handleProgressClick('fill');
                    fillPctButton.onfocus = () => {
                        if (progressPointerTarget !== 'fill') showProgressTip('fill');
                    };
                    fillPctButton.onblur = hideProgressTips;
                    fillPctButton.onkeydown = handleProgressKeydown;
                }

                if (trackPctButton && expectedRemainderPercent > 0) {
                    trackPctButton.disabled = false;
                    trackPctButton.setAttribute('aria-label', `Show expected income percentage: ${roundedExpectedPercent} percent`);
                    trackPctButton.onpointerenter = handleProgressPointerEnter;
                    trackPctButton.onpointerdown = (event) => trackProgressPointerState('track', event);
                    trackPctButton.onclick = () => handleProgressClick('track');
                    trackPctButton.onfocus = () => {
                        if (progressPointerTarget !== 'track') showProgressTip('track');
                    };
                    trackPctButton.onblur = hideProgressTips;
                    trackPctButton.onkeydown = handleProgressKeydown;
                }
                updateAdaptiveProgressLabels();
                requestAnimationFrame(updateAdaptiveProgressLabels);
            }
        } else if (catType === 'debt') {
            const starting = targetCategory.startingBalance || targetCategory.balance || 0;
            const current = targetCategory.balance || 0;
            const paidOff = starting - current;
            let percent = starting > 0 ? (paidOff / starting) * 100 : 0;
            progressBar.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
            progressBar.style.backgroundColor = 'var(--positive)';
        }
    }
    updateDrillDownCategoryProgress({
        budget: sourceBudget,
        spent: totalAmount,
        catType,
        category: targetCategory
    });

    setupDrillDownBudgetEdit(categoryName);

    // --- FIX APPLIED HERE ---
    // Call the new helper function to populate the history list IMMEDIATELY
    // We do this BEFORE opening the panel so the user sees data instantly.
    renderDrillDownTransactionHistory(categoryName, catType, symbol);

    // -----------------------------------------------------------
    // OLD BROKEN CODE (COMMENTED OUT):
    // renderDrillDownTransactionHistory(categoryName, catType, symbol);
    // (This line was previously floating at the top of the file causing errors)
    // -----------------------------------------------------------

    if (overlay) overlay.classList.add('active');
    if (panel) panel.classList.add('active');
    syncOverlayScrollTopState();
};

window.closeCategoryDrillDown = function() {
    const overlay = document.getElementById('categoryDrillDownOverlay');
    const panel = document.getElementById('categoryDrillDownPanel');
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('active');
    syncOverlayScrollTopState();
};

function refreshOpenCategoryDrillDown() {
    const panel = document.getElementById('categoryDrillDownPanel');
    if (!panel?.classList.contains('active')) return;

    const categoryName = document.getElementById('drillDownTitle')?.textContent || '';
    if (!categoryName) return;

    const categories = State.getCategories ? State.getCategories() : [];
    const category = categories.find(cat => cat.name === categoryName);
    if (!category) {
        window.closeCategoryDrillDown?.();
        return;
    }

    window.openCategoryDrillDown?.(category.name, category.icon || '');
}

/**
 * Handles the budget editing logic for the drill-down panel
 */
function setupDrillDownBudgetEdit(categoryName) {
    const budgetWrapper = document.getElementById('budgetEditWrapper');
    const budgetText = document.getElementById('drillDownBudgetText');
    const budgetInputContainer = document.getElementById('drillDownBudgetInputContainer');
    const budgetInput = document.getElementById('drillDownBudget');
    const symbolDisplay = document.getElementById('drillDownSymbol');

    if (!budgetWrapper || !budgetText || !budgetInputContainer || !budgetInput || !symbolDisplay) {
        console.warn('[DrillDown] Missing budget edit elements.');
        return;
    }

    // Remove old listeners by cloning node
    const newWrapper = budgetWrapper.cloneNode(true);
    budgetWrapper.parentNode.replaceChild(newWrapper, budgetWrapper);

    // Re-fetch references
    const freshWrapper = document.getElementById('budgetEditWrapper');
    const freshText = document.getElementById('drillDownBudgetText');
    const freshInputContainer = document.getElementById('drillDownBudgetInputContainer');
    const freshInput = document.getElementById('drillDownBudget');
    const freshSymbol = document.getElementById('drillDownSymbol');

    if (!freshWrapper || !freshText || !freshInputContainer || !freshInput || !freshSymbol) return;

    const currentSymbol = State.getSymbol ? State.getSymbol() : '$';
    freshSymbol.textContent = currentSymbol;
    freshInput.setAttribute('placeholder', '0.00');

    freshWrapper.addEventListener('click', () => {
        freshText.style.display = 'none';
        freshInputContainer.style.display = 'flex';
        setTimeout(() => {
            freshInput.focus();
            freshInput.select();
        }, 10);
    });

    const saveBudget = () => {
        const rawVal = freshInput.value.replace(/[^0-9.-]/g, '');
        const newVal = parseFloat(rawVal) || 0;

        if (State.updateCategoryBudget) {
            State.updateCategoryBudget(categoryName, newVal);
        }

        freshInputContainer.style.display = 'none';
        freshText.style.display = 'block';
        const categories = State.getCategories ? State.getCategories() : [];
        const targetCategory = categories.find(c => c.name === categoryName) || { type: 'expense' };
        const catType = targetCategory.type || 'expense';
        const totalAmount = getCategoryTransactionSummary(categoryName, catType).total;
        renderDrillDownBudgetMetrics({ budget: newVal, spent: totalAmount, catType });
        updateDrillDownCategoryProgress({
            budget: newVal,
            spent: totalAmount,
            catType,
            category: targetCategory
        });
        renderCategoryList();
        renderFormCategories();

        if (typeof renderZBBDashboard === 'function') {
            renderZBBDashboard();
        }
        if (typeof renderIncomeTab === 'function') {
            renderIncomeTab();
        }
    };

    freshInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBudget();
        } else if (e.key === 'Escape') {
            freshInputContainer.style.display = 'none';
            freshText.style.display = 'block';
        }
    });

    freshInput.addEventListener('blur', saveBudget);
}

// ==========================================
// 8. THEME & SETTINGS - Core
// ==========================================

const ACCENT_THEME_KEY = 'bb_accent_color';
const ACCENT_THEME_VALUES = new Set([
    'teal',
    'blue',
    'green',
    'amber',
    'rose',
    'indigo',
    'slate',
    'orange',
    'cyan',
    'sky',
    'lime',
    'emerald',
    'red',
    'pink',
    'zinc'
]);

export function applyAccentTheme(accent = 'teal') {
    const safeAccent = ACCENT_THEME_VALUES.has(accent) ? accent : 'teal';
    document.documentElement.setAttribute('data-accent', safeAccent);
    document.querySelectorAll('input[name="accentColor"]').forEach(input => {
        input.checked = input.value === safeAccent;
    });
}

export function setAccentTheme(accent = 'teal') {
    const safeAccent = ACCENT_THEME_VALUES.has(accent) ? accent : 'teal';
    localStorage.setItem(ACCENT_THEME_KEY, safeAccent);
    applyAccentTheme(safeAccent);
}

export function applyTheme(theme) {
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

export function setTheme(theme) {
    localStorage.setItem('bb_theme_mode', theme);
    applyTheme(theme);

    document.querySelectorAll('.theme-opt').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.theme-opt[data-theme-val="${theme}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

export function initSettingsUI() {
    const savedTheme = localStorage.getItem('bb_theme_mode') || 'system';
    const savedAccent = localStorage.getItem(ACCENT_THEME_KEY) || 'teal';
    const activeBtn = document.querySelector(`.theme-opt[data-theme-val="${savedTheme}"]`);
    if (activeBtn) {
        document.querySelectorAll('.theme-opt').forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }
    applyAccentTheme(savedAccent);
    document.querySelectorAll('input[name="accentColor"]').forEach(input => {
        input.addEventListener('change', () => {
            if (input.checked) applyAccentTheme(input.value);
        });
    });
    updateCurrencyUI();
}

export function openSettingsModal() {
    const currentCurrency = State.getSymbol ? State.getSymbol() : '$';
    const defType = State.getDefaultType ? State.getDefaultType() : 'expense';
    const defPayment = State.getDefaultPayment ? State.getDefaultPayment() : '';
    const summaryView = State.getDashboardSummaryCollapsed && State.getDashboardSummaryCollapsed() ? 'collapsed' : 'open';

    const currencySelect = document.getElementById('currencySelect');
    const typeSelect = document.getElementById('defaultTypeSelect');
    const paymentSelect = document.getElementById('defaultPaymentSelect');
    const summarySelect = document.getElementById('summaryViewSelect');
    const savedAccent = localStorage.getItem(ACCENT_THEME_KEY) || 'teal';

    if (currencySelect) currencySelect.value = currentCurrency;
    if (typeSelect) typeSelect.value = defType;
    if (paymentSelect) paymentSelect.value = defPayment;
    if (summarySelect) summarySelect.value = summaryView;
    applyAccentTheme(savedAccent);

    renderSyncHistory();
    openModal('settingsModal');
}

export function closeSettingsModal() {
    applyAccentTheme(localStorage.getItem(ACCENT_THEME_KEY) || 'teal');
    closeModal('settingsModal');
}

export function saveSettings() {
    const currencySelect = document.getElementById('currencySelect');
    const typeSelect = document.getElementById('defaultTypeSelect');
    const paymentSelect = document.getElementById('defaultPaymentSelect');
    const summarySelect = document.getElementById('summaryViewSelect');
    const accentSelect = document.querySelector('input[name="accentColor"]:checked');

    if (currencySelect && State.setSymbol) State.setSymbol(currencySelect.value);
    if (typeSelect && State.setDefaultType) State.setDefaultType(typeSelect.value);
    if (paymentSelect && State.setDefaultPayment) State.setDefaultPayment(paymentSelect.value);
    if (accentSelect) setAccentTheme(accentSelect.value);
    if (summarySelect && State.setDashboardSummaryCollapsed) {
        const collapsed = summarySelect.value === 'collapsed';
        State.setDashboardSummaryCollapsed(collapsed);
        window.zbbSummaryCollapsed = collapsed;
        applyDashboardSummaryState();
    }

    observeLocalSave('Settings saved partially.');

    updateCurrencyUI();
    hardResetForm();

    closeSettingsModal();
    showToast('✅ Settings saved!');
}

export function updateCurrencyUI() {
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    document.querySelectorAll('.currency-badge').forEach(badge => {
        badge.textContent = symbol;
    });

    const heroCurrencyBadge = document.getElementById('heroCurrencyBadge');
    if (heroCurrencyBadge) {
        heroCurrencyBadge.textContent = symbol;
    }

    render();
}

// --- FACTORY RESET LOGIC ---

export function openResetModal() {
    closeSettingsModal();
    openModal('resetConfirmModal');
}

export function closeResetModal() {
    closeModal('resetConfirmModal');
}

export function executeFactoryReset() {
    if (State.factoryReset) {
        State.factoryReset();
    }
}

// ==========================================
// V2 CUSTOM EMOJI PICKER
// ==========================================
const COMMON_EMOJIS = ['🍔', '🛒', '🏠', '⛽', '🚗', '⚡', '🌐', '📱', '🎬', '🎮', '🏥', '💊', '🛍️', '👕', '✈️', '🏖️', '📚', '💰', '📈', '💳', '🏦', '🏋️', '🐾', '🔄', '💻', '🎁', '☕', '🍷', '👶', '🛠️'];

function attachEmojiPicker(inputId) {
    const input = document.getElementById(inputId);
    // Prevent multiple attachments on same input
    if (!input || input.dataset.emojiAttached) return;

    const parent = input.parentNode;
    const isModalIconInput = inputId === 'catInputIcon' || inputId === 'incomeSourceIcon';
    const pickerHost = isModalIconInput ? (input.closest('.modal-box') || parent) : parent;
    pickerHost.style.position = 'relative';
    if (!isModalIconInput) parent.style.position = 'relative';

    // Create picker grid element
    const picker = document.createElement('div');
    picker.className = 'emoji-picker-grid';
    picker.style.cssText = `
        position: absolute; top: calc(100% + 4px); left: 0;
        background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
        padding: 0.5rem; display: none;
        z-index: 5000; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: max-content;
    `;

    // Center for compact icon inputs
    if (inputId === 'batchIconInput') {
        picker.style.left = '50%';
        picker.style.transform = 'translateX(-50%)';
    } else if (isModalIconInput) {
        picker.style.left = '50%';
        picker.style.transform = 'translateX(-50%)';
        picker.style.width = 'min(320px, calc(100vw - 2rem))';
    }

    picker.innerHTML = `
        <div class="emoji-picker-header">
            <div class="emoji-picker-rule" aria-hidden="true"></div>
            <button type="button" class="emoji-picker-close" aria-label="Close emoji picker">&times;</button>
        </div>
        <div class="emoji-picker-options">
            ${COMMON_EMOJIS.map(e =>
                `<button type="button" class="emoji-opt" aria-label="Choose icon ${e}">${e}</button>`
            ).join('')}
        </div>
    `;

    pickerHost.appendChild(picker);

    // Single source of truth for visibility state
    let isVisible = false;
    const expandableIconPicker = inputId === 'catInputIcon' || inputId === 'incomeSourceIcon';
    const owningModal = expandableIconPicker ? input.closest('.modal-overlay') : null;
    const iconRow = expandableIconPicker ? input.closest('.category-name-icon-row') : null;

    const showPicker = () => {
        if (isModalIconInput) {
            const inputRect = input.getBoundingClientRect();
            const hostRect = pickerHost.getBoundingClientRect();
            picker.style.top = `${inputRect.bottom - hostRect.top + 8}px`;
            picker.style.left = '50%';
            picker.style.transform = 'translateX(-50%)';
        }
        picker.style.display = 'block';
        if (owningModal) owningModal.classList.add('emoji-picker-open');
        isVisible = true;
    };

    const hidePicker = () => {
        picker.style.display = 'none';
        if (owningModal) owningModal.classList.remove('emoji-picker-open');
        if (iconRow) iconRow.classList.remove('icon-picker-open');
        isVisible = false;
    };

    const togglePicker = () => {
        if (picker.style.display === 'block') {
            hidePicker();
        } else {
            if (iconRow) {
                iconRow.classList.remove('category-name-active', 'frequency-active');
                iconRow.classList.add('icon-picker-open');
            }
            showPicker();
        }
    };

    // Emoji selection
    picker.querySelectorAll('.emoji-opt').forEach(opt => {
        const chooseEmoji = (e) => {
            e.preventDefault();
            e.stopPropagation();
            input.value = opt.textContent;
            input.dispatchEvent(new Event('input'));
            hidePicker();
        };
        opt.addEventListener('pointerdown', chooseEmoji);
        opt.addEventListener('click', chooseEmoji);
    });

    const closeButton = picker.querySelector('.emoji-picker-close');
    if (closeButton) {
        const closePicker = (e) => {
            e.preventDefault();
            e.stopPropagation();
            hidePicker();
        };
        closeButton.addEventListener('pointerdown', closePicker);
        closeButton.addEventListener('click', closePicker);
    }

    // Pointer events avoid the mobile double-fire click/touch path.
    input.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePicker();
    });

    // Close when clicking outside
    document.addEventListener('pointerdown', (e) => {
        if (isVisible && !input.contains(e.target) && !picker.contains(e.target)) {
            hidePicker();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (isVisible && e.key === 'Escape') {
            hidePicker();
            input.focus();
        }
    });

    input.dataset.emojiAttached = 'true';
}

export function initCategorySearchInModal() {
    const input = document.getElementById('catInputName');
    const dropdown = document.getElementById('catAutocompleteList');
    if (!input || !dropdown) return;
    if (input.dataset.categorySearchAttached) return;

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        const categories = State.getCategories() || [];

        if (!query) {
            dropdown.style.display = 'none';
            return;
        }

        const filtered = categories
            .filter(c => c.name.toLowerCase().includes(query))
            .sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
                const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
                return aStarts - bStarts || a.name.localeCompare(b.name);
            })
            .slice(0, 6);

        if (filtered.length > 0) {
            dropdown.style.display = 'block';
            dropdown.innerHTML = filtered.map(c => `
                <div class="autocomplete-item" onclick="window.selectCategoryFromModal(${jsArg(c.name)})">
                    ${esc(c.icon || '📁')} ${esc(c.name)}
                </div>
            `).join('');
        } else {
            dropdown.style.display = 'none';
        }
    });

    input.dataset.categorySearchAttached = 'true';
}

// Helper to select and close
window.selectCategoryFromModal = (name) => {
    const input = document.getElementById('catInputName');
    if(input) {
        input.value = cleanNameInput(name);
        input.dispatchEvent(new Event('input'));
    }
    document.getElementById('catAutocompleteList').style.display = 'none';
};

// ==========================================
// INCOME TAB: QUICK LOG & SOURCE CREATION
// ==========================================

export function quickLogIncome(amount) {
    // 1. Find an existing income category, or default to Miscellaneous
    let categories = State.getCategories() || [];
    let defaultCategory = categories.find(c => c.type === 'income') || { name: 'Miscellaneous Income' };

    // 2. Silently create the category if it doesn't exist
    if (!categories.some(c => c.name === defaultCategory.name)) {
        State.addCategory(defaultCategory.name, '💵', 'income');
    }

    // 3. Create the transaction
    const newTx = {
        id: generateId(),
        type: 'income',
        description: 'Quick Deposit',
        category: defaultCategory.name,
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        paymentMethod: State.getDefaultPayment ? State.getDefaultPayment() : '',
        notes: '',
        tag: 'transaction',
        createdAt: new Date().toISOString()
    };

    State.addTransaction(newTx);
    render(); // Instantly updates the dashboard TBB!

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    showToast(`✅ Logged ${symbol}${formatMoney(amount)}!`);
}

function getIncomeSourceModalState() {
    const modal = document.getElementById('incomeSourceModal');
    const nameInput = document.getElementById('incomeSourceName');
    const iconInput = document.getElementById('incomeSourceIcon');
    const loggedInput = document.getElementById('incomeSourceLogged');
    const originalInput = document.getElementById('incomeSourceOriginalName');

    if (!modal || !nameInput || !iconInput || !loggedInput) return null;

    if (!modal.dataset.incomeDraftSession) {
        modal.dataset.incomeDraftSession = generateId();
    }

    return {
        modal,
        nameInput,
        iconInput,
        loggedInput,
        originalInput,
        draftId: modal.dataset.incomeDraftId || '',
        draftSession: modal.dataset.incomeDraftSession
    };
}

function removeIncomeSourceLoggedDraft() {
    const modalState = getIncomeSourceModalState();
    if (!modalState) return false;

    const { modal, draftId } = modalState;
    if (modal._incomeDraftTimer) {
        clearTimeout(modal._incomeDraftTimer);
        modal._incomeDraftTimer = null;
    }
    if (!draftId) return false;

    const txs = State.getTransactions ? State.getTransactions() : [];
    const draftIndex = txs.findIndex(tx => tx.id === draftId);
    if (draftIndex !== -1) {
        txs.splice(draftIndex, 1);
        if (State.save) State.save();
        if (window.renderRecentTransactions) window.renderRecentTransactions();
        if (window.renderIncomeTab) window.renderIncomeTab();
        if (window.renderZBBDashboard) window.renderZBBDashboard();
        if (window.renderFormCategories) window.renderFormCategories();
    }

    delete modal.dataset.incomeDraftId;
    return true;
}

function syncIncomeSourceLoggedDraft(finalize = false) {
    const modalState = getIncomeSourceModalState();
    if (!modalState) return false;

    const { modal, nameInput, iconInput, loggedInput, originalInput } = modalState;
    const sourceName = cleanNameInput(nameInput.value || '');
    const icon = iconInput.value.trim() || '💵';
    const loggedRaw = String(loggedInput.value || '').trim();
    const loggedAmount = loggedRaw === '' ? 0 : Math.max(0, parseFloat(loggedRaw) || 0);

    if (!sourceName || loggedAmount <= 0) {
        return removeIncomeSourceLoggedDraft();
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];
    const draftId = modal.dataset.incomeDraftId || '';
    const txs = State.getTransactions ? State.getTransactions() : [];
    let draftTx = draftId ? txs.find(tx => tx.id === draftId) : null;

    if (!draftTx) {
        draftTx = txs.find(tx => tx.isDraftIncomeLog && tx.incomeDraftSession === modal.dataset.incomeDraftSession) || null;
    }

    const basePayload = {
        type: 'income',
        amount: loggedAmount,
        description: sourceName,
        category: sourceName,
        icon,
        date: today,
        paymentMethod: 'bank',
        notes: '',
        isDeleted: false,
        createdAt: nowIso
    };

    if (!draftTx) {
        const newDraft = {
            id: `draft_income_${generateId()}`,
            ...basePayload,
            isDraftIncomeLog: true,
            incomeDraftSession: modal.dataset.incomeDraftSession
        };
        txs.push(newDraft);
        modal.dataset.incomeDraftId = newDraft.id;
        draftTx = newDraft;
    } else {
        Object.assign(draftTx, basePayload);
        draftTx.isDraftIncomeLog = true;
        draftTx.incomeDraftSession = modal.dataset.incomeDraftSession;
        modal.dataset.incomeDraftId = draftTx.id;
    }

    if (finalize) {
        draftTx.isDraftIncomeLog = false;
        delete draftTx.incomeDraftSession;
        delete modal.dataset.incomeDraftId;
        if (State.save) State.save();
    }

    if (window.renderRecentTransactions) window.renderRecentTransactions();
    if (window.renderIncomeTab) window.renderIncomeTab();
    if (window.renderZBBDashboard) window.renderZBBDashboard();
    if (window.renderFormCategories) window.renderFormCategories();

    return true;
}

function bindIncomeSourceDraftSync() {
    const modalState = getIncomeSourceModalState();
    if (!modalState) return;

    const { nameInput, iconInput, loggedInput } = modalState;
    if (loggedInput && !loggedInput.dataset.incomeDraftSyncAttached) {
        const scheduleSync = () => {
            const modal = document.getElementById('incomeSourceModal');
            if (!modal) return;
            if (modal._incomeDraftTimer) clearTimeout(modal._incomeDraftTimer);
            modal._incomeDraftTimer = setTimeout(() => syncIncomeSourceLoggedDraft(false), 140);
        };

        loggedInput.addEventListener('input', scheduleSync);
        loggedInput.addEventListener('change', () => syncIncomeSourceLoggedDraft(false));
        loggedInput.dataset.incomeDraftSyncAttached = 'true';
    }

    if (nameInput && !nameInput.dataset.incomeDraftSyncAttached) {
        const scheduleSync = () => {
            const modal = document.getElementById('incomeSourceModal');
            if (!modal) return;
            if (modal._incomeDraftTimer) clearTimeout(modal._incomeDraftTimer);
            modal._incomeDraftTimer = setTimeout(() => syncIncomeSourceLoggedDraft(false), 140);
        };

        nameInput.addEventListener('input', scheduleSync);
        nameInput.addEventListener('change', () => syncIncomeSourceLoggedDraft(false));
        nameInput.dataset.incomeDraftSyncAttached = 'true';
    }

    if (iconInput && !iconInput.dataset.incomeDraftSyncAttached) {
        iconInput.addEventListener('input', () => syncIncomeSourceLoggedDraft(false));
        iconInput.addEventListener('change', () => syncIncomeSourceLoggedDraft(false));
        iconInput.dataset.incomeDraftSyncAttached = 'true';
    }
}

export function openCustomIncomeModal() {
    switchTab('add');
    setType('income');
    const descInput = document.getElementById('txDescription');
    if (descInput) setTransactionDescription('Custom Deposit');
    document.getElementById('txAmount')?.focus();
    showToast('💡 Enter custom income amount');
}

export function openAddSourceModal(sourceName = '') {
    const wireAmountShellFocus = (inputEl) => {
        const shell = inputEl?.closest('.budgeted-input-shell');
        const group = inputEl?.closest('.add-form-group');
        if ((!shell && !group) || !inputEl) return;

        const focusInput = () => {
            if (typeof inputEl.focus === 'function') {
                try {
                    inputEl.focus({ preventScroll: true });
                } catch {
                    inputEl.focus();
                }
            }
        };

        if (shell && shell.dataset.focusBound !== 'true') {
            shell.dataset.focusBound = 'true';
            shell.style.cursor = 'text';
            shell.style.touchAction = 'manipulation';
            shell.addEventListener('pointerdown', focusInput);
            shell.addEventListener('click', focusInput);
        }

        if (group && group.dataset.focusBound !== 'true') {
            group.dataset.focusBound = 'true';
            group.style.cursor = 'text';
            const label = group.querySelector('label');
            if (label) label.style.cursor = 'text';
            group.addEventListener('pointerdown', (event) => {
                if (event.target === inputEl) return;
                if (event.target.closest('.emoji-picker-grid') || event.target.closest('.emoji-picker-close')) return;
                focusInput();
            });
            group.addEventListener('click', (event) => {
                if (event.target === inputEl) return;
                if (event.target.closest('.emoji-picker-grid') || event.target.closest('.emoji-picker-close')) return;
                focusInput();
            });
        }
    };

    const staticModal = document.getElementById('incomeSourceModal');
    if (staticModal) {
        removeIncomeSourceLoggedDraft();
        staticModal.dataset.incomeDraftSession = generateId();

        const symbol = State.getSymbol ? State.getSymbol() : '$';
        const existingSource = sourceName
            ? (State.getCategories() || []).find(c => c.name === sourceName && c.type === 'income')
            : null;
        const isEditMode = Boolean(existingSource);

        const titleEl = document.getElementById('incomeSourceModalTitle');
        const nameInput = document.getElementById('incomeSourceName');
        const iconInput = document.getElementById('incomeSourceIcon');
        const plannedInput = document.getElementById('incomeSourcePlanned');
        const loggedInput = document.getElementById('incomeSourceLogged');
        const loggedGroup = document.getElementById('incomeSourceLoggedGroup');
        const frequencyInput = document.getElementById('incomeSourceFrequency');
        const originalInput = document.getElementById('incomeSourceOriginalName');
        const submitBtn = document.getElementById('incomeSourceSubmitBtn');
        const plannedSymbol = document.getElementById('incomeSourcePlannedSymbol');
        const loggedSymbol = document.getElementById('incomeSourceLoggedSymbol');
        const charCount = document.getElementById('incomeSourceNameCharCount');
        const nameIconRow = document.querySelector('#incomeSourceModal .category-name-icon-row');
        const nameTooltip = document.getElementById('incomeSourceNameTooltip');

        if (titleEl) titleEl.textContent = isEditMode ? 'Edit Income Source' : 'Create Income Source';
        if (submitBtn) submitBtn.textContent = isEditMode ? 'Update' : 'Save';
        if (plannedSymbol) plannedSymbol.textContent = symbol;
        if (loggedSymbol) loggedSymbol.textContent = symbol;
        if (originalInput) originalInput.value = isEditMode ? existingSource.name : '';
        if (nameInput) {
            nameInput.value = isEditMode ? existingSource.name : '';
            nameInput.classList.remove('shake-error', 'input-error');
        }
        if (iconInput) {
            iconInput.value = isEditMode ? (existingSource.icon || '💵') : '';
            iconInput.dataset.userModified = isEditMode ? 'true' : 'false';
        }
        if (plannedInput) plannedInput.value = isEditMode && existingSource.budget ? String(existingSource.budget) : '';
        if (loggedInput) loggedInput.value = '';
        if (loggedGroup) loggedGroup.style.display = '';
        if (frequencyInput) frequencyInput.value = isEditMode ? (existingSource.payFrequency || 'weekly') : 'weekly';
        wireAmountShellFocus(plannedInput);
        wireAmountShellFocus(loggedInput);
        if (nameTooltip) {
            nameTooltip.hidden = true;
            nameTooltip.classList.remove('visible');
        }
        if (charCount && nameInput) {
            charCount.textContent = `${nameInput.value.length}/24`;
            charCount.style.color = nameInput.value.length === 24 ? 'var(--red)' : 'var(--text-dim)';
        }

        if (nameInput && nameIconRow && !nameInput.dataset.incomeExpandAttached) {
            let nameExpandTimer = null;
            nameInput.addEventListener('focus', () => {
                nameIconRow.classList.remove('frequency-active');
                nameIconRow.classList.add('category-name-active');
            });
            nameInput.addEventListener('input', () => {
                nameIconRow.classList.remove('frequency-active');
                nameIconRow.classList.add('category-name-active');
                clearTimeout(nameExpandTimer);
                nameExpandTimer = setTimeout(() => nameIconRow.classList.remove('category-name-active'), 900);
            });
            nameInput.addEventListener('blur', () => {
                clearTimeout(nameExpandTimer);
                setTimeout(() => nameIconRow.classList.remove('category-name-active'), 120);
            });
            nameInput.dataset.incomeExpandAttached = 'true';
        }

        if (frequencyInput && nameIconRow && !frequencyInput.dataset.incomeExpandAttached) {
            frequencyInput.addEventListener('focus', () => {
                nameIconRow.classList.remove('category-name-active');
                nameIconRow.classList.add('frequency-active');
            });
            frequencyInput.addEventListener('change', () => {
                nameIconRow.classList.remove('frequency-active');
                frequencyInput.blur();
                document.getElementById('incomeSourcePlanned')?.focus();
            });
            frequencyInput.addEventListener('blur', () => {
                setTimeout(() => nameIconRow.classList.remove('frequency-active'), 120);
            });
            frequencyInput.dataset.incomeExpandAttached = 'true';
        }

        if (nameInput && !nameInput.dataset.incomeValidationAttached) {
            nameInput.addEventListener('input', (e) => {
                const originalVal = e.target.value;
                let val = cleanNameTyping(originalVal);

                if (val !== originalVal) {
                    nameInput.classList.remove('shake-error');
                    void nameInput.offsetWidth;
                    nameInput.classList.add('shake-error');
                    setTimeout(() => { nameInput.classList.remove('shake-error'); }, 400);

                    const tooltip = document.getElementById('incomeSourceNameTooltip');
                    if (tooltip) {
                        tooltip.hidden = false;
                        tooltip.classList.add('visible');
                        clearTimeout(tooltip._hideTimer);
                        tooltip._hideTimer = setTimeout(() => {
                            tooltip.classList.remove('visible');
                            tooltip.hidden = true;
                        }, 2200);
                    }
                }

                if (val.length > 24) val = val.substring(0, 24);
                e.target.value = val;

                const counter = document.getElementById('incomeSourceNameCharCount');
                if (counter) {
                    counter.textContent = `${val.length}/24`;
                    counter.style.color = val.length === 24 ? 'var(--red)' : 'var(--text-dim)';
                }
            });
            nameInput.dataset.incomeValidationAttached = 'true';
        }

        attachEmojiPicker('incomeSourceIcon');
        bindIncomeSourceDraftSync();
        openModal('incomeSourceModal');

        setTimeout(() => {
            if (nameInput && typeof nameInput.focus === 'function') {
                nameInput.focus();
            }
        }, 100);
        return;
    }

    let existingModal = document.getElementById('incomeSourceModal');
    if (existingModal) existingModal.remove();

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const existingSource = sourceName
        ? (State.getCategories() || []).find(c => c.name === sourceName && c.type === 'income')
        : null;
    const isEditMode = Boolean(existingSource);
    const modal = document.createElement('div');
    modal.id = 'incomeSourceModal';
    modal.className = 'modal-overlay active';
    modal.dataset.incomeDraftSession = generateId();
    modal.innerHTML = `
        <div class="modal-box modal-box-medium" role="dialog" aria-modal="true" aria-label="Create Income Source" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.closeIncomeSourceModal()" aria-label="Close income source form">&times;</button>
            <h3 class="modal-title mb-lg">${isEditMode ? 'Edit Income' : 'Create Income'}</h3>

            <form id="incomeSourceForm" onsubmit="event.preventDefault(); window.saveIncomeSource();">
                <input type="hidden" id="incomeSourceOriginalName" value="${isEditMode ? esc(existingSource.name) : ''}">
                <div class="add-form-group mb-lg">
                    <label for="incomeSourceName">Income Source</label>
                    <input type="text" id="incomeSourceName" class="form-input" maxlength="24" placeholder="e.g., Paycheck" autocomplete="off" value="${isEditMode ? esc(existingSource.name) : ''}" required>
                </div>

                <div class="add-form-group mb-lg">
                    <label for="incomeSourcePlanned">Expected Amount</label>
                    <div class="budgeted-input-shell">
                        <span>${symbol}</span>
                        <input type="number" id="incomeSourcePlanned" class="form-input" min="0" step="0.01" placeholder="0.00" value="${isEditMode && existingSource.budget ? String(existingSource.budget) : ''}">
                    </div>
                </div>

                <div class="add-form-group mb-lg">
                    <label for="incomeSourceLogged">Logged Amount</label>
                    <div class="budgeted-input-shell">
                        <span>${symbol}</span>
                        <input type="number" id="incomeSourceLogged" class="form-input" min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>

                <div class="add-form-group mb-lg">
                    <label for="incomeSourceIcon">Icon</label>
                    <input type="text" id="incomeSourceIcon" class="form-input icon-picker-trigger" placeholder="💵" maxlength="2" readonly inputmode="none" aria-label="Choose income source icon" value="${isEditMode ? esc(existingSource.icon || '💵') : ''}">
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="window.closeIncomeSourceModal()">Cancel</button>
                    <button type="submit" class="btn-create">${isEditMode ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) window.closeIncomeSourceModal();
    });

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    attachEmojiPicker('incomeSourceIcon');
    wireAmountShellFocus(modal.querySelector('#incomeSourcePlanned'));
    wireAmountShellFocus(modal.querySelector('#incomeSourceLogged'));
    bindIncomeSourceDraftSync();
    document.getElementById('incomeSourceName')?.focus();
}

window.closeIncomeSourceModal = function() {
    const staticModal = document.getElementById('incomeSourceModal');
    if (staticModal) {
        if (staticModal._incomeDraftTimer) {
            clearTimeout(staticModal._incomeDraftTimer);
            staticModal._incomeDraftTimer = null;
        }
        if (staticModal.dataset.incomeDraftId) {
            removeIncomeSourceLoggedDraft();
        }
        staticModal.classList.remove('emoji-picker-open');
        document.querySelector('#incomeSourceModal .category-name-icon-row')?.classList.remove('category-name-active', 'frequency-active', 'icon-picker-open');

        const tooltip = document.getElementById('incomeSourceNameTooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
            tooltip.hidden = true;
        }

        const iconInput = document.getElementById('incomeSourceIcon');
        if (iconInput) {
            const pickerGrid = document.querySelector('#incomeSourceModal .emoji-picker-grid');
            if (pickerGrid) pickerGrid.style.display = 'none';
        }

        closeModal('incomeSourceModal');
        return;
    }

    animateModalClose(document.getElementById('incomeSourceModal'), true);
    syncOverlayScrollTopState();
};

window.saveIncomeSource = function() {
    const nameInput = document.getElementById('incomeSourceName');
    const rawName = nameInput?.value.trim() || '';
    const name = cleanNameInput(rawName);
    const icon = document.getElementById('incomeSourceIcon')?.value.trim() || '💵';
    const plannedAmount = Math.max(0, parseFloat(document.getElementById('incomeSourcePlanned')?.value) || 0);
    const payFrequency = document.getElementById('incomeSourceFrequency')?.value || '';
    const originalName = document.getElementById('incomeSourceOriginalName')?.value || '';

    if (!name) {
        if (window.showToast) window.showToast('Invalid income source. Use 1-24 characters, no line breaks.');
        return;
    }

    if (nameInput && name !== rawName) {
        nameInput.value = name;
    }

    const result = originalName
        ? (State.editIncomeSource
            ? State.editIncomeSource(originalName, name, icon, plannedAmount)
            : State.editCategory(originalName, name, icon, 'income', plannedAmount))
        : (State.addIncomeSource
            ? State.addIncomeSource(name, icon, plannedAmount)
            : State.addCategory(name, icon, 'income', plannedAmount));

    if (result && result.success === false) {
        if (window.showToast) window.showToast(result.error || 'Income source already exists.');
        return;
    }

    const savedName = result.name || name;
    const savedSource = (State.getCategories() || []).find(c => c.name === savedName && c.type === 'income');
    if (savedSource) {
        savedSource.payFrequency = payFrequency;
        if (State.save) State.save();
    }

    syncIncomeSourceLoggedDraft(true);

    renderIncomeTab();
    renderFormCategories();
    renderZBBDashboard();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
    window.closeIncomeSourceModal();
    if (window.showToast) window.showToast(originalName ? 'Income source updated.' : `Income source '${savedName}' created.`);
}

export function renderDebtTab() {
    const breakdownEl = document.getElementById('debtBreakdown');
    const totalEl = document.getElementById('tabDebtTotal');
    const minEl = document.getElementById('tabDebtMin');
    const actionArea = document.getElementById('debtActionArea');
    if (!breakdownEl) return;

    const categories = State.getCategories() || [];
    const symbol = State.getSymbol ? State.getSymbol() : '$';

    // 1. Grab only the Debt categories
    const debtSources = categories.filter(c => c.type === 'debt');

    // 2. The Empty State (Freedom Achieved)
    if (debtSources.length === 0) {
        breakdownEl.innerHTML = `
            <div class="empty-state-container" style="text-align: center; padding: 3rem 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div class="empty-state-animated-icon" style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text);">Zero Debt!</h3>
                <p style="color: var(--text-dim); font-size: 0.95rem; margin-bottom: 1.5rem; max-width: 260px; line-height: 1.4;">You are completely debt-free. Add a balance to start your Freedom Plan.</p>
                <button type="button" class="btn-primary-dashed" onclick="window.openAddDebtModal()" style="width: auto; padding: 0.75rem 2rem;">
                    + Add New Debt
                </button>
            </div>
        `;
        if (actionArea) actionArea.style.display = 'none';

        // Zero out headers safely
        if (totalEl) totalEl.textContent = `${symbol}0.00`;
        if (minEl) minEl.textContent = `${symbol}0.00`;
        return;
    }

    if (actionArea) actionArea.style.display = 'block';

    // 3. Separate Active Debts from Paid-Off Trophies
    const activeDebts = debtSources.filter(d => (d.balance || 0) > 0);
    const paidOffDebts = debtSources.filter(d => (d.balance || 0) <= 0);

    // 4. Force "Snowball" Sorting (Smallest to Largest)
    activeDebts.sort((a, b) => (a.balance || 0) - (b.balance || 0));

    // Combine them (Active on top, Paid off on bottom)
    const sortedDebts = [...activeDebts, ...paidOffDebts];

    // Calculate Header Totals
    const totalDebt = activeDebts.reduce((sum, d) => sum + (d.balance || 0), 0);
    const totalMin = activeDebts.reduce((sum, d) => sum + (d.minPayment || 0), 0);

    if (totalEl) totalEl.textContent = `${symbol}${formatMoney(totalDebt)}`;
    if (minEl) minEl.textContent = `${symbol}${formatMoney(totalMin)}/mo`;

    // 5. Build the UI Cards
    breakdownEl.innerHTML = sortedDebts.map(debt => {
        const balance = debt.balance || 0;
        const startingBalance = debt.startingBalance || balance; // Assuming you track original balance
        const isPaidOff = balance <= 0;

        // Right-to-left progress calculation
        let progressPercent = startingBalance > 0 ? (balance / startingBalance) * 100 : 0;
        // Cap it between 0 and 100
        progressPercent = Math.min(Math.max(progressPercent, 0), 100);

        if (isPaidOff) {
            // The ultimate safe icon fallback (bypasses esc() for emojis)
            const safePaidIcon = (debt.icon && debt.icon.trim() !== '') ? debt.icon : '🎉';

            // PAID OFF TEMPLATE
            return `
            <div class="category-item debt-card-paid celebrate-shimmer" style="display: flex; align-items: center; padding: 1rem; cursor: pointer; border: 1px dashed var(--positive); border-radius: 12px; margin-bottom: 0.75rem;" onclick="window.openCategoryDrillDown(${jsArg(debt.name)}, ${jsArg(debt.icon || '')})">
                <div class="category-icon-box" style="margin-top: 0; margin-left: 0; width: 40px; height: 40px; background: rgba(76, 175, 80, 0.1); color: var(--positive);">
                    <span class="category-icon" style="font-size: 1.25rem;">${safePaidIcon}</span>
                </div>
                <div class="category-body" style="padding: 0 0.75rem;">
                    <div class="strikethrough-container" style="font-weight: 600; color: var(--text); font-size: 0.95rem;">
                        ${esc(debt.name)}
                        <div class="strikethrough-line"></div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--positive); margin-top: 2px;">PAID IN FULL</div>
                </div>
            </div>
            `;
        }

        // The ultimate safe icon fallback (bypasses esc() for emojis)
        const safeActiveIcon = (debt.icon && debt.icon.trim() !== '') ? debt.icon : '💳';

        // ACTIVE DEBT TEMPLATE
        return `
        <div class="category-item" style="padding: 1rem; cursor: pointer; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 0.75rem;" onclick="window.openCategoryDrillDown(${jsArg(debt.name)}, ${jsArg(debt.icon || '')})">

            <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <div class="category-icon-box" style="margin-top: 0; margin-left: 0; width: 40px; height: 40px;">
                    <span class="category-icon" style="font-size: 1.25rem;">${safeActiveIcon}</span>
                </div>
                <div class="category-body" style="padding: 0 0.75rem; flex: 1;">
                    <div style="font-weight: 600; color: var(--text); font-size: 0.95rem;">${esc(debt.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">
                        Min: ${symbol}${formatMoney(debt.minPayment || 0)} | APR: ${debt.apr || 0}%
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; font-size: 1.1rem;" class="blur-value">${symbol}${formatMoney(balance)}</div>
                </div>
            </div>

            <div class="debt-progress-track">
                <div class="debt-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>

        </div>
        `;
    }).join('');
}

// --- ADD DEBT MODAL & 2-YEAR FREEDOM MATH ---
window.openAddDebtModal = function() {
    let existingModal = document.getElementById('addDebtModal');
    if (existingModal) existingModal.remove();

    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const modal = document.createElement('div');
    modal.id = 'addDebtModal';
    modal.className = 'modal-overlay active';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: flex-end; z-index: 1000;';

    modal.innerHTML = `
        <div class="modal-content form-panel" style="width: 100%; max-width: 500px; background: var(--surface); border-radius: 20px 20px 0 0; padding: 1.5rem; animation: slideUp 0.3s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.2rem;">Add New Debt</h3>
                <button type="button" onclick="window.closeAddDebtModal()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-dim); cursor: pointer;">✕</button>
            </div>

            <form id="newDebtForm" onsubmit="event.preventDefault(); window.saveNewDebt();">
                <div class="add-form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Creditor Name</label>
                    <input type="text" id="newDebtName" class="form-input" placeholder="e.g., Visa Credit Card" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                </div>

                <div class="add-form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Current Balance</label>
                    <div style="display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); padding: 0 0.75rem;">
                        <span style="color: var(--text-dim);">${symbol}</span>
                        <input type="number" id="newDebtBalance" class="form-input" step="0.01" min="0.01" required style="width: 100%; padding: 0.75rem; border: none; background: transparent; outline: none; color: var(--text);">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="add-form-group">
                        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Interest Rate (APR %)</label>
                        <input type="number" id="newDebtApr" class="form-input" step="0.1" min="0" placeholder="19.9" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                    </div>
                    <div class="add-form-group">
                        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Min Payment</label>
                        <div style="display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); padding: 0 0.75rem;">
                            <span style="color: var(--text-dim);">${symbol}</span>
                            <input type="number" id="newDebtMin" class="form-input" step="0.01" min="0" placeholder="0.00" style="width: 100%; padding: 0.75rem; border: none; background: transparent; outline: none; color: var(--text);">
                        </div>
                    </div>
                </div>

                <div class="add-form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Next Due Date</label>
                    <input type="date" id="newDebtDueDate" class="form-input" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                </div>

                <button type="submit" class="btn-primary" style="width: 100%; padding: 1rem; border-radius: 8px; font-weight: 600;">Save Debt Target</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    document.getElementById('newDebtName').focus();
};

window.closeAddDebtModal = function() {
    document.getElementById('addDebtModal')?.remove();
    syncOverlayScrollTopState();
};

window.saveNewDebt = function() {
    // Prevent double-clicking
    if (window.isSubmitting) return;
    window.isSubmitting = true;
    setTimeout(() => { window.isSubmitting = false; }, 500);

    const name = document.getElementById('newDebtName').value.trim();
    const balance = parseFloat(document.getElementById('newDebtBalance').value);
    const apr = parseFloat(document.getElementById('newDebtApr').value) || 0;
    const minPayment = parseFloat(document.getElementById('newDebtMin').value) || 0;
    const dueDate = document.getElementById('newDebtDueDate').value;

    if (!name || !dueDate) return;

    // ITEM 3: Block $0 Debt Creation
    if (isNaN(balance) || balance <= 0) {
        const msg = "Cannot create a $0 debt. Please use Expense or Savings instead.";
        if (typeof window.showToast === 'function') window.showToast(msg);
        else alert(msg);
        return;
    }

    const newCategory = {
        id: 'debt_' + Date.now(),
        type: 'debt',
        name: name,
        icon: '💳',
        balance: balance,
        startingBalance: balance,
        apr: apr,
        minPayment: minPayment,
        dueDate: dueDate
    };

    const result = State.addDebtAccount
        ? State.addDebtAccount({ name, balance, apr, minPayment, dueDate, icon: newCategory.icon })
        : State.addCategory(name, newCategory.icon, 'debt');

    if (result && result.success === false) {
        if (typeof window.showToast === 'function') window.showToast(result.error || 'Debt already exists.');
        return;
    }

    window.closeAddDebtModal();
    if (window.renderDebtTab) window.renderDebtTab();
    if (window.renderSavingsTab) window.renderSavingsTab();

    // ITEM 1: The 2-Year Math & Smart Suggestion
    const monthlyRate = (apr / 100) / 12;
    let needsExtraHelp = false;
    let extraNeeded = 0;

    if (apr === 0 && minPayment > 0) {
        if ((balance / minPayment) > 24) {
            needsExtraHelp = true;
            extraNeeded = (balance / 24) - minPayment;
        }
    } else if (minPayment > 0) {
        const interestPerMonth = balance * monthlyRate;
        if (minPayment <= interestPerMonth) {
            // Min payment doesn't even cover interest
            needsExtraHelp = true;
            extraNeeded = ((balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -24))) - minPayment;
        } else {
            // Calculate actual months to payoff
            const monthsToPayoff = -Math.log(1 - (balance * monthlyRate) / minPayment) / Math.log(1 + monthlyRate);
            if (monthsToPayoff > 24) {
                needsExtraHelp = true;
                extraNeeded = ((balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -24))) - minPayment;
            }
        }
    }

    // Trigger the motivational toast if they are falling behind the 2-year mark
    if (needsExtraHelp) {
        const extraFormatted = Math.ceil(extraNeeded).toFixed(2);
        const symbol = State.getSymbol ? State.getSymbol() : '$';

        setTimeout(() => {
            const toastMsg = `Tip: Add an extra ${symbol}${extraFormatted}/mo to hit your 2-year goal!`;
            if (typeof window.showToast === 'function') window.showToast(toastMsg);
            else alert(toastMsg);
        }, 600); // Wait for modal to disappear before showing toast
    }
};

// ITEM 2: ACCESSIBILITY - Toggle Motion on Paid Debts
window.toggleDebtAnimation = function(element) {
    if (element.classList.contains('celebrate-shimmer')) {
        element.classList.remove('celebrate-shimmer');
        element.style.opacity = "1";
    } else {
        element.classList.add('celebrate-shimmer');
        element.style.opacity = "0.7";
    }
};

// ==========================================
// CREATE CATEGORY MODAL (Expense / Savings)
// ==========================================
window.openAddCategoryModal = function() {
    let existingModal = document.getElementById('addCategoryModal');
    if (existingModal) existingModal.remove();

    const symbol = State.getSymbol ? State.getSymbol() : '$';

    const modal = document.createElement('div');
    modal.id = 'addCategoryModal';
    modal.className = 'modal-overlay active';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: flex-end; z-index: 1000;';

    modal.innerHTML = `
        <div class="modal-content form-panel" style="width: 100%; max-width: 500px; background: var(--surface); border-radius: 20px 20px 0 0; padding: 1.5rem; animation: slideUp 0.3s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.2rem;">Create Category</h3>
                <button type="button" onclick="window.closeAddCategoryModal()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-dim); cursor: pointer;">✕</button>
            </div>

            <form id="newCategoryForm" onsubmit="event.preventDefault(); window.saveNewCategory();">
                <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="add-form-group">
                        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Category Name</label>
                        <input type="text" id="newCatName" class="form-input" placeholder="e.g., Groceries" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                    </div>
                    <div class="add-form-group">
                        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Icon</label>
                        <input type="text" id="newCatIcon" class="form-input" placeholder="🛒" required maxlength="2" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); text-align: center;">
                    </div>
                </div>

                <div class="add-form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Category Type</label>
                    <select id="newCatType" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                        <option value="expense">Expense</option>
                        <option value="savings">Savings Fund</option>
                    </select>
                </div>

                <div class="add-form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">Monthly Target</label>
                    <div style="display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); padding: 0 0.75rem;">
                        <span style="color: var(--text-dim);">${symbol}</span>
                        <input type="number" id="newCatBudget" class="form-input" step="0.01" min="0" placeholder="0.00" style="width: 100%; padding: 0.75rem; border: none; background: transparent; outline: none; color: var(--text);">
                    </div>
                </div>

                <button type="submit" class="btn-primary" style="width: 100%; padding: 1rem; border-radius: 8px; font-weight: 600;">Save Category</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    modal.addEventListener('click', (event) => {
        if (event.target === modal) window.closeAddCategoryModal();
    });
    document.getElementById('newCatName').focus();
};

window.closeAddCategoryModal = function() {
    animateModalClose(document.getElementById('addCategoryModal'), true);
};

window.saveNewCategory = function() {
    // Lock to prevent double-saving
    if (window.isSubmittingCat) return;
    window.isSubmittingCat = true;
    setTimeout(() => { window.isSubmittingCat = false; }, 500);

    const name = document.getElementById('newCatName').value.trim();
    const icon = document.getElementById('newCatIcon').value.trim() || '📁';
    const type = document.getElementById('newCatType').value;
    const budget = parseFloat(document.getElementById('newCatBudget').value) || 0;

    if (!name) return;

    const newCategory = {
        id: 'cat_' + Date.now(),
        type: type,
        name: name,
        icon: icon,
        budget: budget,
        balance: 0
    };

    const categories = State.getCategories() || [];
    categories.push(newCategory);

    // Bypass strict addCategory to ensure our object stays intact
    if (State.saveCategories) {
        State.saveCategories(categories);
    } else {
        localStorage.setItem('bb_categories', JSON.stringify(categories));
    }

    window.closeAddCategoryModal();

    // Refresh your UI dynamically depending on which tab is open
    if (typeof UI !== 'undefined' && UI.renderCategoryList) UI.renderCategoryList();
    if (window.renderZBBDashboard) window.renderZBBDashboard();
};

// ==========================================
// DYNAMIC CATEGORY MODAL (Create & Edit)
// ==========================================
window.openCategoryModal = function(mode = 'create', originalName = '', originalIcon = '') {
    // Remove existing if open
    let existingModal = document.getElementById('categoryModal');
    if (existingModal) existingModal.remove();

    const isEdit = mode === 'edit';
    const titleText = isEdit ? 'Edit Category' : 'Create Category';

    const modal = document.createElement('div');
    modal.id = 'categoryModal';
    modal.className = 'modal-overlay active';
    // The "Mobile-First" Slide-Up Overlay Styling
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: flex-end; z-index: 1000;';

    // Close when clicking the dark overlay
    modal.onclick = (e) => {
        if (e.target === modal) window.closeCategoryModal();
    };

    modal.innerHTML = `
        <div class="modal-content form-panel" style="width: 100%; max-width: 500px; background: var(--surface); border-radius: 20px 20px 0 0; padding: 1.5rem; animation: slideUp 0.3s ease-out;" onclick="event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.2rem;">${titleText}</h3>
                <button type="button" onclick="window.closeCategoryModal()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-dim); cursor: pointer;">✕</button>
            </div>

            <form id="categoryForm" onsubmit="event.preventDefault(); window.saveCategory();">
                <input type="hidden" id="catEditOriginalName" value="${isEdit ? originalName : ''}">

                <div style="margin-bottom: 1.5rem;">
                    <label for="catInputName" style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim); font-weight: 600;">Category Name</label>
                    <div class="autocomplete-wrapper" style="position: relative; width: 100%;">
                        <input type="text"
                               id="catInputName"
                               maxlength="24"
                               class="form-input autocomplete-input"
                               placeholder="e.g., Groceries"
                               value="${isEdit ? originalName : ''}"
                               required
                               style="width: 100%; box-sizing: border-box; padding: 0.75rem 3.5rem 0.75rem 0.75rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px;"
                               autocomplete="off">

                        <span id="catNameCharCount" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: var(--text-dim); pointer-events: none; font-weight: 600;">${isEdit ? originalName.length : 0}/24</span>

                        <div id="catAutocompleteList" class="autocomplete-dropdown" style="display: none;"></div>
                    </div>
                </div>

                <div style="margin-bottom: 2rem;">
                    <label for="catInputIcon" style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim); font-weight: 600;">Icon</label>
                    <input type="text"
                           id="catInputIcon"
                           class="form-input"
                           placeholder="📁"
                           maxlength="2"
                           value="${isEdit ? originalIcon : ''}"
                           required
                           style="width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; text-align: left;">
                </div>

                <button type="submit" class="btn-primary" style="width: 100%; padding: 1rem; border-radius: 8px; font-weight: 600;">Save Category</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Wire up the live Character Counter!
    const nameInput = document.getElementById('catInputName');
    const charCount = document.getElementById('catNameCharCount');
    if (nameInput && charCount) {
        nameInput.addEventListener('input', (e) => {
            charCount.textContent = `${e.target.value.length}/24`;
        });
    }

    // Auto-focus the input cleanly
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 10);
};

window.closeCategoryModal = function() {
    const modal = document.getElementById('categoryModal');
    animateModalClose(modal, true);
};

// ==========================================
// ☁️ BUDDY CLOUD: Access & Monetization (Spec 2.4 & 2.5)
// ==========================================

const PREMIUM_ACTIVE_KEY = 'bb_premium_active';
const PRO_STATUS_KEY = 'bb_pro_status';
const STRIPE_SESSION_KEY = 'bb_stripe_checkout_session_id';
const PREMIUM_ACTIVATED_AT_KEY = 'bb_premium_activated_at';
const STRIPE_REDIRECT_ACK_KEY = 'bb_stripe_redirect_acknowledged';
const BILLING_FUNCTIONS = {
    status: 'billing-status',
    checkout: 'billing-create-checkout',
    portal: 'billing-create-portal'
};
const ACCOUNT_DELETE_FUNCTION = 'account-delete';
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '']);
const STRIPE_REDIRECT_REVIEW_SECONDS = 3;

function getCheckoutReturnUrl(params = {}) {
    const url = new URL('index.html', window.location.href);
    url.search = '';
    url.hash = '';

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });

    return url.href;
}

function hasBillingBackend() {
    return Boolean(window.sb?.functions?.invoke && window.currentUser);
}

function isBillingEnabled() {
    return window.bbConfig?.billingEnabled === true;
}

function getBillingDisabledMessage() {
    return 'Premium billing is disabled during beta testing.';
}

function hasAcknowledgedStripeRedirect() {
    return localStorage.getItem(STRIPE_REDIRECT_ACK_KEY) === 'true';
}

function setStripeRedirectAcknowledged() {
    localStorage.setItem(STRIPE_REDIRECT_ACK_KEY, 'true');
}

async function readSupabaseFunctionError(error, fallbackMessage) {
    let message = error?.message || fallbackMessage;
    const response = error?.context;

    if (response?.json) {
        try {
            const details = await response.json();
            message = details?.error || details?.message || message;
        } catch {
            // Keep the Supabase client message if the body is not JSON.
        }
    } else if (response?.text) {
        try {
            const details = await response.text();
            if (details) message = details;
        } catch {
            // Keep the Supabase client message if the body cannot be read.
        }
    }

    return message;
}

async function invokeBillingFunction(name, body = {}) {
    if (!hasBillingBackend()) {
        throw new Error('Please sign in before managing Premium.');
    }

    const { data, error } = await window.sb.functions.invoke(name, { body });
    if (error) {
        const message = await readSupabaseFunctionError(error, 'Billing is temporarily unavailable. Please try again.');
        throw new Error(message);
    }

    return data || {};
}

function syncBillingUi() {
    const isPro = Boolean(State.getIsPro?.());
    const accountUpgradeBtn = document.getElementById('accountUpgradeBtn');
    const accountBillingStatus = document.getElementById('accountBillingStatus');

    if (accountUpgradeBtn) {
        const upgradeLabel = accountUpgradeBtn.querySelector('.account-action-label');
        const billingEnabled = isBillingEnabled();
        const labelText = isPro ? 'Manage' : billingEnabled ? 'Upgrade' : 'Premium';
        if (upgradeLabel) {
            upgradeLabel.textContent = labelText;
        } else {
            accountUpgradeBtn.textContent = isPro ? 'Manage Subscription' : billingEnabled ? 'Upgrade to Premium' : 'Premium';
        }
        accountUpgradeBtn.onclick = isPro ? window.handleManageSubscription : window.startStripeCheckout;
        accountUpgradeBtn.classList.toggle('is-manage-subscription', isPro);
        accountUpgradeBtn.classList.toggle('is-billing-disabled', !isPro && !billingEnabled);
        accountUpgradeBtn.setAttribute('aria-label', !isPro && !billingEnabled
            ? getBillingDisabledMessage()
            : isPro
            ? 'Manage Premium subscription'
            : 'Upgrade to Premium');
    }

    if (accountBillingStatus) {
        accountBillingStatus.textContent = isPro ? 'Premium' : 'Free Tier';
        accountBillingStatus.classList.toggle('is-active', isPro);
        accountBillingStatus.removeAttribute('data-tooltip');
        accountBillingStatus.setAttribute('aria-label', accountBillingStatus.textContent);
        accountBillingStatus.removeAttribute('tabindex');
    }
}

function syncAccountRecoveryUi() {
    const el = document.getElementById('accountRecoveryStatus');
    if (!el) return;
    const status = window.BuddyCloud?.getStatus?.() || {};
    const needsRecoveryKeyImport = Boolean(status.signedIn && status.enabled && !status.hasKey);

    if (!needsRecoveryKeyImport && !needsRecoveryKeySaveReminder()) {
        el.hidden = true;
        el.classList.remove('is-expired', 'is-required');
        el.replaceChildren();
        return;
    }

    if (needsRecoveryKeyImport) {
        el.hidden = false;
        el.classList.add('is-required');
        el.classList.remove('is-expired');
        el.innerHTML = `
            <div class="account-recovery-copy">
                <div class="account-recovery-title">Recovery key required</div>
                <div class="account-recovery-message">Import your recovery key to reconnect this browser to Buddy Cloud.</div>
            </div>
            <button type="button" class="account-recovery-action" onclick="event.stopPropagation(); window.closeAccountModal(); window.showBuddyCloudRecoveryKey(event)">Import Key</button>
        `;
        return;
    }

    const grace = getRecoveryKeyGraceState();
    const title = grace.expired ? 'Recovery key not saved' : 'Recovery key reminder';
    const message = grace.expired
        ? 'Save it before relying on Buddy Cloud as your backup.'
        : `Save it within ${formatGraceHours(grace.remainingMs)}. Buddy Cloud stays active during this grace period.`;

    el.hidden = false;
    el.classList.remove('is-required');
    el.classList.toggle('is-expired', grace.expired);
    el.innerHTML = `
        <div class="account-recovery-copy">
            <div class="account-recovery-title">${esc(title)}</div>
            <div class="account-recovery-message">${esc(message)}</div>
        </div>
        <button type="button" class="account-recovery-action" onclick="event.stopPropagation(); window.closeAccountModal(); window.showBuddyCloudRecoveryKey(event)">Save Key</button>
    `;
}

window.addEventListener('buddy-cloud-status', () => {
    syncCloudActionButtons();
    syncAccountRecoveryUi();
});

function showStripeRedirectNotice(destinationUrl = 'https://checkout.stripe.com/') {
    document.getElementById('stripeRedirectNotice')?.remove();

    return new Promise((resolve) => {
        let resolved = false;
        let secondsLeft = STRIPE_REDIRECT_REVIEW_SECONDS;
        let intervalId = null;

        const modal = document.createElement('div');
        modal.id = 'stripeRedirectNotice';
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-box modal-box-medium stripe-redirect-modal" role="dialog" aria-modal="true" aria-labelledby="stripeRedirectTitle" onclick="event.stopPropagation()">
                <button type="button" class="modal-close" id="stripeRedirectClose" aria-label="Cancel Stripe redirect">&times;</button>
                <h3 id="stripeRedirectTitle" class="modal-title">Opening secure checkout</h3>
                <p class="stripe-redirect-copy">
                    You are about to leave BudgetBuddy and continue payment on Stripe's secure checkout page.
                </p>
                <p class="stripe-redirect-privacy">
                    Once you continue, Stripe may process payment, billing, tax, and device information under Stripe's
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>
                    and
                    <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener">Services Agreement</a>.
                </p>
                <div class="stripe-redirect-destination">
                    Redirecting to
                    <a class="stripe-redirect-link" href="${esc(destinationUrl)}" target="_blank" rel="noopener" aria-label="Open Stripe secure checkout in a new tab">
                        Stripe
                    </a>
                </div>
                <details class="stripe-redirect-url-details">
                    <summary>Show checkout link</summary>
                    <a class="stripe-redirect-url-full" href="${esc(destinationUrl)}" target="_blank" rel="noopener">
                        ${esc(destinationUrl)}
                    </a>
                </details>
                <div class="stripe-redirect-question" aria-live="polite">
                    Continue available in <span id="stripeRedirectReviewCountdown">${secondsLeft}</span>s
                </div>
                <div class="modal-actions stripe-redirect-actions">
                    <button type="button" class="btn-cancel" id="stripeRedirectCancel">Cancel</button>
                    <button type="button" class="btn-create stripe-redirect-continue is-hidden" id="stripeRedirectContinue" disabled>Continue to Stripe</button>
                </div>
            </div>
        `;

        const finish = (shouldContinue) => {
            if (resolved) return;
            resolved = true;
            if (intervalId) clearInterval(intervalId);
            if (shouldContinue) setStripeRedirectAcknowledged();
            modal.remove();
            resolve(shouldContinue);
        };

        document.body.appendChild(modal);
        const question = document.querySelector('#stripeRedirectNotice .stripe-redirect-question');
        const continueButton = document.getElementById('stripeRedirectContinue');

        document.getElementById('stripeRedirectClose')?.addEventListener('click', () => finish(false));
        document.getElementById('stripeRedirectCancel')?.addEventListener('click', () => finish(false));
        continueButton?.addEventListener('click', () => finish(true));

        intervalId = setInterval(() => {
            secondsLeft -= 1;
            const countdown = document.getElementById('stripeRedirectReviewCountdown');
            if (countdown) countdown.textContent = String(Math.max(0, secondsLeft));

            if (secondsLeft <= 0) {
                clearInterval(intervalId);
                intervalId = null;
                if (question) question.textContent = 'Would you like to proceed?';
                if (continueButton) {
                    continueButton.disabled = false;
                    continueButton.classList.remove('is-hidden');
                    continueButton.focus({ preventScroll: true });
                }
            }
        }, 1000);
    });
}

function setUpgradeButtonLoading(button, isLoading) {
    if (!button) return;
    const tileLabel = button.querySelector?.('.account-action-label');

    if (isLoading) {
        if (tileLabel) {
            button.dataset.originalLabel = tileLabel.textContent;
            tileLabel.textContent = 'Opening';
        } else {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Opening secure checkout...';
        }
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        return;
    }

    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (tileLabel && button.dataset.originalLabel) {
        tileLabel.textContent = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
    } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

export function setPremiumAccess(active = true, metadata = {}) {
    const isActive = Boolean(active);

    localStorage.setItem(PREMIUM_ACTIVE_KEY, isActive ? 'true' : 'false');
    localStorage.setItem(PRO_STATUS_KEY, isActive ? 'true' : 'false');

    if (metadata.sessionId) localStorage.setItem(STRIPE_SESSION_KEY, metadata.sessionId);
    if (isActive) localStorage.setItem(PREMIUM_ACTIVATED_AT_KEY, new Date().toISOString());

    if (!isActive) {
        localStorage.removeItem(STRIPE_SESSION_KEY);
        localStorage.removeItem(PREMIUM_ACTIVATED_AT_KEY);
    }

    if (typeof State.setIsPro === 'function') {
        State.setIsPro(isActive, metadata);
    }

    syncBillingUi();
}

export async function refreshPremiumAccess(options = {}) {
    const { silent = false, checkoutSessionId = '' } = options;

    if (!isBillingEnabled() || !window.currentUser || !window.sb?.functions?.invoke) {
        setPremiumAccess(false, { source: 'billing_status_unavailable' });
        return false;
    }

    try {
        const status = await invokeBillingFunction(BILLING_FUNCTIONS.status, { checkoutSessionId });
        const active = Boolean(status.active) || ACTIVE_SUBSCRIPTION_STATUSES.has(status.subscriptionStatus);
        setPremiumAccess(active, {
            source: 'billing_status',
            sessionId: checkoutSessionId || status.checkoutSessionId || ''
        });
        return active;
    } catch (err) {
        console.error('[Billing] Premium status refresh failed:', err);
        if (!silent && window.showToast) window.showToast(err.message || 'Could not verify Premium status.');
        syncBillingUi();
        return Boolean(State.getIsPro?.());
    }
}

export async function startStripeCheckout(event) {
    event?.preventDefault?.();

    const button = event?.currentTarget
        || document.getElementById('upgrade-btn')
        || document.getElementById('accountUpgradeBtn');

    try {
        if (!window.currentUser) {
            throw new Error('Please sign in before upgrading to Premium.');
        }

        if (!isBillingEnabled()) {
            throw new Error(getBillingDisabledMessage());
        }

        setUpgradeButtonLoading(button, true);

        if (!hasBillingBackend()) {
            throw new Error('Secure billing is not available. Please refresh and sign in before upgrading.');
        }
        const successUrl = `${getCheckoutReturnUrl({ payment: 'success' })}&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = getCheckoutReturnUrl({ payment: 'cancelled' });
        const checkoutSession = await invokeBillingFunction(BILLING_FUNCTIONS.checkout, { successUrl, cancelUrl });

        if (!checkoutSession.url) throw new Error('Checkout session did not include a redirect URL.');

        setUpgradeButtonLoading(button, false);
        if (!hasAcknowledgedStripeRedirect()) {
            const shouldContinue = await showStripeRedirectNotice(checkoutSession.url);
            if (!shouldContinue) return;
        }

        setUpgradeButtonLoading(button, true);
        window.location.assign(checkoutSession.url);
    } catch (err) {
        console.error('[Billing] Stripe Checkout failed:', err);
        if (window.showToast) window.showToast(err.message || 'Payment setup failed. Please try again.');
        setUpgradeButtonLoading(button, false);
    }
}

export async function handleManageSubscription(event) {
    event?.preventDefault?.();

    const button = event?.currentTarget || document.getElementById('accountUpgradeBtn');
    setUpgradeButtonLoading(button, true);

    try {
        if (!window.currentUser) {
            throw new Error('Please sign in before managing your subscription.');
        }

        if (!isBillingEnabled()) {
            throw new Error(getBillingDisabledMessage());
        }

        const returnUrl = getCheckoutReturnUrl();
        const portalSession = await invokeBillingFunction(BILLING_FUNCTIONS.portal, { returnUrl });
        if (!portalSession.url) throw new Error('Billing portal did not include a redirect URL.');
        window.location.assign(portalSession.url);
    } catch (err) {
        console.error('[Billing] Customer portal failed:', err);
        if (window.showToast) window.showToast(err.message || 'Could not open billing portal.');
        setUpgradeButtonLoading(button, false);
    }
}

export function showPremiumSuccessModal(title = 'Welcome to BudgetBuddy Pro!', message = 'Your payment was successful and premium access is now active.') {
    document.getElementById('premiumSuccessModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'premiumSuccessModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-box modal-box-medium premium-success-modal" role="dialog" aria-modal="true" aria-labelledby="premiumSuccessTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="document.getElementById('premiumSuccessModal')?.remove()" aria-label="Close premium success">&times;</button>
            <div class="text-center">
                <div class="icon-large" aria-hidden="true">âœ¨</div>
                <h3 id="premiumSuccessTitle" class="modal-title mb-sm">${esc(title)}</h3>
                <p class="text-sm text-muted">${esc(message)}</p>
                <button type="button" class="btn-create account-action-btn mt-lg" onclick="document.getElementById('premiumSuccessModal')?.remove()">Start using Pro</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

export async function handleStripeCheckoutReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
        const verified = await refreshPremiumAccess({ silent: true, checkoutSessionId: sessionId });
        if (verified) {
            showPremiumSuccessModal(
                'Welcome to BudgetBuddy Pro!',
                'Your payment was verified and premium access is now active.'
            );
        } else {
            showPremiumSuccessModal(
                'Payment received',
                'Stripe is still confirming your subscription. Premium access will turn on after verification finishes.'
            );
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }

    if (paymentStatus === 'cancelled') {
        if (window.showToast) window.showToast('Checkout cancelled. You can upgrade anytime.');
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }

    return false;
}

// Check if free Buddy Cloud sync is active on this signed-in device
window.hasBuddyCloud = function() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    return Boolean(status.signedIn && status.enabled);
};

// The standardized Buddy Cloud gatekeeper
window.checkBuddyCloudAccess = function(featureName, actionCallback) {
    if (window.hasBuddyCloud()) {
        actionCallback();
    } else {
        if (!window.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        recordSyncEvent(`${featureName || 'Buddy Cloud'} needs free cloud sync enabled first.`, 'error');
        window.openSyncHistoryPanel?.();
    }
};

// The Upgrade UI Modal
window.openUpgradeModal = function(featureName = 'this premium feature') {
    let existingModal = document.getElementById('upgradeModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.className = 'modal-overlay active';
    // Centered fade-in modal per standard UI guidelines
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; padding: 1rem; backdrop-filter: blur(4px);';

    modal.innerHTML = `
        <div class="modal-content" style="width: 100%; max-width: 380px; background: var(--surface); border-radius: 24px; padding: 2rem; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: popIn 0.3s ease-out;">
            <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">☁️</div>
            <h2 style="margin: 0 0 0.5rem 0; color: var(--text); font-size: 1.5rem;">Unlock Buddy Cloud</h2>

            <p style="color: var(--text-dim); font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">
                Keep your deleted transactions safe for 30 days, unlock <strong>${featureName}</strong>, and never lose your data again.
            </p>

            <div style="border: 1px solid var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; background: var(--bg);">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--text);">$4.99<span style="font-size: 0.9rem; color: var(--text-dim); font-weight: 500;"> / mo</span></div>
                <div style="font-size: 0.85rem; color: var(--positive); font-weight: 600; margin-top: 0.25rem;">or $49.99/yr (Save 17%)</div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <button type="button" id="upgrade-btn" class="btn-primary" onclick="window.startStripeCheckout(event)" style="width: 100%; padding: 1rem; border-radius: 12px; font-weight: 700; font-size: 1rem; border: none; background: var(--primary); color: white; cursor: pointer;">
                    Start Free Trial → Unlock
                </button>
                <button type="button" onclick="document.getElementById('upgradeModal').remove()" style="width: 100%; padding: 1rem; background: none; border: none; color: var(--text-dim); font-weight: 600; cursor: pointer; font-size: 0.95rem;">
                    No Thanks
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.openUpgradeModal = function(featureName = 'this premium feature') {
    document.getElementById('upgradeModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.className = 'modal-overlay active';

    modal.innerHTML = `
        <div class="modal-box modal-box-medium premium-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgradeModalTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="document.getElementById('upgradeModal')?.remove()" aria-label="Close premium upgrade">&times;</button>

            <div class="premium-upgrade-header">
                <div class="premium-upgrade-icon" aria-hidden="true">Pro</div>
                <div>
                    <h2 id="upgradeModalTitle" class="modal-title">BudgetBuddy Premium</h2>
                    <p class="premium-upgrade-copy">Unlock ${esc(featureName)} plus the paid tools built for recurring budget work.</p>
                </div>
            </div>

            <div class="premium-price-panel">
                <div class="premium-price">$4.99 <span>/ month</span></div>
                <div class="premium-price-note">Secure subscription checkout powered by Stripe.</div>
            </div>

            <ul class="premium-feature-list">
                <li>30-day recovery for deleted transactions</li>
                <li>Premium budget automation and planning tools</li>
                <li>Cloud-backed premium status tied to your account</li>
                <li>Billing management, invoices, card updates, and cancellation through Stripe</li>
            </ul>

            <div class="premium-terms-note">
                By upgrading, you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="privacypolicy.html" target="_blank" rel="noopener">Privacy Policy</a>. Cancel anytime in the billing portal.
            </div>

            <div class="account-actions">
                <button type="button" id="upgrade-btn" class="btn-create account-action-btn" onclick="window.startStripeCheckout(event)">
                    Upgrade securely
                </button>
                <button type="button" class="btn-cancel account-action-btn" onclick="document.getElementById('upgradeModal').remove()">
                    No Thanks
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

// Developer Helper: Instantly activate premium for testing
window.activateBuddyCloudDev = function() {
    if (!LOCAL_DEV_HOSTS.has(window.location.hostname)) {
        if (typeof window.showToast === 'function') window.showToast('Developer premium toggle is only available locally.');
        return;
    }

    setPremiumAccess(true, { source: 'developer_helper' });
    document.getElementById('upgradeModal')?.remove();

    if (typeof window.showToast === 'function') {
        window.showToast('Premium dev mode activated.');
    } else {
        alert('Premium dev mode activated.');
    }
};

// ==========================================
// 🗑️ DELETION LOGIC (Spec 2.3 & 8.1)
// Hard Delete (Free) vs Soft Delete (Buddy Cloud)
// ==========================================

window.deleteTransaction = function(txId) {
    // 1. Fetch existing transactions safely
    let transactions = [];
    if (typeof State !== 'undefined' && State.getTransactions) {
        transactions = State.getTransactions();
    } else {
        transactions = JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    }

    const txIndex = transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return; // Failsafe: Transaction not found

    // 2. PREMIUM FLOW: Soft Delete (Buddy Cloud)
    if (window.hasBuddyCloud()) {
        // Flag it as deleted, do not remove it from the array
        transactions[txIndex].isDeleted = true;
        transactions[txIndex].deletedAt = new Date().toISOString();

        window.saveTransactionsHelper(transactions);

        if (typeof window.showToast === 'function') {
            window.showToast("Moved to trash (Recoverable for 30 days)");
        } else {
            // Fallback if your custom toast isn't built yet
            console.log("Moved to trash (Recoverable for 30 days)");
        }

        window.refreshActiveUI();
    }

    // 3. FREE FLOW: Hard Delete
    else {
        // Strict warning requirement for free users
        const confirmDelete = confirm("Permanently delete? This cannot be undone.");
        if (!confirmDelete) return; // User canceled the deletion

        // Physically slice it out of the array forever
        transactions.splice(txIndex, 1);

        window.saveTransactionsHelper(transactions);

        if (typeof window.showToast === 'function') {
            window.showToast("Deleted permanently");
        }

        window.refreshActiveUI();
    }
};

// --- Helpers to keep the function clean ---

window.saveTransactionsHelper = function(txArray) {
    if (typeof State !== 'undefined' && State.saveTransactions) {
        State.saveTransactions(txArray);
    } else {
        localStorage.setItem('bb_transactions', JSON.stringify(txArray));
    }
};

window.refreshActiveUI = function() {
    // Re-renders whatever view the user is currently looking at
    if (window.renderRecentTransactions) window.renderRecentTransactions();
    if (window.renderDebtTab) window.renderDebtTab();
    if (window.renderSavingsTab) window.renderSavingsTab();
    if (window.renderIncomeTab) window.renderIncomeTab();
    if (window.renderZBBDashboard) window.renderZBBDashboard();
    // (Add any other render functions you use here)
};

// ==========================================
// 📄 SLIDE-OVER DETAIL PANEL (Spec 6.3)
// ==========================================

window.openTxDetailPanel = function(txId) {
    // 1. Fetch the transaction
    const transactions = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    const tx = transactions.find(t => t.id === txId);

    if (!tx) return;

    // 2. Populate the Data (Contextual Integrity)
    const symbol = (typeof State !== 'undefined' && State.getSymbol) ? State.getSymbol() : '$';
    const amountEl = document.getElementById('slideAmount');

    // Color coding the hero amount
    amountEl.textContent = `${symbol}${Math.abs(tx.amount).toFixed(2)}`;
    amountEl.style.color = tx.type === 'income' ? 'var(--positive)' : 'var(--text)';

    document.getElementById('slideDescription').textContent = tx.description || 'Unnamed Transaction';
    document.getElementById('slideCategory').textContent = tx.category || 'Uncategorized';
    document.getElementById('slideMethod').textContent = tx.paymentMethod || 'Unknown';
    document.getElementById('slideDate').textContent = window.formatDate ? window.formatDate(tx.date) : tx.date;
    document.getElementById('slideTag').textContent = tx.tag || 'None';
    document.getElementById('slideNotes').value = tx.notes || '';
    document.getElementById('slideCreated').textContent = tx.createdAt || tx.date;

    // 3. Wire up the action buttons specifically to this ID
    document.getElementById('slideDeleteBtn').onclick = () => {
        window.deleteTransaction(txId); // Re-using our Gatekeeper deletion logic!
        window.closeTxDetailPanel();
    };

    // 4. Trigger the CSS Slide Animation
    const panel = document.getElementById('txDetailPanel');
    const overlay = document.getElementById('txDetailOverlay');

    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    panel.style.right = '0';
    syncOverlayScrollTopState();
};

window.closeTxDetailPanel = function() {
    const panel = document.getElementById('txDetailPanel');
    const overlay = document.getElementById('txDetailOverlay');

    // Slide it back off-screen
    panel.style.right = '-100%';
    overlay.style.opacity = '0';

    setTimeout(() => {
        overlay.style.pointerEvents = 'none';
        syncOverlayScrollTopState();
    }, 300); // Wait for transition to finish
};

// ==========================================
// 🔍 PHASE 2 RENDER & SEARCH ENGINE
// ==========================================

// Failsafe: Route any old legacy 'X' buttons to our new gatekeeper
window.removeTransaction = window.deleteTransaction;

function legacyRenderRecentTransactionsV2() {
    const listContainer = document.getElementById('recentTxList');
    if (!listContainer) return;

    // 1. Fetch transactions safely
    let allTx = [];
    if (typeof State !== 'undefined' && State.getTransactions) {
        allTx = State.getTransactions();
    } else {
        allTx = JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    }

    // Filter out Buddy Cloud soft-deleted items
    let visibleTx = allTx.filter(tx => !tx.isDeleted);

    // 2. The Bulletproof Search Filter
    const searchInput = document.getElementById('txSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (searchTerm) {
        visibleTx = visibleTx.filter(tx => {
            const safeDesc = tx.description ? String(tx.description).toLowerCase() : '';
            const safeCat = tx.category ? String(tx.category).toLowerCase() : '';
            const safeAmt = (tx.amount !== undefined && tx.amount !== null) ? String(tx.amount) : '';
            const safeName = tx.name ? String(tx.name).toLowerCase() : ''; // Catch-all for older data models

            return safeDesc.includes(searchTerm) ||
                   safeCat.includes(searchTerm) ||
                   safeAmt.includes(searchTerm) ||
                   safeName.includes(searchTerm);
        });
    }

    // 3. Apply the Pill Filters
    const activeFilterBtn = document.querySelector('.tx-filters .active');
    const currentFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';

    if (currentFilter !== 'all') {
        visibleTx = visibleTx.filter(tx => tx.type === currentFilter);
    }

    // 4. Sort: Newest First
    visibleTx.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 5. Render the HTML Cards (No more 'X' buttons!)
    listContainer.innerHTML = '';

    if (visibleTx.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div>No transactions found.</div>
            </div>`;
        return;
    }

    const symbol = (typeof State !== 'undefined' && State.getSymbol) ? State.getSymbol() : '$';

    visibleTx.forEach(tx => {
        const icon = window.getIconFromName ? window.getIconFromName(tx.category) : '📁';
        const formattedAmount = window.formatMoney ? window.formatMoney(tx.amount) : Math.abs(tx.amount).toFixed(2);
        const amountColor = tx.type === 'income' ? 'var(--positive)' : 'var(--text)';
        const amountPrefix = tx.type === 'income' ? '+' : '-';
        const displayDesc = tx.description || tx.name || 'Unnamed Transaction';

        const card = document.createElement('div');

        // This is the magic! Clicking anywhere on the card opens the new panel
        card.onclick = () => {
            if (window.openTxDetailPanel) window.openTxDetailPanel(tx.id);
        };

        card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s ease;';

        // Hover effect to show it is clickable
        card.onmouseover = () => card.style.background = 'var(--surface-hover)';
        card.onmouseout = () => card.style.background = 'transparent';

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
                    ${icon}
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text);">${displayDesc}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem;">
                        ${tx.category || 'Uncategorized'} • ${window.formatDate ? window.formatDate(tx.date) : tx.date}
                    </div>
                </div>
            </div>
            <div style="font-weight: 700; font-size: 1.1rem; color: ${amountColor}; text-align: right;">
                ${amountPrefix}${symbol}${formattedAmount}
            </div>
        `;
        listContainer.appendChild(card);
    });
};

// ==========================================
// 🎛️ RECENT TAB UI TRIGGERS
// ==========================================

function legacyRenderRecentTransactionsV4() {
    const listContainer = document.getElementById('recentTxList');
    if (!listContainer) return;

    let visibleTx = (State.getTransactions ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]'))
        .filter(tx => !tx.isDeleted);

    const searchInput = document.getElementById('txSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (searchTerm) {
        visibleTx = visibleTx.filter(tx => {
            const safeDesc = tx.description ? String(tx.description).toLowerCase() : '';
            const safeCat = tx.category ? String(tx.category).toLowerCase() : '';
            const safeAmt = tx.amount !== undefined && tx.amount !== null ? String(tx.amount) : '';
            const safeName = tx.name ? String(tx.name).toLowerCase() : '';
            return safeDesc.includes(searchTerm) || safeCat.includes(searchTerm) || safeAmt.includes(searchTerm) || safeName.includes(searchTerm);
        });
    }

    const activeFilterBtn = document.querySelector('.tx-filters .active');
    const currentFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
    if (currentFilter !== 'all') {
        visibleTx = visibleTx.filter(tx => tx.type === currentFilter);
    }

    visibleTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    listContainer.innerHTML = '';

    if (visibleTx.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div>No transactions found.</div>
            </div>`;
        return;
    }

    const symbol = State.getSymbol ? State.getSymbol() : '$';

    visibleTx.forEach(tx => {
        const icon = window.getIconFromName ? window.getIconFromName(tx.category) : '📁';
        const formattedAmount = window.formatMoney ? window.formatMoney(tx.amount) : Math.abs(tx.amount).toFixed(2);
        const amountColor = tx.type === 'income' ? 'var(--positive)' : 'var(--text)';
        const amountPrefix = tx.type === 'income' ? '+' : '-';
        const displayDesc = tx.description || tx.name || 'Unnamed Transaction';
        const displayCategory = tx.category || 'Uncategorized';

        const card = document.createElement('div');
        card.className = 'recent-tx-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Open transaction details for ${displayDesc}`);
        card.onclick = () => {
            if (window.openTxDetailPanel) window.openTxDetailPanel(tx.id);
        };
        card.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (window.openTxDetailPanel) window.openTxDetailPanel(tx.id);
            }
        };

        let touchStartX = 0;
        let touchStartY = 0;
        card.addEventListener('touchstart', (event) => {
            const touch = event.changedTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        card.addEventListener('touchend', (event) => {
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            if (deltaX < -80 && Math.abs(deltaY) < 40) {
                event.preventDefault();
                window.deleteTransaction(tx.id);
            }
        }, { passive: false });

        card.innerHTML = `
            <div class="recent-tx-main">
                <div class="recent-tx-icon" aria-hidden="true">${esc(icon)}</div>
                <div class="recent-tx-copy">
                    <div class="recent-tx-title">${esc(displayDesc)}</div>
                    <div class="recent-tx-meta">${esc(displayCategory)} • ${window.formatDate ? window.formatDate(tx.date) : tx.date}</div>
                </div>
            </div>
            <div class="recent-tx-actions">
                <div class="recent-tx-amount" style="color: ${amountColor};">${amountPrefix}${symbol}${formattedAmount}</div>
                <button type="button" class="recent-tx-delete-btn" onclick="event.stopPropagation(); window.deleteTransaction('${tx.id}');" aria-label="Delete transaction ${esc(displayDesc)}">&times;</button>
            </div>
        `;
        listContainer.appendChild(card);

        if (tx.id === lastSavedTxId && tx.type === 'expense') {
            const amountEl = card.querySelector('.recent-tx-amount');
            if (amountEl) {
                card.classList.add('expense-slot-highlight');
                animateSlotText(amountEl, `${amountPrefix}${symbol}${formattedAmount}`, { duration: 950, intervalMs: 50 });
                setTimeout(() => card.classList.remove('expense-slot-highlight'), 900);
            }
        }
    });
};

// 1. Triggered when typing in the search bar
function legacyFilterRecentTransactionsV2() {
    window.renderRecentTransactions();
}

// 2. Triggered when clicking the All / Income / Savings / Expense pills
function legacyFilterTransactionsV2(filterType) {
    // Update the active class on the buttons for visual feedback
    document.querySelectorAll('.tx-filters .tag-pill').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });

    const activeBtn = document.querySelector(`.tx-filters .tag-pill[data-filter="${filterType}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
    }

    // Re-render the list with the new active filter
    window.renderRecentTransactions();
}

// ==========================================
// 📦 BULK SELECTION ENGINE (Spec 6.4)
// ==========================================

// Global state for bulk editing
window.isBulkMode = false;
window.selectedTxIds = new Set();

export function toggleBulkMode() {
    if (window.toggleRecentBulkMode) {
        window.toggleRecentBulkMode();
        return;
    }
    window.isBulkMode = !window.isBulkMode;
    window.selectedTxIds.clear();
    renderRecentTransactions();
}

// Routes clicks based on what mode the user is in
export function handleCardClick(txId) {
    if (window.handleRecentCardClick) {
        window.handleRecentCardClick(txId);
        return;
    }
    if (window.openTxDetailPanel) window.openTxDetailPanel(txId);
}

// Builds the floating bottom bar when items are selected
export function renderBulkActionBar() {
    let bar = document.getElementById('bulkActionBar');

    // Remove it if we turn off bulk mode
    if (!window.isBulkMode) {
        if (bar) bar.remove();
        return;
    }

    // Create it if it doesn't exist
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bulkActionBar';
        bar.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-top: 1px solid var(--border); padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; z-index: 3000; box-shadow: 0 -4px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease;';
        document.body.appendChild(bar);
    }

    const count = window.selectedTxIds.size;

    bar.innerHTML = `
        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text);">${count} Selected</div>
        <div style="display: flex; gap: 0.75rem;">
            <button class="btn-cancel" onclick="window.toggleBulkMode()">Cancel</button>
            <button class="btn-primary" onclick="window.bulkMoveTransactions()" ${count === 0 ? 'disabled' : ''} style="${count === 0 ? 'opacity: 0.5' : ''}">Move</button>
            <button class="btn-danger" onclick="window.bulkDeleteTransactions()" ${count === 0 ? 'disabled' : ''} style="${count === 0 ? 'opacity: 0.5' : ''}">Delete</button>
        </div>
    `;
}

// Mass-Delete Engine (Respects Buddy Cloud tiers)
export function bulkDeleteTransactions() {
    if (window.bulkDeleteRecentTransactions) {
        window.bulkDeleteRecentTransactions();
        return;
    }

    const count = window.selectedTxIds.size;
    if (count === 0) return;

    if (!confirm(`Permanently delete ${count} transactions? This cannot be undone.`)) return;

    let txs = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');

    if (window.hasBuddyCloud && window.hasBuddyCloud()) {
        // Premium soft-delete
        txs.forEach(tx => {
            if (window.selectedTxIds.has(tx.id)) {
                tx.isDeleted = true;
                tx.deletedAt = new Date().toISOString();
            }
        });
    } else {
        // Free hard-delete
        txs = txs.filter(tx => !window.selectedTxIds.has(tx.id));
    }

    if (typeof State !== 'undefined' && State.saveTransactions) {
        State.saveTransactions(txs);
    } else {
        localStorage.setItem('bb_transactions', JSON.stringify(txs));
    }

    if (typeof showToast === 'function') showToast(`Deleted ${count} transactions`);

    toggleBulkMode(); // Exits mode and cleans up
}

// Mass-Move Engine (Re-uses your Reassign Modal!)
export function bulkMoveTransactions() {
    if (window.selectedTxIds.size === 0) return;

    const select = document.getElementById('reassignCategorySelect');
    const categories = (typeof State !== 'undefined' && State.getCategories) ? State.getCategories() : JSON.parse(localStorage.getItem('bb_custom_categories') || '[]');

    // Build the dropdown
    select.innerHTML = '<option value="" selected disabled>Select a new category...</option>';
    categories.forEach(c => {
        select.innerHTML += `<option value="${esc(c.name)}">${esc(c.name)}</option>`;
    });

    document.getElementById('reassignTxCount').textContent = window.selectedTxIds.size;
    document.getElementById('reassignCatName').textContent = "Multiple Items";

    // Hide the "Force Delete" checkbox since this is purely a Move flow
    const forceDeleteRow = document.getElementById('deleteForceOrphan');
    if (forceDeleteRow) forceDeleteRow.parentElement.style.display = 'none';

    // Hijack the confirm button
    const confirmBtn = document.getElementById('reassignConfirmBtn');
    confirmBtn.textContent = "Move Transactions";
    confirmBtn.onclick = function() {
        const newCat = select.value;
        if (!newCat) return alert("Please select a category");

        let txs = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');

        txs.forEach(tx => {
            if (window.selectedTxIds.has(tx.id)) {
                tx.category = newCat;
            }
        });

        if (typeof State !== 'undefined' && State.saveTransactions) {
            State.saveTransactions(txs);
        } else {
            localStorage.setItem('bb_transactions', JSON.stringify(txs));
        }

        if (typeof showToast === 'function') showToast(`Moved ${window.selectedTxIds.size} transactions`);

        document.getElementById('reassignCategoryModal').style.display = 'none';
        toggleBulkMode();
    };

    // Show the modal
    document.getElementById('reassignCategoryModal').style.display = 'flex';
}

// ==========================================
// RECENT TRANSACTIONS REBUILD
// ==========================================

const RECENT_FILTER_LABELS = {
    all: 'All transactions',
    expense: 'Expenses',
    income: 'Income',
    savings: 'Savings',
    debt: 'Debt'
};
const RECENT_PILL_IDLE_RESET_MS = 2500;

window.currentTxFilter = window.currentTxFilter || 'all';
window.isBulkMode = Boolean(window.isBulkMode);
window.selectedTxIds = window.selectedTxIds instanceof Set ? window.selectedTxIds : new Set();
window.visibleRecentTxIds = Array.isArray(window.visibleRecentTxIds) ? window.visibleRecentTxIds : [];
window.openRecentMenuTxId = window.openRecentMenuTxId || '';
window.currentDrillDownMetricMode = window.currentDrillDownMetricMode || 'spent';
let pendingRecentDeleteTxId = '';
let deleteTxTimerInterval = null;
const RECENT_FILTER_VALUES = new Set(['all', 'expense', 'income', 'savings', 'debt']);

function normalizeRecentFilter(filterType) {
    const value = String(filterType || 'all').toLowerCase();
    return RECENT_FILTER_VALUES.has(value) ? value : 'all';
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function getLocalDateKey(date = new Date()) {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return '';
    return `${safeDate.getFullYear()}-${padDatePart(safeDate.getMonth() + 1)}-${padDatePart(safeDate.getDate())}`;
}

function parseDateKeyLocal(dateKey = '') {
    const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTransactionDateKey(tx = {}) {
    const rawDate = String(tx.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;

    const fallback = tx.createdAt || tx.serverLoggedAtUTC || tx.createdAtUTC || '';
    if (!fallback) return '';
    return getLocalDateKey(new Date(fallback));
}

function formatCalendarDateLabel(dateKey = '') {
    const date = parseDateKeyLocal(dateKey);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function getRecentScopeLabel() {
    const filterLabel = RECENT_FILTER_LABELS[window.currentTxFilter || 'all'] || RECENT_FILTER_LABELS.all;
    return selectedCalendarDateKey
        ? `${filterLabel} on ${formatCalendarDateLabel(selectedCalendarDateKey)}`
        : filterLabel;
}

function syncRecentFilterPills() {
    window.currentTxFilter = normalizeRecentFilter(window.currentTxFilter);
    document.querySelectorAll('#view-recent .recent-filter-row .tag-pill[data-filter]').forEach(btn => {
        const isActive = normalizeRecentFilter(btn.dataset.filter) === window.currentTxFilter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function getRecentTransactions() {
    return (State.getTransactions ? State.getTransactions() : []).filter(tx => !tx.isDeleted);
}

function getTransactionKind(tx) {
    const type = String(tx.type || '').toLowerCase();
    const tag = String(tx.tag || '').toLowerCase();

    if (tag === 'savings' || type === 'savings') return 'savings';
    if (tag === 'debt' || type === 'debt') return 'debt';
    if (type === 'income') return 'income';
    return 'expense';
}

function getTransactionKindLabel(tx) {
    const labels = {
        income: 'Income',
        debt: 'Debt',
        savings: 'Savings',
        expense: 'Expense'
    };
    return labels[getTransactionKind(tx)] || 'Expense';
}

function getLocalTimeZoneLabel() {
    const zoneMap = {
        'America/New_York': 'EST',
        'America/Detroit': 'EST',
        'America/Kentucky/Louisville': 'EST',
        'America/Indiana/Indianapolis': 'EST',
        'America/Chicago': 'CST',
        'America/Indiana/Knox': 'CST',
        'America/Menominee': 'CST',
        'America/North_Dakota/Center': 'CST',
        'America/Denver': 'MST',
        'America/Boise': 'MST',
        'America/Phoenix': 'MST',
        'America/Los_Angeles': 'PST',
        'America/Vancouver': 'PST'
    };

    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zoneMap[timeZone]) return zoneMap[timeZone];

        const labelPart = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
            .formatToParts(new Date())
            .find(part => part.type === 'timeZoneName');
        return labelPart?.value || 'Local';
    } catch {
        return 'Local';
    }
}

function getTransactionUtcTimestamp(tx) {
    const raw = tx.serverLoggedAtUTC || tx.createdAtUTC || tx.createdAt || '';
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

function formatLocalTransactionTimestamp(tx) {
    const utcTimestamp = getTransactionUtcTimestamp(tx);
    if (!utcTimestamp) return tx.date ? formatDate(tx.date) : 'No timestamp';

    const date = new Date(utcTimestamp);
    const localDateTime = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);

    return `${localDateTime} ${getLocalTimeZoneLabel()}`;
}

function getSignedTransactionAmount(tx) {
    const amount = Math.abs(parseFloat(tx.amount) || 0);
    const type = String(tx.type || '').toLowerCase();
    return (type === 'income' || type === 'savings') ? amount : -amount;
}

function getTransactionDisplay(tx) {
    const kind = getTransactionKind(tx);
    const signedAmount = getSignedTransactionAmount(tx);
    const isPositive = signedAmount >= 0;
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const description = tx.description || tx.name || 'Unnamed Transaction';
    const category = tx.category || (kind === 'income' ? 'Uncategorized Income' : 'Uncategorized');
    const icon = getIconFromName(tx.category || tx.tag || kind) || '📁';
    const color = isPositive ? 'var(--positive)' : (kind === 'debt' ? 'var(--red)' : 'var(--text)');

    return {
        kind,
        kindLabel: getTransactionKindLabel(tx),
        signedAmount,
        sign: isPositive ? '+' : '-',
        amountText: `${isPositive ? '+' : '-'}${symbol}${formatMoney(Math.abs(signedAmount))}`,
        color,
        description,
        category,
        icon,
        dateText: tx.date ? formatDate(tx.date) : 'No date',
        timestampText: formatLocalTransactionTimestamp(tx),
        utcTimestamp: getTransactionUtcTimestamp(tx)
    };
}

function getFilteredRecentTransactions(options = {}) {
    const { includeSelectedDate = true } = options;
    const currentFilter = normalizeRecentFilter(window.currentTxFilter);
    window.currentTxFilter = currentFilter;
    const searchTerm = String(document.getElementById('txSearch')?.value || '').toLowerCase().trim();

    return getRecentTransactions()
        .filter(tx => currentFilter === 'all' || getTransactionKind(tx) === currentFilter)
        .filter(tx => !includeSelectedDate || !selectedCalendarDateKey || getTransactionDateKey(tx) === selectedCalendarDateKey)
        .filter(tx => {
            if (!searchTerm) return true;
            const fields = [
                tx.description,
                tx.name,
                tx.category,
                tx.tag,
                tx.type,
                tx.amount,
                tx.date,
                tx.notes,
                getTransactionKindLabel(tx),
                formatLocalTransactionTimestamp(tx)
            ];
            return fields.some(value => String(value ?? '').toLowerCase().includes(searchTerm));
        })
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
}

function getBudgetCalendarMonthTitle(date = calendarCursorDate) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function getBudgetCalendarDayMap(transactions = []) {
    const map = new Map();

    transactions.forEach(tx => {
        const dateKey = getTransactionDateKey(tx);
        if (!dateKey) return;

        const existing = map.get(dateKey) || {
            count: 0,
            net: 0,
            income: 0,
            outflow: 0,
            transactions: []
        };
        const signed = getSignedTransactionAmount(tx);
        existing.count += 1;
        existing.net += signed;
        if (signed >= 0) {
            existing.income += signed;
        } else {
            existing.outflow += Math.abs(signed);
        }
        existing.transactions.push(tx);
        map.set(dateKey, existing);
    });

    return map;
}

function setBudgetCalendarText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderBudgetCalendar() {
    const grid = document.getElementById('budgetCalendarGrid');
    if (!grid) return;

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const monthStart = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth(), 1);
    const monthEnd = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    const visibleTx = getFilteredRecentTransactions({ includeSelectedDate: false });
    const dayMap = getBudgetCalendarDayMap(visibleTx);
    const monthKeyPrefix = `${monthStart.getFullYear()}-${padDatePart(monthStart.getMonth() + 1)}-`;
    const monthTotals = { net: 0, income: 0, outflow: 0, activeDays: 0 };

    [...dayMap.entries()].forEach(([dateKey, day]) => {
        if (!dateKey.startsWith(monthKeyPrefix)) return;
        monthTotals.net += day.net;
        monthTotals.income += day.income;
        monthTotals.outflow += day.outflow;
        monthTotals.activeDays += 1;
    });

    setBudgetCalendarText('calendarMonthLabel', getBudgetCalendarMonthTitle(monthStart));
    setBudgetCalendarText('calendarScope', getRecentScopeLabel());
    setBudgetCalendarText('calendarMonthNet', `${monthTotals.net < 0 ? '-' : ''}${symbol}${formatMoney(Math.abs(monthTotals.net))}`);
    setBudgetCalendarText('calendarMonthIncome', `${symbol}${formatMoney(monthTotals.income)}`);
    setBudgetCalendarText('calendarMonthOutflow', `${symbol}${formatMoney(monthTotals.outflow)}`);
    setBudgetCalendarText('calendarActiveDays', String(monthTotals.activeDays));

    const todayKey = getLocalDateKey();
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const dateKey = getLocalDateKey(date);
        const day = dayMap.get(dateKey);
        const inMonth = date.getMonth() === monthStart.getMonth();
        const isToday = dateKey === todayKey;
        const isSelected = dateKey === selectedCalendarDateKey;
        const hasActivity = Boolean(day?.count);
        const labelParts = [
            formatCalendarDateLabel(dateKey),
            hasActivity ? `${day.count} transaction${day.count === 1 ? '' : 's'}` : 'No transactions',
            hasActivity ? `Net ${day.net < 0 ? '-' : '+'}${symbol}${formatMoney(Math.abs(day.net))}` : ''
        ].filter(Boolean);

        cells.push(`
            <button type="button"
                class="calendar-day${inMonth ? '' : ' is-outside-month'}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${hasActivity ? ' has-activity' : ''}"
                onclick="window.selectBudgetCalendarDate(${jsArg(dateKey)})"
                role="gridcell"
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-label="${esc(labelParts.join('. '))}">
                <span class="calendar-day-number">${date.getDate()}</span>
                <span class="calendar-day-count">${hasActivity ? day.count : ''}</span>
                <span class="calendar-day-net">${hasActivity ? `${day.net < 0 ? '-' : '+'}${symbol}${formatMoney(Math.abs(day.net))}` : ''}</span>
            </button>
        `);
    }
    grid.innerHTML = cells.join('');

    const clearBtn = document.getElementById('calendarClearDateBtn');
    if (clearBtn) clearBtn.hidden = !selectedCalendarDateKey;

    const selectedPanel = document.getElementById('calendarSelectedPanel');
    const selectedTitle = document.getElementById('calendarSelectedTitle');
    const selectedMeta = document.getElementById('calendarSelectedMeta');
    if (!selectedPanel || !selectedTitle || !selectedMeta) return;

    if (!selectedCalendarDateKey) {
        selectedPanel.hidden = true;
        return;
    }

    const selectedDay = dayMap.get(selectedCalendarDateKey);
    selectedPanel.hidden = false;
    selectedTitle.textContent = formatCalendarDateLabel(selectedCalendarDateKey);
    selectedMeta.textContent = selectedDay
        ? `${selectedDay.count} transaction${selectedDay.count === 1 ? '' : 's'} - net ${selectedDay.net < 0 ? '-' : '+'}${symbol}${formatMoney(Math.abs(selectedDay.net))}`
        : 'No transactions on this day';
}

window.moveBudgetCalendarMonth = function(delta = 0) {
    calendarCursorDate = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() + Number(delta || 0), 1);
    renderBudgetCalendar();
};

window.goToBudgetCalendarToday = function() {
    const today = new Date();
    calendarCursorDate = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedCalendarDateKey = getLocalDateKey(today);
    renderBudgetCalendar();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
};

window.selectBudgetCalendarDate = function(dateKey) {
    const parsed = parseDateKeyLocal(dateKey);
    if (!parsed) return;
    selectedCalendarDateKey = dateKey;
    calendarCursorDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    renderBudgetCalendar();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
};

window.clearBudgetCalendarDate = function() {
    selectedCalendarDateKey = '';
    renderBudgetCalendar();
    if (window.renderRecentTransactions) window.renderRecentTransactions();
};

window.openBudgetCalendarRecent = function() {
    if (typeof window.switchTab === 'function') window.switchTab('recent');
};

function saveTransactionArray(txArray) {
    if (State.saveTransactions) {
        State.saveTransactions(txArray);
    } else if (State.save) {
        const current = State.getTransactions ? State.getTransactions() : [];
        current.splice(0, current.length, ...txArray);
        State.save();
    }
}

function refreshRecentDependents() {
    if (window.renderRecentTransactions) window.renderRecentTransactions();
    renderBudgetCalendar();
    if (window.renderIncomeTab) window.renderIncomeTab();
    if (window.renderSavingsTab) window.renderSavingsTab();
    if (window.renderZBBDashboard) window.renderZBBDashboard();
    if (window.renderCategoryList) window.renderCategoryList();
    if (window.renderFormCategories) window.renderFormCategories();
    if (window.renderDebtTab) window.renderDebtTab();
    refreshOpenCategoryDrillDown();
}

function deleteTransactionsByIds(ids, confirmMessage) {
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return false;

    if (confirmMessage && !confirm(confirmMessage)) return false;
    return performDeleteTransactionsByIds(idSet);
}

function performDeleteTransactionsByIds(ids) {
    const idSet = ids instanceof Set ? ids : new Set((ids || []).filter(Boolean));
    if (idSet.size === 0) return false;

    const txs = State.getTransactions ? State.getTransactions() : [];
    const hasCloudTrash = typeof window.hasBuddyCloud === 'function' && window.hasBuddyCloud();

    if (hasCloudTrash) {
        txs.forEach(tx => {
            if (idSet.has(tx.id)) {
                tx.isDeleted = true;
                tx.deletedAt = new Date().toISOString();
            }
        });
        if (State.save) State.save();
    } else {
        saveTransactionArray(txs.filter(tx => !idSet.has(tx.id)));
    }

    idSet.forEach(id => window.selectedTxIds.delete(id));
    if (window.showToast) {
        window.showToast(idSet.size === 1 ? 'Transaction deleted.' : `${idSet.size} transactions deleted.`);
    }
    refreshRecentDependents();
    return true;
}

function getTransactionById(txId) {
    return (State.getTransactions ? State.getTransactions() : []).find(tx => String(tx.id) === String(txId));
}

function openRecentDeleteTransactionModal(txId) {
    const tx = getTransactionById(txId);
    if (!tx) return false;

    window.openRecentMenuTxId = '';

    if (localStorage.getItem('bb_skip_tx_warn') === 'true') {
        performDeleteTransactionsByIds([txId]);
        return true;
    }

    pendingRecentDeleteTxId = txId;
    const display = getTransactionDisplay(tx);
    const descEl = document.getElementById('deleteTxDesc');
    const amountEl = document.getElementById('deleteTxAmt');
    const timerEl = document.getElementById('deleteTxTimer');
    const skipEl = document.getElementById('deleteTxSkipWarn');

    if (descEl) descEl.textContent = display.description;
    if (amountEl) amountEl.textContent = display.amountText;
    if (skipEl) skipEl.checked = false;

    let timeLeft = 30;
    if (timerEl) timerEl.textContent = timeLeft;
    clearInterval(deleteTxTimerInterval);
    deleteTxTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) window.closeDeleteTxModal();
    }, 1000);

    if (typeof openModal === 'function') openModal('deleteTxModal');
    else document.getElementById('deleteTxModal')?.classList.add('active');

    return true;
}

function getMoveCategoryOptions(tx) {
    const currentCategory = String(tx?.category || '');
    const txKind = getTransactionKind(tx);
    // Move compatibility is intentionally centralized here; revise this map if future rules allow cross-type moves.
    const compatibleCategoryTypes = {
        savings: new Set(['savings', 'sinking_fund', 'external']),
        income: new Set(['income']),
        expense: new Set(['expense', '']),
        debt: new Set(['debt'])
    };
    const allowedTypes = compatibleCategoryTypes[txKind] || compatibleCategoryTypes.expense;

    return (State.getCategories ? State.getCategories() : [])
        .filter(cat => {
            if (!cat || !cat.name || cat.name === currentCategory) return false;
            const categoryType = cat.type || 'expense';
            return allowedTypes.has(categoryType);
        })
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function closeRecentTxActionMenu() {
    if (!window.openRecentMenuTxId) return;
    window.openRecentMenuTxId = '';
    window.renderRecentTransactions();
}

window.toggleRecentTxActionMenu = function(event, txId) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    window.openRecentMenuTxId = window.openRecentMenuTxId === txId ? '' : txId;
    window.renderRecentTransactions();

    if (window.openRecentMenuTxId) {
        requestAnimationFrame(() => {
            [...document.querySelectorAll('.recent-tx-card')]
                .find(card => card.dataset.txId === String(txId))
                ?.querySelector('.recent-tx-action-btn')
                ?.focus();
        });
    }
};

window.deleteRecentTransactionFromMenu = function(event, txId) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    window.openRecentMenuTxId = '';
    openRecentDeleteTransactionModal(txId);
    window.renderRecentTransactions();
};

window.openRecentMoveCategoryModal = function(event, txId) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const tx = getTransactionById(txId);
    if (!tx) return;

    const categories = getMoveCategoryOptions(tx);
    if (categories.length === 0) {
        if (window.showToast) window.showToast('Create another category before moving this transaction.');
        return;
    }

    window.openRecentMenuTxId = '';
    window.renderRecentTransactions();
    document.getElementById('recentMoveCategoryModal')?.remove();

    const display = getTransactionDisplay(tx);
    const modal = document.createElement('div');
    modal.id = 'recentMoveCategoryModal';
    modal.className = 'modal-overlay active';
    modal.onclick = (modalEvent) => {
        if (modalEvent.target === modal) window.closeRecentMoveCategoryModal();
    };

    modal.innerHTML = `
        <div class="modal-box modal-box-medium recent-move-modal" role="dialog" aria-modal="true" aria-labelledby="recentMoveCategoryTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.closeRecentMoveCategoryModal()" aria-label="Close move transaction">&times;</button>
            <h3 id="recentMoveCategoryTitle" class="modal-title">Move Transaction</h3>
            <p class="recent-move-copy">${esc(display.description)} is currently in ${esc(display.category)}.</p>
            <div class="add-form-group">
                <label for="recentMoveCategorySelect">New Category</label>
                <select id="recentMoveCategorySelect" class="payment-method-select">
                    <option value="" selected disabled>Select a category...</option>
                    ${categories.map(cat => `<option value="${esc(cat.name)}">${esc(cat.icon || String.fromCodePoint(0x1F4C1))} ${esc(cat.name)}</option>`).join('')}
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="window.closeRecentMoveCategoryModal()">Cancel</button>
                <button type="button" class="btn-create" onclick="window.confirmRecentMoveCategory(${jsArg(txId)})">Move</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    requestAnimationFrame(() => document.getElementById('recentMoveCategorySelect')?.focus());
};

window.closeRecentMoveCategoryModal = function() {
    const modal = document.getElementById('recentMoveCategoryModal');
    if (!modal) return;
    modal.classList.add('closing');
    window.setTimeout(() => {
        modal.remove();
        syncOverlayScrollTopState();
    }, 220);
};

window.confirmRecentMoveCategory = function(txId) {
    const select = document.getElementById('recentMoveCategorySelect');
    const nextCategory = select?.value || '';
    if (!nextCategory) {
        if (window.showToast) window.showToast('Select a category first.');
        select?.focus();
        return;
    }

    const txs = State.getTransactions ? State.getTransactions() : [];
    const tx = txs.find(item => String(item.id) === String(txId));
    if (!tx) return;

    tx.category = nextCategory;
    if (State.saveTransactions) {
        State.saveTransactions(txs);
    } else if (State.save) {
        State.save();
    }

    window.closeRecentMoveCategoryModal();
    if (window.showToast) window.showToast(`Moved transaction to ${nextCategory}.`);
    refreshRecentDependents();
};

function bindRecentSwipeActions(listContainer) {
    const cards = listContainer.querySelectorAll('.recent-tx-card');
    cards.forEach(card => {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let pointerId = null;
        let isSwiping = false;
        let suppressClick = false;

        const resetSwipe = () => {
            card.style.removeProperty('--recent-swipe-x');
            card.classList.remove('is-swiping-delete');
            window.setTimeout(() => { suppressClick = false; }, 0);
        };

        card.addEventListener('click', (event) => {
            if (suppressClick) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        card.addEventListener('pointerdown', (event) => {
            if (window.isBulkMode || window.openRecentMenuTxId) return;
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a')) return;

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            currentX = startX;
            isSwiping = false;
        });

        card.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (!isSwiping && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
                isSwiping = true;
                try { card.setPointerCapture(event.pointerId); } catch {}
            }

            if (!isSwiping) return;
            event.preventDefault();
            currentX = event.clientX;
            const offset = Math.max(-132, Math.min(0, deltaX));
            card.style.setProperty('--recent-swipe-x', `${offset}px`);
            card.classList.toggle('is-swiping-delete', offset < -18);
        });

        const endSwipe = (event) => {
            if (pointerId !== event.pointerId) return;

            const deltaX = currentX - startX;
            const txId = card.dataset.txId;
            const shouldDelete = isSwiping && deltaX < -118;
            suppressClick = isSwiping;
            pointerId = null;
            isSwiping = false;

            if (shouldDelete && txId) {
                card.style.setProperty('--recent-swipe-x', '-132px');
                card.classList.add('is-swiping-delete');
                window.setTimeout(() => {
                    resetSwipe();
                    window.deleteRecentTransaction(txId);
                }, 120);
                return;
            }

            resetSwipe();
        };

        card.addEventListener('pointerup', endSwipe);
        card.addEventListener('pointercancel', endSwipe);
    });
}

document.addEventListener('pointerdown', (event) => {
    if (!window.openRecentMenuTxId) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.recent-tx-menu-wrap')) return;
    window.openRecentMenuTxId = '';
    window.renderRecentTransactions();
}, true);

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !window.openRecentMenuTxId) return;
    event.preventDefault();
    closeRecentTxActionMenu();
});

function renderRecentBulkControls() {
    const panel = document.getElementById('recentBulkPanel');
    const countEl = document.getElementById('recentSelectedCount');
    const actionsEl = panel?.querySelector('.recent-bulk-actions');
    const selectBtn = document.getElementById('recentBulkSelectBtn');
    const deleteBtn = document.getElementById('recentBulkDeleteBtn');
    const toggleBtn = document.getElementById('recentBulkToggleBtn');
    const count = window.selectedTxIds.size;

    if (panel) panel.hidden = !window.isBulkMode;
    if (countEl) countEl.textContent = count;
    if (selectBtn) selectBtn.textContent = count > 0 ? 'Clear Selection' : 'Select Visible';
    if (actionsEl) actionsEl.classList.toggle('has-selection', count > 0);
    if (deleteBtn) {
        deleteBtn.hidden = count === 0;
        deleteBtn.disabled = count === 0;
    }
    if (toggleBtn) {
        toggleBtn.textContent = window.isBulkMode ? 'Done' : 'Select';
        toggleBtn.setAttribute('aria-pressed', window.isBulkMode ? 'true' : 'false');
    }
}

function renderRecentDateFilterBar() {
    const bar = document.getElementById('recentDateFilterBar');
    const label = document.getElementById('recentDateFilterLabel');
    if (!bar || !label) return;

    bar.hidden = !selectedCalendarDateKey;
    if (selectedCalendarDateKey) {
        label.textContent = `Showing ${formatCalendarDateLabel(selectedCalendarDateKey)}`;
    }
}

function renderRecentOverview(transactions = getFilteredRecentTransactions()) {
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const totals = { income: 0, expense: 0, savings: 0, debt: 0, net: 0 };

    transactions.forEach(tx => {
        const kind = getTransactionKind(tx);
        const signed = getSignedTransactionAmount(tx);
        totals.net += signed;
        totals[kind] += Math.abs(parseFloat(tx.amount) || 0);
    });

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('recentOverviewScope', getRecentScopeLabel());
    setText('recentOverviewTotal', String(transactions.length));
    setText('recentOverviewNet', `${totals.net < 0 ? '-' : ''}${symbol}${formatMoney(Math.abs(totals.net))}`);
    setText('recentOverviewIncome', `${symbol}${formatMoney(totals.income)}`);
    setText('recentOverviewExpense', `${symbol}${formatMoney(totals.expense)}`);
    setText('recentOverviewSavings', `${symbol}${formatMoney(totals.savings)}`);
    setText('recentOverviewDebt', `${symbol}${formatMoney(totals.debt)}`);
    setText('recentOverviewSelected', String(window.selectedTxIds.size));

    const list = document.getElementById('recentOverviewList');
    if (!list) return;

    const latest = transactions.slice(0, 6);
    list.innerHTML = latest.length
        ? latest.map(tx => {
            const display = getTransactionDisplay(tx);
            return `
                <div class="recent-overview-mini">
                    <div>
                        <strong>${esc(display.description)}</strong>
                        <span>${esc(display.kindLabel)} - ${esc(display.category)} - ${esc(display.timestampText)}</span>
                    </div>
                    <em style="color: ${display.color};">${display.amountText}</em>
                </div>
            `;
        }).join('')
        : '<div class="recent-empty-state"><div class="recent-empty-title">No activity in this view</div><div>Change filters or add a transaction.</div></div>';
}

function initRecentPillPull() {
    const row = document.querySelector('#view-recent .recent-filter-row');
    if (!row || row.dataset.pullBound === 'true') return;

    row.dataset.pullBound = 'true';
    let isPulling = false;
    let didDrag = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activePointerId = null;
    let resetTimer = null;
    let isHovering = false;
    let hasFocusWithin = false;
    let pendingClickFilter = '';

    const clearResetTimer = () => {
        if (!resetTimer) return;
        clearTimeout(resetTimer);
        resetTimer = null;
    };

    const isResetPaused = () => isPulling || isHovering || hasFocusWithin;

    const resetToStart = () => {
        resetTimer = null;
        if (row.scrollLeft <= 0 || isResetPaused()) return;

        if (typeof row.scrollTo === 'function') {
            row.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            row.scrollLeft = 0;
        }
    };

    const scheduleReset = () => {
        clearResetTimer();
        if (row.scrollLeft <= 0 || isResetPaused()) return;
        resetTimer = setTimeout(resetToStart, RECENT_PILL_IDLE_RESET_MS);
    };

    row.addEventListener('pointerdown', (event) => {
        const pill = event.target?.closest?.('.tag-pill[data-filter]');
        pendingClickFilter = pill ? pill.dataset.filter : '';

        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        clearResetTimer();
        isPulling = true;
        didDrag = false;
        startX = event.clientX;
        startScrollLeft = row.scrollLeft;
        activePointerId = event.pointerId;
        row.classList.add('is-pulling');
        row.setPointerCapture?.(event.pointerId);
    });

    row.addEventListener('pointermove', (event) => {
        if (!isPulling || event.pointerType !== 'mouse') return;
        const deltaX = event.clientX - startX;
        if (Math.abs(deltaX) > 4) didDrag = true;
        row.scrollLeft = startScrollLeft - deltaX;
        if (didDrag) event.preventDefault();
    });

    const endPull = () => {
        if (!isPulling) return;
        isPulling = false;
        row.classList.remove('is-pulling');
        if (activePointerId !== null && row.hasPointerCapture?.(activePointerId)) {
            row.releasePointerCapture(activePointerId);
        }
        activePointerId = null;

        if (didDrag) {
            row.dataset.suppressPillClick = 'true';
            setTimeout(() => {
                row.dataset.suppressPillClick = 'false';
            }, 0);
        }

        scheduleReset();
    };

    row.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse') return;
        isHovering = true;
        clearResetTimer();
    });
    row.addEventListener('pointerup', endPull);
    row.addEventListener('pointercancel', endPull);
    row.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'mouse') isHovering = false;
        endPull();
        scheduleReset();
    });
    row.addEventListener('focusin', () => {
        hasFocusWithin = true;
        clearResetTimer();
    });
    row.addEventListener('focusout', () => {
        setTimeout(() => {
            hasFocusWithin = row.contains(document.activeElement);
            scheduleReset();
        }, 0);
    });
    row.addEventListener('scroll', () => {
        if (isPulling) return;
        scheduleReset();
    }, { passive: true });
    row.addEventListener('click', (event) => {
        const pill = event.target?.closest?.('.tag-pill[data-filter]');
        const filterType = pill && row.contains(pill) ? pill.dataset.filter : pendingClickFilter;
        pendingClickFilter = '';
        if (!filterType) return;

        event.preventDefault();
        event.stopPropagation();

        if (row.dataset.suppressPillClick === 'true') {
            row.dataset.suppressPillClick = 'false';
            return;
        }

        window.filterTransactions(filterType);
    });
}

window.renderRecentTransactions = function() {
    const listContainer = document.getElementById('recentTxList');
    if (!listContainer) return;
    initRecentPillPull();
    syncRecentFilterPills();

    const visibleTx = getFilteredRecentTransactions();
    window.visibleRecentTxIds = visibleTx.map(tx => tx.id).filter(Boolean);

    renderRecentBulkControls();
    renderRecentDateFilterBar();
    renderRecentOverview(visibleTx);

    if (visibleTx.length === 0) {
        listContainer.innerHTML = `
            <div class="recent-empty-state">
                <div class="recent-empty-title">No transactions found</div>
                <div>${selectedCalendarDateKey ? 'Clear the selected calendar day or choose another date.' : 'Try another filter, search term, or add a transaction.'}</div>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = visibleTx.map(tx => {
        const display = getTransactionDisplay(tx);
        const checked = window.selectedTxIds.has(tx.id) ? 'checked' : '';
        const selectedClass = checked ? ' is-selected' : '';
        const menuOpen = !window.isBulkMode && window.openRecentMenuTxId === tx.id;
        const menuClass = menuOpen ? ' is-menu-open' : '';
        const checkbox = window.isBulkMode
            ? `<input type="checkbox" class="recent-tx-select" ${checked} aria-label="Select ${esc(display.description)}" onclick="event.stopPropagation()" onchange="window.toggleTransactionSelection(${jsArg(tx.id)}, this.checked)">`
            : '';
        const actionMenu = window.isBulkMode ? '' : `
            <div class="recent-tx-menu-wrap${menuClass}">
                <button type="button" class="recent-tx-menu-btn" onclick="window.toggleRecentTxActionMenu(event, ${jsArg(tx.id)})" aria-label="Open actions for ${esc(display.description)}" aria-expanded="${menuOpen ? 'true' : 'false'}">
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                </button>
                <div class="recent-tx-action-drawer" aria-hidden="${menuOpen ? 'false' : 'true'}">
                    <button type="button" class="recent-tx-action-btn" tabindex="${menuOpen ? '0' : '-1'}" onclick="window.openRecentMoveCategoryModal(event, ${jsArg(tx.id)})">Move</button>
                    <button type="button" class="recent-tx-action-btn is-danger" tabindex="${menuOpen ? '0' : '-1'}" onclick="window.deleteRecentTransactionFromMenu(event, ${jsArg(tx.id)})">Delete</button>
                </div>
            </div>
        `;

        return `
            <div class="recent-tx-card${selectedClass}${menuClass}" role="button" tabindex="0" data-tx-id="${esc(tx.id || '')}" onclick="window.handleRecentCardClick(${jsArg(tx.id)})" onkeydown="if(event.target.closest && event.target.closest('button,input,select,textarea,a')) return; if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.handleRecentCardClick(${jsArg(tx.id)});}" aria-label="Open ${esc(display.description)} transaction overview">
                <div class="recent-tx-swipe-bg" aria-hidden="true">Delete</div>
                <div class="recent-tx-main">
                    ${checkbox}
                    <div class="recent-tx-icon" aria-hidden="true">${esc(display.icon)}</div>
                    <div class="recent-tx-copy">
                        <div class="recent-tx-title-row">
                            <div class="recent-tx-title">${esc(display.category)}</div>
                            <span class="recent-tx-kind recent-tx-kind-${display.kind}">${esc(display.kindLabel)}</span>
                        </div>
                        <div class="recent-tx-description">${esc(display.description)}</div>
                        <div class="recent-tx-meta">
                            <span>${esc(display.timestampText)}</span>
                        </div>
                    </div>
                </div>
                <div class="recent-tx-actions">
                    <div class="recent-tx-amount" style="color: ${display.color};">${display.amountText}</div>
                    ${actionMenu}
                </div>
            </div>
        `;
    }).join('');

    bindRecentSwipeActions(listContainer);

    visibleTx.forEach(tx => {
        if (tx.id === lastSavedTxId && tx.type === 'expense') {
            const card = [...listContainer.querySelectorAll('.recent-tx-card')]
                .find(item => item.dataset.txId === tx.id);
            const amountEl = card?.querySelector('.recent-tx-amount');
            if (card && amountEl) {
                card.classList.add('expense-slot-highlight');
                animateSlotText(amountEl, amountEl.textContent, { duration: 950, intervalMs: 50 });
                setTimeout(() => card.classList.remove('expense-slot-highlight'), 900);
            }
        }
    });
};

window.filterRecentTransactions = function() {
    const wrap = document.getElementById('recentSearchWrap');
    const searchInput = document.getElementById('txSearch');
    if (wrap) wrap.classList.toggle('has-value', Boolean(searchInput?.value));
    window.renderRecentTransactions();
};

window.toggleRecentSearch = function(forceOpen = null) {
    const wrap = document.getElementById('recentSearchWrap');
    const input = document.getElementById('txSearch');
    const toggle = document.getElementById('recentSearchToggle');
    if (!wrap || !input) return;

    const shouldOpen = forceOpen === null ? !wrap.classList.contains('is-open') : Boolean(forceOpen);
    wrap.classList.toggle('is-open', shouldOpen);
    wrap.classList.toggle('has-value', Boolean(input.value));
    if (toggle) {
        toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        toggle.setAttribute('aria-label', shouldOpen ? 'Close transaction search' : 'Open transaction search');
    }

    if (shouldOpen) {
        requestAnimationFrame(() => input.focus());
    }
};

window.handleRecentSearchBlur = function() {
    const input = document.getElementById('txSearch');
    if (!input?.value) {
        window.toggleRecentSearch(false);
    }
};

window.filterTransactions = function(filterType) {
    window.currentTxFilter = normalizeRecentFilter(filterType);
    syncRecentFilterPills();

    window.renderRecentTransactions();
};

window.toggleRecentBulkMode = function() {
    window.isBulkMode = !window.isBulkMode;
    window.selectedTxIds.clear();
    window.renderRecentTransactions();
};

window.toggleTransactionSelection = function(txId, forceChecked = null) {
    const shouldSelect = forceChecked === null ? !window.selectedTxIds.has(txId) : Boolean(forceChecked);
    if (shouldSelect) {
        window.selectedTxIds.add(txId);
    } else {
        window.selectedTxIds.delete(txId);
    }
    window.renderRecentTransactions();
};

window.selectVisibleTransactions = function() {
    if (window.selectedTxIds.size > 0) {
        window.selectedTxIds.clear();
        window.renderRecentTransactions();
        return;
    }

    window.visibleRecentTxIds.forEach(id => window.selectedTxIds.add(id));
    window.renderRecentTransactions();
};

window.clearSelectedTransactions = function() {
    window.selectedTxIds.clear();
    window.renderRecentTransactions();
};

window.handleRecentCardClick = function(txId) {
    if (window.isBulkMode) {
        window.toggleTransactionSelection(txId);
        return;
    }
    window.openRecentOverviewPanel();
};

window.bulkDeleteRecentTransactions = function() {
    const count = window.selectedTxIds.size;
    if (count === 0) return;
    const deleted = deleteTransactionsByIds(
        [...window.selectedTxIds],
        `Delete ${count} selected transaction${count === 1 ? '' : 's'}? This cannot be undone.`
    );
    if (deleted) {
        window.isBulkMode = false;
        window.selectedTxIds.clear();
        window.renderRecentTransactions();
    }
};

window.deleteRecentTransaction = function(txId) {
    openRecentDeleteTransactionModal(txId);
};

window.removeTransaction = window.deleteRecentTransaction;

window.saveTransactionsHelper = function(txArray) {
    saveTransactionArray(txArray);
};

window.refreshActiveUI = function() {
    refreshRecentDependents();
};

window.openRecentOverviewPanel = function() {
    const panel = document.getElementById('recentOverviewPanel');
    const overlay = document.getElementById('recentOverviewOverlay');
    if (!panel || !overlay) return;

    renderRecentOverview(getFilteredRecentTransactions());
    panel.classList.add('active');
    overlay.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
};

window.closeRecentOverviewPanel = function() {
    const panel = document.getElementById('recentOverviewPanel');
    const overlay = document.getElementById('recentOverviewOverlay');
    if (!panel || !overlay) return;

    panel.classList.remove('active');
    overlay.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
};

window.openTxDetailPanel = function() {
    window.openRecentOverviewPanel();
};

window.closeTxDetailPanel = function() {
    window.closeRecentOverviewPanel();
};

window.closeDeleteTxModal = function() {
    clearInterval(deleteTxTimerInterval);
    deleteTxTimerInterval = null;
    pendingRecentDeleteTxId = '';
    if (typeof closeModal === 'function') closeModal('deleteTxModal');
    else document.getElementById('deleteTxModal')?.classList.remove('active');
};

window.executeTxDelete = function() {
    const txId = pendingRecentDeleteTxId;
    if (!txId) {
        window.closeDeleteTxModal();
        return;
    }

    const skipEl = document.getElementById('deleteTxSkipWarn');
    if (skipEl?.checked) {
        localStorage.setItem('bb_skip_tx_warn', 'true');
    }

    performDeleteTransactionsByIds([txId]);
    window.closeDeleteTxModal();
};

window.exportTransactions = function() {
    const txs = getRecentTransactions()
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

    if (txs.length === 0) {
        if (window.showToast) window.showToast('No transactions to export.');
        return;
    }

    const csvField = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = ['Date,Description,Category,Type,Amount,Tag,Payment Method,Notes,Server Logged UTC'];

    txs.forEach(tx => {
        rows.push([
            csvField(tx.date || ''),
            csvField(tx.description || tx.name || ''),
            csvField(tx.category || ''),
            csvField(tx.type || ''),
            csvField(tx.amount || 0),
            csvField(tx.tag || ''),
            csvField(tx.paymentMethod || ''),
            csvField(tx.notes || ''),
            csvField(getTransactionUtcTimestamp(tx))
        ].join(','));
    });

    const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BudgetBuddy_Transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    recordSyncEvent(`Exported ${txs.length} transaction${txs.length === 1 ? '' : 's'} to CSV.`, 'local');
    if (window.showToast) window.showToast('CSV export downloaded.');
};

function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            field += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(field);
            field = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(field);
            if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }

    row.push(field);
    if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
    return rows;
}

window.importTransactionsFromCSV = function(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const rows = parseCsvRows(String(reader.result || ''));
            if (rows.length < 2) throw new Error('No transaction rows found.');

            const headers = rows[0].map(header => String(header || '').trim().toLowerCase());
            const indexOf = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0);
            const indexes = {
                date: indexOf('date'),
                description: indexOf('description', 'name'),
                category: indexOf('category'),
                type: indexOf('type'),
                amount: indexOf('amount'),
                tag: indexOf('tag'),
                paymentMethod: indexOf('payment method', 'paymentmethod'),
                notes: indexOf('notes'),
                serverLoggedAtUTC: indexOf('server logged utc', 'serverloggedatutc', 'created utc', 'createdatutc', 'created at utc')
            };

            if (indexes.amount === undefined || indexes.amount < 0) {
                throw new Error('CSV must include an Amount column.');
            }

            const now = new Date().toISOString();
            const today = now.slice(0, 10);
            const imported = rows.slice(1).map((row, rowIndex) => {
                const get = (key) => indexes[key] >= 0 ? String(row[indexes[key]] || '').trim() : '';
                const rawAmount = get('amount').replace(/[^0-9.-]/g, '');
                const parsedAmount = parseFloat(rawAmount);
                if (!Number.isFinite(parsedAmount)) return null;

                const rawType = get('type').toLowerCase();
                const type = ['income', 'expense', 'savings', 'debt'].includes(rawType) ? rawType : 'expense';
                const tag = get('tag') || (type === 'savings' || type === 'debt' ? type : 'transaction');
                const rawDate = get('date');
                const date = rawDate && !Number.isNaN(Date.parse(rawDate)) ? rawDate : today;
                const rawUtc = get('serverLoggedAtUTC');
                const serverLoggedAtUTC = rawUtc && !Number.isNaN(Date.parse(rawUtc))
                    ? new Date(rawUtc).toISOString()
                    : now;

                return {
                    id: `tx_import_${Date.now()}_${rowIndex}_${Math.random().toString(36).slice(2, 8)}`,
                    type,
                    description: get('description') || 'Imported Transaction',
                    category: get('category'),
                    amount: Math.abs(parsedAmount),
                    date,
                    paymentMethod: get('paymentMethod'),
                    notes: get('notes'),
                    tag,
                    createdAt: serverLoggedAtUTC,
                    createdAtUTC: serverLoggedAtUTC,
                    serverLoggedAtUTC
                };
            }).filter(Boolean);

            if (imported.length === 0) throw new Error('No valid transaction rows found.');

            const existing = State.getTransactions ? State.getTransactions() : [];
            saveTransactionArray([...existing, ...imported]);
            observeLocalSave(`Imported ${imported.length} transaction${imported.length === 1 ? '' : 's'} and saved partially.`);
            if (window.showToast) window.showToast(`Imported ${imported.length} transaction${imported.length === 1 ? '' : 's'}.`);
            refreshRecentDependents();
        } catch (error) {
            console.error('[CSV Import]', error);
            recordSyncEvent(error.message || 'CSV import failed.', 'error');
            if (window.showToast) window.showToast(error.message || 'CSV import failed.');
        } finally {
            if (input) input.value = '';
        }
    };
    reader.readAsText(file);
};

// ==========================================
// 🏗️ PHASE 2 UNIFIED CREATE MODAL ENGINE
// ==========================================

let currentUnifiedType = 'expense';

// --- THE UI MORPH ENGINE (V1 Workflow - Expense/Income Only) ---
window.setUnifiedType = function(type) {
    currentUnifiedType = type;

    // 1. Reset Toggle Button Styles
    document.querySelectorAll('.type-btn-v2').forEach(btn => {
        btn.classList.remove('active-expense-v2', 'active-income-v2');
    });

    const activeBtn = document.getElementById(`btn${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if(activeBtn) activeBtn.classList.add(`active-${type}-v2`);

    // 2. Apply Theme & Text Changes
    const amountInput = document.getElementById('txAmount');
    const targetLabel = document.getElementById('txTargetLabel');
    const saveBtn = document.getElementById('submitBtn');
    const recurrenceBlock = document.getElementById('variantRecurrence');

    if (type === 'expense') {
        if (amountInput) amountInput.style.color = 'var(--text)';
        if (targetLabel) targetLabel.innerText = "Expense Category";
        if (saveBtn) saveBtn.innerText = "Save Expense";
        if (recurrenceBlock) recurrenceBlock.style.display = 'block';
    }
    else if (type === 'income') {
        if (amountInput) amountInput.style.color = 'var(--positive)';
        if (targetLabel) targetLabel.innerText = "Income Source";
        if (saveBtn) saveBtn.innerText = "Save Income";
        if (recurrenceBlock) recurrenceBlock.style.display = 'block';
    }

    // 3. Refresh the category chips to match the new type
    if (typeof window.populateCategoryChips === 'function') window.populateCategoryChips(type);
    if (typeof window.renderCircularBuffer === 'function') window.renderCircularBuffer(type);
};

// --- THE CIRCULAR BUFFER (Spec 3.2) ---
window.renderCircularBuffer = function(type) {
    const container = document.getElementById('smartSuggestionsRow');
    if (!container) return;

    // Pull from localStorage, or default to empty object
    const bufferData = JSON.parse(localStorage.getItem('bb_circular_buffer') || '{}');
    const typeBuffer = bufferData[type] || [];

    container.innerHTML = '';

    // Show up to 5 chips initially
    const displayChips = typeBuffer
        .map(desc => String(desc || '').trim())
        .filter(Boolean)
        .slice(0, 5);

    if (displayChips.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'none';
    const label = document.createElement('span');
    label.className = 'recently-used-label';
    label.textContent = 'Recently Used:';
    container.appendChild(label);

    displayChips.forEach(desc => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-pill';
        chip.innerText = desc;
        chip.onclick = () => {
            setTransactionDescription(desc);
            window.autoFillIcon(); // Trigger the smart icon mapping
        };
        container.appendChild(chip);
    });
};

window.saveToCircularBuffer = function(type, description) {
    if (!description) return;

    const bufferData = JSON.parse(localStorage.getItem('bb_circular_buffer') || '{}');
    let typeBuffer = bufferData[type] || [];

    // Remove if it already exists to prevent duplicates, then push to front
    typeBuffer = typeBuffer.filter(d => d.toLowerCase() !== description.toLowerCase());
    typeBuffer.unshift(description);

    // Enforce the 20-item limit per category
    if (typeBuffer.length > 20) {
        typeBuffer.pop(); // Remove the oldest
    }

    bufferData[type] = typeBuffer;
    localStorage.setItem('bb_circular_buffer', JSON.stringify(bufferData));
};

// --- SMART ICON AUTO-FILL (Spec 4.1 & 4.2) ---
window.autoFillIcon = function() {
    const descInput = document.getElementById('txDescription').value;
    const iconInput = document.getElementById('txIcon');

    // Uses your existing getIconFromName utility
    if (window.getIconFromName) {
        iconInput.value = window.getIconFromName(descInput);
    } else {
        if(iconInput) iconInput.value = '📁'; // Default Manila Folder
    }
};

// --- DEBT FREEDOM PLAN TOAST (Spec 3.6) ---
// Note: This logic belongs to the Debt Creation modal, not the Add Tab anymore.
window.calculateDebtTwoYearCheck = function() {
    const amount = parseFloat(document.getElementById('txAmount').value || 0); // Starting Balance
    const minPayment = parseFloat(document.getElementById('txDebtMin').value || 0);
    const toast = document.getElementById('debtTwoYearToast');

    if (toast && amount > 0 && minPayment > 0) {
        const months = amount / minPayment;
        if (months > 24) {
            const extraNeeded = (amount / 24) - minPayment;
            toast.innerText = `At this rate, it takes ${(months/12).toFixed(1)} years. Add extra $${extraNeeded.toFixed(0)}/mo to hit your 2-year goal!`;
            toast.style.display = 'block';
            return;
        }
    }
    if (toast) toast.style.display = 'none';
};

// ==========================================
// 🏗️ UNIFIED SUBMIT ENGINE
// ==========================================
window.submitUnifiedTransaction = function() {
    // 1. Gather Universal Fields
    const amountRaw = document.getElementById('txAmount').value;
    const amount = parseFloat(amountRaw.replace(/[^0-9.-]+/g, ""));
    const description = document.getElementById('txDescription').value.trim();

    // Fallback to 'Uncategorized' if the user didn't pick a chip
    const category = document.getElementById('txCategory').value || 'Uncategorized';
    const icon = document.getElementById('txIcon') ? document.getElementById('txIcon').value : '📁';

    // Default to today if left blank
    const dateInput = document.getElementById('txDateNative');
    const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    const paymentMethodNode = document.getElementById('txPaymentMethod');
    const paymentMethod = paymentMethodNode ? paymentMethodNode.value : '';

    const notesNode = document.getElementById('txNotes');
    const notes = notesNode ? notesNode.value.trim() : '';

    // Basic Validation
    if (isNaN(amount) || amount <= 0) {
        if (typeof showToast === 'function') showToast("Please enter a valid amount greater than 0.");
        return;
    }
    if (!description) {
        if (typeof showToast === 'function') showToast("Please enter a description.");
        return;
    }

    // 2. Build the Base Transaction Object
    const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        type: currentUnifiedType,
        amount: amount,
        description: description,
        category: category,
        icon: icon || '📁',
        date: date,
        paymentMethod: paymentMethod,
        notes: notes,
        tag: currentUnifiedType === 'savings' || currentUnifiedType === 'debt' ? currentUnifiedType : 'transaction',
        createdAt: new Date().toISOString(),
        isDeleted: false
    };

    // 3. Append Variant-Specific Fields (Only Expense/Income needed now)
    if (currentUnifiedType === 'expense' || currentUnifiedType === 'income') {
        const recurrenceNode = document.getElementById('txRecurrence');
        if (recurrenceNode && recurrenceNode.value) newTx.recurrence = recurrenceNode.value;
    }

    if (blockDebtLockedSavingsIncreaseIfNeeded(newTx)) return;

    // 4. Save to Circular Buffer
    if (typeof window.saveToCircularBuffer === 'function') {
        window.saveToCircularBuffer(currentUnifiedType, description);
    }

    // 5. Save to State / LocalStorage
    let txs = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    txs.push(newTx);

    if (typeof State !== 'undefined' && State.saveTransactions) {
        State.saveTransactions(txs);
    } else {
        localStorage.setItem('bb_transactions', JSON.stringify(txs));
    }

    // 6. UI Cleanup & Feedback
    const form = document.getElementById('addTxForm');
    if (form) {
        form.reset();
        initDescriptionRollover();
    }

    // --- RESET THE TEMPORARY DEBT OVERRIDE ---
    if (window.isTemporaryDebtMode) {
        const incomeBtn = document.getElementById('btnIncome');
        if (incomeBtn) incomeBtn.innerText = 'Income'; // Put it back to normal
        window.isTemporaryDebtMode = false;
    }

    // Reset UI to standard default
    if (typeof window.setUnifiedType === 'function') {
        window.setUnifiedType('expense');
    }

    if (typeof showToast === 'function') showToast(`✅ Transaction saved successfully!`);

    // Jump to recent tab to see the new entry
    if (typeof window.switchTab === 'function') window.switchTab('recent');
    if (typeof window.renderRecentTransactions === 'function') window.renderRecentTransactions();
};

// ==========================================
// 🔗 INVISIBLE PAYMENT SWITCH (Triggered from Debt Tab)
// ==========================================
window.triggerDebtPayment = function(debtName, minPaymentAmount) {
    // 1. Jump to the Add Tab
    if (typeof window.switchTab === 'function') window.switchTab('add');

    // 2. Temporarily hijack the "Income" button to say "Debt"
    const incomeBtn = document.getElementById('btnIncome');
    if (incomeBtn) {
        incomeBtn.innerText = 'Debt';
    }

    // 3. Force the form to behave as an Expense (money leaving checking)
    if (typeof window.setUnifiedType === 'function') window.setUnifiedType('expense');

    // 4. Pre-fill the transaction data
    const amountInput = document.getElementById('txAmount');
    const descInput = document.getElementById('txDescription');
    const catInput = document.getElementById('txCategory');

    if (amountInput) amountInput.value = minPaymentAmount || '';
    if (descInput) {
        setTransactionDescription("Payment: " + debtName);
        if (typeof window.autoFillIcon === 'function') window.autoFillIcon(); // Auto-grab the smart icon
    }
    if (catInput) catInput.value = debtName;

    // 5. Engage the override flag
    window.isTemporaryDebtMode = true;
};

// ==========================================
// 🏗️ PHASE 2 SAVINGS ENGINE
// ==========================================

const SAVINGS_INITIAL_RENDER = 10;
const SAVINGS_LAZY_BATCH = 5;
const SAVINGS_MAX_AUTO_RENDER = 25;

let currentSavingsVisibleCount = SAVINGS_INITIAL_RENDER;

// 1. The Intersection Observer (Safely Wrapped)
let savingsObserver = null;
if ('IntersectionObserver' in window) {
    savingsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.dataset.state === 'placeholder') {
                const categoryId = entry.target.dataset.id;
                // Swap skeleton for real content
                entry.target.innerHTML = generateSavingsCardHTML(categoryId);
                entry.target.dataset.state = 'loaded';
                entry.target.classList.remove('card-skeleton');
                savingsObserver.unobserve(entry.target);
            }
        });
    }, { rootMargin: '100px' });
}

// 2. The Main Render Engine
window.renderSavingsTab = function() {
    const grid = document.getElementById('savingsBucketsGrid') || document.getElementById('savingsGoalsGrid');
    const btnContainer = document.getElementById('loadMoreContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!grid) return;

    // A. The Math Aggregator
    const txs = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    const savingsTxs = txs.filter(tx => tx.tag === 'savings' || tx.type === 'savings');

    const totalSavings = savingsTxs.reduce((sum, tx) => {
        const amount = Math.abs(parseFloat(tx.amount) || 0);
        return sum + (tx.type === 'expense' ? -amount : amount);
    }, 0);
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const fundStage = getSavingsFundStage(totalSavings);
    const globalGoal = fundStage.goal;
    const countedSavings = fundStage.countedSavings;

    // Update Hero UI
    const currentSymbol = document.getElementById('savingsCurrentSymbol');
    const goalDisplay = document.getElementById('savingsGoalDisplay');
    const goalEdit = document.getElementById('emergencyGoalEdit');
    const goalSymbol = document.getElementById('emergencyGoalSymbol');
    renderSavingsFundTitle(fundStage);
    if (currentSymbol) currentSymbol.innerText = symbol;
    setSavingsCurrentAmountDisplay(countedSavings, { inputAmount: totalSavings });
    if (goalDisplay) goalDisplay.innerText = `${symbol}${formatMoney(globalGoal)}`;
    if (goalDisplay) goalDisplay.hidden = fundStage.isEmergencyFund;
    if (goalEdit) {
        goalEdit.hidden = !fundStage.isEmergencyFund;
        if (!fundStage.isEmergencyFund) setEmergencyFundGoalEditMode(false);
    }
    if (goalSymbol) goalSymbol.innerText = symbol;
    setEmergencyFundGoalDisplay(fundStage.emergencyGoal);
    applyDebtLockedSavingsState(fundStage);
    applyEmergencyFundValidationState(fundStage);

    const percent = globalGoal > 0 ? Math.min(Math.max((countedSavings / globalGoal) * 100, 0), 100) : 0;
    const progressBar = document.getElementById('globalSavingsBar');
    const progressText = document.getElementById('globalSavingsPercent');

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        progressBar.setAttribute('aria-valuetext', `${percent.toFixed(1)} percent funded`);
        progressBar.setAttribute('aria-label', fundStage.hasActiveDebt
            ? `Emergency fund progress capped at ${symbol}${formatMoney(STARTER_EMERGENCY_FUND_GOAL)} while active debt exists`
            : 'Emergency fund progress');
    }
    if (progressText) {
        progressText.innerText = `${percent.toFixed(1)}% Funded`;
    }

    // B. The Grid Renderer
    const categories = (typeof State !== 'undefined' && State.getCategories) ? State.getCategories() : JSON.parse(localStorage.getItem('bb_categories') || '[]');
    const savingsBuckets = categories.filter(c => ['savings', 'sinking_fund', 'external'].includes(c.type));
    const emergencyFundCard = createEmergencyFundCardElement(totalSavings, fundStage);

    grid.innerHTML = '';

    // --- EMPTY STATE HANDLER ---
    if (savingsBuckets.length === 0 && !emergencyFundCard) {
        if (btnContainer) btnContainer.style.display = 'none';

        // Note: Corrected onclick to match your design spec routing
        grid.innerHTML = `
            <div class="savings-empty-state">
                <div style="font-size: 3rem; animation: float 3s ease-in-out infinite;">💰</div>
                <div style="color: var(--text-dim);">No savings goals yet.<br>Create one to start tracking.</div>
                <button type="button" class="btn-create" onclick="window.openSavingsGoalModal()" style="margin-top: 1rem;">+ Create Savings Goal</button>
            </div>
        `;
        return;
    }

    if (emergencyFundCard) {
        grid.appendChild(emergencyFundCard);
    }

    const totalItems = savingsBuckets.length;
    let renderLimit = Math.min(SAVINGS_INITIAL_RENDER, totalItems);

    savingsBuckets.forEach((cat, index) => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'savings-goal-card';
        cardWrapper.dataset.id = cat.id;
        cardWrapper.setAttribute('role', 'button');
        cardWrapper.tabIndex = 0;
        cardWrapper.setAttribute('aria-label', `Open ${cat.name} savings goal`);

        // Standard drill-down routing
        const openSavingsCard = () => {
            if (typeof window.openCategoryDrillDown === 'function') {
                window.openCategoryDrillDown(cat.name, cat.icon);
            }
        };
        cardWrapper.onclick = openSavingsCard;
        cardWrapper.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openSavingsCard();
            }
        };

        if (index < renderLimit) {
            cardWrapper.innerHTML = generateSavingsCardHTML(cat.id, cat);
            cardWrapper.dataset.state = 'loaded';
        } else if (totalItems > SAVINGS_MAX_AUTO_RENDER && index >= SAVINGS_MAX_AUTO_RENDER) {
            return; // Hard cap
        } else {
            cardWrapper.dataset.state = 'placeholder';
            cardWrapper.classList.add('card-skeleton');
            if (savingsObserver) savingsObserver.observe(cardWrapper);
        }
        grid.appendChild(cardWrapper);
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'savings-action-row';
    actionRow.innerHTML = `
        <button type="button" class="btn-primary-dashed" onclick="window.openSavingsGoalModal()">+ Create Savings Goal</button>
    `;
    grid.appendChild(actionRow);

    // C. The Button Logic
    if (totalItems > SAVINGS_MAX_AUTO_RENDER && btnContainer && loadMoreBtn) {
        btnContainer.style.display = 'block';
        const remaining = totalItems - currentSavingsVisibleCount;
        loadMoreBtn.textContent = `Show ${Math.min(SAVINGS_LAZY_BATCH, remaining)} More`;
        loadMoreBtn.onclick = () => handleSavingsLoadMore(savingsBuckets, totalItems);
    } else if (btnContainer) {
        btnContainer.style.display = 'none';
    }
};

window.openSavingsGoalModal = function() {
    let existingModal = document.getElementById('savingsGoalModal');
    if (existingModal) existingModal.remove();

    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const modal = document.createElement('div');
    modal.id = 'savingsGoalModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-box modal-box-medium" role="dialog" aria-modal="true" aria-label="Create Savings Goal" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" onclick="window.closeSavingsGoalModal()" aria-label="Close savings goal form">&times;</button>
            <h3 class="modal-title mb-lg">Create Savings Goal</h3>

            <form id="savingsGoalForm" onsubmit="event.preventDefault(); window.saveSavingsGoal();">
                <div class="add-form-group mb-lg">
                    <label for="savingsGoalName">Savings Goal</label>
                    <input type="text" id="savingsGoalName" class="form-input" maxlength="24" placeholder="e.g., Vacation" autocomplete="off" required>
                </div>

                <div class="add-form-group mb-lg">
                    <label for="savingsGoalTarget">Target Amount</label>
                    <div class="budgeted-input-shell">
                        <span>${symbol}</span>
                        <input type="number" id="savingsGoalTarget" class="form-input" min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>

                <div class="add-form-group mb-lg">
                    <label for="savingsGoalIcon">Icon</label>
                    <input type="text" id="savingsGoalIcon" class="form-input icon-picker-trigger" placeholder="💰" maxlength="2" readonly inputmode="none" aria-label="Choose savings goal icon">
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="window.closeSavingsGoalModal()">Cancel</button>
                    <button type="submit" class="btn-create">Save</button>
                </div>
            </form>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) window.closeSavingsGoalModal();
    });

    document.body.appendChild(modal);
    syncOverlayScrollTopState();
    attachEmojiPicker('savingsGoalIcon');
    document.getElementById('savingsGoalName')?.focus();
};

window.closeSavingsGoalModal = function() {
    document.getElementById('savingsGoalModal')?.remove();
    syncOverlayScrollTopState();
};

window.saveSavingsGoal = function() {
    const nameInput = document.getElementById('savingsGoalName');
    const rawName = nameInput?.value.trim() || '';
    const name = cleanNameInput(rawName);
    const targetAmount = Math.max(0, parseFloat(document.getElementById('savingsGoalTarget')?.value) || 0);
    const icon = document.getElementById('savingsGoalIcon')?.value.trim() || '💰';

    if (!name) {
        if (window.showToast) window.showToast('Invalid savings goal. Use 1-24 characters, no line breaks.');
        return;
    }

    if (nameInput && name !== rawName) {
        nameInput.value = name;
    }

    const result = State.addSavingsGoal
        ? State.addSavingsGoal(name, icon, targetAmount)
        : State.addCategory(name, icon, 'savings', targetAmount);

    if (result && result.success === false) {
        if (window.showToast) window.showToast(result.error || 'Savings goal already exists.');
        return;
    }

    if (window.renderSavingsTab) window.renderSavingsTab();
    renderFormCategories();
    renderZBBDashboard();
    window.closeSavingsGoalModal();
    if (window.showToast) window.showToast(`Savings goal '${result.name || name}' created.`);
};

// 3. Card HTML Generator
function generateSavingsCardHTML(catId, catObj = null) {
    const categories = (typeof State !== 'undefined' && State.getCategories) ? State.getCategories() : JSON.parse(localStorage.getItem('bb_categories') || '[]');
    const cat = catObj || categories.find(c => c.id === catId);
    if (!cat) return '';

    // Card math
    const txs = (typeof State !== 'undefined' && State.getTransactions) ? State.getTransactions() : JSON.parse(localStorage.getItem('bb_transactions') || '[]');
    const symbol = State.getSymbol ? State.getSymbol() : '$';
    const bucketTxs = txs.filter(tx => tx.category === cat.name && (tx.tag === 'savings' || tx.type === 'savings'));
    const savedAmount = bucketTxs.reduce((sum, tx) => {
        const amount = Math.abs(parseFloat(tx.amount) || 0);
        return sum + (tx.type === 'expense' ? -amount : amount);
    }, 0);
    const targetAmount = cat.budget || 0; // 'budget' acts as the target for savings

    let progressHTML = '';
    if (targetAmount > 0) {
        const percent = Math.min(Math.max((savedAmount / targetAmount) * 100, 0), 100);
        progressHTML = `
            <div class="savings-card-progress" aria-hidden="true">
                <div class="savings-card-progress-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="savings-card-progress-label">${percent.toFixed(0)}% of ${symbol}${formatMoney(targetAmount)}</div>
        `;
    }

    return `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.5rem; background: var(--surface-hover); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${cat.icon || '💰'}</div>
            <div style="font-weight: 600; font-size: 1.05rem;">${esc(cat.name)}</div>
        </div>
        <div class="savings-card-amount">${symbol}${formatMoney(savedAmount)}</div>
        ${progressHTML}
    `;
}

// 4. Load More Handler
function handleSavingsLoadMore(allBuckets, totalItems) {
    const btnContainer = document.getElementById('loadMoreContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const grid = document.getElementById('savingsBucketsGrid') || document.getElementById('savingsGoalsGrid');
    if (!grid) return;

    const startIndex = currentSavingsVisibleCount;
    const endIndex = Math.min(startIndex + SAVINGS_LAZY_BATCH, totalItems);

    for (let i = startIndex; i < endIndex; i++) {
        const cat = allBuckets[i];
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'savings-goal-card';
        cardWrapper.dataset.id = cat.id;
        cardWrapper.dataset.state = 'loaded';
        cardWrapper.setAttribute('role', 'button');
        cardWrapper.tabIndex = 0;
        cardWrapper.setAttribute('aria-label', `Open ${cat.name} savings goal`);
        const openSavingsCard = () => {
            if (typeof window.openCategoryDrillDown === 'function') {
                window.openCategoryDrillDown(cat.name, cat.icon);
            }
        };
        cardWrapper.onclick = openSavingsCard;
        cardWrapper.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openSavingsCard();
            }
        };
        cardWrapper.innerHTML = generateSavingsCardHTML(cat.id, cat);
        grid.appendChild(cardWrapper);
        currentSavingsVisibleCount++;
    }

    if (currentSavingsVisibleCount >= totalItems && btnContainer) {
        btnContainer.style.display = 'none';
    } else if (loadMoreBtn) {
        const remaining = totalItems - currentSavingsVisibleCount;
        loadMoreBtn.textContent = `Show ${Math.min(SAVINGS_LAZY_BATCH, remaining)} More`;
    }
}

// ==========================================
// 🔌 THE RENDER TRIGGER HOOK
// ==========================================
// This ensures that clicking the Savings tab actually fires the engine.
// It wraps your existing switchTab function safely without breaking it.
if (typeof window.switchTab === 'function' && !window._savingsHookAdded) {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabName) {
        // Run your original UI switching logic first
        originalSwitchTab(tabName);

        // If they clicked Savings, fire the render engine
        if (tabName === 'savings') {
            window.renderSavingsTab();
        }
    };
    window._savingsHookAdded = true;
}

async function startMfaSetup() {
    // 1. Ask Supabase to generate the TOTP secret and QR code
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
    });

    if (enrollError) {
        console.error('MFA Enrollment failed:', enrollError.message);
        return;
    }

    const factorId = enrollData.id;
    const qrCodeSvg = enrollData.totp.qr_code;
    
    // THIS is the raw string you must expose to the user
    const masterRecoveryKey = enrollData.totp.secret; 

    // 2. Render this to your UI modal
    document.getElementById('mfa-qr-container').innerHTML = qrCodeSvg;
    document.getElementById('mfa-recovery-key-display').textContent = masterRecoveryKey;

    // Force the user to check a box acknowledging the risk before continuing
    document.getElementById('mfa-saved-checkbox').addEventListener('change', (e) => {
        document.getElementById('mfa-verify-btn').disabled = !e.target.checked;
    });

    // Store the factorId temporarily in state to use during verification
    window.pendingMfaFactorId = factorId;
}

export function repairViewportLayout() {
    clearTimeout(viewportRepairTimer);
    viewportRepairTimer = setTimeout(() => {
        document.documentElement.style.overflowX = 'clip';
        document.body.style.overflowX = 'clip';

        if (!document.body.classList.contains('ui-overlay-open')) {
            document.body.style.position = '';
            document.body.style.width = '';
        }

        const accountModal = document.getElementById('accountModal');
        if (accountModal && !accountModal.classList.contains('active')) {
            accountModal.style.removeProperty('--account-menu-top');
            accountModal.style.removeProperty('--account-menu-right');
        }
    }, 0);
}

function getCurrentUserAvatarUrl() {
    return window.currentUser?.user_metadata?.avatar_url
        || window.currentUser?.user_metadata?.picture
        || window.currentUser?.user_metadata?.photoURL
        || '';
}

function getCurrentUserAuthProviders() {
    const user = window.currentUser || {};
    const providers = new Set();

    if (typeof user.app_metadata?.provider === 'string') {
        providers.add(user.app_metadata.provider);
    }

    if (Array.isArray(user.app_metadata?.providers)) {
        user.app_metadata.providers.forEach(provider => {
            if (typeof provider === 'string') providers.add(provider);
        });
    }

    if (Array.isArray(user.identities)) {
        user.identities.forEach(identity => {
            if (typeof identity?.provider === 'string') providers.add(identity.provider);
        });
    }

    return providers;
}

function canCurrentUserResetPassword() {
    return getCurrentUserAuthProviders().has('email');
}

function syncAccountAuthProviderUi() {
    const passwordBtn = document.getElementById('accountPasswordBtn');
    if (passwordBtn) passwordBtn.hidden = !canCurrentUserResetPassword();
}

function showSessionClearingScreen(message = 'Clearing Session...', detail = 'Clearing this browser and refreshing BudgetBuddy.') {
    let overlay = document.getElementById('sessionClearingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sessionClearingOverlay';
        overlay.className = 'session-clearing-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-live', 'assertive');
        overlay.innerHTML = `
            <div class="session-clearing-card">
                <div class="session-clearing-orbit" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <h3 id="sessionClearingTitle">Clearing Session...</h3>
                <p id="sessionClearingDetail">Clearing this browser and refreshing BudgetBuddy.</p>
                <div class="session-clearing-progress" aria-hidden="true"><span></span></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const title = overlay.querySelector('#sessionClearingTitle');
    const detailEl = overlay.querySelector('#sessionClearingDetail');
    if (title) title.textContent = message;
    if (detailEl) detailEl.textContent = detail;
    overlay.classList.add('active');
    document.body.classList.add('session-clearing-active');
}

function hideSessionClearingScreen() {
    document.getElementById('sessionClearingOverlay')?.classList.remove('active');
    document.body.classList.remove('session-clearing-active');
}

function clearAccessibleCookies() {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    const hostParts = window.location.hostname.split('.');
    const domains = new Set(['', window.location.hostname]);
    for (let i = 0; i < hostParts.length - 1; i++) {
        domains.add(`.${hostParts.slice(i).join('.')}`);
    }

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const paths = new Set(['/']);
    let currentPath = '';
    pathParts.forEach(part => {
        currentPath += `/${part}`;
        paths.add(currentPath);
    });

    cookies.forEach(cookie => {
        const name = cookie.split('=')[0]?.trim();
        if (!name) return;
        domains.forEach(domain => {
            paths.forEach(path => {
                const domainPart = domain ? `; domain=${domain}` : '';
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}${domainPart}; SameSite=Lax`;
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}${domainPart}; SameSite=None; Secure`;
            });
        });
    });
}

function getTrustedBuddyCloudPreservedLocalStorage() {
    const userId = window.currentUser?.id;
    if (!userId) return [];

    const keys = [
        'bb_cloud_sync_enabled',
        `bb_cloud_key_${userId}`,
        `bb_cloud_sync_slot_${userId}`,
        `${BROWSER_ACCESS_TOKEN_PREFIX}${userId}`,
        `${RECOVERY_KEY_SAVED_PREFIX}${userId}`,
        `${RECOVERY_KEY_BACKED_UP_PREFIX}${userId}`,
        `${RECOVERY_KEY_GRACE_STARTED_PREFIX}${userId}`,
        `${BUDDY_CLOUD_RECENT_RESTORE_PREFIX}${userId}`
    ];

    return keys
        .filter(key => localStorage.getItem(key) !== null)
        .map(key => [key, localStorage.getItem(key)]);
}

function restorePreservedLocalStorage(entries = []) {
    entries.forEach(([key, value]) => {
        if (typeof key === 'string' && value !== null && value !== undefined) {
            localStorage.setItem(key, value);
        }
    });
}

function clearBudgetBuddyBrowserSessionState(options = {}) {
    const { preserveTrustedBuddyCloud = false, preservedLocalStorage = null } = options;
    const preservedEntries = preserveTrustedBuddyCloud
        ? preservedLocalStorage || getTrustedBuddyCloudPreservedLocalStorage()
        : [];

    try {
        localStorage.clear();
        restorePreservedLocalStorage(preservedEntries);
    } catch {
        clearBudgetBuddyLocalAccountState({ preserveTrustedBuddyCloud, preservedLocalStorage: preservedEntries });
    }

    try {
        sessionStorage.clear();
    } catch {
        // Session storage can be unavailable in some privacy modes.
    }

    clearAccessibleCookies();
}

function forceBudgetBuddyRefresh(target = 'index.html') {
    const url = new URL(target, window.location.href);
    url.searchParams.set('sessionCleared', String(Date.now()));
    window.location.replace(url.href);
}

function wait(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function clearBrowserSessionAndRefresh({ target = 'index.html', message = 'Clearing Session...', preserveTrustedBuddyCloud = false, preservedLocalStorage = null } = {}) {
    showSessionClearingScreen(
        message,
        preserveTrustedBuddyCloud
            ? 'Clearing budget data and signing out of this browser.'
            : 'Clearing local data, session storage, and browser cookies.'
    );
    await wait(3000);
    clearBudgetBuddyBrowserSessionState({ preserveTrustedBuddyCloud, preservedLocalStorage });
    await wait(450);
    forceBudgetBuddyRefresh(target);
}

function getUserInitial(email) {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    return cleanEmail ? cleanEmail.charAt(0).toUpperCase() : 'U';
}

function getAccountDisplayName(email) {
    const metadata = window.currentUser?.user_metadata || {};
    const rawName = metadata.full_name
        || metadata.name
        || metadata.display_name
        || metadata.preferred_username
        || String(email || '').split('@')[0]
        || 'there';
    return cleanNameInput(rawName) || 'there';
}

const ACCOUNT_WELCOME_TRANSLATIONS = [
    'Welcome',
    'Bienvenido',
    'Bienvenue',
    'Willkommen',
    'Benvenuto',
    'Bem-vindo',
    'Welkom',
    'Velkommen',
    'V\u00e4lkommen',
    'Tervetuloa',
    'Witamy',
    'V\u00edtejte',
    'Vitajte',
    'Bun venit',
    'Ho\u015f geldin',
    '\u039a\u03b1\u03bb\u03ce\u03c2 \u03ae\u03c1\u03b8\u03b5\u03c2',
    '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c',
    '\u041b\u0430\u0441\u043a\u0430\u0432\u043e \u043f\u0440\u043e\u0441\u0438\u043c\u043e',
    '\u0623\u0647\u0644\u0627\u064b \u0648\u0633\u0647\u0644\u0627\u064b',
    '\u05d1\u05e8\u05d5\u05da \u05d4\u05d1\u05d0',
    '\u0938\u094d\u0935\u093e\u0917\u0924 \u0939\u0948',
    '\u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae',
    '\u0a1c\u0a40 \u0a06\u0a07\u0a06\u0a02 \u0a28\u0a42\u0a70',
    '\u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f',
    '\u6b22\u8fce',
    '\u3088\u3046\u3053\u305d',
    '\ud658\uc601\ud569\ub2c8\ub2e4',
    'Ch\u00e0o m\u1eebng',
    '\u0e22\u0e34\u0e19\u0e14\u0e35\u0e15\u0e49\u0e2d\u0e19\u0e23\u0e31\u0e1a',
    'Selamat datang',
    'Maligayang pagdating',
    'Karibu',
    'K\u00e1\u00e0b\u1ecd\u0300',
    'Siyakwamukela',
    'F\u00e1ilte',
    'Croeso',
    'Aloha',
    'Tere tulemast',
    'Laipni l\u016bdzam',
    'Sveiki atvyk\u0119'
];
const ACCOUNT_WELCOME_LANGUAGES = new Map([
    ['Welcome', 'English'],
    ['Bienvenido', 'Spanish'],
    ['Bienvenue', 'French'],
    ['Willkommen', 'German'],
    ['Benvenuto', 'Italian'],
    ['Bem-vindo', 'Portuguese'],
    ['Welkom', 'Dutch'],
    ['Velkommen', 'Norwegian/Danish'],
    ['V\u00e4lkommen', 'Swedish'],
    ['Tervetuloa', 'Finnish'],
    ['Witamy', 'Polish'],
    ['V\u00edtejte', 'Czech'],
    ['Vitajte', 'Slovak'],
    ['Bun venit', 'Romanian'],
    ['Ho\u015f geldin', 'Turkish'],
    ['\u039a\u03b1\u03bb\u03ce\u03c2 \u03ae\u03c1\u03b8\u03b5\u03c2', 'Greek'],
    ['\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c', 'Russian'],
    ['\u041b\u0430\u0441\u043a\u0430\u0432\u043e \u043f\u0440\u043e\u0441\u0438\u043c\u043e', 'Ukrainian'],
    ['\u0623\u0647\u0644\u0627\u064b \u0648\u0633\u0647\u0644\u0627\u064b', 'Arabic'],
    ['\u05d1\u05e8\u05d5\u05da \u05d4\u05d1\u05d0', 'Hebrew'],
    ['\u0938\u094d\u0935\u093e\u0917\u0924 \u0939\u0948', 'Hindi'],
    ['\u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae', 'Bengali'],
    ['\u0a1c\u0a40 \u0a06\u0a07\u0a06\u0a02 \u0a28\u0a42\u0a70', 'Punjabi'],
    ['\u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f', 'Persian'],
    ['\u6b22\u8fce', 'Chinese'],
    ['\u3088\u3046\u3053\u305d', 'Japanese'],
    ['\ud658\uc601\ud569\ub2c8\ub2e4', 'Korean'],
    ['Ch\u00e0o m\u1eebng', 'Vietnamese'],
    ['\u0e22\u0e34\u0e19\u0e14\u0e35\u0e15\u0e49\u0e2d\u0e19\u0e23\u0e31\u0e1a', 'Thai'],
    ['Selamat datang', 'Indonesian/Malay'],
    ['Maligayang pagdating', 'Filipino/Tagalog'],
    ['Karibu', 'Swahili'],
    ['K\u00e1\u00e0b\u1ecd\u0300', 'Yoruba'],
    ['Siyakwamukela', 'Zulu'],
    ['F\u00e1ilte', 'Irish'],
    ['Croeso', 'Welsh'],
    ['Aloha', 'Hawaiian'],
    ['Tere tulemast', 'Estonian'],
    ['Laipni l\u016bdzam', 'Latvian'],
    ['Sveiki atvyk\u0119', 'Lithuanian']
]);
const ACCOUNT_WELCOME_ROTATE_MS = 30000;
const ACCOUNT_WELCOME_RECENT_LIMIT = 12;
let accountWelcomeTimer = null;
let accountWelcomeGreeting = ACCOUNT_WELCOME_TRANSLATIONS[0];
let accountWelcomeRecent = [];
let accountWelcomeBag = [];

function shuffleAccountWelcomeItems(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
    }
    return items;
}

function refillAccountWelcomeBag() {
    const blockedGreetings = new Set(accountWelcomeRecent);
    accountWelcomeBag = ACCOUNT_WELCOME_TRANSLATIONS.filter(greeting => !blockedGreetings.has(greeting));
    if (!accountWelcomeBag.length) {
        accountWelcomeBag = ACCOUNT_WELCOME_TRANSLATIONS.filter(greeting => greeting !== accountWelcomeGreeting);
    }
    shuffleAccountWelcomeItems(accountWelcomeBag);
}

function rememberAccountWelcomeGreeting(greeting) {
    accountWelcomeRecent.push(greeting);
    if (accountWelcomeRecent.length > ACCOUNT_WELCOME_RECENT_LIMIT) {
        accountWelcomeRecent = accountWelcomeRecent.slice(-ACCOUNT_WELCOME_RECENT_LIMIT);
    }
}

function getNextAccountWelcomeGreeting({ reset = false } = {}) {
    if (reset) {
        accountWelcomeGreeting = ACCOUNT_WELCOME_TRANSLATIONS[0];
        accountWelcomeRecent = [accountWelcomeGreeting];
        accountWelcomeBag = [];
        return accountWelcomeGreeting;
    }

    if (!accountWelcomeBag.length) {
        refillAccountWelcomeBag();
    }

    accountWelcomeGreeting = accountWelcomeBag.shift() || ACCOUNT_WELCOME_TRANSLATIONS[0];
    rememberAccountWelcomeGreeting(accountWelcomeGreeting);
    return accountWelcomeGreeting;
}

function renderAccountWelcomeTitle(titleEl, greeting, displayName) {
    const nextText = `${greeting}, ${displayName}`;
    const language = ACCOUNT_WELCOME_LANGUAGES.get(greeting) || 'translated';
    const tooltip = `${language} greeting`;
    const greetingEl = document.createElement('span');
    greetingEl.className = 'account-welcome-word';
    greetingEl.textContent = greeting;
    greetingEl.setAttribute('data-tooltip', tooltip);
    titleEl.replaceChildren(greetingEl, document.createTextNode(`, ${displayName}`));
    titleEl.setAttribute('aria-label', nextText);
}

function updateAccountWelcomeTitle(titleEl, email, greeting, { fade = false } = {}) {
    if (!titleEl) return;
    const displayName = getAccountDisplayName(email);

    if (!fade) {
        titleEl.classList.remove('is-welcome-fading');
        renderAccountWelcomeTitle(titleEl, greeting, displayName);
        return;
    }

    titleEl.classList.add('is-welcome-fading');
    setTimeout(() => {
        renderAccountWelcomeTitle(titleEl, greeting, displayName);
        titleEl.classList.remove('is-welcome-fading');
    }, 260);
}

function startAccountWelcomeRotation(email) {
    const titleEl = document.getElementById('accountModalTitle');
    stopAccountWelcomeRotation();
    updateAccountWelcomeTitle(titleEl, email, getNextAccountWelcomeGreeting({ reset: true }));
    accountWelcomeTimer = setInterval(() => {
        updateAccountWelcomeTitle(titleEl, email, getNextAccountWelcomeGreeting(), { fade: true });
    }, ACCOUNT_WELCOME_ROTATE_MS);
}

function stopAccountWelcomeRotation() {
    if (accountWelcomeTimer) {
        clearInterval(accountWelcomeTimer);
        accountWelcomeTimer = null;
    }
    document.getElementById('accountModalTitle')?.classList.remove('is-welcome-fading');
}

function getAccountTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return { label: 'Coffee budgeter', icon: 'coffee' };
    if (hour < 18) return { label: 'Midday money', icon: 'sun' };
    return { label: 'Night budgeter', icon: 'moon' };
}

function getAccountTimeGreetingIcon(icon) {
    if (icon === 'coffee') {
        return '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z"></path><path d="M16 9h2a3 3 0 0 1 0 6h-2"></path><path d="M6 3v2"></path><path d="M10 3v2"></path><path d="M14 3v2"></path></svg>';
    }
    if (icon === 'moon') {
        return '<svg viewBox="0 0 24 24" focusable="false"><path d="M20 14.2A7.4 7.4 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path></svg>';
}

function renderAccountTimeGreeting(container, greeting) {
    if (!container) return;
    container.setAttribute('aria-label', greeting.label);
    container.classList.toggle('is-night', greeting.icon === 'moon');
    container.classList.toggle('is-coffee', greeting.icon === 'coffee');
    container.classList.toggle('is-midday', greeting.icon === 'sun');
    container.innerHTML = `
        <span class="account-time-greeting-icon is-${esc(greeting.icon)}" aria-hidden="true">${getAccountTimeGreetingIcon(greeting.icon)}</span>
        <span class="account-time-greeting-text">${esc(greeting.label)}</span>
    `;
}

function createAvatarFallback(initial, className = 'user-avatar') {
    const avatar = document.createElement('div');
    avatar.className = className;
    avatar.textContent = initial;
    return avatar;
}

function appendAvatarImage(container, avatarUrl, className) {
    const avatar = document.createElement('img');
    avatar.src = avatarUrl;
    avatar.alt = '';
    avatar.className = `${className} is-loading`;
    avatar.referrerPolicy = 'strict-origin-when-cross-origin';
    avatar.addEventListener('load', () => {
        avatar.classList.remove('is-loading');
        avatar.classList.add('is-loaded');
    }, { once: true });
    avatar.addEventListener('error', () => {
        avatar.remove();
    }, { once: true });
    container.appendChild(avatar);
    return avatar;
}

function renderAccountModalAvatar(container, email, avatarUrl) {
    if (!container) return;
    const initial = getUserInitial(email);
    container.replaceChildren();
    container.classList.add('account-modal-avatar');
    container.setAttribute('aria-label', `Signed in as ${email || 'BudgetBuddy user'}`);
    container.setAttribute('data-tooltip', email || 'Signed in account');
    container.removeAttribute('title');
    container.tabIndex = 0;

    container.appendChild(createAvatarFallback(initial, 'account-modal-avatar-fallback'));
    if (avatarUrl) appendAvatarImage(container, avatarUrl, 'account-modal-avatar-img');
}

// Render the Login / Avatar Button
export function updateAuthUI() {
    const authContainer = document.querySelector('.auth-buttons');
    if (!authContainer) {
        console.warn("[UI] .auth-buttons container not found in DOM. Cannot render avatar.");
        return;
    }

    authContainer.replaceChildren();

    if (window.currentUser) {
        // User is Logged In
        const email = window.currentUser.email || 'User';
        const avatarUrl = getCurrentUserAvatarUrl();
        const initial = getUserInitial(email);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-avatar';
        button.dataset.tooltip = 'Account';
        button.dataset.accountEmail = email;
        button.setAttribute('aria-label', `Open account menu for ${email}`);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', openAccountModal);

        const avatarStack = document.createElement('span');
        avatarStack.className = 'user-avatar-stack';
        avatarStack.appendChild(createAvatarFallback(initial));
        if (avatarUrl) appendAvatarImage(avatarStack, avatarUrl, 'user-avatar-img');
        button.appendChild(avatarStack);

        // Replace the "Log In" button with the Avatar (which acts as Logout for now)
        authContainer.appendChild(button);
    } else {
        // User is Logged Out
        const loginLink = document.createElement('a');
        loginLink.href = 'login.html';
        loginLink.className = 'btn-text login-cta';
        loginLink.dataset.tooltip = 'Sign In';
        loginLink.innerHTML = `
            <span class="login-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path></svg>
            </span>
            <span>Sign In</span>
        `;
        authContainer.appendChild(loginLink);
    }

    syncBillingUi();
    syncAccountRecoveryUi();
    syncAccountAuthProviderUi();
    repairViewportLayout();
}

export function openAccountModal(e) {
    if (e) e.preventDefault();

    const email = window.currentUser?.email || 'Signed in';
    const avatarUrl = getCurrentUserAvatarUrl();
    const modal = document.getElementById('accountModal');
    const anchor = e?.currentTarget || document.querySelector('.btn-avatar');
    const emailEl = document.getElementById('accountModalEmail');
    const titleEl = document.getElementById('accountModalTitle');
    const avatarEl = document.getElementById('accountModalAvatar');
    const timeGreetingDockEl = document.getElementById('accountTimeGreetingDock');

    if (modal?.classList.contains('active')) {
        closeAccountModal();
        return;
    }

    if (emailEl) {
        emailEl.textContent = email;
        emailEl.hidden = true;
    }
    const greeting = getAccountTimeGreeting();
    renderAccountTimeGreeting(timeGreetingDockEl, greeting);
    if (titleEl) startAccountWelcomeRotation(email);
    renderAccountModalAvatar(avatarEl, email, avatarUrl);

    syncBillingUi();
    syncAccountRecoveryUi();
    syncAccountAuthProviderUi();
    repairViewportLayout();

    if (modal && anchor) {
        const rect = anchor.getBoundingClientRect();
        const headerRect = document.querySelector('.app-header')?.getBoundingClientRect();
        const top = headerRect ? headerRect.bottom + 8 : rect.bottom + 8;
        modal.style.setProperty('--account-menu-top', `${Math.round(top)}px`);
        modal.style.setProperty('--account-menu-right', `${Math.max(12, Math.round(window.innerWidth - rect.right))}px`);
    }

    anchor?.classList.add('is-menu-open');
    anchor?.setAttribute('aria-expanded', 'true');
    modal?.classList.add('active');
}

export function closeAccountModal() {
    stopAccountWelcomeRotation();
    document.getElementById('accountModal')?.classList.remove('active');
    document.querySelectorAll('.btn-avatar').forEach(button => {
        button.classList.remove('is-menu-open');
        button.setAttribute('aria-expanded', 'false');
    });
}

document.addEventListener('pointerdown', (event) => {
    const modal = document.getElementById('accountModal');
    if (!modal?.classList.contains('active')) return;

    const target = event.target;
    const modalBox = modal.querySelector('.modal-box');
    if (modalBox?.contains(target)) return;
    if (target instanceof Element && target.closest('.btn-avatar')) return;

    closeAccountModal();
}, true);

export function handleUpgradeToPremium() {
    return startStripeCheckout();
}

function closeAccountConfirmModal() {
    document.getElementById('accountConfirmModal')?.remove();
}

function showAccountConfirmModal({
    title,
    message,
    note = '',
    confirmLabel,
    confirmClass = 'btn-create',
    onConfirm
}) {
    closeAccountConfirmModal();

    const modal = document.createElement('div');
    modal.id = 'accountConfirmModal';
    modal.className = 'modal-overlay active account-confirm-modal';
    modal.innerHTML = `
        <div class="modal-box modal-box-medium" role="dialog" aria-modal="true" aria-labelledby="accountConfirmTitle" onclick="event.stopPropagation()">
            <button type="button" class="modal-close" aria-label="Close confirmation">&times;</button>
            <div class="account-confirm-content">
                <h3 id="accountConfirmTitle" class="modal-title">${esc(title)}</h3>
                <p class="account-confirm-message">${esc(message)}</p>
                ${note ? `<div class="warning-box account-confirm-note"><p>${esc(note)}</p></div>` : ''}
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel account-confirm-cancel">Cancel</button>
                <button type="button" class="${esc(confirmClass)} account-confirm-action">${esc(confirmLabel)}</button>
            </div>
        </div>
    `;

    const close = () => closeAccountConfirmModal();
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.querySelector('.account-confirm-cancel')?.addEventListener('click', close);
    modal.querySelector('.account-confirm-action')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
            await onConfirm?.();
        } catch (err) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            if (window.showToast) window.showToast(err?.message || 'Something went wrong.');
        }
    });

    document.body.appendChild(modal);
    modal.querySelector('.account-confirm-cancel')?.focus();
}

export function handleResetPassword(e) {
    if (e) e.preventDefault();
    if (!canCurrentUserResetPassword()) {
        if (window.showToast) window.showToast('Password reset is not available for OAuth-only sign-ins.');
        return;
    }

    const email = window.currentUser?.email;
    if (!email) {
        if (window.showToast) window.showToast('No signed-in email found.');
        return;
    }

    if (!window.sb?.auth?.resetPasswordForEmail) {
        if (window.showToast) window.showToast('Password reset is not available.');
        return;
    }

    closeAccountModal();
    showAccountConfirmModal({
        title: 'Reset password?',
        message: `Send a password reset email to ${email}.`,
        note: 'Only continue if you requested this change. Use the newest reset email and ignore older reset links.',
        confirmLabel: 'Send reset email',
        confirmClass: 'btn-create',
        onConfirm: executePasswordReset
    });
}

async function executePasswordReset() {
    const email = window.currentUser?.email;
    if (!email) {
        closeAccountConfirmModal();
        if (window.showToast) window.showToast('No signed-in email found.');
        return;
    }

    const { error } = await window.sb.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('login.html', window.location.href).href
    });

    if (error) {
        throw new Error(error.message || 'Could not send password reset email.');
    }

    closeAccountConfirmModal();
    if (window.showToast) window.showToast(`Password reset email sent to ${email}.`);
}

async function invokeAccountDeleteFunction() {
    if (!window.sb?.functions?.invoke || !window.currentUser) {
        throw new Error('Please sign in before resetting Buddy Cloud.');
    }

    const { data, error } = await window.sb.functions.invoke(ACCOUNT_DELETE_FUNCTION, {
        body: { deleteAuthUser: false }
    });
    if (error) {
        const message = await readSupabaseFunctionError(error, 'Buddy Cloud reset is temporarily unavailable. Please try again.');
        throw new Error(message);
    }

    return data || {};
}

async function askDeleteAccountConfirmation() {
    const result = await showBuddyCloudModal({
        eyebrow: 'Account Security',
        title: 'Reset Buddy Cloud?',
        body: 'Use this only when the recovery key is lost and you need to start Buddy Cloud over for this sign-in.',
        assurance: 'This removes the encrypted Buddy Cloud vault and encrypted version-history snapshots from Supabase. Your Supabase login stays active, and BudgetBuddy cannot decrypt or recover the old cloud budget.',
        warning: 'This is permanent. BudgetBuddy will clear this browser back to a blank state. Your next Buddy Cloud setup will create a new encrypted vault and a new recovery key.',
        inputLabel: 'Type DELETE to confirm',
        inputPlaceholder: 'DELETE',
        inputSingleLine: true,
        inputAutoUppercase: true,
        actions: [
            { id: 'cancel', label: 'Back', className: 'btn-cancel' },
            { id: 'delete', label: 'Reset Buddy Cloud', className: 'btn-danger' }
        ]
    });

    if (result.action !== 'delete') return false;
    if (result.value.toUpperCase() !== 'DELETE') {
        if (window.showToast) window.showToast('Type DELETE to confirm Buddy Cloud reset.');
        return false;
    }

    return true;
}

export async function handleDeleteAccount(e) {
    if (e) e.preventDefault();
    closeAccountModal();

    const confirmed = await askDeleteAccountConfirmation();
    if (!confirmed) return false;

    showSessionClearingScreen('Clearing Session...', 'Resetting Buddy Cloud and clearing this browser.');
    try {
        await invokeAccountDeleteFunction();
        try {
            await window.sb?.auth?.signOut?.();
        } catch {
            // Continue clearing this browser even if the local session is already invalid.
        }
        document.getElementById('buddyCloudModal')?.remove();
        await clearBrowserSessionAndRefresh({ target: 'login.html?buddyCloud=reset', message: 'Clearing Session...' });
        return true;
    } catch (err) {
        hideSessionClearingScreen();
        if (window.showToast) window.showToast(err?.message || 'Could not reset Buddy Cloud.');
        return false;
    }
}

// Handle Log Out Action
export function handleLogout(e) {
    if (e) e.preventDefault();
    const cloudStatus = window.BuddyCloud?.getStatus?.() || {};
    const needsRecoveryKeyBackup = Boolean(cloudStatus.enabled && cloudStatus.hasKey && !hasRecoveryKeyBackedUpFlag());
    closeAccountModal();
    showAccountConfirmModal({
        title: 'Log out?',
        message: 'You will be signed out of BudgetBuddy.',
        note: needsRecoveryKeyBackup
            ? 'This trusted browser keeps its Buddy Cloud recovery key for your next login. Still save a backup copy somewhere safe.'
            : '',
        confirmLabel: 'Secure Sign Out',
        confirmClass: 'btn-danger',
        onConfirm: executeLogout
    });
}

function clearBudgetBuddyLocalAccountState(options = {}) {
    const { preserveTrustedBuddyCloud = false, preservedLocalStorage = null } = options;
    const preservedEntries = preserveTrustedBuddyCloud
        ? preservedLocalStorage || getTrustedBuddyCloudPreservedLocalStorage()
        : [];

    [
        'bb_data',
        'bb_local_updated_at',
        'bb_sync_history',
        'bb_transactions',
        'bb_categories',
        'bb_custom_categories',
        'bb_circular_buffer',
        'bb_cloud_sync_enabled',
        'bb_cloud_last_pushed_at',
        'bb_cloud_last_remote_at',
        'bb_cloud_last_error',
        'bb_cloud_conflict_remote_at',
        'bb_cloud_conflict_local_at',
        'bb_cloud_conflict_last_synced_at',
        'bb_cloud_device_id',
        'bb_skip_cat_warn',
        'bb_skip_income_warn',
        'bb_skip_tx_warn',
        'bb_pro_status',
        'bb_premium_active',
        'bb_stripe_checkout_session_id',
        'bb_premium_activated_at',
        'bb_stripe_redirect_acknowledged'
    ].forEach(key => localStorage.removeItem(key));

    Object.keys(localStorage)
        .filter(key => key.startsWith('bb_cloud_key_') || key.startsWith('bb_cloud_sync_slot_') || key.startsWith(BROWSER_ACCESS_TOKEN_PREFIX) || key.startsWith(RECOVERY_KEY_SAVED_PREFIX) || key.startsWith(RECOVERY_KEY_BACKED_UP_PREFIX) || key.startsWith(RECOVERY_KEY_GRACE_STARTED_PREFIX) || key.startsWith(BUDDY_CLOUD_RECENT_RESTORE_PREFIX))
        .forEach(key => localStorage.removeItem(key));

    restorePreservedLocalStorage(preservedEntries);
}

async function verifyBuddyCloudBeforeLogout() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    if (!status.signedIn || !status.enabled || !status.hasKey || !status.canUseCloud) return;
    await window.BuddyCloud.forcePush();
}

async function requireRecoveryKeySavedBeforeLocalClear() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    if (!status.enabled || !status.hasKey) return true;
    if (hasRecoveryKeyBackedUpFlag()) return true;

    const recoveryKey = window.BuddyCloud?.exportRecoveryKey?.();
    if (!recoveryKey) return true;

    return showRecoveryKeyNotice(recoveryKey, {
        copied: false,
        initial: false,
        requireDownload: true
    });
}

async function executeLogout() {
    const preservedLocalStorage = getTrustedBuddyCloudPreservedLocalStorage();
    closeAccountConfirmModal();
    closeAccountModal();
    showSessionClearingScreen('Clearing Session...', 'Signing out and clearing the budget screen.');
    try {
        await verifyBuddyCloudBeforeLogout();
        if (window.sb) {
            await window.sb.auth.signOut();
        }
        await clearBrowserSessionAndRefresh({
            target: 'index.html',
            message: 'Clearing Session...',
            preserveTrustedBuddyCloud: true,
            preservedLocalStorage
        });
    } catch (error) {
        hideSessionClearingScreen();
        throw error;
    }
}

// ==========================================
// BIND GLOBAL FUNCTIONS
// ==========================================
window.render = render;
window.renderFormCategories = renderFormCategories;
window.selectFormCategory = selectFormCategory;
window.useSuggestion = useSuggestion;
window.toggleTxDetails = toggleTxDetails;
window.numpadInput = numpadInput;
window.numpadDelete = numpadDelete;
window.undoLastTransaction = undoLastTransaction;
window.toggleQuickAddScroller = toggleQuickAddScroller;
window.proceedToDelete = proceedToDelete;
window.handleReassignConfirm = handleReassignConfirm;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.handleUpgradeToPremium = handleUpgradeToPremium;
window.startStripeCheckout = startStripeCheckout;
window.handleStripeCheckoutReturn = handleStripeCheckoutReturn;
window.handleManageSubscription = handleManageSubscription;
window.refreshPremiumAccess = refreshPremiumAccess;
window.setPremiumAccess = setPremiumAccess;
window.showPremiumSuccessModal = showPremiumSuccessModal;
window.repairViewportLayout = repairViewportLayout;
window.refreshBrowserAccessRegistry = refreshBrowserAccessRegistry;
window.handleBuddyCloudRecoveryHelp = handleBuddyCloudRecoveryHelp;
window.handleBuddyCloudVersionHistory = handleBuddyCloudVersionHistory;
window.handleResetPassword = handleResetPassword;
window.handleAccountDiagnostics = handleAccountDiagnostics;
window.handleAccountSettings = handleAccountSettings;
window.handleAccountSupport = handleAccountSupport;
window.handleDeleteAccount = handleDeleteAccount;
window.handleLogout = handleLogout;
window.closeDeleteCategoryModal = closeDeleteCategoryModal;
window.closeDeleteIncomeSourceModal = closeDeleteIncomeSourceModal;
window.executeIncomeSourceDelete = executeIncomeSourceDelete;
window.openReassignModal = openReassignModal;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.saveCategory = saveCategory;
window.removeCategory = removeCategory;
window.removeIncomeSource = removeIncomeSource;
window.toggleCategoryEditMode = toggleCategoryEditMode;
window.toggleCategorySelection = toggleCategorySelection;
window.executeBulkDelete = executeBulkDelete;
window.confirmBulkDelete = confirmBulkDelete;
window.cancelBulkDelete = cancelBulkDelete;
window.openBatchIconPicker = openBatchIconPicker;
window.confirmBatchIcon = confirmBatchIcon;
window.cancelBatchIcon = cancelBatchIcon;
window.quickAddCategory = quickAddCategory;
window.quickAddSavings = quickAddSavings;
window.openSavingsAddModal = openSavingsAddModal;
window.applyCategorySort = applyCategorySort;
window.closeModalOnOutsideClick = closeModalOnOutsideClick;
window.closeModal = closeModal;
window.openModal = openModal;
window.switchTab = switchTab;
window.closeMobileAddOverlay = closeMobileAddOverlay;
window.setType = setType;
window.showToast = showToast;
window.toggleZBBSummary = toggleZBBSummary;
window.submitTransaction = submitTransaction;
window.handleDateChange = handleDateChange;
window.setAddTransactionDate = setAddTransactionDate;
window.openAddDatePicker = openAddDatePicker;
window.initAddTransactionForm = initAddTransactionForm;
window.hardResetForm = hardResetForm;
window.initCategoryUI = initCategoryUI;
window.quickLogIncome = quickLogIncome;
window.openCustomIncomeModal = openCustomIncomeModal;
window.openAddSourceModal = openAddSourceModal;
window.toggleBulkMode = toggleBulkMode;
window.handleCardClick = handleCardClick;
window.bulkDeleteTransactions = bulkDeleteTransactions;
window.bulkMoveTransactions = bulkMoveTransactions;
