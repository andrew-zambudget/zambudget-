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
const ENDED_NOTICE_KEY = 'bb_demo_ended_notice';
const ACCOUNT_PROMPT_DISMISSED_KEY = 'bb_demo_account_prompt_dismissed';
const TUTORIAL_SKIPPED_KEY = 'bb_demo_tutorial_skipped';
const BANNER_ID = 'bbDemoModeBanner';
const MODAL_ID = 'bbDemoEndedModal';
const ACCOUNT_PROMPT_ID = 'bbDemoAccountPrompt';
const SIGNED_IN_PROMPT_ID = 'bbDemoSignedInPrompt';
const SIGNED_IN_PROMPT_TITLE_ID = 'bbDemoSignedInPromptTitle';
const SIGNED_IN_PROMPT_BODY_ID = 'bbDemoSignedInPromptBody';
const TUTORIAL_ID = 'bbDemoTutorial';
const TUTORIAL_SPOTLIGHT_ID = 'bbDemoTutorialSpotlight';
const TUTORIAL_SCRIM_ID = 'bbDemoTutorialScrim';
const STYLE_ID = 'bbDemoModeStyles';
const MAIN_SITE_URL = 'https://budget-buddy.io';

let countdownTimer = null;
let loginCaptureAttached = false;
let tutorialIndex = 0;
let tutorialResizeAttached = false;

const TUTORIAL_STEPS = [
    {
        selector: '.app-header',
        label: 'Nav Bar',
        title: 'Start with the nav bar',
        body: 'Switch themes, open settings, check Buddy Cloud status, and sign in when you are ready to protect a real budget.'
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
        selector: `#${BANNER_ID}`,
        label: 'Demo Timer',
        title: 'This is temporary sample data',
        body: 'The demo resets after 5 minutes. Create a free account when you want encrypted Buddy Cloud protection for a real budget.'
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

function clearDemoKeys() {
    [
        ACTIVE_KEY,
        STARTED_AT_KEY,
        EXPIRES_AT_KEY,
        BACKUP_HAS_DATA_KEY,
        BACKUP_DATA_KEY,
        BACKUP_UPDATED_AT_KEY
    ].forEach(storageRemove);
}

function clearBudgetScreenBeforeDemo() {
    [
        BB_DATA_KEY,
        BB_LOCAL_UPDATED_AT_KEY,
        BACKUP_HAS_DATA_KEY,
        BACKUP_DATA_KEY,
        BACKUP_UPDATED_AT_KEY
    ].forEach(storageRemove);
}

function backupCurrentBudget() {
    if (isDemoModeActive()) return;

    const currentData = storageGet(BB_DATA_KEY);
    const currentUpdatedAt = storageGet(BB_LOCAL_UPDATED_AT_KEY);

    storageSet(BACKUP_HAS_DATA_KEY, currentData ? 'true' : 'false');
    if (currentData) storageSet(BACKUP_DATA_KEY, currentData);
    else storageRemove(BACKUP_DATA_KEY);

    if (currentUpdatedAt) storageSet(BACKUP_UPDATED_AT_KEY, currentUpdatedAt);
    else storageRemove(BACKUP_UPDATED_AT_KEY);
}

function restorePreviousBudget() {
    const hadData = storageGet(BACKUP_HAS_DATA_KEY) === 'true';
    const backupData = storageGet(BACKUP_DATA_KEY);
    const backupUpdatedAt = storageGet(BACKUP_UPDATED_AT_KEY);

    if (hadData && backupData) {
        storageSet(BB_DATA_KEY, backupData);
    } else {
        storageRemove(BB_DATA_KEY);
    }

    if (backupUpdatedAt) {
        storageSet(BB_LOCAL_UPDATED_AT_KEY, backupUpdatedAt);
    } else {
        storageRemove(BB_LOCAL_UPDATED_AT_KEY);
    }
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
            makeTransaction('demo-savings-1', 'income', 250, 'Emergency Fund', 'Emergency fund deposit', -2, 'bank', 'Sample savings progress'),
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
    storageSet(BB_DATA_KEY, JSON.stringify(payload));
    storageSet(BB_LOCAL_UPDATED_AT_KEY, stampedAt);
}

function startDemo() {
    backupCurrentBudget();
    const now = Date.now();
    storageSet(ACTIVE_KEY, 'true');
    storageSet(STARTED_AT_KEY, String(now));
    storageSet(EXPIRES_AT_KEY, String(now + DEMO_DURATION_MS));
    seedDemoBudget();
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
        url.searchParams.delete(DEMO_QUERY_PARAM);
        Object.entries(extraParams).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') url.searchParams.delete(key);
            else url.searchParams.set(key, value);
        });
        return url.toString();
    } catch {
        return 'index.html';
    }
}

