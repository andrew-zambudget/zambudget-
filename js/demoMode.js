// js/demoMode.js

const DEMO_DURATION_MS = 5 * 60 * 1000;
const DEMO_QUERY_PARAM = 'demo';
const BB_DATA_KEY = 'bb_data';
const DEMO_DATA_KEY = 'zam_demo_data';
const DEMO_LOCAL_UPDATED_AT_KEY = 'zam_demo_local_updated_at';
const ACTIVE_KEY = 'zam_demo_active';
const STARTED_AT_KEY = 'zam_demo_started_at';
const EXPIRES_AT_KEY = 'zam_demo_expires_at';
const STALE_DEMO_KEYS = Object.freeze([
    'bb_demo_active',
    'bb_demo_started_at',
    'bb_demo_expires_at',
    'bb_demo_backup_has_data',
    'bb_demo_backup_bb_data',
    'bb_demo_backup_local_updated_at',
    'bb_demo_backup_created_at'
]);
const ENDED_NOTICE_KEY = 'bb_demo_ended_notice';
const ACCOUNT_PROMPT_DISMISSED_KEY = 'bb_demo_account_prompt_dismissed';
const TUTORIAL_SKIPPED_KEY = 'bb_demo_tutorial_skipped';
const BANNER_MINIMIZED_KEY = 'bb_demo_banner_minimized';
const BANNER_POSITION_KEY = 'bb_demo_banner_position';
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
let demoBannerDragState = null;
let demoBannerResizeAttached = false;

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
        return true;
    } catch {
        // Ignore notice failures.
        return false;
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
        if (path === '/demo' || path.startsWith('/demo/')) return true;
        const params = new URLSearchParams(window.location.search);
        const value = params.get(DEMO_QUERY_PARAM);
        return value === '1' || value === 'true';
    } catch {
        return false;
    }
}

function getDemoExpiresAt() {
    const value = Number.parseInt(sessionGet(EXPIRES_AT_KEY) || '', 10);
    return Number.isFinite(value) ? value : 0;
}

function demoExpired() {
    const expiresAt = getDemoExpiresAt();
    return Boolean(expiresAt && Date.now() >= expiresAt);
}

export function isDemoModeActive() {
    return sessionGet(ACTIVE_KEY) === 'true';
}

export function cleanupStaleDemoKeys() {
    STALE_DEMO_KEYS.forEach(storageRemove);
}

function clearDemoSessionKeys() {
    [
        ACTIVE_KEY,
        STARTED_AT_KEY,
        EXPIRES_AT_KEY,
        DEMO_DATA_KEY,
        DEMO_LOCAL_UPDATED_AT_KEY,
        BANNER_POSITION_KEY
    ].forEach(sessionRemove);
    sessionRemove(BANNER_MINIMIZED_KEY);
}

function clearDemoKeys() {
    clearDemoSessionKeys();
    cleanupStaleDemoKeys();
}

function clearBudgetScreenBeforeDemo() {
    clearDemoKeys();
}

function restoreAndClearDemo(reason = 'ended') {
    clearDemoKeys();
    return true;
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
    const wroteData = sessionSet(DEMO_DATA_KEY, JSON.stringify(payload));
    const wroteTimestamp = sessionSet(DEMO_LOCAL_UPDATED_AT_KEY, stampedAt);
    return wroteData && wroteTimestamp;
}

