(function () {
    const COOKIE_NAME = 'zam_site_data_notice';
    const COOKIE_VALUE = 'acknowledged';
    const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
    const NOTICE_ID = 'zamSiteDataNotice';
    const STYLE_ID = 'zamSiteDataNoticeStyles';

    function getCookie(name) {
        const prefix = `${name}=`;
        return document.cookie
            .split(';')
            .map(part => part.trim())
            .find(part => part.startsWith(prefix))
            ?.slice(prefix.length) || '';
    }

    function setNoticeCookie() {
        const securePart = window.location.protocol === 'https:' ? '; Secure' : '';
        // No Domain attribute: keep this host-only for app.zambudget.com.
        document.cookie = `${COOKIE_NAME}=${COOKIE_VALUE}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${securePart}`;
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .site-data-notice {
                position: fixed;
                right: 1rem;
                bottom: 1rem;
                z-index: 2500;
                width: min(440px, calc(100vw - 2rem));
                padding: 0.9rem;
                color: var(--text, #0f172a);
                background: var(--surface, #ffffff);
                border: 1px solid var(--border, #cbd5e1);
                border-left: 4px solid var(--accent, #14b8a6);
                border-radius: 12px;
                box-shadow: 0 16px 36px var(--shadow, rgba(15, 23, 42, 0.18));
                display: grid;
                gap: 0.7rem;
                font-size: 0.82rem;
                line-height: 1.45;
            }

            .site-data-notice strong {
                display: block;
                margin-bottom: 0.18rem;
                color: var(--text, #0f172a);
                font-size: 0.9rem;
            }

            .site-data-notice p {
                margin: 0;
                color: var(--text-dim, #475569);
            }

            .site-data-notice-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 0.5rem;
                flex-wrap: wrap;
            }

            .site-data-notice-link,
            .site-data-notice-button {
                min-height: 34px;
                border-radius: 999px;
                padding: 0 0.85rem;
                font: inherit;
                font-size: 0.78rem;
                font-weight: 800;
                cursor: pointer;
                text-decoration: none;
            }

            .site-data-notice-link {
                display: inline-flex;
                align-items: center;
                color: var(--text, #0f172a);
                border: 1px solid var(--border, #cbd5e1);
                background: var(--bg, #f8fafc);
            }

            .site-data-notice-button {
                color: #ffffff;
                border: 0;
                background: var(--accent, #14b8a6);
            }

            .site-data-notice-button:active,
            .site-data-notice-link:active {
                transform: scale(0.97);
            }

            @media (max-width: 600px) {
                .site-data-notice {
                    right: 0.75rem;
                    bottom: 0.75rem;
                    left: 0.75rem;
                    width: auto;
                }

                .site-data-notice-actions {
                    justify-content: stretch;
                }

                .site-data-notice-link,
                .site-data-notice-button {
                    flex: 1 1 auto;
                    justify-content: center;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function dismissNotice() {
        setNoticeCookie();
        document.getElementById(NOTICE_ID)?.remove();
    }

    function showNotice() {
        if (getCookie(COOKIE_NAME) === COOKIE_VALUE || document.getElementById(NOTICE_ID)) return;

        injectStyles();

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.className = 'site-data-notice';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.innerHTML = `
            <div>
                <strong>Required cookie and site data</strong>
                <p>Zam uses required first-party site data on app.zambudget.com for budgets, sign-in state, Cloud Sync trusted browser keys, preferences, and security. No analytics or advertising cookies are used. Blocking site data may stop Zam from saving or loading correctly.</p>
            </div>
            <div class="site-data-notice-actions">
                <a class="site-data-notice-link" href="https://zambudget.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
                <button type="button" class="site-data-notice-button">I understand</button>
            </div>
        `;

        notice.querySelector('.site-data-notice-button')?.addEventListener('click', dismissNotice);
        document.body.appendChild(notice);
    }

    window.ZamSiteDataNotice = {
        cookieName: COOKIE_NAME,
        show: showNotice,
        dismiss: dismissNotice
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showNotice, { once: true });
    } else {
        showNotice();
    }
})();
