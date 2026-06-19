// js/demoMode.js

const DEMO_DURATION_MS = 5 * 60 * 1000;
const DEMO_QUERY_PARAM = 'demo';
const BB_DATA_KEY = 'bb_data';
const BB_LOCAL_UPDATED_AT_KEY = 'bb_local_updated_at';
const ACTIVE_KEY = 'bb_demo_active';
const STARTED_AT_KEY = 'bb_demo_started_at';
const EXPIRES_AT_KEY = 'bb_demo_expires_at';
const BACKUP_HAS_DATA_KEY = 'bb_demo_backup_has_data';
const BACKUP_DATA_KEY = 'bb_demo_backup_bb_data';
const BACKUP_UPDATED_AT_KEY = 'bb_demo_backup_local_updated_at';
const BACKUP_CREATED_AT_KEY = 'bb_demo_backup_created_at';
const ENDED_NOTICE_KEY = 'bb_demo_ended_notice';
const ACCOUNT_PROMPT_DISMISSED_KEY = 'bb_demo_account_prompt_dismissed';
const TUTORIAL_SKIPPED_KEY = 'bb_demo_tutorial_skipped';
const BANNER_MINIMIZED_KEY = 'bb_demo_banner_minimized';
const BANNER_ID = 'bbDemoModeBanner';
const MODAL_ID = 'bbDemoEndedModal';
const ACCOUNT_PROMPT_BANNER_ID = 'bbAccountPromptBanner';
const ACCOUNT_PROMPT_ID = 'bbDemoAccountPrompt';
const SIGNED_IN_PROMPT_ID = 'bbDemoSignedInPrompt';
const SIGNED_IN_PROMPT_TITLE_ID = 'bbDemoSignedInPromptTitle';
const SIGNED_IN_PROMPT_BODY_ID = 'bbDemoSignedInPromptBody';
const TUTORIAL_ID = 'bbDemoTutorial';
const TUTORIAL_SPOTLIGHT_ID = 'bbDemoTutorialSpotlight';
const TUTORIAL_SCRIM_ID = 'bbDemoTutorialScrim';
const STYLE_ID = 'bbDemoModeStyles';
const MAIN_SITE_URL = 'https://zambudget.com';
const ACCOUNT_PROMPT_DELAY_MS = 30 * 1000;

let countdownTimer = null;
let loginCaptureAttached = false;
let tutorialIndex = 0;
let tutorialResizeAttached = false;
let accountPromptTimer = null;

const TUTORIAL_STEPS = [
    {
        selector: '.app-header',
        label: 'Nav Bar',
        title: 'Start with the nav bar',
        body: 'Switch themes, open settings, check Cloud Sync status, and sign in when you are ready to protect a real budget.'
    },
    {
        selector: '#zbbSummaryCard',
        label: 'Snapshot',
        title: 'Scan the budget snapshot',
        body: 'This is the quick read on income, assigned dollars, and money still waiting for a job.'
    },
    {
        selector: '.category-panel',
        label: 'Categories',
        title: 'Shape categories your way',
        body: 'Create, edit, sort, and budget categories without being forced into someone else\'s system.'
    },
    {
        selector: '.command-tabs',
        label: 'Workflows',
        title: 'Move through the core tools',
        body: 'Income, savings, debt, add, and recent activity are grouped here so the app stays fast to navigate.'
    },
    {
        selector: '#view-income .income-total-summary',
        tab: 'income',
        label: 'Income',
        title: 'Track money coming in',
        body: 'Use Income to compare expected income against deposits you have actually logged. This tells the budget how much money is available to assign.'
    },
    {
        selector: '#view-savings .savings-total-summary',
        tab: 'savings',
        label: 'Savings',
        title: 'Watch savings goals',
        body: 'Use Savings for emergency funds and goals. Keep the target realistic, update the current amount, and let the progress bar show whether the plan is actually funded.'
    },
    {
        selector: '#view-debt',
        tab: 'debt',
        label: 'Debt',
        title: 'Keep debt visible',
        body: 'Use Debt for balances, payoff plans, and payments you do not want to ignore. The goal is simple: know what is owed, what is due, and what progress looks like.'
    },
    {
        selector: '#view-add #addTxForm',
        tab: 'add',
        label: 'Add',
        title: 'Log transactions fast',
        body: 'Use Add for expenses and deposits. Amount, category, and description are the core fields; dates, payment method, and notes are there when you need more detail.'
    },
    {
        selector: '#view-recent .recent-workspace',
        tab: 'recent',
        label: 'Recent',
        title: 'Review the audit trail',
        body: 'Use Recent to search, filter, review, and clean up entries. Be careful with bulk actions on a real budget; delete only when you are sure.'
    },
    {
        selector: '#syncStatusBtn',
        label: 'Cloud Sync',
        title: 'Do not lose the Recovery Key',
        body: 'If you turn on encrypted Cloud Sync, save and download the Recovery Key immediately. Store it somewhere private and durable. If you lose it, Zam! cannot decrypt or recover your cloud budget.'
    },
    {
        selector: '.btn-avatar, .auth-buttons',
        label: 'Account',
        title: 'Account management is real-account territory',
        body: 'After signing in, the account menu handles billing, sync, devices, settings, password, support, and secure sign-out. Do not casually use reset, lost-key, or destructive recovery tools unless you understand the consequence.'
    },
    {
        selector: `#${BANNER_ID}`,
        label: 'Demo Timer',
        title: 'This is temporary sample data',
        body: 'The demo resets after 5 minutes. Sign in when you want encrypted Cloud Sync protection for a real budget.'
    }
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
        return true;
    } catch (error) {
        console.warn('[Demo Mode] Could not write local demo storage:', error);
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore cleanup failures.
    }
}

function sessionGet(key) {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function sessionSet(key, value) {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Ignore notice failures.
    }
}

function sessionRemove(key) {
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Ignore notice cleanup failures.
    }
}

function demoRequested() {
    try {
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        if (path === '/demo') return true;
        const params = new URLSearchParams(window.location.search);
        const value = params.get(DEMO_QUERY_PARAM);
        return value === '1' || value === 'true';
    } catch {
        return false;
    }
}

function getDemoExpiresAt() {
    const value = Number.parseInt(storageGet(EXPIRES_AT_KEY) || '', 10);
    return Number.isFinite(value) ? value : 0;
}

function demoExpired() {
    const expiresAt = getDemoExpiresAt();
    return Boolean(expiresAt && Date.now() >= expiresAt);
}

export function isDemoModeActive() {
    return storageGet(ACTIVE_KEY) === 'true';
}

