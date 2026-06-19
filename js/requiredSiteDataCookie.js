(function () {
    const COOKIE_NAME = 'zam_site_data_notice';
    const COOKIE_VALUE = 'required';
    const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

    function setRequiredSiteDataCookie() {
        try {
            const securePart = window.location.protocol === 'https:' ? '; Secure' : '';
            // No Domain attribute: keep this host-only for app.zambudget.com.
            document.cookie = `${COOKIE_NAME}=${COOKIE_VALUE}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${securePart}`;
        } catch {
            // Storage-blocked handling lives in the app startup guard.
        }
    }

    window.ZamRequiredSiteDataCookie = {
        cookieName: COOKIE_NAME,
        set: setRequiredSiteDataCookie
    };

    setRequiredSiteDataCookie();
})();
