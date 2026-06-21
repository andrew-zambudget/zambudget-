const { expect, test } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

function modulePath(path) {
    return `${path}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test.describe('Cloud Sync device management', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('migrates browser access token to encrypted local metadata during registry refresh', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const rows = [];
            const legacyToken = 'LEGACY_BROWSER_ACCESS_TOKEN_SENTINEL';
            const legacyKey = 'bb_browser_access_token_browser-access-runtime-user';
            const storageKey = 'bb_browser_access_tokens_v1';
            const encodeBase64Url = bytes => {
                let binary = '';
                bytes.forEach(byte => { binary += String.fromCharCode(byte); });
                return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
            };
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(legacyToken));
            const expectedHash = encodeBase64Url(new Uint8Array(digest));

            localStorage.setItem(legacyKey, legacyToken);

            const makeQuery = () => ({
                select() { return this; },
                eq() { return this; },
                order() { return this; },
                maybeSingle() {
                    return Promise.resolve({ data: null, error: null });
                },
                upsert(payload) {
                    rows.unshift({
                        created_at: '2026-06-21T20:00:00.000Z',
                        ...payload
                    });
                    return Promise.resolve({ data: payload, error: null });
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                }
            });

            window.currentUser = {
                id: 'browser-access-runtime-user',
                email: 'browser-access-runtime@example.com'
            };
            window.sb = {
                from: () => makeQuery(),
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
            window.BuddyCloud = {
                refreshSyncSlotStatus: async () => true,
                getCurrentSyncSlotHash: async () => '',
                getStatus: () => ({
                    signedIn: true,
                    enabled: true,
                    hasKey: true,
                    canUseCloud: true,
                    isPremium: true,
                    multiDeviceAllowed: true,
                    syncSlotRows: []
                })
            };

            await window.refreshBrowserAccessRegistry({ silent: false });

            return {
                expectedHash,
                raw: localStorage.getItem(storageKey) || '',
                legacyValue: localStorage.getItem(legacyKey),
                keys: Object.keys(localStorage).sort(),
                rows
            };
        });

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].browser_hash).toBe(result.expectedHash);
        expect(result.raw).toContain('zam_local_metadata_vault');
        expect(result.raw).toContain('browser_access_tokens');
        expect(result.raw).not.toContain('LEGACY_BROWSER_ACCESS_TOKEN_SENTINEL');
        expect(result.legacyValue).toBeNull();
        expect(result.keys).toContain('bb_browser_access_tokens_v1');
        expect(result.keys).not.toContain('bb_browser_access_token_browser-access-runtime-user');
    });

    test('shows available Free sync slot when current browser is inactive', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            const rows = [];
            const makeQuery = () => {
                const query = {
                    select() { return this; },
                    eq() { return this; },
                    order() { return this; },
                    maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                    },
                    upsert(payload) {
                        const existingIndex = rows.findIndex(row => row.browser_hash === payload.browser_hash);
                        if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...payload };
                        else rows.unshift({
                            created_at: '2026-06-13T18:00:00.000Z',
                            ...payload
                        });
                        return Promise.resolve({ data: payload, error: null });
                    },
                    then(resolve, reject) {
                        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                    }
                };
                return query;
            };

            window.currentUser = {
                id: 'device-free-slot-user',
                email: 'device-free-slot@example.com'
            };
            window.sb = {
                from: () => makeQuery(),
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
            window.BuddyCloud = {
                getStatus: () => ({
                    signedIn: true,
                    enabled: true,
                    hasKey: true,
                    canUseCloud: true,
                    syncing: false,
                    hasConflict: false,
                    lastError: '',
                    isPremium: false,
                    multiDeviceAllowed: false,
                    syncSlotBlocked: false,
                    syncSlotCurrentBrowserActive: false,
                    syncSlotCurrentHash: '',
                    syncSlotDeviceCount: 1,
                    freeDeviceLimit: 2,
                    syncSlotLimit: 2,
                    syncSlotRows: [{
                        hash: 'occupied-slot-hash',
                        claimed_at: '2026-06-13T17:00:00.000Z',
                        last_seen_at: '2026-06-13T17:30:00.000Z'
                    }]
                }),
                refreshSyncSlotStatus: async () => true,
                getCurrentSyncSlotHash: async () => '',
                releaseSyncSlotByHash: async () => true,
                syncNow: async () => true
            };

            window.openBuddyCloudDeviceManagement();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Cloud Sync Devices');
        await expect(modal).toContainText('This browser is signed in but is not using a Free sync slot yet.');
        await expect(modal).toContainText('Unlinked sync slot');
        await expect(modal).toContainText('Not tied to a visible browser');
        await expect(modal).toContainText('Current browser · Sync slot inactive');
        await expect(modal).toContainText('Available sync slot');
        await expect(modal.getByRole('button', { name: 'Use This Browser' })).toBeVisible();
        await modal.getByRole('button', { name: 'Release sync slot' }).click();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Release Unlinked Sync Slot?');
        await expect(page.locator('#buddyCloudModal')).toContainText('not tied to a visible Zam! browser record');
        await expect(modal).not.toContainText('Current browser · Sync paused');
    });

    test('surfaces local changes that are not backed up in the Cloud Sync status panel', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            const status = {
                signedIn: true,
                enabled: true,
                hasKey: true,
                canUseCloud: true,
                syncing: false,
                hasConflict: false,
                lastError: '',
                hasUnverifiedLocalChanges: true,
                localUpdatedAt: '2026-06-13T20:10:00.000Z',
                lastVerifiedCloudAt: '2026-06-13T19:00:00.000Z',
                isPremium: false,
                multiDeviceAllowed: false,
                syncSlotBlocked: false,
                syncSlotCurrentBrowserActive: false,
                syncSlotCurrentHash: 'current-browser-hash',
                syncSlotDeviceCount: 1,
                freeDeviceLimit: 2,
                syncSlotLimit: 2,
                syncSlotRows: [{
                    hash: 'other-browser-hash',
                    claimed_at: '2026-06-13T18:00:00.000Z',
                    last_seen_at: '2026-06-13T19:30:00.000Z'
                }]
            };
            window.currentUser = {
                id: 'unbacked-local-user',
                email: 'unbacked-local@example.com'
            };
            window.BuddyCloud = {
                getStatus: () => status,
                refreshSyncSlotStatus: async () => true,
                getCurrentSyncSlotHash: async () => status.syncSlotCurrentHash,
                syncNow: async () => true
            };
            window.dispatchEvent(new CustomEvent('buddy-cloud-status', { detail: status }));
        });

        const statusButton = page.locator('#syncStatusBtn');
        await expect(statusButton).toHaveAttribute('aria-label', /Local changes not backed up/);

        await statusButton.click();

        const panel = page.locator('#syncHistoryPanel');
        await expect(panel).toBeVisible();
        await expect(page.locator('#syncHistoryStatusBadge')).toHaveText('Paused');
        await expect(page.locator('#syncCloudNudge')).toContainText('Local changes not backed up');
        await expect(page.locator('#syncCloudNudge')).toContainText('Changes on this browser are saved locally but have not been backed up to Cloud Sync.');
        await expect(page.locator('#syncCloudNudge')).toContainText('Sync this browser before clearing data or signing out.');
    });

    test('reclaims inactive Free sync slots after the active-browser lease window', async ({ page }) => {
        const result = await page.evaluate(async (cloudModulePath) => {
            const realNow = Date.now;
            Date.now = () => new Date('2026-06-13T12:00:00.000Z').getTime();

            const remote = {
                payload: null,
                payload_checksum: '',
                client_updated_at: '2026-06-13T10:00:00.000Z',
                updated_at: '2026-06-13T10:00:00.000Z',
                sync_owner_slots: [
                    {
                        hash: 'stale-slot',
                        claimed_at: '2026-06-13T09:00:00.000Z',
                        last_seen_at: '2026-06-13T10:59:59.000Z'
                    },
                    {
                        hash: 'active-slot',
                        claimed_at: '2026-06-13T11:20:00.000Z',
                        last_seen_at: '2026-06-13T11:20:00.000Z'
                    }
                ]
            };
            let persistedFields = null;
            const makeQuery = () => {
                const query = {
                    select() { return this; },
                    eq() { return this; },
                    maybeSingle() {
                        return Promise.resolve({ data: { ...remote }, error: null });
                    },
                    update(fields) {
                        persistedFields = fields;
                        remote.sync_owner_slots = fields.sync_owner_slots;
                        remote.sync_owner_hash = fields.sync_owner_hash;
                        remote.sync_owner_claimed_at = fields.sync_owner_claimed_at;
                        remote.sync_owner_last_seen_at = fields.sync_owner_last_seen_at;
                        this._result = { data: { ...remote }, error: null };
                        return this;
                    },
                    then(resolve, reject) {
                        return Promise.resolve(this._result || { data: [], error: null }).then(resolve, reject);
                    }
                };
                return query;
            };

            const Cloud = await import(cloudModulePath);
            try {
                await Cloud.init({
                    supabaseClient: {
                        from: () => makeQuery(),
                        channel: () => ({
                            on() { return this; },
                            subscribe(callback) {
                                if (typeof callback === 'function') callback('SUBSCRIBED');
                                return this;
                            },
                            unsubscribe() {}
                        }),
                        removeChannel: async () => ({ error: null })
                    },
                    user: { id: 'lease-window-user', email: 'lease@example.com' },
                    getSnapshot: () => ({ transactions: [], categories: [], settings: {}, meta: {} }),
                    replaceSnapshot: () => {},
                    afterRemoteApply: () => {},
                    isPremiumAccount: () => false
                });
                await Cloud.refreshSyncSlotStatus();
                const status = Cloud.getStatus();
                return {
                    persistedHashes: persistedFields?.sync_owner_slots?.map(slot => slot.hash) || [],
                    deviceCount: status.syncSlotDeviceCount,
                    leaseLabel: status.freeSyncSlotIdleReclaimLabel
                };
            } finally {
                Date.now = realNow;
            }
        }, modulePath('/js/cloudSync.js'));

        expect(result.persistedHashes).toEqual(['active-slot']);
        expect(result.deviceCount).toBe(1);
        expect(result.leaseLabel).toBe('60 minutes');
    });
});