function clearDemoBackup() {
    [
        BACKUP_HAS_DATA_KEY,
        BACKUP_DATA_KEY,
        BACKUP_UPDATED_AT_KEY,
        BACKUP_CREATED_AT_KEY
    ].forEach(storageRemove);
}

function clearDemoSessionKeys() {
    [
        ACTIVE_KEY,
        STARTED_AT_KEY,
        EXPIRES_AT_KEY
    ].forEach(storageRemove);
    sessionRemove(BANNER_MINIMIZED_KEY);
}

function clearDemoKeys() {
    clearDemoSessionKeys();
    clearDemoBackup();
}

function clearBudgetScreenBeforeDemo() {
    [
        BB_DATA_KEY,
        BB_LOCAL_UPDATED_AT_KEY
    ].forEach(storageRemove);
    clearDemoBackup();
}

function backupCurrentBudget() {
    if (isDemoModeActive()) return true;

    clearDemoBackup();

    if (!hasMeaningfulLocalBudget()) {
        storageSet(BACKUP_HAS_DATA_KEY, 'false');
        storageSet(BACKUP_CREATED_AT_KEY, String(Date.now()));
        return true;
    }

    const currentData = storageGet(BB_DATA_KEY);
    const currentUpdatedAt = storageGet(BB_LOCAL_UPDATED_AT_KEY);
    if (!currentData) {
        storageSet(BACKUP_HAS_DATA_KEY, 'false');
        storageSet(BACKUP_CREATED_AT_KEY, String(Date.now()));
        return true;
    }

    const wroteBackup = storageSet(BACKUP_DATA_KEY, currentData);
    const wroteFlag = storageSet(BACKUP_HAS_DATA_KEY, 'true');
    const wroteCreatedAt = storageSet(BACKUP_CREATED_AT_KEY, String(Date.now()));

    if (!wroteBackup || !wroteFlag || !wroteCreatedAt) {
        clearDemoBackup();
        return false;
    }

    if (currentUpdatedAt) {
        storageSet(BACKUP_UPDATED_AT_KEY, currentUpdatedAt);
    }
    else storageRemove(BACKUP_UPDATED_AT_KEY);

    return true;
}

function restorePreviousBudget() {
    const hadData = storageGet(BACKUP_HAS_DATA_KEY) === 'true';
    const backupData = storageGet(BACKUP_DATA_KEY);
    const backupUpdatedAt = storageGet(BACKUP_UPDATED_AT_KEY);

    if (hadData && backupData) {
        storageRemove(BB_DATA_KEY);
        if (!storageSet(BB_DATA_KEY, backupData)) {
            console.warn('[Demo Mode] Could not restore the pre-demo budget. Keeping demo backup for retry.');
            return false;
        }
    } else {
        storageRemove(BB_DATA_KEY);
    }

    if (backupUpdatedAt) {
        storageSet(BB_LOCAL_UPDATED_AT_KEY, backupUpdatedAt);
    } else {
        storageRemove(BB_LOCAL_UPDATED_AT_KEY);
    }

    clearDemoBackup();
    return true;
}

function restoreAndClearDemo(reason = 'ended') {
    const restored = restorePreviousBudget();
    if (restored) {
        clearDemoKeys();
        return true;
    }

    console.warn(`[Demo Mode] Cleanup paused after ${reason}; pre-demo backup is still available for retry.`);
    return false;
}

function dateFor(dayOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().slice(0, 10);
}

function makeTransaction(id, type, amount, category, description, dayOffset, paymentMethod = 'card', notes = '') {
    const createdAt = new Date(Date.now() + dayOffset * 60 * 1000).toISOString();
    return {
        id,
        type,
        amount,
        category,
        description,
        date: dateFor(dayOffset),
        paymentMethod,
        notes,
        tag: type === 'savings' || type === 'debt' ? type : 'transaction',
        createdAt,
        createdAtUTC: createdAt,
        serverLoggedAtUTC: createdAt,
        updatedAtUTC: createdAt
    };
}

function getSampleBudget() {
    const now = new Date().toISOString();

    return {
        transactions: [
            makeTransaction('demo-income-1', 'income', 2600, 'Paycheck', 'Primary paycheck', -12, 'bank'),
            makeTransaction('demo-income-2', 'income', 420, 'Side Work', 'Design project deposit', -8, 'bank'),
            makeTransaction('demo-rent-1', 'expense', 1450, 'Rent', 'Apartment rent', -10, 'bank'),
            makeTransaction('demo-grocery-1', 'expense', 96.43, 'Groceries', 'Weekly groceries', -7, 'card'),
            makeTransaction('demo-utility-1', 'expense', 138.27, 'Utilities', 'Electric and internet', -6, 'card'),
            makeTransaction('demo-dining-1', 'expense', 38.18, 'Dining Out', 'Dinner with friends', -4, 'card'),
            makeTransaction('demo-gas-1', 'expense', 44.91, 'Transportation', 'Fuel', -3, 'card'),
            makeTransaction('demo-savings-1', 'savings', 250, 'Emergency Fund', 'Emergency fund deposit', -2, 'bank'),
            makeTransaction('demo-debt-1', 'expense', 125, 'Credit Card', 'Extra credit card payment', -1, 'bank')
        ],
        categories: [
            { id: 'demo-cat-paycheck', type: 'income', name: 'Paycheck', icon: '\u{1F4B5}', budget: 2600, createdAt: now },
            { id: 'demo-cat-side-work', type: 'income', name: 'Side Work', icon: '\u{1F4BC}', budget: 400, createdAt: now },
            { id: 'demo-cat-rent', type: 'expense', name: 'Rent', icon: '\u{1F3E0}', budget: 1450, createdAt: now },
            { id: 'demo-cat-groceries', type: 'expense', name: 'Groceries', icon: '\u{1F6D2}', budget: 450, createdAt: now },
            { id: 'demo-cat-utilities', type: 'expense', name: 'Utilities', icon: '\u{1F4A1}', budget: 185, createdAt: now },
            { id: 'demo-cat-dining', type: 'expense', name: 'Dining Out', icon: '\u{1F37D}', budget: 180, createdAt: now },
            { id: 'demo-cat-transportation', type: 'expense', name: 'Transportation', icon: '\u{1F698}', budget: 220, createdAt: now },
            { id: 'demo-cat-emergency', type: 'savings', name: 'Emergency Fund', icon: '\u{1F6E1}', budget: 1000, createdAt: now },
            { id: 'demo-cat-credit-card', type: 'debt', name: 'Credit Card', icon: '\u{1F4B3}', budget: 1250, createdAt: now }
        ],
        settings: {
            currency: '$',
            defaultType: 'expense',
            defaultCategory: 'Groceries',
            defaultPayment: 'card',
            defaultTag: 'transaction',
            savingsGoal: 1000,
            emergencyFundMonths: 3,
            emergencyFundGoalOverride: false,
            emergencyFundInteracted: true,
            overrideDebtEmergencyFundLock: false,
            dashboardSummaryCollapsed: false,
            treatSavingsAsIncomeInZbb: false,
            treatSavingsAsTotalIncome: false,
            lastCategorySort: 'custom',
            isPro: false,
            premiumSinceUTC: '',
            stripeCheckoutSessionId: ''
        }
    };
}

