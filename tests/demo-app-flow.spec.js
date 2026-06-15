const { test, expect } = require('@playwright/test');
const {
    QUARANTINE_TAG,
    collectConsoleMessages,
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const REAL_BUDGET = {
    transactions: [
        {
            id: 'real-tx-demo-restore',
            type: 'expense',
            amount: 800,
            category: 'RealRent',
            description: 'Real rent',
            date: '2026-06-13',
            createdAt: '2026-06-13T02:00:00.000Z'
        }
    ],
    categories: [
        {
            id: 'real-cat-demo-restore',
            type: 'expense',
            name: 'RealRent',
            icon: 'RR',
            budget: 800,
            createdAt: '2026-06-13T02:00:00.000Z'
        }
    ],
    settings: {
        currency: '$',
        defaultType: 'expense',
        lastCategorySort: 'custom'
    }
};

test.describe('Zam! demo app flow', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('demo mode starts, exits, and restores the browser budget without legacy fallback warnings', async ({ page }) => {
        const quarantineWarnings = collectConsoleMessages(page, text => text.includes(QUARANTINE_TAG));

        await page.evaluate((budget) => {
            localStorage.setItem('bb_data', JSON.stringify(budget));
            localStorage.setItem('bb_local_updated_at', '2026-06-13T02:00:00.000Z');
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        }, REAL_BUDGET);

        await page.goto('/index.html?demo=1');
        await waitForAppReady(page);
        await expect(page.locator('#bbDemoModeBanner')).toBeVisible();

        const startedState = await page.evaluate(() => ({
            active: localStorage.getItem('bb_demo_active'),
            data: localStorage.getItem('bb_data'),
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));

        expect(startedState.active).toBe('true');
        expect(startedState.backupFlag).toBe('true');
        expect(startedState.data).toContain('demo-income-1');
        expect(startedState.backup).toContain('RealRent');

        await Promise.all([
            page.waitForURL(url => !url.searchParams.has('demo'), { timeout: 15000 }),
            page.locator('[data-demo-action="end"]').click()
        ]);
        await waitForAppReady(page);

        const restoredState = await page.evaluate(() => ({
            active: localStorage.getItem('bb_demo_active'),
            data: localStorage.getItem('bb_data'),
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));

        expect(restoredState.active).toBeNull();
        expect(restoredState.backup).toBeNull();
        expect(restoredState.backupFlag).toBeNull();
        expect(restoredState.data).toContain('RealRent');
        expect(restoredState.data).not.toContain('demo-income-1');
        expect(quarantineWarnings).toEqual([]);
    });
});