function loginUrl() {
    try {
        return new URL('login.html', window.location.href).toString();
    } catch {
        return 'login.html';
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

    restorePreviousBudget();
    clearDemoKeys();

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

    if (user && (requested || active)) {
        if (active) restorePreviousBudget();
        clearDemoKeys();
        return {
            active: false,
            disabledForSignedInUser: true,
            signedInDemoBlocked: true,
            demoRequestedWhileSignedIn: requested,
            demoWasActiveWhileSignedIn: active
        };
    }

    if (active && !requested) {
        restorePreviousBudget();
        clearDemoKeys();
        return { active: false, leftDemo: true };
    }

    if (active && demoExpired()) {
        restorePreviousBudget();
        clearDemoKeys();
        markDemoEnded('expired');
        return { active: false, expired: true };
    }

    if (requested && !active) {
        return startDemo();
    }

    if (isDemoModeActive() && !storageGet(BB_DATA_KEY)) {
        seedDemoBudget();
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

            .bb-demo-banner {
                grid-template-columns: 1fr;
                align-items: stretch;
                bottom: 10px;
                width: min(370px, calc(100vw - 20px));
                padding: 14px;
            }

            .bb-demo-banner-actions {
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
    banner.setAttribute('aria-label', 'BudgetBuddy demo mode');
    banner.innerHTML = `
        <div class="bb-demo-banner-content">
            <p class="bb-demo-label"><span class="bb-demo-pulse" aria-hidden="true"></span>Demo Mode</p>
            <p class="bb-demo-copy">Sample data resets in <span class="bb-demo-timer" data-demo-countdown>5:00</span>. Create a free account when you are ready to protect a real budget.</p>
        </div>
        <div class="bb-demo-banner-actions">
            <button type="button" class="bb-demo-action" data-demo-action="create-account">Create Free Account</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="tour">Tour</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="restart">Restart Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="end">End Demo</button>
            <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-action="website">Back to Website</button>
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
        }
    });

    document.body.appendChild(banner);
    document.body.classList.add('bb-demo-active');
}

function updateCountdown() {
    const remaining = getDemoExpiresAt() - Date.now();
    const timer = document.querySelector('[data-demo-countdown]');
    if (timer) timer.textContent = formatCountdown(remaining);

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

    const title = reason === 'expired' ? 'Demo time ended' : 'Demo cleared';
    const body = reason === 'expired'
        ? 'The 5-minute sample session ended. Your real budget is protected when you create a free account.'
        : 'The sample demo data has been cleared. Create a free account to start a real budget with encrypted Buddy Cloud protection.';

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'bb-demo-modal-overlay';
    overlay.innerHTML = `
        <div class="bb-demo-modal" role="dialog" aria-modal="true" aria-labelledby="bbDemoEndedTitle">
            <h2 id="bbDemoEndedTitle">${title}</h2>
            <p>${body}</p>
            <div class="bb-demo-modal-actions">
                <button type="button" class="bb-demo-action" data-demo-ended-action="create-account">Create Free Account</button>
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
    return 'BudgetBuddy account';
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
        throw new Error('BudgetBuddy could not confirm encrypted Buddy Cloud protection yet.');
    }
    await window.BuddyCloud.forcePush();
}

async function signOutAndStartDemo(overlay) {
    setSignedInPromptBusy(overlay, true);
    setSignedInPromptContent({
        title: 'Preparing demo safely...',
        body: 'BudgetBuddy is checking Buddy Cloud before it clears this browser budget screen.',
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
            body: 'BudgetBuddy could not confirm the encrypted Buddy Cloud backup, so it did not sign you out or clear this browser.',
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
            <p id="${SIGNED_IN_PROMPT_BODY_ID}">You are already logged in with a ${accountLabel}. Demo mode uses temporary sample data, so BudgetBuddy needs to sign out first before opening the demo.</p>
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

function renderAccountPrompt() {
    if (document.getElementById(ACCOUNT_PROMPT_ID) || isDemoModeActive()) return;

    const hasLocalBudget = hasMeaningfulLocalBudget();
    if (hasLocalBudget && sessionGet(ACCOUNT_PROMPT_DISMISSED_KEY) === 'true') return;

    const title = hasLocalBudget ? 'Protect this browser budget' : 'Create a free account to start BudgetBuddy';
    const body = hasLocalBudget
        ? 'This browser already has a local budget. Create a free account for encrypted Buddy Cloud protection, or keep using this browser without recovery support.'
        : 'Free accounts protect real budgets with encrypted Buddy Cloud and two active sync slots. Want to look around first? Try a 5-minute sample demo.';

    const overlay = document.createElement('div');
    overlay.id = ACCOUNT_PROMPT_ID;
    overlay.className = 'bb-demo-modal-overlay';
    overlay.innerHTML = `
        <div class="bb-demo-modal" role="dialog" aria-modal="true" aria-labelledby="bbDemoAccountPromptTitle">
            <h2 id="bbDemoAccountPromptTitle">${title}</h2>
            <p>${body}</p>
            <div class="bb-demo-modal-actions">
                <button type="button" class="bb-demo-action" data-demo-prompt-action="create-account">Create Free Account</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="demo">Try 5-Minute Demo</button>
                <button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="website">Back to Website</button>
                ${hasLocalBudget ? '<button type="button" class="bb-demo-action bb-demo-action-secondary" data-demo-prompt-action="continue">Keep Using Browser</button>' : ''}
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-demo-prompt-action]');
        if (!button) return;

        const action = button.getAttribute('data-demo-prompt-action');
        if (action === 'create-account') {
            window.location.href = loginUrl();
        } else if (action === 'demo') {
            window.location.href = cleanAppUrl({ [DEMO_QUERY_PARAM]: '1' });
        } else if (action === 'website') {
            window.location.href = mainSiteUrl();
        } else if (action === 'continue') {
            sessionSet(ACCOUNT_PROMPT_DISMISSED_KEY, 'true');
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-demo-prompt-action="create-account"]')?.focus({ preventScroll: true });
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
    card.setAttribute('aria-label', 'BudgetBuddy demo tutorial');
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
    if (user || demoRequested() || isDemoModeActive()) return;
    injectStyles();
    renderAccountPrompt();
}