function hasMeaningfulLocalBudget() {
    const raw = storageGet(BB_DATA_KEY);
    if (!raw) return false;

    try {
        const parsed = JSON.parse(raw);
        return Boolean(
            (Array.isArray(parsed.transactions) && parsed.transactions.length)
            || (Array.isArray(parsed.categories) && parsed.categories.length)
        );
    } catch {
        return false;
    }
}

function seedDemoBudget() {
    const payload = getSampleBudget();
    const stampedAt = new Date().toISOString();
    const wroteData = storageSet(BB_DATA_KEY, JSON.stringify(payload));
    const wroteTimestamp = storageSet(BB_LOCAL_UPDATED_AT_KEY, stampedAt);
    return wroteData && wroteTimestamp;
}

function markDemoSessionActive(now = Date.now()) {
    const wroteActive = storageSet(ACTIVE_KEY, 'true');
    const wroteStartedAt = storageSet(STARTED_AT_KEY, String(now));
    const wroteExpiresAt = storageSet(EXPIRES_AT_KEY, String(now + DEMO_DURATION_MS));
    return wroteActive && wroteStartedAt && wroteExpiresAt;
}

function abortDemoStart(reason = 'startup_failed') {
    const restored = restoreAndClearDemo(reason);
    if (!restored) {
        markDemoEnded('restore_failed');
        return { active: true, restoreFailed: true };
    }

    clearDemoSessionKeys();
    markDemoEnded(reason);
    return { active: false, startupFailed: true };
}

function startDemo() {
    if (!backupCurrentBudget()) {
        markDemoEnded('startup_failed');
        return { active: false, startupFailed: true };
    }

    const now = Date.now();
    if (!markDemoSessionActive(now)) {
        return abortDemoStart('startup_failed');
    }

    if (!seedDemoBudget()) {
        return abortDemoStart('startup_failed');
    }

    return getDemoState();
}

function getDemoState() {
    return {
        active: isDemoModeActive(),
        expiresAt: getDemoExpiresAt()
    };
}

function markDemoEnded(reason) {
    sessionSet(ENDED_NOTICE_KEY, reason || 'ended');
}

function cleanAppUrl(extraParams = {}) {
    try {
        const url = new URL(window.location.href);
        const isDemoPath = url.pathname.replace(/\/+$/, '') === '/demo';
        url.searchParams.delete(DEMO_QUERY_PARAM);
        Object.entries(extraParams).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') url.searchParams.delete(key);
            else url.searchParams.set(key, value);
        });
        if (isDemoPath && !url.searchParams.has(DEMO_QUERY_PARAM)) {
            return new URL('/app', window.location.origin).toString();
        }
        if (isDemoPath && url.searchParams.get(DEMO_QUERY_PARAM)) {
            url.searchParams.delete(DEMO_QUERY_PARAM);
        }
        return url.toString();
    } catch {
        return '/app';
    }
}

function loginUrl() {
    try {
        return new URL('/login', window.location.origin).toString();
    } catch {
        return '/login';
    }
}

function mainSiteUrl() {
    return MAIN_SITE_URL;
}

