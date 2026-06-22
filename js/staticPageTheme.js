(function () {
    const THEME_KEY = 'bb_theme_mode';
    const ACCENT_KEY = 'bb_accent_color';
    const SESSION_ACCENT_KEY = 'bb_session_accent_color';
    const ENCRYPTED_AUTH_KEY = 'zam_supabase_auth_session_v1';
    const AUTH_METADATA_NAME = 'supabase_auth_session';
    const LEGACY_AUTH_KEY_PATTERN = /^sb-.+-auth-token$/;
    const FALLBACK_ACCENT = 'slate';
    const ACCENTS = {
        teal: ['#14b8a6', '#0f766e', '20, 184, 166', '#ffffff'],
        blue: ['#3b82f6', '#1d4ed8', '59, 130, 246', '#ffffff'],
        green: ['#22c55e', '#15803d', '34, 197, 94', '#ffffff'],
        amber: ['#f59e0b', '#92400e', '245, 158, 11', '#ffffff'],
        rose: ['#f43f5e', '#be123c', '244, 63, 94', '#ffffff'],
        indigo: ['#6366f1', '#4338ca', '99, 102, 241', '#ffffff'],
        slate: ['#64748b', '#334155', '100, 116, 139', '#ffffff'],
        orange: ['#f97316', '#9a3412', '249, 115, 22', '#ffffff'],
        cyan: ['#06b6d4', '#155e75', '6, 182, 212', '#ffffff'],
        sky: ['#0ea5e9', '#075985', '14, 165, 233', '#ffffff'],
        lime: ['#84cc16', '#3f6212', '132, 204, 22', '#ffffff'],
        emerald: ['#10b981', '#047857', '16, 185, 129', '#ffffff'],
        red: ['#ef4444', '#b91c1c', '239, 68, 68', '#ffffff'],
        pink: ['#ec4899', '#be185d', '236, 72, 153', '#ffffff'],
        zinc: ['#71717a', '#3f3f46', '113, 113, 122', '#ffffff']
    };

    function isValidAccent(accent) {
        return Object.prototype.hasOwnProperty.call(ACCENTS, accent);
    }

    function readStorage(storage, key) {
        try {
            return storage.getItem(key) || '';
        } catch (error) {
            return '';
        }
    }

    function writeStorage(storage, key, value) {
        try {
            storage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function chooseRandomAccent() {
        const accents = Object.keys(ACCENTS);
        return accents[Math.floor(Math.random() * accents.length)] || FALLBACK_ACCENT;
    }

    function getStoredTheme() {
        return localStorage.getItem(THEME_KEY) || 'system';
    }

    function resolveAccent() {
        const savedAccent = readStorage(localStorage, ACCENT_KEY);
        if (isValidAccent(savedAccent)) return savedAccent;

        const sessionAccent = readStorage(sessionStorage, SESSION_ACCENT_KEY);
        if (isValidAccent(sessionAccent)) return sessionAccent;

        const randomAccent = chooseRandomAccent();
        if (writeStorage(sessionStorage, SESSION_ACCENT_KEY, randomAccent)) {
            return randomAccent;
        }

        return FALLBACK_ACCENT;
    }

    function updateThemeButtons(mode) {
        document.querySelectorAll('.theme-opt').forEach((button) => {
            button.classList.toggle('active', button.dataset.themeVal === mode);
        });
    }

    function applyAccent() {
        const accent = resolveAccent();
        const [color, strong, rgb, onAccent] = ACCENTS[accent] || ACCENTS[FALLBACK_ACCENT];
        const root = document.documentElement;
        root.setAttribute('data-accent', accent);
        root.style.setProperty('--accent', color);
        root.style.setProperty('--accent-strong', strong);
        root.style.setProperty('--accent-on', onAccent || '#ffffff');
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

    function parseJson(value) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    function looksLikeEncryptedAuthRecord(value) {
        const stored = parseJson(value || '');
        return Boolean(
            stored
            && stored.kind === 'zam_local_metadata_vault'
            && stored.version === 1
            && stored.algorithm === 'AES-GCM'
            && stored.name === AUTH_METADATA_NAME
            && typeof stored.iv === 'string'
            && typeof stored.ciphertext === 'string'
        );
    }

    function getStoredAuthStatus() {
        try {
            if (looksLikeEncryptedAuthRecord(localStorage.getItem(ENCRYPTED_AUTH_KEY))) {
                return { signedIn: true };
            }

            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (key && LEGACY_AUTH_KEY_PATTERN.test(key) && localStorage.getItem(key)) {
                    return { signedIn: true };
                }
            }
        } catch (error) {
            console.warn('[staticPageTheme] Could not read local auth status:', error);
        }
        return { signedIn: false };
    }

    function updateAuthStatus() {
        const statusLinks = document.querySelectorAll('.footer-page-actions .btn-text:not(.footer-back-btn)');
        if (!statusLinks.length) return;

        const authStatus = getStoredAuthStatus();
        statusLinks.forEach((link) => {
            if (authStatus.signedIn) {
                link.href = 'index.html';
                link.textContent = 'Signed In';
                link.dataset.tooltip = 'Signed in on this browser';
                link.title = 'Signed in on this browser';
                link.setAttribute('aria-label', 'Signed in on this browser. Back to Zam!');
                link.classList.add('static-auth-signed-in');
            } else {
                link.href = 'login.html';
                link.textContent = 'Log In';
                link.dataset.tooltip = 'Log In';
                link.title = 'Log In';
                link.setAttribute('aria-label', 'Log in to Zam!');
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
        if (event.key === ENCRYPTED_AUTH_KEY || (event.key && LEGACY_AUTH_KEY_PATTERN.test(event.key))) {
            updateAuthStatus();
        }
    });
})();
