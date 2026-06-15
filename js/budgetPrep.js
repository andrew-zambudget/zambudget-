// js/budgetPrep.js

const OVERLAY_ID = 'budgetPrepOverlay';
const STYLE_ID = 'budgetPrepStyles';
const TITLE_ID = 'budgetPrepTitle';
const DETAIL_ID = 'budgetPrepDetail';
const LINE_ID = 'budgetPrepLine';

const ROTATING_LINES = [
    'Giving every dollar a job.',
    'Lining up the decimal points.',
    'Checking Cloud Sync without peeking.',
    'Convincing categories to behave.',
    'Warming up the calculator.',
    'Making the math look calm.'
];

let lineTimer = null;
let lineIndex = 0;
let shownAt = 0;
let hideTimer = null;
let removeTimer = null;

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .budget-prep-overlay {
            position: fixed;
            inset: 0;
            z-index: 2600;
            display: grid;
            place-items: center;
            padding: 20px;
            background: rgba(15, 23, 42, 0.56);
            backdrop-filter: blur(10px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
        }

        .budget-prep-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .budget-prep-overlay.closing {
            opacity: 0;
            pointer-events: none;
        }

        .budget-prep-card {
            width: min(460px, 100%);
            padding: 28px;
            color: var(--text);
            background:
                linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), var(--surface));
            border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
            border-radius: 22px;
            box-shadow: 0 24px 80px var(--shadow);
            transform: translateY(10px) scale(0.985);
            transition: transform 220ms ease;
        }

        .budget-prep-overlay.active .budget-prep-card {
            transform: translateY(0) scale(1);
        }

        .budget-prep-mark {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            width: 88px;
            height: 56px;
            margin-bottom: 18px;
            align-items: end;
        }

        .budget-prep-mark span {
            display: block;
            height: 18px;
            border-radius: 8px 8px 4px 4px;
            background: var(--accent-strong);
            animation: budgetPrepBars 980ms ease-in-out infinite;
        }

        .budget-prep-mark span:nth-child(2) {
            height: 34px;
            background: color-mix(in srgb, var(--accent) 82%, var(--accent-strong));
            animation-delay: 110ms;
        }

        .budget-prep-mark span:nth-child(3) {
            height: 48px;
            background: color-mix(in srgb, var(--accent) 70%, var(--text));
            animation-delay: 220ms;
        }

        .budget-prep-mark span:nth-child(4) {
            height: 26px;
            background: var(--accent);
            animation-delay: 330ms;
        }

        .budget-prep-kicker {
            margin: 0 0 8px;
            color: var(--accent-strong);
            font-size: 0.78rem;
            font-weight: 900;
            letter-spacing: 0;
            text-transform: uppercase;
        }

        .budget-prep-card h2 {
            margin: 0 0 10px;
            color: var(--text);
            font-size: clamp(1.55rem, 5vw, 2.1rem);
            line-height: 1.08;
            letter-spacing: 0;
        }

        .budget-prep-card p {
            margin: 0;
            color: var(--text-dim);
            line-height: 1.5;
        }

        .budget-prep-meter {
            position: relative;
            height: 10px;
            margin: 22px 0 14px;
            overflow: hidden;
            border-radius: 999px;
            background: var(--border);
        }

        .budget-prep-meter span {
            position: absolute;
            inset: 0 auto 0 0;
            width: 45%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--accent-strong), var(--accent), color-mix(in srgb, var(--accent) 72%, var(--text)));
            animation: budgetPrepMeter 1.35s ease-in-out infinite;
        }

        .budget-prep-line {
            min-height: 1.4em;
            font-size: 0.92rem;
            font-weight: 700;
        }

        .budget-prep-overlay.is-error .budget-prep-mark span,
        .budget-prep-overlay.is-error .budget-prep-meter span {
            animation-play-state: paused;
            background: #dc2626;
        }

        .budget-prep-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 18px;
        }

        .budget-prep-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 42px;
            padding: 0 16px;
            border: 0;
            border-radius: 999px;
            color: #ffffff;
            background: var(--accent-strong);
            font: inherit;
            font-weight: 800;
            cursor: pointer;
        }

        .budget-prep-action-secondary {
            color: var(--text);
            background: color-mix(in srgb, var(--accent) 10%, var(--surface));
        }

        @keyframes budgetPrepBars {
            0%, 100% { transform: scaleY(0.72); opacity: 0.72; }
            50% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes budgetPrepMeter {
            0% { transform: translateX(-105%); }
            55% { transform: translateX(70%); }
            100% { transform: translateX(235%); }
        }

        @media (max-width: 540px) {
            .budget-prep-overlay {
                align-items: start;
                padding: 84px 14px 18px;
            }

            .budget-prep-card {
                padding: 22px;
                border-radius: 18px;
            }

            .budget-prep-action {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

function ensureOverlay() {
    injectStyles();

    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'budget-prep-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
        <div class="budget-prep-card">
            <div class="budget-prep-mark" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </div>
            <p class="budget-prep-kicker">BudgetBuddy</p>
            <h2 id="${TITLE_ID}">Preparing budget...</h2>
            <p id="${DETAIL_ID}">Checking your account and encrypted sync state.</p>
            <div class="budget-prep-meter" aria-hidden="true"><span></span></div>
            <p id="${LINE_ID}" class="budget-prep-line">${ROTATING_LINES[0]}</p>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function setText({ title, detail, line } = {}) {
    const titleEl = document.getElementById(TITLE_ID);
    const detailEl = document.getElementById(DETAIL_ID);
    const lineEl = document.getElementById(LINE_ID);

    if (title && titleEl) titleEl.textContent = title;
    if (detail && detailEl) detailEl.textContent = detail;
    if (line && lineEl) lineEl.textContent = line;
}

function startLineRotation() {
    if (lineTimer) return;
    lineTimer = window.setInterval(() => {
        const lineEl = document.getElementById(LINE_ID);
        if (!lineEl) return;
        lineIndex = (lineIndex + 1) % ROTATING_LINES.length;
        lineEl.textContent = ROTATING_LINES[lineIndex];
    }, 1450);
}

function stopLineRotation() {
    if (!lineTimer) return;
    window.clearInterval(lineTimer);
    lineTimer = null;
}

function cancelHideTimers() {
    if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
    }
    if (removeTimer) {
        window.clearTimeout(removeTimer);
        removeTimer = null;
    }
}

export function showPreparingBudget(options = {}) {
    const overlay = ensureOverlay();
    cancelHideTimers();
    overlay.classList.remove('closing', 'is-error');
    setText(options);
    shownAt = shownAt || Date.now();
    window.requestAnimationFrame?.(() => overlay.classList.add('active'));
    if (!window.requestAnimationFrame) overlay.classList.add('active');
    startLineRotation();
    return overlay;
}

export function updatePreparingBudget(options = {}) {
    if (!document.getElementById(OVERLAY_ID)) return;
    setText(options);
}

export function hidePreparingBudget({ minVisibleMs = 850 } = {}) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const elapsed = shownAt ? Date.now() - shownAt : minVisibleMs;
    const waitMs = Math.max(0, minVisibleMs - elapsed);
    cancelHideTimers();
    hideTimer = window.setTimeout(() => {
        hideTimer = null;
        stopLineRotation();
        overlay.classList.add('closing');
        overlay.classList.remove('active');
        removeTimer = window.setTimeout(() => {
            removeTimer = null;
            overlay.remove();
            shownAt = 0;
            lineIndex = 0;
        }, 220);
    }, waitMs);
}

export function failPreparingBudget({ title = 'Budget needs a refresh', detail = 'BudgetBuddy could not finish preparing the dashboard. Your budget data was not changed.' } = {}) {
    const overlay = ensureOverlay();
    cancelHideTimers();
    stopLineRotation();
    shownAt = shownAt || Date.now();
    overlay.classList.add('active', 'is-error');
    overlay.classList.remove('closing');
    setText({
        title,
        detail,
        line: 'The calculator tripped over a decimal point. Refreshing usually fixes this.'
    });

    const card = overlay.querySelector('.budget-prep-card');
    if (card && !card.querySelector('.budget-prep-actions')) {
        const actions = document.createElement('div');
        actions.className = 'budget-prep-actions';
        actions.innerHTML = `
            <button type="button" class="budget-prep-action" data-budget-prep-action="refresh">Refresh</button>
            <button type="button" class="budget-prep-action budget-prep-action-secondary" data-budget-prep-action="dismiss">Dismiss</button>
        `;
        actions.addEventListener('click', event => {
            const button = event.target.closest('[data-budget-prep-action]');
            if (!button) return;
            const action = button.getAttribute('data-budget-prep-action');
            if (action === 'refresh') window.location.reload();
            if (action === 'dismiss') hidePreparingBudget({ minVisibleMs: 0 });
        });
        card.appendChild(actions);
    }
}

export function isPreparingBudgetVisible() {
    return Boolean(document.getElementById(OVERLAY_ID)?.classList.contains('active'));
}