function escapeHtml(value = '') {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(value).replace(/[&<>"']/g, char => replacements[char]);
}

function completeDemo({ reason = 'ended', navigateTo = '', restart = false, showNotice = true } = {}) {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    if (!restoreAndClearDemo(reason)) {
        markDemoEnded('restore_failed');
        if (window.showToast) {
            window.showToast('Demo cleanup paused. Zam! kept the restore backup and will retry before leaving demo mode.');
        }
        return;
    }

    if (showNotice) markDemoEnded(reason);

    if (restart) {
        window.location.href = cleanAppUrl({ [DEMO_QUERY_PARAM]: '1' });
        return;
    }

    window.location.href = navigateTo || cleanAppUrl();
}

export function prepareDemoMode({ user } = {}) {
    const requested = demoRequested();
    const active = isDemoModeActive();

    if (!requested && !active) {
        clearDemoBackup();
    }

    if (user && (requested || active)) {
        if (active && !restoreAndClearDemo('signed_in')) {
            return { active: true, restoreFailed: true };
        }
        if (!active) clearDemoKeys();
        return {
            active: false,
            disabledForSignedInUser: true,
            signedInDemoBlocked: true,
            demoRequestedWhileSignedIn: requested,
            demoWasActiveWhileSignedIn: active
        };
    }

    if (active && demoExpired()) {
        if (!restoreAndClearDemo('expired')) {
            return { active: true, restoreFailed: true };
        }
        markDemoEnded('expired');
        return { active: false, expired: true };
    }

    if (active && !requested) {
        if (!restoreAndClearDemo('left_demo')) {
            return { active: true, restoreFailed: true };
        }
        return { active: false, leftDemo: true };
    }

    if (requested && !active) {
        return startDemo();
    }

    if (isDemoModeActive() && !storageGet(BB_DATA_KEY)) {
        if (!seedDemoBudget()) {
            return abortDemoStart('startup_failed');
        }
    }

    return getDemoState();
}

function formatCountdown(msRemaining) {
    const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        body.bb-demo-active {
            padding-bottom: 96px;
        }

        body.bb-demo-active.bb-demo-banner-minimized {
            padding-bottom: 54px;
        }

        body.bb-account-prompt-active {
            padding-bottom: 124px;
        }

        .bb-demo-banner {
            position: fixed;
            left: 50%;
            bottom: 16px;
            z-index: 2500;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 16px;
            align-items: center;
            width: min(920px, calc(100vw - 32px));
            padding: 14px 16px;
            color: #f8fafc;
            background:
                linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 94, 89, 0.94)),
                #0f172a;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.32);
            transform: translateX(-50%);
            animation: bbDemoSlideUp 260ms ease-out;
        }

        .bb-demo-banner::before {
            content: "";
            position: absolute;
            inset: 1px;
            pointer-events: none;
            border-radius: 17px;
            background: linear-gradient(120deg, rgba(20, 184, 166, 0.22), transparent 34%, rgba(255, 255, 255, 0.12) 62%, transparent);
            opacity: 0.78;
        }

        .bb-demo-banner-content,
        .bb-demo-banner-actions {
            position: relative;
            z-index: 1;
        }

        .bb-demo-label {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 0 0 4px;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0;
            text-transform: uppercase;
        }

        .bb-demo-pulse {
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: #2dd4bf;
            box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.72);
            animation: bbDemoPulse 1.8s infinite;
        }

        .bb-demo-copy {
            margin: 0;
            color: rgba(248, 250, 252, 0.84);
            font-size: 0.94rem;
            line-height: 1.35;
        }

        .bb-demo-timer {
            color: #ffffff;
            font-weight: 900;
            font-variant-numeric: tabular-nums;
        }

        .bb-demo-banner-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: wrap;
        }

        .bb-demo-compact {
            display: none;
            align-items: center;
            gap: 8px;
            margin: 0;
            color: rgba(248, 250, 252, 0.92);
            font-size: 0.88rem;
            font-weight: 800;
            line-height: 1;
            white-space: nowrap;
        }

        .bb-demo-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
            padding: 0 14px;
            border: 0;
            border-radius: 999px;
            font: inherit;
            font-size: 0.88rem;
            font-weight: 800;
            color: #0f172a;
            background: #ffffff;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
            transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }

        .bb-demo-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.26);
        }

        .bb-demo-action-secondary {
            color: #f8fafc;
            background: rgba(255, 255, 255, 0.12);
            box-shadow: none;
        }

        .bb-demo-action-secondary:hover {
            background: rgba(255, 255, 255, 0.18);
        }

        .bb-demo-toggle {
            min-height: 34px;
            padding: 0 12px;
        }

        .bb-demo-banner.is-minimized {
            left: auto;
            right: 16px;
            bottom: 12px;
            grid-template-columns: auto auto;
            gap: 10px;
            width: auto;
            max-width: calc(100vw - 32px);
            padding: 8px 10px;
            border-radius: 999px;
            transform: none;
        }

        .bb-demo-banner.is-minimized::before {
            border-radius: 999px;
        }

        .bb-demo-banner.is-minimized .bb-demo-label,
        .bb-demo-banner.is-minimized .bb-demo-copy,
        .bb-demo-banner.is-minimized .bb-demo-banner-actions .bb-demo-action:not(.bb-demo-toggle) {
            display: none;
        }

        .bb-demo-banner.is-minimized .bb-demo-compact {
            display: inline-flex;
        }

        .bb-demo-banner.is-minimized .bb-demo-banner-actions {
            flex-wrap: nowrap;
        }

        .bb-account-banner {
            position: fixed;
            left: 50%;
            bottom: 16px;
            z-index: 2350;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 14px;
            align-items: center;
            width: min(760px, calc(100vw - 32px));
            padding: 14px 16px;
            color: #f8fafc;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(148, 163, 184, 0.24);
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.32);
            backdrop-filter: blur(16px);
            transform: translateX(-50%);
            animation: bbDemoSlideUp 260ms ease-out;
        }

        .bb-account-banner-kicker {
            margin: 0 0 2px !important;
            color: #99f6e4 !important;
            font-size: 0.76rem;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .bb-account-banner-copy {
            margin: 0 !important;
            color: #e2e8f0 !important;
            font-size: 0.94rem;
            line-height: 1.45;
        }

        .bb-account-banner-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 8px;
        }

        .bb-demo-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 2700;
            display: grid;
            place-items: center;
            padding: 18px;
            background: rgba(15, 23, 42, 0.58);
            backdrop-filter: blur(8px);
            animation: bbDemoFadeIn 180ms ease-out;
        }

        .bb-demo-modal {
            width: min(440px, 100%);
            padding: 24px;
            color: #172033;
            background: #ffffff;
            border-radius: 18px;
            box-shadow: 0 22px 70px rgba(15, 23, 42, 0.28);
        }

        .bb-demo-modal h2 {
            margin: 0 0 8px;
            font-size: 1.45rem;
            line-height: 1.15;
            letter-spacing: 0;
        }

        .bb-demo-modal p {
            margin: 0;
            color: #475569;
            line-height: 1.55;
        }

        .bb-demo-modal-note {
            margin-top: 12px !important;
            padding: 12px 14px;
            color: #334155 !important;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            font-size: 0.92rem;
        }

        .bb-demo-modal-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 18px;
        }

        .bb-demo-account-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(165px, max-content));
            justify-content: center;
            align-items: center;
        }

        .bb-demo-account-actions .bb-demo-action {
            min-width: 165px;
        }

        .bb-demo-account-actions [data-demo-prompt-action="website"],
        .bb-demo-account-actions [data-demo-prompt-action="continue"] {
            grid-column: 1 / -1;
            justify-self: center;
        }

        .bb-demo-modal .bb-demo-action {
            background: #0f766e;
            color: #ffffff;
        }

        .bb-demo-modal .bb-demo-action-secondary {
            background: #f1f5f9;
            color: #0f172a;
        }

        .bb-demo-modal .bb-demo-action-danger {
            background: #b91c1c;
            color: #ffffff;
        }

        .bb-demo-modal .bb-demo-action:disabled {
            cursor: wait;
            opacity: 0.68;
            transform: none;
            box-shadow: none;
        }

        .bb-demo-tutorial-scrim {
            position: fixed;
            inset: 0;
            z-index: 2550;
            pointer-events: none;
            background: radial-gradient(circle at var(--demo-tour-x, 50%) var(--demo-tour-y, 80px), rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.48) 38%, rgba(15, 23, 42, 0.62));
            animation: bbDemoFadeIn 180ms ease-out;
        }

        .bb-demo-tutorial-spotlight {
            position: fixed;
            z-index: 2551;
            pointer-events: none;
            border: 2px solid #2dd4bf;
            border-radius: 18px;
            box-shadow:
                0 0 0 9999px rgba(15, 23, 42, 0.42),
                0 0 0 7px rgba(45, 212, 191, 0.16),
                0 18px 44px rgba(15, 23, 42, 0.28);
            transition: top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease;
        }

        .bb-demo-tutorial-card {
            position: fixed;
            top: 112px;
            right: 24px;
            z-index: 2552;
            box-sizing: border-box;
            width: min(390px, calc(100vw - 32px));
            padding: 18px;
            color: #172033;
            background: #ffffff;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            box-shadow: 0 22px 70px rgba(15, 23, 42, 0.3);
            animation: bbDemoTourPop 200ms ease-out;
        }

        .bb-demo-tutorial-kicker {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
            color: #0f766e;
            font-size: 0.76rem;
            font-weight: 900;
            letter-spacing: 0;
            text-transform: uppercase;
        }

        .bb-demo-tutorial-step {
            color: #64748b;
            font-variant-numeric: tabular-nums;
        }

        .bb-demo-tutorial-title {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 1.22rem;
            line-height: 1.15;
            letter-spacing: 0;
        }

        .bb-demo-tutorial-copy {
            margin: 0;
            color: #475569;
            font-size: 0.94rem;
            line-height: 1.5;
        }

        .bb-demo-tutorial-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 16px;
            flex-wrap: wrap;
        }

        .bb-demo-tutorial-nav {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .bb-demo-tour-close {
            min-width: 64px;
            min-height: 36px;
            padding: 0 14px;
            border-radius: 999px;
        }

        .bb-demo-tutorial-card .bb-demo-action {
            flex: 0 0 auto;
        }

        .bb-demo-tutorial-card .bb-demo-action-secondary {
            color: #0f172a;
            background: #f1f5f9;
            box-shadow: none;
        }

        .bb-demo-tutorial-card .bb-demo-action-secondary:hover {
            background: #e2e8f0;
        }

        .bb-demo-tutorial-card .bb-demo-action:disabled {
            opacity: 0.46;
            cursor: not-allowed;
            transform: none;
        }

        @keyframes bbDemoTourPop {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes bbDemoSlideUp {
            from { transform: translate(-50%, 20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }

        @keyframes bbDemoPulse {
            0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.72); }
            70% { box-shadow: 0 0 0 9px rgba(45, 212, 191, 0); }
            100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
        }

        @keyframes bbDemoFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @media (max-width: 720px) {
            body.bb-demo-active {
                padding-bottom: 176px;
            }

            body.bb-demo-active.bb-demo-banner-minimized {
                padding-bottom: 58px;
            }

            body.bb-account-prompt-active {
                padding-bottom: 212px;
            }

            .bb-demo-banner {
                grid-template-columns: 1fr;
                align-items: stretch;
                bottom: 10px;
                width: min(370px, calc(100vw - 20px));
                padding: 14px;
            }

            .bb-demo-banner.is-minimized {
                left: auto;
                right: 10px;
                bottom: 10px;
                grid-template-columns: auto auto;
                align-items: center;
                width: auto;
                max-width: calc(100vw - 20px);
                padding: 8px 10px;
            }

            .bb-demo-banner-actions {
                justify-content: stretch;
            }

            .bb-account-banner {
                grid-template-columns: 1fr;
                align-items: stretch;
                bottom: 10px;
                width: min(370px, calc(100vw - 20px));
                padding: 14px;
            }

            .bb-account-banner-actions {
                justify-content: stretch;
            }

            .bb-demo-action {
                flex: 1 1 130px;
            }

            .bb-demo-tutorial-card {
                left: 50% !important;
                right: auto;
                max-width: min(340px, calc(100vw - 20px));
                width: min(340px, calc(100vw - 20px)) !important;
                transform: translateX(-50%);
            }

            .bb-demo-tutorial-actions,
            .bb-demo-tutorial-nav {
                align-items: stretch;
                width: 100%;
            }

            .bb-demo-tutorial-actions {
                flex-direction: column;
            }

            .bb-demo-account-actions {
                grid-template-columns: 1fr;
            }

            .bb-demo-account-actions .bb-demo-action,
            .bb-demo-account-actions [data-demo-prompt-action="website"],
            .bb-demo-account-actions [data-demo-prompt-action="continue"] {
                width: 100%;
                min-width: 0;
            }

            .bb-demo-tutorial-nav {
                display: grid;
                grid-template-columns: 1fr 1fr;
            }

            .bb-demo-tour-close {
                width: 100%;
            }

            .bb-demo-tutorial-card .bb-demo-action {
                flex: 0 0 auto;
                min-height: 44px;
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

function renderBanner() {
    if (document.getElementById(BANNER_ID)) return;

    const banner = document.createElement('section');
    banner.id = BANNER_ID;
    banner.className = 'bb-demo-banner';
    banner.setAttribute('aria-label', 'Zam! demo mode');
    banner.innerHTML = `
        <div class="bb-demo-banner-content">
            <p class="bb-demo-label"><span class="bb-demo-pulse" aria-hidden="true"></span>Demo Mode</p>
            <p class="bb-demo-copy">Sample data resets in <span class="bb-demo-timer" data-demo-countdown>5:00</span>. Sign in when you are ready to protect a real budget.</p>
            <p class="bb-demo-compact"><span class="bb-demo-pulse" aria-hidden="true"></span>Demo <span class="bb-demo-timer" data-demo-countdown>5:00</span></p>
        </div>
        <div class="bb-demo-banner-actions">
            <button type="button" class="bb-demo-action" data-demo-action="create-account">Log In / Create Account</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="tour">Tour</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="restart">Restart Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="end">End Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="website">Back to Website</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-toggle" data-demo-action="toggle-banner" aria-expanded="true" aria-label="Minimize demo banner">Minimize</button>
        </div>
    `;

    banner.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-action]');
        if (!button) return;

        const action = button.getAttribute('data-demo-action');
        if (action === 'create-account') {
            completeDemo({ reason: 'account', navigateTo: loginUrl(), showNotice: false });
        } else if (action === 'tour') {
            startTutorial({ force: true });
        } else if (action === 'restart') {
            completeDemo({ reason: 'restart', restart: true, showNotice: false });
        } else if (action === 'end') {
            completeDemo({ reason: 'ended' });
        } else if (action === 'website') {
            completeDemo({ reason: 'website', navigateTo: mainSiteUrl(), showNotice: false });
        } else if (action === 'toggle-banner') {
            setDemoBannerMinimized(!isDemoBannerMinimized());
        }
    });

    document.body.appendChild(banner);
    document.body.classList.add('bb-demo-active');
    setDemoBannerMinimized(isDemoBannerMinimized());
}

function isDemoBannerMinimized() {
    return sessionGet(BANNER_MINIMIZED_KEY) === 'true';
}

function setDemoBannerMinimized(minimized) {
    const nextValue = Boolean(minimized);
    const banner = document.getElementById(BANNER_ID);
    const toggle = banner?.querySelector('[data-demo-action="toggle-banner"]');

    if (nextValue) {
        sessionSet(BANNER_MINIMIZED_KEY, 'true');
    } else {
        sessionRemove(BANNER_MINIMIZED_KEY);
    }

    document.body.classList.toggle('bb-demo-banner-minimized', nextValue);
    banner?.classList.toggle('is-minimized', nextValue);

    if (toggle) {
        toggle.textContent = nextValue ? 'Show' : 'Minimize';
        toggle.setAttribute('aria-expanded', String(!nextValue));
        toggle.setAttribute('aria-label', nextValue ? 'Show demo banner' : 'Minimize demo banner');
    }
}

function updateCountdown() {
    const remaining = getDemoExpiresAt() - Date.now();
    document.querySelectorAll('[data-demo-countdown]').forEach(timer => {
        timer.textContent = formatCountdown(remaining);
    });

    if (remaining <= 0) {
        completeDemo({ reason: 'expired' });
    }
}

function startCountdown() {
    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 1000);
}

