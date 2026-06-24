const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

async function createExpenseFromAddTab(page, description = 'Local status smoke') {
    await page.evaluate(() => {
        sessionStorage.setItem('zam_demo_active', 'true');
        window.switchTab?.('add');
        window.setType?.('expense');
    });

    const categoryName = await page.evaluate(() => {
        const existing = window.getCategories().find(category => category.type === 'expense')?.name;
        if (existing) return existing;

        const result = window.addCategory?.('Sync Status Test', 'ST', 'expense', 100);
        return result?.success ? result.name : '';
    });
    expect(categoryName).not.toBe('');

    await page.fill('#txAmount', '12.34');
    await page.fill('#txDescription', description);
    await page.evaluate((category) => {
        const categoryInput = document.getElementById('txCategory');
        if (categoryInput) categoryInput.value = category;
        window.submitTransaction();
    }, categoryName);
}

async function clearLocalVaultKeyDb(page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            const request = indexedDB.deleteDatabase('zam_local_vault_keys');
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    });
}

test.describe('Cloud Sync local save status', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
        await clearLocalVaultKeyDb(page);
    });

    test('Add transaction in demo mode is labeled as a local save', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await createExpenseFromAddTab(page, 'Demo local status');

        await expect(page.locator('#syncStatusBtn')).toHaveAttribute(
            'aria-label',
            /Saved locally\. Cloud Sync not active/
        );
    });

    test('signed-out Cloud Sync panel shows sync off state and keeps sign-in action reachable', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await createExpenseFromAddTab(page, 'Signed out sync off status');
        await page.locator('#syncStatusBtn').click();

        const panel = page.locator('#syncHistoryPanel');
        await expect(panel).toBeVisible();
        await expect(page.locator('#syncHistoryStatusBadge')).toHaveText('SYNC OFF');
        await expect(page.locator('#syncCloudNudge')).toContainText('Sign in to protect this budget');
        await expect(page.locator('#syncDeviceCountFineprint')).toHaveText('2 free sync slots included');

        const signInButton = page.locator('#syncEnableBtn');
        await expect(signInButton).toHaveText('Sign In');
        await expect(signInButton).toBeEnabled();
        await expect(page.locator('#syncKeyBtn')).toBeDisabled();
        await expect(page.locator('#syncManualBtn')).not.toHaveAttribute('data-tooltip', /.+/);

        await expect(page.locator('#syncHistoryList .sync-history-item')).toHaveCount(1);
        await expect(page.locator('#syncHistoryList')).toContainText('Last saved locally. Sign in to protect this budget with Cloud Sync.');

        const order = await page.evaluate(() => {
            const nudge = document.getElementById('syncCloudNudge');
            const actions = document.getElementById('syncCloudActions');
            const list = document.getElementById('syncHistoryList');
            return {
                nudgeBeforeList: Boolean(nudge && list && nudge.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING),
                actionsBeforeList: Boolean(actions && list && actions.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)
            };
        });
        expect(order.nudgeBeforeList).toBe(true);
        expect(order.actionsBeforeList).toBe(true);
    });

    test('manual Sync now action does not render a panel-overlapping tooltip', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.BuddyCloud = {
                ...(window.BuddyCloud || {}),
                getStatus: () => ({
                    signedIn: true,
                    enabled: true,
                    hasKey: false,
                    canUseCloud: false,
                    syncing: false,
                    isPremium: false,
                    freeDeviceLimit: 2,
                    syncSlotLimit: 2,
                    syncSlotDeviceCount: 1
                })
            };
            window.openSyncHistoryPanel?.();
        });

        const panel = page.locator('#syncHistoryPanel');
        const syncNowButton = page.locator('#syncManualBtn');

        await expect(panel).toBeVisible();
        await expect(syncNowButton).toBeVisible();
        await expect(syncNowButton).toBeDisabled();
        await expect(syncNowButton).toHaveAttribute('aria-label', /Import your recovery key/);
        await expect(syncNowButton).not.toHaveAttribute('data-tooltip', /.+/);
        await expect(syncNowButton).not.toHaveAttribute('title', /.+/);
    });

    test('Add transaction while offline is labeled as local and not backed up', async ({ page, context }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await context.setOffline(true);

        await createExpenseFromAddTab(page, 'Offline local status');

        await expect(page.locator('#syncStatusBtn')).toHaveAttribute(
            'aria-label',
            /Offline - saved locally\. Not backed up to Cloud Sync/
        );

        await context.setOffline(false);
    });

    test('legacy plaintext sync history migrates to encrypted storage and still renders', async ({ page }) => {
        await page.goto('/tests/fixtures/blank.html');
        await page.evaluate(() => {
            localStorage.setItem('bb_sync_history', JSON.stringify([
                {
                    id: 'legacy-sync-history-event',
                    time: '2026-06-21T18:30:00.000Z',
                    status: 'synced',
                    message: 'Cloud Sync is up to date.',
                    details: {
                        transaction: {
                            amount: 12.34,
                            description: 'LEGACY_SYNC_HISTORY_MERCHANT'
                        }
                    }
                }
            ]));
        });

        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.waitForFunction(() => {
            const raw = localStorage.getItem('bb_sync_history') || '';
            return raw.includes('zam_local_metadata_vault') && raw.includes('sync_history');
        });

        const raw = await page.evaluate(() => localStorage.getItem('bb_sync_history') || '');
        expect(raw).not.toContain('Cloud Sync is up to date.');
        expect(raw).not.toContain('2026-06-21T18:30:00.000Z');
        expect(raw).not.toContain('LEGACY_SYNC_HISTORY_MERCHANT');

        await page.locator('#syncStatusBtn').click();
        await expect(page.locator('#syncHistoryPanel')).toBeVisible();
        await expect(page.locator('#syncHistoryList .sync-history-item')).toHaveCount(1);
        await expect(page.locator('#syncHistoryList')).toContainText('Last saved locally. Sign in to protect this budget with Cloud Sync.');
        await expect(page.locator('#syncHistoryList')).not.toContainText('LEGACY_SYNC_HISTORY_MERCHANT');
    });

    test('new sync history writes are encrypted after local saves', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await createExpenseFromAddTab(page, 'Encrypted sync history runtime');
        await page.waitForTimeout(500);
        await page.evaluate(async () => {
            await window.flushSyncHistorySaveQueue?.();
        });
        await page.waitForFunction(() => {
            const raw = localStorage.getItem('bb_sync_history') || '';
            return raw.includes('zam_local_metadata_vault') && raw.includes('sync_history');
        });

        const raw = await page.evaluate(() => localStorage.getItem('bb_sync_history') || '');
        expect(raw).not.toContain('Saved locally. Cloud Sync not active.');
        expect(raw).not.toContain('Encrypted sync history runtime');

        await page.locator('#syncStatusBtn').click();
        await expect(page.locator('#syncHistoryPanel')).toBeVisible();
        await expect(page.locator('#syncHistoryList .sync-history-item')).toHaveCount(1);
        await expect(page.locator('#syncHistoryList')).toContainText('Last saved locally. Sign in to protect this budget with Cloud Sync.');
    });
});