function markDemoSessionActive(now = Date.now()) {
    const wroteActive = sessionSet(ACTIVE_KEY, 'true');
    const wroteStartedAt = sessionSet(STARTED_AT_KEY, String(now));
    const wroteExpiresAt = sessionSet(EXPIRES_AT_KEY, String(now + DEMO_DURATION_MS));
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
    cleanupStaleDemoKeys();
    sessionRemove(DEMO_DATA_KEY);
    sessionRemove(DEMO_LOCAL_UPDATED_AT_KEY);

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
        cleanupStaleDemoKeys();
    }

    if (user && (requested || active)) {
        if (active) clearDemoKeys();
        else cleanupStaleDemoKeys();
        return {
            active: false,
            disabledForSignedInUser: true,
            signedInDemoBlocked: true,
            demoRequestedWhileSignedIn: requested,
            demoWasActiveWhileSignedIn: active
        };
    }

    if (active && demoExpired()) {
        restoreAndClearDemo('expired');
        markDemoEnded('expired');
        return { active: false, expired: true };
    }

    if (active && !requested) {
        restoreAndClearDemo('left_demo');
        return { active: false, leftDemo: true };
    }

    if (requested && !active) {
        return startDemo();
    }

    if (isDemoModeActive() && !sessionGet(DEMO_DATA_KEY)) {
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
            padding-bottom: 118px;
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
            grid-template-columns: minmax(0, 1fr);
            gap: 8px;
            align-items: stretch;
            width: min(760px, calc(100vw - 32px));
            padding: 10px 12px;
            color: #f8fafc;
            background:
                linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 94, 89, 0.94)),
                #0f172a;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 14px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.32);
            transform: translateX(-50%);
            animation: bbDemoSlideUp 260ms ease-out;
        }

        .bb-demo-banner::before {
            content: "";
            position: absolute;
            inset: 1px;
            pointer-events: none;
            border-radius: 13px;
            background: linear-gradient(120deg, rgba(20, 184, 166, 0.22), transparent 34%, rgba(255, 255, 255, 0.12) 62%, transparent);
            opacity: 0.78;
        }

        .bb-demo-banner-content,
        .bb-demo-banner-actions {
            position: relative;
            z-index: 1;
        }

        .bb-demo-banner-content {
            display: flex;
            gap: 10px;
            align-items: center;
            min-width: 0;
        }

        .bb-demo-label {
            display: flex;
            gap: 8px;
            align-items: center;
            flex: 0 0 auto;
            margin: 0;
            font-size: 0.7rem;
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
            min-width: 0;
            margin: 0;
            color: rgba(248, 250, 252, 0.84);
            font-size: 0.86rem;
            line-height: 1.28;
        }

        .bb-demo-timer {
            color: #ffffff;
            font-weight: 900;
            font-variant-numeric: tabular-nums;
        }

        .bb-demo-banner-actions {
            display: flex;
            gap: 6px;
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
            min-height: 32px;
            padding: 0 10px;
            border: 0;
            border-radius: 999px;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 800;
            color: #0f172a;
            background: #ffffff;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
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
            min-height: 30px;
            padding: 0 9px;
        }

        .bb-demo-action-quiet {
            color: rgba(248, 250, 252, 0.88);
            background: transparent;
            border: 1px solid rgba(248, 250, 252, 0.16);
            box-shadow: none;
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
            cursor: grab;
            touch-action: none;
            user-select: none;
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

        .bb-demo-banner.is-minimized.is-dragging {
            cursor: grabbing;
            animation: none;
            transition: none;
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
            -webkit-backdrop-filter: blur(16px);
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
            -webkit-backdrop-filter: blur(8px);
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

        @keyframes bbDemoFlowIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
            .bb-demo-banner:not(.is-minimized) {
                position: relative;
                left: auto;
                bottom: auto;
                z-index: 1200;
                width: min(760px, calc(100vw - 24px));
                margin: 10px auto 14px;
                transform: none;
                animation: bbDemoFlowIn 220ms ease-out;
            }
        }

        @media (max-width: 720px) {
            body.bb-demo-active {
                padding-bottom: calc(5.75rem + env(safe-area-inset-bottom));
            }

            body.bb-demo-active.bb-demo-banner-minimized {
                padding-bottom: calc(5.75rem + env(safe-area-inset-bottom) + 58px);
            }

            body.bb-account-prompt-active {
                padding-bottom: 212px;
            }

            .bb-demo-banner {
                grid-template-columns: 1fr;
                align-items: stretch;
                width: min(420px, calc(100vw - 20px));
                padding: 10px;
                gap: 8px;
            }

            .bb-demo-banner.is-minimized {
                left: auto;
                right: 10px;
                bottom: calc(5.75rem + env(safe-area-inset-bottom) + 10px);
                grid-template-columns: auto auto;
                align-items: center;
                width: auto;
                max-width: calc(100vw - 20px);
                padding: 8px 10px;
            }

            .bb-demo-banner-actions {
                justify-content: flex-start;
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
                flex: 0 1 auto;
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

function getDemoBannerViewport() {
    return {
        width: Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0),
        height: Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0)
    };
}

function clampDemoBannerPosition(position = {}, banner = document.getElementById(BANNER_ID)) {
    const viewport = getDemoBannerViewport();
    const rect = banner?.getBoundingClientRect?.();
    const width = Math.max(1, rect?.width || 0);
    const height = Math.max(1, rect?.height || 0);
    const margin = 8;
    const maxLeft = Math.max(margin, viewport.width - width - margin);
    const maxTop = Math.max(margin, viewport.height - height - margin);
    const left = Math.max(margin, Math.min(Number(position.left) || margin, maxLeft));
    const top = Math.max(margin, Math.min(Number(position.top) || margin, maxTop));

    return { left, top };
}

function readDemoBannerPosition() {
    try {
        const raw = sessionGet(BANNER_POSITION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const left = Number(parsed?.left);
        const top = Number(parsed?.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
        return { left, top };
    } catch {
        return null;
    }
}

function writeDemoBannerPosition(position) {
    const banner = document.getElementById(BANNER_ID);
    if (!banner || !position) return;
    const nextPosition = clampDemoBannerPosition(position, banner);
    sessionSet(BANNER_POSITION_KEY, JSON.stringify(nextPosition));
    applyDemoBannerPosition(nextPosition);
}

function clearDemoBannerInlinePosition() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.style.removeProperty('left');
    banner.style.removeProperty('top');
    banner.style.removeProperty('right');
    banner.style.removeProperty('bottom');
}

function applyDemoBannerPosition(position = readDemoBannerPosition()) {
    const banner = document.getElementById(BANNER_ID);
    if (!banner || !banner.classList.contains('is-minimized') || !position) return;
    const nextPosition = clampDemoBannerPosition(position, banner);
    banner.style.left = `${nextPosition.left}px`;
    banner.style.top = `${nextPosition.top}px`;
    banner.style.right = 'auto';
    banner.style.bottom = 'auto';
}

function handleDemoBannerViewportChange() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner?.classList.contains('is-minimized')) return;
    const current = readDemoBannerPosition();
    if (current) writeDemoBannerPosition(current);
}

