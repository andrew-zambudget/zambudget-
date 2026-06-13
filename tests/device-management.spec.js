const { expect, test } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('Buddy Cloud device management', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
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
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Buddy Cloud Devices');
        await expect(modal).toContainText('This browser is signed in but is not using a Free sync slot yet.');
        await expect(modal).toContainText('Current browser · Sync slot inactive');
        await expect(modal).toContainText('Available sync slot');
        await expect(modal.getByRole('button', { name: 'Use This Browser' })).toBeVisible();
        await expect(modal).not.toContainText('Current browser · Sync paused');
    });
});
