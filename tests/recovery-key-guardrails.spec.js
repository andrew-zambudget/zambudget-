const { test, expect } = require('@playwright/test');
const {
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const TEST_USER_ID = 'fresh-recovery-key-user';
const TEST_EMAIL = 'test-user@example.invalid';

function installFreshSignedInSupabaseStub(page) {
    return page.route(/.*(?:@supabase\/supabase-js@2|js\/vendor\/supabase\.js).*/, route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
            const testUser = {
                id: '${TEST_USER_ID}',
                email: '${TEST_EMAIL}',
                app_metadata: { provider: 'email', providers: ['email'] },
                identities: [{ provider: 'email' }]
            };
            const store = {
                vault: null,
                snapshots: [],
                browserAccess: []
            };

            function makeQuery(table) {
                const state = {
                    filters: {},
                    limit: 0,
                    updateFields: null,
                    deleteRequested: false
                };
                const query = {
                    select() { return this; },
                    eq(column, value) {
                        state.filters[column] = value;
                        return this;
                    },
                    order() { return this; },
                    limit(value) {
                        state.limit = Number(value) || 0;
                        return this;
                    },
                    range() { return this; },
                    maybeSingle() {
                        if (table === 'buddy_cloud_vaults') {
                            return Promise.resolve({ data: store.vault ? { ...store.vault } : null, error: null });
                        }
                        if (table === 'buddy_cloud_browser_access') {
                            const row = store.browserAccess.find(item => (
                                item.user_id === state.filters.user_id
                                && item.browser_hash === state.filters.browser_hash
                            ));
                            return Promise.resolve({ data: row ? { ...row } : null, error: null });
                        }
                        if (table === 'buddy_cloud_vault_snapshots') {
                            return Promise.resolve({ data: store.snapshots[0] ? { ...store.snapshots[0] } : null, error: null });
                        }
                        return Promise.resolve({ data: null, error: null });
                    },
                    single() {
                        return this.maybeSingle();
                    },
                    insert(row) {
                        if (table === 'buddy_cloud_vault_snapshots') {
                            store.snapshots.unshift({ ...row });
                        }
                        return Promise.resolve({ data: row, error: null });
                    },
                    upsert(row) {
                        if (table === 'buddy_cloud_vaults') {
                            store.vault = {
                                ...(store.vault || {}),
                                ...row,
                                updated_at: row.updated_at || row.client_updated_at
                            };
                            return Promise.resolve({ data: store.vault, error: null });
                        }
                        if (table === 'buddy_cloud_browser_access') {
                            const index = store.browserAccess.findIndex(item => (
                                item.user_id === row.user_id
                                && item.browser_hash === row.browser_hash
                            ));
                            if (index >= 0) {
                                store.browserAccess[index] = { ...store.browserAccess[index], ...row };
                            } else {
                                store.browserAccess.push({ ...row });
                            }
                            return Promise.resolve({ data: row, error: null });
                        }
                        return Promise.resolve({ data: row, error: null });
                    },
                    update(fields) {
                        state.updateFields = fields;
                        return this;
                    },
                    delete() {
                        state.deleteRequested = true;
                        return this;
                    },
                    then(resolve, reject) {
                        if (table === 'buddy_cloud_browser_access') {
                            let rows = store.browserAccess.filter(item => item.user_id === state.filters.user_id);
                            if (state.updateFields) {
                                rows = rows.map(row => ({ ...row, ...state.updateFields }));
                                store.browserAccess = store.browserAccess.map(row => (
                                    row.user_id === state.filters.user_id ? { ...row, ...state.updateFields } : row
                                ));
                            }
                            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                        }
                        if (table === 'buddy_cloud_vault_snapshots') {
                            const rows = state.limit ? store.snapshots.slice(0, state.limit) : [...store.snapshots];
                            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                        }
                        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                    }
                };
                return query;
            }

            window.supabase = {
                createClient() {
                    return {
                        auth: {
                            getSession: async () => ({ data: { session: { user: testUser } }, error: null }),
                            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                            signOut: async () => ({ error: null })
                        },
                        from: makeQuery,
                        functions: {
                            invoke: async () => ({ data: { active: false, subscriptionStatus: 'inactive' }, error: null })
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
        `
    }));
}

async function waitForRecoveryKeySetupModal(page) {
    await page.goto('/index.html');
    const modal = page.locator('#buddyCloudModal');
    await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Save Your Recovery Key', { timeout: 20000 });
    await expect(modal).toContainText('Take 10 seconds to read this.');
    await expect(modal).toContainText('save this Recovery Key within 72 hours');
    return modal;
}

test.describe('recovery key setup guardrails', () => {
    test.beforeEach(async ({ page }) => {
        await installFreshSignedInSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('fresh setup requires a 10-second acknowledgement before 72-hour reminder', async ({ page }) => {
        const modal = await waitForRecoveryKeySetupModal(page);

        await expect(modal.locator('.buddy-cloud-close')).toHaveCount(0);
        await expect(modal.getByRole('button', { name: 'I saved my Recovery Key' })).toBeDisabled();
        await expect(modal.getByRole('button', { name: /Read first/ })).toBeDisabled();

        await page.waitForTimeout(11000);

        await expect(modal.getByRole('button', { name: 'I saved my Recovery Key' })).toBeEnabled();
        const remindButton = modal.getByRole('button', { name: 'I understand - remind me for 72 hours' });
        await expect(remindButton).toBeEnabled();
        await remindButton.click();

        await expect(modal).toBeHidden();
        const flags = await page.evaluate((userId) => ({
            backedUp: localStorage.getItem('bb_cloud_recovery_key_backed_up_' + userId),
            saved: localStorage.getItem('bb_cloud_recovery_key_saved_' + userId),
            graceStarted: localStorage.getItem('bb_cloud_recovery_key_grace_started_' + userId)
        }), TEST_USER_ID);

        expect(flags.backedUp).toBeNull();
        expect(flags.saved).toBeNull();
        expect(flags.graceStarted).toBeTruthy();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
        await page.waitForFunction(() => {
            const status = window.BuddyCloud?.getStatus?.() || {};
            return Boolean(status.signedIn && status.enabled && status.hasKey && !status.hasExportableKey);
        });

        const nudge = page.locator('.sync-cloud-nudge');
        await expect(nudge).toContainText('Recovery key reminder');
        await expect(nudge).toContainText('Recovery key backup is not verified');
        await expect(nudge).toContainText('If you did not save it, open Recovery Help');
    });

    test('fresh setup validates pasted recovery key before marking it saved', async ({ page }) => {
        const modal = await waitForRecoveryKeySetupModal(page);
        const recoveryKey = await page.locator('#buddyCloudModalInput').inputValue();

        await page.waitForTimeout(11000);
        await modal.getByRole('button', { name: 'I saved my Recovery Key' }).click();

        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Important: We Cannot Recover This Key');
        const confirmModal = page.locator('#buddyCloudModal');
        const confirmInput = page.locator('#buddyCloudModalInput');
        const error = page.locator('[data-key-confirm-error]');
        const confirmButton = confirmModal.getByRole('button', { name: 'I saved my Recovery Key' });

        await confirmButton.click();
        await expect(confirmModal).toBeVisible();
        await expect(error).toBeVisible();
        await expect(error).toHaveText('Paste your Recovery Key to continue.');

        await confirmInput.fill('wrong recovery key');
        await confirmButton.click();
        await expect(confirmModal).toBeVisible();
        await expect(error).toBeVisible();
        await expect(error).toHaveText('That does not match this Recovery Key. Paste the key you just saved.');

        await confirmInput.fill(recoveryKey);
        await confirmButton.click();
        await expect(confirmModal).toBeHidden();

        const flags = await page.evaluate((userId) => ({
            backedUp: localStorage.getItem('bb_cloud_recovery_key_backed_up_' + userId),
            saved: localStorage.getItem('bb_cloud_recovery_key_saved_' + userId),
            graceStarted: localStorage.getItem('bb_cloud_recovery_key_grace_started_' + userId)
        }), TEST_USER_ID);

        expect(flags.backedUp).toBe('true');
        expect(flags.saved).toBe('true');
        expect(flags.graceStarted).toBeNull();
    });
});
