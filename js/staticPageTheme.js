(function () {
    const THEME_KEY = 'bb_theme_mode';
    const ACCENT_KEY = 'bb_accent_color';
    const ACCENTS = {
        teal: ['#14b8a6', '#0f766e', '20, 184, 166'],
        blue: ['#3b82f6', '#1d4ed8', '59, 130, 246'],
        green: ['#22c55e', '#15803d', '34, 197, 94'],
        amber: ['#f59e0b', '#b45309', '245, 158, 11'],
        rose: ['#f43f5e', '#be123c', '244, 63, 94'],
        indigo: ['#6366f1', '#4338ca', '99, 102, 241'],
        slate: ['#64748b', '#334155', '100, 116, 139'],
        orange: ['#f97316', '#c2410c', '249, 115, 22'],
        cyan: ['#06b6d4', '#0e7490', '6, 182, 212'],
        sky: ['#0ea5e9', '#0369a1', '14, 165, 233'],
        lime: ['#84cc16', '#4d7c0f', '132, 204, 22'],
        emerald: ['#10b981', '#047857', '16, 185, 129'],
        red: ['#ef4444', '#b91c1c', '239, 68, 68'],
        pink: ['#ec4899', '#be185d', '236, 72, 153'],
        zinc: ['#71717a', '#3f3f46', '113, 113, 122']
    };

    function getStoredTheme() {
        return localStorage.getItem(THEME_KEY) || 'system';
    }

    function getStoredAccent() {
        const saved = localStorage.getItem(ACCENT_KEY) || 'teal';
        return Object.prototype.hasOwnProperty.call(ACCENTS, saved) ? saved : 'teal';
    }

    function updateThemeButtons(mode) {
        document.querySelectorAll('.theme-opt').forEach((button) => {
            button.classList.toggle('active', button.dataset.themeVal === mode);
        });
    }

    function applyAccent() {
        const accent = getStoredAccent();
        const [color, strong, rgb] = ACCENTS[accent];
        const root = document.documentElement;
        root.setAttribute('data-accent', accent);
        root.style.setProperty('--accent', color);
        root.style.setProperty('--accent-strong', strong);
        root.style.setProperty('--accent-rgb', rgb);
    }

    function applyTheme(mode = getStoredTheme()) {
        const root = document.documentElement;
        if (mode === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', mode);
        }
        localStorage.setItem(THEME_KEY, mode);
        updateThemeButtons(mode);
        applyAccent();
    }

    function getStoredAuthUser() {
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !/^sb-.+-auth-token$/.test(key)) continue;

                const stored = JSON.parse(localStorage.getItem(key) || 'null');
                const session = stored?.currentSession || stored;
                const user = session?.user || stored?.user;
                if (user?.id) return user;
            }
        } catch (error) {
            console.warn('[staticPageTheme] Could not read local auth status:', error);
        }
        return null;
    }

    function updateAuthStatus() {
        const statusLinks = document.querySelectorAll('.footer-page-actions .btn-text:not(.footer-back-btn)');
        if (!statusLinks.length) return;

        const user = getStoredAuthUser();
        statusLinks.forEach((link) => {
            if (user) {
                const email = user.email || 'signed-in account';
                link.href = 'index.html';
                link.textContent = 'Signed In';
                link.dataset.tooltip = email;
                link.title = email;
                link.setAttribute('aria-label', `Signed in as ${email}. Back to BudgetBuddy.`);
                link.classList.add('static-auth-signed-in');
            } else {
                link.href = 'login.html';
                link.textContent = 'Log In';
                link.dataset.tooltip = 'Log In';
                link.title = 'Log In';
                link.setAttribute('aria-label', 'Log in to BudgetBuddy');
                link.classList.remove('static-auth-signed-in');
            }
        });
    }

    window.setTheme = applyTheme;
    window.applyStaticPageTheme = function () {
        applyTheme(getStoredTheme());
        updateAuthStatus();
    };

    window.applyStaticPageTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getStoredTheme() === 'system') window.applyStaticPageTheme();
    });

    window.addEventListener('storage', (event) => {
        if (event.key && /^sb-.+-auth-token$/.test(event.key)) updateAuthStatus();
    });
})();
