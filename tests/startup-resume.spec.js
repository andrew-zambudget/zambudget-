const { test, expect } = require('@playwright/test');
const {
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const RESUME_SESSION = {
    access_token: 'resume-test-token',
    refresh_token: 'resume-test-refresh',
    user: {
        id: 'resume-user-1',
        email: 'resume-user@example.com'
    }
};

function supabaseSignedInResumeStub() {
    return `
        const resumeSession = ${JSON.stringify(RESUME_SESSION)};
        window.__zamAuthStateCallbacks = [];
        window.supabase = {
            createClient() {
                const emptyQuery = {
                    select() { return this; },
                    insert() { return Promise.resolve({ data: null, error: null }); },
                    update() { return this; },
                    upsert() { return Promise.resolve({ data: null, error: null }); },
                    delete() { return this; },
                    eq() { return this; },
                    order() { return this; },
                    limit() { return this; },
                    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
                    single() { return Promise.resolve({ data: null, error: null }); },
                    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
                };

                return {
                    auth: {
                        getSession: async () => ({ data: { session: resumeSession }, error: null }),
                        onAuthStateChange: (callback) => {
                            window.__zamAuthStateCallbacks.push(callback);
                            window.__zamAuthStateCallback = callback;
                            return { data: { subscription: { unsubscribe() {} } } };
                        },
                        signOut: async () => ({ error: null })
                    },
                    from: () => emptyQuery,
                    functions: {
                        invoke: async () => ({ data: { isPremium: false, status: 'free' }, error: null })
                    },
                    channel: () => ({
                        on() { return this; },
                        subscribe(callback) {
                            if (typeof callback === 'function') callback('SUBSCRIBED');
                            return this;
                        },
                        unsubscribe() {}
                    }),
                    removeChannel: async () => ({ error: null })
                };
            }
        };
    `;
}

async function installSignedInResumeStub(page) {
    await page.route('**/config.json', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            supabaseUrl: 'https://example.supabase.co',
            supabaseAnonKey: 'test-anon-key',
            billingEnabled: false,
            localVaultStorageEnabled: false
        })
    }));
    await page.route('**/js/vendor/supabase.js', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: supabaseSignedInResumeStub()
    }));
    await page.route('**/@supabase/supabase-js@2', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: supabaseSignedInResumeStub()
    }));
}

async function waitForBudgetPrepInactive(page) {
    await page.waitForFunction(() => {
        const overlay = document.getElementById('budgetPrepOverlay');
        return !overlay || !overlay.classList.contains('active');
    }, null, { timeout: 15000 });
}

async function settleInitialRecoveryPromptIfShown(page) {
    const remindButton = page.getByRole('button', { name: /remind me for 72 hours/i });
    try {
        await remindButton.waitFor({ state: 'visible', timeout: 2000 });
        await remindButton.click();
    } catch {
        // Existing/trusted test states may not show the first-run recovery prompt.
    }
}

async function watchForBudgetPrepActivation(page, durationMs = 700) {
    return page.evaluate(async (watchMs) => {
        const started = Date.now();
        while (Date.now() - started < watchMs) {
            const overlay = document.getElementById('budgetPrepOverlay');
            if (overlay?.classList.contains('active')) return true;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
    }, durationMs);
}

test.describe('startup and tab resume behavior', () => {
    test.beforeEach(async ({ page }) => {
        await resetBrowserStorage(page);
        await page.evaluate((userId) => {
            sessionStorage.setItem(`bb_cloud_default_setup_attempted_${userId}`, 'true');
        }, RESUME_SESSION.user.id);
        await installSignedInResumeStub(page);
    });

    test('same-user auth refresh after startup does not show the full budget prep overlay', async ({ page }) => {
        await page.goto('/app');
        await waitForAppReady(page);
        await settleInitialRecoveryPromptIfShown(page);
        await waitForBudgetPrepInactive(page);

        const setupMarkerState = await page.evaluate((userId) => {
            const sessionKeys = Object.keys(sessionStorage);
            const hardenedKeys = sessionKeys.filter(key => key.startsWith('bb_cloud_default_setup_attempted_v1_'));
            const legacyKey = `bb_cloud_default_setup_attempted_${userId}`;
            return {
                legacySessionMarker: sessionStorage.getItem(legacyKey),
                legacyLocalMarker: localStorage.getItem(legacyKey),
                hardenedKeys,
                hardenedValues: hardenedKeys.map(key => sessionStorage.getItem(key))
            };
        }, RESUME_SESSION.user.id);

        expect(setupMarkerState.legacySessionMarker).toBeNull();
        expect(setupMarkerState.legacyLocalMarker).toBeNull();
        setupMarkerState.hardenedKeys.forEach((key) => {
            expect(key).not.toContain(RESUME_SESSION.user.id);
        });
        setupMarkerState.hardenedValues.forEach((value) => {
            expect(value).toMatch(/^zcs-default-setup:v1:/);
            expect(value).not.toBe('true');
        });

        await page.evaluate(() => {
            window.replaceSnapshot({
                transactions: [{
                    id: 'resume-visible-tx',
                    type: 'expense',
                    description: 'Resume coffee',
                    category: 'Groceries',
                    amount: 8.25,
                    date: '2026-06-22',
                    paymentMethod: 'card',
                    notes: ''
                }],
                categories: [{
                    id: 'resume-groceries',
                    type: 'expense',
                    name: 'Groceries',
                    icon: 'G',
                    budget: 100,
                    createdAt: '2026-06-22T12:00:00.000Z'
                }],
                settings: {}
            }, { remoteUpdatedAt: '2026-06-22T12:00:00.000Z' });
            window.render?.();
        });

        await expect.poll(() => page.evaluate(() => (
            window.getTransactions?.().some(tx => tx.description === 'Resume coffee')
        ))).toBe(true);

        await page.evaluate(async (session) => {
            if (typeof window.__zamAuthStateCallback !== 'function') {
                throw new Error('Auth state callback was not registered.');
            }
            await window.__zamAuthStateCallback('TOKEN_REFRESHED', session);
        }, RESUME_SESSION);

        await expect(watchForBudgetPrepActivation(page)).resolves.toBe(false);
        await expect.poll(() => page.evaluate(() => (
            window.getTransactions?.().some(tx => tx.description === 'Resume coffee')
        ))).toBe(true);
    });
});
