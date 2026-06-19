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

    test('demo mode uses isolated session storage and never mutates the browser budget', async ({ page }) => {
        const quarantineWarnings = collectConsoleMessages(page, text => text.includes(QUARANTINE_TAG));

        await page.evaluate((budget) => {
            localStorage.setItem('bb_data', JSON.stringify(budget));
            localStorage.setItem('bb_local_updated_at', '2026-06-13T02:00:00.000Z');
            localStorage.setItem('bb_demo_active', 'true');
            localStorage.setItem('bb_demo_backup_bb_data', JSON.stringify({ transactions: [{ description: 'Stale backup' }], categories: [] }));
            localStorage.setItem('bb_demo_backup_has_data', 'true');
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        }, REAL_BUDGET);

        await page.goto('/index.html?demo=1');
        await waitForAppReady(page);
        await expect(page.locator('#bbDemoModeBanner')).toBeVisible();

        const startedState = await page.evaluate(() => ({
            active: sessionStorage.getItem('zam_demo_active'),
            data: localStorage.getItem('bb_data'),
            demoData: sessionStorage.getItem('zam_demo_data'),
            staleActive: localStorage.getItem('bb_demo_active'),
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));

        expect(startedState.active).toBe('true');
        expect(startedState.data).toContain('RealRent');
        expect(startedState.data).not.toContain('demo-income-1');
        expect(startedState.demoData).toContain('demo-income-1');
        expect(startedState.staleActive).toBeNull();
        expect(startedState.backup).toBeNull();
        expect(startedState.backupFlag).toBeNull();

        await Promise.all([
            page.waitForURL(url => !url.searchParams.has('demo'), { timeout: 15000 }),
            page.locator('[data-demo-action="end"]').click()
        ]);
        await waitForAppReady(page);

        const restoredState = await page.evaluate(() => ({
            active: sessionStorage.getItem('zam_demo_active'),
            demoData: sessionStorage.getItem('zam_demo_data'),
            data: localStorage.getItem('bb_data'),
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));

        expect(restoredState.active).toBeNull();
        expect(restoredState.demoData).toBeNull();
        expect(restoredState.backup).toBeNull();
        expect(restoredState.backupFlag).toBeNull();
        expect(restoredState.data).toContain('RealRent');
        expect(restoredState.data).not.toContain('demo-income-1');
        expect(quarantineWarnings).toEqual([]);
    });

    test('demo banner can be minimized and restored without ending demo mode', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        });

        await page.goto('/index.html?demo=1');
        await waitForAppReady(page);

        const banner = page.locator('#bbDemoModeBanner');
        const toggle = banner.locator('[data-demo-action="toggle-banner"]');
        await expect(banner).toBeVisible();
        await expect(toggle).toHaveText('Minimize');

        await toggle.click();
        await expect(banner).toHaveClass(/is-minimized/);
        await expect(page.locator('body')).toHaveClass(/bb-demo-banner-minimized/);
        await expect(toggle).toHaveText('Show');
        await expect(page.locator('[data-demo-action="end"]')).toBeHidden();

        await toggle.click();
        await expect(banner).not.toHaveClass(/is-minimized/);
        await expect(page.locator('body')).not.toHaveClass(/bb-demo-banner-minimized/);
        await expect(toggle).toHaveText('Minimize');
        await expect(page.locator('[data-demo-action="end"]')).toBeVisible();

        const activeState = await page.evaluate(() => sessionStorage.getItem('zam_demo_active'));
        expect(activeState).toBe('true');
    });

    test('demo budget edits persist only to zam_demo_data', async ({ page }) => {
        await page.evaluate((budget) => {
            localStorage.setItem('bb_data', JSON.stringify(budget));
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        }, REAL_BUDGET);

        await page.goto('/demo');
        await waitForAppReady(page);

        const result = await page.evaluate(() => {
            const categoryResult = window.addCategory?.('Demo Only', 'DO', 'expense', 100);
            const transactionResult = window.addTransaction?.({
                id: 'tx_demo_storage_guard',
                type: 'expense',
                description: 'Demo only purchase',
                category: 'Demo Only',
                amount: 12,
                date: new Date().toISOString().slice(0, 10),
                tag: 'expense'
            });

            return {
                categoryResult,
                transactionResult,
                appData: localStorage.getItem('bb_data'),
                demoData: sessionStorage.getItem('zam_demo_data')
            };
        });

        expect(result.categoryResult?.success).toBe(true);
        expect(result.transactionResult).toBe(true);
        expect(result.appData).toContain('RealRent');
        expect(result.appData).not.toContain('Demo only purchase');
        expect(result.demoData).toContain('Demo only purchase');
    });

    test('real CSV import is blocked in demo before parsing user-selected files', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        });

        await page.goto('/demo');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const file = new File(['Date,Description,Amount\n2026-06-01,Real Bank Row,10.00'], 'bank.csv', { type: 'text/csv' });
            const target = { files: [file], value: 'C:\\fakepath\\bank.csv' };
            await window.importTransactionsFromCSV({ target });
            return {
                inputValue: target.value,
                demoData: sessionStorage.getItem('zam_demo_data'),
                reviewOpen: document.getElementById('csvImportReviewModal')?.classList.contains('active') || false
            };
        });

        expect(result.inputValue).toBe('');
        expect(result.demoData).not.toContain('Real Bank Row');
        expect(result.reviewOpen).toBe(false);
    });
});