function showEndedModal(reason = 'ended') {
    if (document.getElementById(MODAL_ID) || isDemoModeActive()) return;

    const startupFailed = reason === 'backup_failed' || reason === 'startup_failed';
    const title = startupFailed
        ? 'Demo start paused'
        : reason === 'expired' ? 'Demo time ended' : 'Demo cleared';
    const body = startupFailed
        ? 'Zam! could not safely prepare a temporary demo session for this browser budget, so demo mode did not start.'
        : reason === 'expired'
            ? 'The sample session ended. Your real budget is protected when you sign in with Cloud Sync.'
            : 'The sample demo data has been cleared. Sign in or create an account to start a real budget with encrypted Cloud Sync protection.';

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'bb-demo-modal-overlay';
    overlay.innerHTML = `
        <div class="bb-demo-modal" role="dialog" aria-modal="true" aria-labelledby="bbDemoEndedTitle">
            <h2 id="bbDemoEndedTitle">${title}</h2>
            <p>${body}</p>
            <div class="bb-demo-modal-actions">
                <button type="button" class="bb-demo-action" data-demo-ended-action="create-account">Log In / Create Account</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-ended-action="restart">Restart Demo</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-ended-action="website">Back to Website</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-ended-action="close">Close</button>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
        const button = event.target.closest('[data-demo-ended-action]');
        if (!button) return;

        const action = button.getAttribute('data-demo-ended-action');
        if (action === 'create-account') {
            window.location.href = loginUrl();
        } else if (action === 'restart') {
            window.location.href = cleanAppUrl({ [DEMO_QUERY_PARAM]: '1' });
        } else if (action === 'website') {
            window.location.href = mainSiteUrl();
        } else if (action === 'close') {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-demo-ended-action="create-account"]')?.focus({ preventScroll: true });
}

function getSignedInAccountLabel(accountTier = '') {
    const normalized = String(accountTier || '').trim().toLowerCase();
    if (normalized === 'premium' || normalized === 'pro') return 'premium account';
    if (normalized === 'free') return 'free account';
    return 'Zam! account';
}

function setSignedInPromptContent({ title, body, note } = {}) {
    const titleEl = document.getElementById(SIGNED_IN_PROMPT_TITLE_ID);
    const bodyEl = document.getElementById(SIGNED_IN_PROMPT_BODY_ID);
    const noteEl = document.querySelector(`#${SIGNED_IN_PROMPT_ID} [data-demo-signed-in-note]`);
    if (title && titleEl) titleEl.textContent = title;
    if (body && bodyEl) bodyEl.textContent = body;
    if (note && noteEl) noteEl.textContent = note;
}

