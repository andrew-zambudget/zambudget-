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

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function expectRealBudgetPreserved(record) {
    expect(['encrypted', 'plaintext']).toContain(record.classification.kind);
    expect(record.payload?.transactions?.[0]?.category).toBe('RealRent');
    expect(record.raw).not.toContain('demo-income-1');
    if (record.classification.kind === 'encrypted') {
        expect(record.raw).not.toContain('RealRent');
    }
}

async function readLocalBudgetRecord(page) {
    return page.evaluate(async ({ vaultModulePath, keyProviderModulePath }) => {
        const Vault = await import(vaultModulePath);
        const KeyProvider = await import(keyProviderModulePath);
        const raw = localStorage.getItem('bb_data') || '';
        const classification = Vault.classifyLocalBudgetRecord(raw);
        let payload = null;

        if (classification.kind === 'encrypted') {
            const keyId = KeyProvider.getLocalVaultKeyId({ scope: 'primary' });
            const key = await KeyProvider.readLocalVaultKey(keyId);
            payload = key
                ? await Vault.readEncryptedLocalVaultRecord(localStorage, key, { storageKey: 'bb_data' })
                : null;
        } else if (classification.kind === 'plaintext') {
            payload = JSON.parse(raw);
        }

        return { raw, classification, payload };
    }, {
        vaultModulePath: modulePath('/js/localVaultStorage.js'),
        keyProviderModulePath: modulePath('/js/localVaultKeyProvider.js')
    });
}

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
            demoData: sessionStorage.getItem('zam_demo_data'),
            staleActive: localStorage.getItem('bb_demo_active'),
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));
        const startedBudget = await readLocalBudgetRecord(page);

        expect(startedState.active).toBe('true');
        expectRealBudgetPreserved(startedBudget);
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
            backup: localStorage.getItem('bb_demo_backup_bb_data'),
            backupFlag: localStorage.getItem('bb_demo_backup_has_data')
        }));
        const restoredBudget = await readLocalBudgetRecord(page);

        expect(restoredState.active).toBeNull();
        expect(restoredState.demoData).toBeNull();
        expect(restoredState.backup).toBeNull();
        expect(restoredState.backupFlag).toBeNull();
        expectRealBudgetPreserved(restoredBudget);
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

    test('minimized demo badge can be dragged without triggering Show', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
        });

        await page.goto('/index.html?demo=1');
        await waitForAppReady(page);

        const banner = page.locator('#bbDemoModeBanner');
        const toggle = banner.locator('[data-demo-action="toggle-banner"]');
        await toggle.click();
        await expect(banner).toHaveClass(/is-minimized/);
        await expect(toggle).toHaveText('Show');
        await page.evaluate(() => document.fonts?.ready || Promise.resolve());

        const before = await banner.boundingBox();
        const dragSurface = await banner.locator('.bb-demo-banner-content').boundingBox();
        expect(before).not.toBeNull();
        expect(dragSurface).not.toBeNull();

        const startX = dragSurface.x + dragSurface.width / 2;
        const startY = dragSurface.y + dragSurface.height / 2;
        const targetX = Math.max(42, startX - 180);
        const targetY = Math.max(42, startY - 120);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(targetX, targetY, { steps: 8 });
        await page.mouse.up();

        await expect(banner).toHaveClass(/is-minimized/);
        await expect(toggle).toHaveText('Show');

        const after = await banner.boundingBox();
        expect(after).not.toBeNull();
        expect(Math.abs(after.x - before.x)).toBeGreaterThan(40);
        expect(Math.abs(after.y - before.y)).toBeGreaterThan(40);
        const viewport = page.viewportSize() || { width: 1280, height: 720 };
        expect(after.x).toBeGreaterThanOrEqual(0);
        expect(after.y).toBeGreaterThanOrEqual(0);
        expect(after.x + after.width).toBeLessThanOrEqual(viewport.width);
        expect(after.y + after.height).toBeLessThanOrEqual(viewport.height);

        const savedPosition = await page.evaluate(() => sessionStorage.getItem('bb_demo_banner_position'));
        expect(savedPosition).toContain('left');

        await page.reload();
        await waitForAppReady(page);
        await expect(banner).toHaveClass(/is-minimized/);
        await page.evaluate(() => document.fonts?.ready || Promise.resolve());

        const reloaded = await banner.boundingBox();
        expect(reloaded).not.toBeNull();
        expect(Math.abs(reloaded.x - before.x)).toBeGreaterThan(40);
        expect(Math.abs(reloaded.y - before.y)).toBeGreaterThan(40);
        expect(reloaded.x).toBeGreaterThanOrEqual(0);
        expect(reloaded.y).toBeGreaterThanOrEqual(0);
        expect(reloaded.x + reloaded.width).toBeLessThanOrEqual(viewport.width);
        expect(reloaded.y + reloaded.height).toBeLessThanOrEqual(viewport.height);

        await toggle.click();
        await expect(banner).not.toHaveClass(/is-minimized/);
        await expect(toggle).toHaveText('Minimize');
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