function consumeDemoBannerDragClick() {
    if (!demoBannerDragState?.suppressClick) return false;
    demoBannerDragState = null;
    return true;
}

function attachDemoBannerDrag(banner) {
    if (!banner || banner.dataset.demoDragAttached === 'true') return;
    banner.dataset.demoDragAttached = 'true';

    banner.addEventListener('pointerdown', (event) => {
        if (!banner.classList.contains('is-minimized')) return;
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest?.('[data-demo-action]')) return;

        const rect = banner.getBoundingClientRect();
        demoBannerDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top,
            moved: false,
            suppressClick: false
        };

        banner.setPointerCapture?.(event.pointerId);
    });

    banner.addEventListener('pointermove', (event) => {
        const state = demoBannerDragState;
        if (!state || state.pointerId !== event.pointerId || !banner.classList.contains('is-minimized')) return;

        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;
        const hasMoved = Math.hypot(deltaX, deltaY) > 6;
        if (!hasMoved && !state.moved) return;

        state.moved = true;
        banner.classList.add('is-dragging');
        applyDemoBannerPosition({
            left: state.startLeft + deltaX,
            top: state.startTop + deltaY
        });
        event.preventDefault();
    });

    const finishDrag = (event) => {
        const state = demoBannerDragState;
        if (!state || state.pointerId !== event.pointerId) return;

        banner.releasePointerCapture?.(event.pointerId);
        banner.classList.remove('is-dragging');

        if (state.moved) {
            const rect = banner.getBoundingClientRect();
            writeDemoBannerPosition({ left: rect.left, top: rect.top });
            state.suppressClick = true;
            window.setTimeout(() => {
                if (demoBannerDragState === state) demoBannerDragState = null;
            }, 350);
        } else {
            demoBannerDragState = null;
        }
    };

    banner.addEventListener('pointerup', finishDrag);
    banner.addEventListener('pointercancel', (event) => {
        if (demoBannerDragState?.pointerId === event.pointerId) {
            banner.classList.remove('is-dragging');
            demoBannerDragState = null;
        }
    });
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
            <p class="bb-demo-copy">You're using sample data. Changes stay in this demo and are not synced. Do not enter real financial information. Resets in <span class="bb-demo-timer" data-demo-countdown>5:00</span>.</p>
            <p class="bb-demo-compact"><span class="bb-demo-pulse" aria-hidden="true"></span>Demo <span class="bb-demo-timer" data-demo-countdown>5:00</span></p>
        </div>
        <div class="bb-demo-banner-actions">
            <button type="button" class="bb-demo-action" data-demo-action="create-account">Create Free Account</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="login">Sign In</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-action-quiet" data-demo-action="tour">Tour</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-action-quiet" data-demo-action="restart">Reset Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-action-quiet" data-demo-action="end">End Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-action-quiet" data-demo-action="website">Back to Website</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary bb-demo-toggle" data-demo-action="toggle-banner" aria-expanded="true" aria-label="Minimize demo banner">Minimize</button>
        </div>
    `;

    attachDemoBannerDrag(banner);

    banner.addEventListener('click', (event) => {
        if (consumeDemoBannerDragClick()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const button = event.target.closest('[data-demo-action]');
        if (!button) return;

        const action = button.getAttribute('data-demo-action');
        if (action === 'create-account' || action === 'login') {
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

    const main = document.getElementById('main');
    if (main?.parentNode) {
        main.parentNode.insertBefore(banner, main);
    } else {
        document.body.appendChild(banner);
    }
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
    banner?.classList.remove('is-dragging');
    if (nextValue) {
        applyDemoBannerPosition();
    } else {
        clearDemoBannerInlinePosition();
    }

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
    return true;
}

async function signOutAndStartDemo(overlay) {
    setSignedInPromptBusy(overlay, true);
    setSignedInPromptContent({
        title: 'Signing out for demo mode...',
        body: 'Zam! will open the public sample sandbox after sign-out.',
        note: 'Demo data stays separate from your signed-in budget.'
    });

    try {
        if (!window.sb?.auth?.signOut) throw new Error('Sign out is not available.');
        await window.sb.auth.signOut();
        clearDemoKeys();
        window.location.href = new URL('/demo', window.location.origin).toString();
    } catch (error) {
        console.warn('[Demo Mode] Could not safely switch signed-in user to demo mode:', error);
        setSignedInPromptBusy(overlay, false);
        setSignedInPromptContent({
            title: 'Demo start paused',
            body: 'Zam! could not sign out, so it did not open the public demo.',
            note: 'Try again in a moment, or go back to your app.'
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
            <h2 id="${SIGNED_IN_PROMPT_TITLE_ID}">Demo mode is available while signed out</h2>
            <p id="${SIGNED_IN_PROMPT_BODY_ID}">You are already logged in with a ${accountLabel}. Go to your app, or sign out to view the public demo with sample data.</p>
            <p class="bb-demo-modal-note" data-demo-signed-in-note>${escapeHtml(emailNote)}</p>
            <div class="bb-demo-modal-actions">
                <button type="button" class="bb-demo-action" data-demo-signed-in-action="stay">Go to My App</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-signed-in-action="demo">Sign Out and View Demo</button>
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
    if (!demoBannerResizeAttached) {
        demoBannerResizeAttached = true;
        window.addEventListener('resize', handleDemoBannerViewportChange);
    }
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