function setSignedInPromptBusy(overlay, busy = true) {
    overlay?.querySelectorAll('[data-demo-signed-in-action]').forEach(button => {
        button.disabled = busy;
    });
}

async function backupSignedInBudgetBeforeDemo() {
    const status = window.BuddyCloud?.getStatus?.() || {};
    const canPush = Boolean(status.enabled && status.hasKey && window.BuddyCloud?.forcePush);
    if (!canPush) {
        throw new Error('Zam! could not confirm encrypted Cloud Sync protection yet.');
    }
    await window.BuddyCloud.forcePush();
}

async function signOutAndStartDemo(overlay) {
    setSignedInPromptBusy(overlay, true);
    setSignedInPromptContent({
        title: 'Preparing demo safely...',
        body: 'Zam! is checking Cloud Sync before it clears this browser budget screen.',
        note: 'No sample data gets loaded until this sign-out step finishes.'
    });

    try {
        await backupSignedInBudgetBeforeDemo();
        if (!window.sb?.auth?.signOut) throw new Error('Sign out is not available.');
        await window.sb.auth.signOut();
        clearDemoKeys();
        clearBudgetScreenBeforeDemo();
        window.location.href = cleanAppUrl({ [DEMO_QUERY_PARAM]: '1' });
    } catch (error) {
        console.warn('[Demo Mode] Could not safely switch signed-in user to demo mode:', error);
        setSignedInPromptBusy(overlay, false);
        setSignedInPromptContent({
            title: 'Demo start paused',
            body: 'Zam! could not confirm the encrypted Cloud Sync backup, so it did not sign you out or clear this browser.',
            note: 'Try again in a moment, or stay in your real budget.'
        });
    }
}

function showSignedInDemoPrompt({ accountTier = '', user } = {}) {
    if (document.getElementById(SIGNED_IN_PROMPT_ID)) return;

    const accountLabel = getSignedInAccountLabel(accountTier);
    const email = String(user?.email || '').trim();
    const emailNote = email ? `Signed in as ${email}.` : 'Your real signed-in budget stays protected.';

    const overlay = document.createElement('div');
    overlay.id = SIGNED_IN_PROMPT_ID;
    overlay.className = 'bb-demo-modal-overlay';
    overlay.innerHTML = `
        <div class="bb-demo-modal" role="dialog" aria-modal="true" aria-labelledby="${SIGNED_IN_PROMPT_TITLE_ID}">
            <h2 id="${SIGNED_IN_PROMPT_TITLE_ID}">You are already signed in</h2>
            <p id="${SIGNED_IN_PROMPT_BODY_ID}">You are already logged in with a ${accountLabel}. Demo mode uses temporary sample data, so Zam! needs to sign out first before opening the demo.</p>
            <p class="bb-demo-modal-note" data-demo-signed-in-note>${escapeHtml(emailNote)}</p>
            <div class="bb-demo-modal-actions">
                <button type="button" class="bb-demo-action" data-demo-signed-in-action="stay">Stay in My Budget</button>
                <button type="button" class="bb-demo-action bb-demo-action-danger" data-demo-signed-in-action="demo">Sign Out and Try Demo</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-signed-in-action="website">Back to Website</button>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-signed-in-action]');
        if (!button) return;

        const action = button.getAttribute('data-demo-signed-in-action');
        if (action === 'stay') {
            window.location.href = cleanAppUrl();
        } else if (action === 'website') {
            window.location.href = mainSiteUrl();
        } else if (action === 'demo') {
            signOutAndStartDemo(overlay);
        }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-demo-signed-in-action="stay"]')?.focus({ preventScroll: true });
}

function clearAccountPromptTimer() {
    if (!accountPromptTimer) return;
    window.clearTimeout(accountPromptTimer);
    accountPromptTimer = null;
}

function dismissAccountPromptSession() {
    sessionSet(ACCOUNT_PROMPT_DISMISSED_KEY, 'true');
    clearAccountPromptTimer();
}

function handleAccountPromptAction(action, sourceEl = null) {
    if (action === 'login' || action === 'create-account') {
        dismissAccountPromptSession();
        window.location.href = loginUrl();
    } else if (action === 'demo') {
        dismissAccountPromptSession();
        window.location.href = cleanAppUrl({ [DEMO_QUERY_PARAM]: '1' });
    } else if (action === 'website') {
        dismissAccountPromptSession();
        window.location.href = mainSiteUrl();
    } else if (action === 'continue') {
        dismissAccountPromptSession();
        document.getElementById(ACCOUNT_PROMPT_ID)?.remove();
        const sourceBanner = sourceEl?.closest(`#${ACCOUNT_PROMPT_BANNER_ID}`);
        if (sourceBanner) {
            sourceBanner.remove();
            document.body.classList.remove('bb-account-prompt-active');
        } else if (!document.getElementById(ACCOUNT_PROMPT_BANNER_ID)) {
            document.body.classList.remove('bb-account-prompt-active');
        }
    }
}

function renderAccountPromptBanner() {
    if (document.getElementById(ACCOUNT_PROMPT_BANNER_ID) || isDemoModeActive()) return;
    if (sessionGet(ACCOUNT_PROMPT_DISMISSED_KEY) === 'true') return;

    const hasLocalBudget = hasMeaningfulLocalBudget();
    const copy = hasLocalBudget
        ? 'This browser has a local budget. Sign in for Cloud Sync protection, or keep using this browser.'
        : 'Sign in for Cloud Sync protection, or try the demo first.';
    const continueButton = hasLocalBudget
        ? '<button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="continue">Keep Using Browser</button>'
        : '';

    const banner = document.createElement('section');
    banner.id = ACCOUNT_PROMPT_BANNER_ID;
    banner.className = 'bb-account-banner';
    banner.setAttribute('aria-label', 'Zam! account options');
    banner.innerHTML = `
        <div>
            <p class="bb-account-banner-kicker">Ready when you are</p>
            <p class="bb-account-banner-copy">${copy}</p>
        </div>
        <div class="bb-account-banner-actions">
            <button type="button" class="bb-demo-action" data-demo-prompt-action="login">Log In / Create Account</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="demo">Try Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="website">Back to Website</button>
            ${continueButton}
        </div>
    `;

    banner.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-prompt-action]');
        if (!button) return;
        handleAccountPromptAction(button.getAttribute('data-demo-prompt-action'), button);
    });

    document.body.appendChild(banner);
    document.body.classList.add('bb-account-prompt-active');
}

function scheduleAccountPromptModal() {
    if (accountPromptTimer || sessionGet(ACCOUNT_PROMPT_DISMISSED_KEY) === 'true') return;
    accountPromptTimer = window.setTimeout(() => {
        accountPromptTimer = null;
        renderAccountPrompt();
    }, ACCOUNT_PROMPT_DELAY_MS);
}

function renderAccountPrompt() {
    if (document.getElementById(ACCOUNT_PROMPT_ID) || isDemoModeActive()) return;
    if (sessionGet(ACCOUNT_PROMPT_DISMISSED_KEY) === 'true') return;

    const hasLocalBudget = hasMeaningfulLocalBudget();
    const title = hasLocalBudget ? 'Protect this browser budget' : 'Ready to start Zam!?';
    const body = hasLocalBudget
        ? 'This browser already has a local budget. Log in or create an account for encrypted Cloud Sync protection, or keep using this browser without recovery support.'
        : 'Log in or create a free account for encrypted Cloud Sync and two active sync slots. You can also keep exploring or try the demo first.';
    const continueLabel = hasLocalBudget ? 'Keep Using Browser' : 'Keep Exploring';

    const overlay = document.createElement('div');
    overlay.id = ACCOUNT_PROMPT_ID;
    overlay.className = 'bb-demo-modal-overlay';
    overlay.innerHTML = `
        <div class="bb-demo-modal" role="dialog" aria-modal="true" aria-labelledby="bbDemoAccountPromptTitle">
            <h2 id="bbDemoAccountPromptTitle">${title}</h2>
            <p>${body}</p>
            <div class="bb-demo-modal-actions bb-demo-account-actions">
                <button type="button" class="bb-demo-action" data-demo-prompt-action="login">Log In / Create Account</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="demo">Try Demo</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="website">Back to Website</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="continue">${continueLabel}</button>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-prompt-action]');
        if (!button) return;
        handleAccountPromptAction(button.getAttribute('data-demo-prompt-action'), button);
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-demo-prompt-action="login"]')?.focus({ preventScroll: true });
}

function attachLoginCapture() {
    if (loginCaptureAttached) return;
    loginCaptureAttached = true;

    document.addEventListener('click', (event) => {
        if (!isDemoModeActive()) return;
        const link = event.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href') || '';
        const nextUrl = new URL(href, window.location.href);
        const isLoginRoute = /\/login(?:\.html)?$/i.test(nextUrl.pathname) || nextUrl.pathname.endsWith('/login.html');
        if (!isLoginRoute) return;

        event.preventDefault();
        completeDemo({ reason: 'account', navigateTo: nextUrl.toString(), showNotice: false });
    }, true);
}

function getTutorialStep(index = tutorialIndex) {
    return TUTORIAL_STEPS[Math.max(0, Math.min(index, TUTORIAL_STEPS.length - 1))];
}

function applyTutorialStepContext(step = getTutorialStep()) {
    const tab = String(step?.tab || '').trim();
    if (!tab || typeof window.switchTab !== 'function') return;

    try {
        window.switchTab(tab);
    } catch (error) {
        console.warn('[Demo Mode] Could not switch tutorial tab:', error);
    }
}

function getTutorialTarget(step = getTutorialStep()) {
    return document.querySelector(step?.selector || '') || document.querySelector('.app-header') || document.body;
}

function removeTutorial() {
    document.getElementById(TUTORIAL_ID)?.remove();
    document.getElementById(TUTORIAL_SPOTLIGHT_ID)?.remove();
    document.getElementById(TUTORIAL_SCRIM_ID)?.remove();
    document.body.classList.remove('bb-demo-tutorial-active');
}

function endTutorial() {
    sessionSet(TUTORIAL_SKIPPED_KEY, 'true');
    removeTutorial();
}

function placeTutorial() {
    const card = document.getElementById(TUTORIAL_ID);
    const spotlight = document.getElementById(TUTORIAL_SPOTLIGHT_ID);
    const scrim = document.getElementById(TUTORIAL_SCRIM_ID);
    if (!card || !spotlight || !scrim) return;

    const step = getTutorialStep();
    const target = getTutorialTarget(step);
    const rect = target.getBoundingClientRect();
    const padding = 8;
    const top = Math.max(8, rect.top - padding);
    const left = Math.max(8, rect.left - padding);
    const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
    const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);

    spotlight.style.top = `${top}px`;
    spotlight.style.left = `${left}px`;
    spotlight.style.width = `${Math.max(44, width)}px`;
    spotlight.style.height = `${Math.max(44, height)}px`;
    spotlight.style.borderRadius = target.id === BANNER_ID ? '20px' : '18px';

    scrim.style.setProperty('--demo-tour-x', `${left + width / 2}px`);
    scrim.style.setProperty('--demo-tour-y', `${top + height / 2}px`);

    const cardWidth = Math.min(390, window.innerWidth - 32);
    card.style.width = `${cardWidth}px`;
    const cardHeight = card.offsetHeight || 220;
    let cardTop = top + height + 14;
    if (cardTop + cardHeight > window.innerHeight - 14) {
        cardTop = top - cardHeight - 14;
    }
    cardTop = Math.max(14, Math.min(cardTop, window.innerHeight - cardHeight - 14));

    let cardLeft = left + width / 2 - cardWidth / 2;
    cardLeft = Math.max(16, Math.min(cardLeft, window.innerWidth - cardWidth - 16));

    card.style.top = `${cardTop}px`;
    card.style.left = `${cardLeft}px`;
}

function renderTutorialStep() {
    const card = document.getElementById(TUTORIAL_ID);
    if (!card) return;

    const step = getTutorialStep();
    applyTutorialStepContext(step);
    const isFirst = tutorialIndex === 0;
    const isLast = tutorialIndex === TUTORIAL_STEPS.length - 1;
    card.innerHTML = `
        <div class="bb-demo-tutorial-kicker">
            <span>${step.label}</span>
            <span class="bb-demo-tutorial-step">${tutorialIndex + 1} / ${TUTORIAL_STEPS.length}</span>
        </div>
        <h2 class="bb-demo-tutorial-title">${step.title}</h2>
        <p class="bb-demo-tutorial-copy">${step.body}</p>
        <div class="bb-demo-tutorial-actions">
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-tour-close" data-demo-tour-action="skip">Skip</button>
            <div class="bb-demo-tutorial-nav">
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-tour-action="back" ${isFirst ? 'disabled' : ''}>Back</button>
                <button type="button" class="bb-demo-action" data-demo-tour-action="${isLast ? 'finish' : 'next'}">${isLast ? 'Finish' : 'Next'}</button>
            </div>
        </div>
    `;

    const target = getTutorialTarget(step);
    if (target !== document.body) {
        target.scrollIntoView({ block: tutorialIndex === 0 ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
    }
    placeTutorial();
    window.requestAnimationFrame?.(placeTutorial);
    window.setTimeout(placeTutorial, 120);
    window.setTimeout(placeTutorial, 320);
}

function handleTutorialAction(action) {
    if (action === 'skip') {
        endTutorial();
        return;
    }
    if (action === 'back') {
        tutorialIndex = Math.max(0, tutorialIndex - 1);
        renderTutorialStep();
        return;
    }
    if (action === 'next') {
        tutorialIndex = Math.min(TUTORIAL_STEPS.length - 1, tutorialIndex + 1);
        renderTutorialStep();
        return;
    }
    if (action === 'finish') {
        endTutorial();
    }
}

function startTutorial({ force = false } = {}) {
    if (!isDemoModeActive()) return;
    if (!force && sessionGet(TUTORIAL_SKIPPED_KEY) === 'true') return;

    removeTutorial();
    tutorialIndex = 0;

    const scrim = document.createElement('div');
    scrim.id = TUTORIAL_SCRIM_ID;
    scrim.className = 'bb-demo-tutorial-scrim';

    const spotlight = document.createElement('div');
    spotlight.id = TUTORIAL_SPOTLIGHT_ID;
    spotlight.className = 'bb-demo-tutorial-spotlight';
    spotlight.setAttribute('aria-hidden', 'true');

    const card = document.createElement('aside');
    card.id = TUTORIAL_ID;
    card.className = 'bb-demo-tutorial-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-label', 'Zam! demo tutorial');
    card.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-tour-action]');
        if (!button || button.disabled) return;
        handleTutorialAction(button.getAttribute('data-demo-tour-action'));
    });

    document.body.append(scrim, spotlight, card);
    document.body.classList.add('bb-demo-tutorial-active');
    renderTutorialStep();

    if (!tutorialResizeAttached) {
        tutorialResizeAttached = true;
        window.addEventListener('resize', placeTutorial);
        window.addEventListener('scroll', placeTutorial, true);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && document.getElementById(TUTORIAL_ID)) {
                endTutorial();
            }
        });
    }
}

export function initDemoMode({ demoModeState, user, accountTier = '' } = {}) {
    injectStyles();

    if (demoModeState?.signedInDemoBlocked) {
        showSignedInDemoPrompt({ accountTier, user });
        return;
    }

    const endedReason = sessionGet(ENDED_NOTICE_KEY);
    if (endedReason) {
        sessionRemove(ENDED_NOTICE_KEY);
        showEndedModal(endedReason);
    }

    if (!demoModeState?.active && !isDemoModeActive()) return;

    renderBanner();
    startCountdown();
    attachLoginCapture();
    window.setTimeout(() => startTutorial(), 450);
}

export function initSignedOutAccountPrompt({ user } = {}) {
    if (user || demoRequested() || isDemoModeActive()) {
        clearAccountPromptTimer();
        document.getElementById(ACCOUNT_PROMPT_BANNER_ID)?.remove();
        document.getElementById(ACCOUNT_PROMPT_ID)?.remove();
        document.body.classList.remove('bb-account-prompt-active');
        return;
    }
    injectStyles();
    renderAccountPromptBanner();
    scheduleAccountPromptModal();
}
