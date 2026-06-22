const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const root = path.resolve(__dirname, '..');

const ATTACK_STRINGS = Object.freeze({
    description: '"><img src=x onerror="window.__xssFired=(window.__xssFired||0)+1">',
    category: '<svg onload="window.__xssFired=(window.__xssFired||0)+1">Groceries</svg>',
    note: '<iframe srcdoc="<script>parent.__xssFired=(parent.__xssFired||0)+1</script>"></iframe>',
    giftCard: '<svg onload=__xssFired++>Gift',
    csv: '<img src=x onerror="window.__xssFired=(window.__xssFired||0)+1">'
});

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function seedHostileBudget(page) {
    await page.goto('/index.html');
    await waitForAppReady(page);
    await page.evaluate((attackStrings) => {
        window.__xssFired = 0;
        window.currentUser = { id: 'security-hardening-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'security-hostile-tx',
                    type: 'expense',
                    description: attackStrings.description,
                    category: attackStrings.category,
                    amount: 12.34,
                    date: '2026-06-21',
                    paymentMethod: 'Checking',
                    notes: attackStrings.note,
                    source_type: 'csv_import',
                    importDetails: {
                        sourceType: 'csv_import',
                        sourceFileName: 'hostile.csv',
                        sourceLineNumber: 2,
                        importedAt: '2026-06-21T12:00:00.000Z',
                        rawValues: {
                            Description: attackStrings.csv,
                            Notes: attackStrings.note
                        },
                        rawCsvValues: [
                            { column: 1, header: 'Description', value: attackStrings.csv },
                            { column: 2, header: 'Notes', value: attackStrings.note }
                        ],
                        mappedImportValues: {
                            date: '2026-06-21',
                            description: attackStrings.csv,
                            amount: '12.34',
                            signedAmount: '-12.34',
                            type: 'expense',
                            category: attackStrings.category,
                            paymentMethod: 'Checking',
                            notes: attackStrings.note
                        }
                    }
                }
            ],
            categories: [
                {
                    id: 'security-hostile-category',
                    type: 'expense',
                    name: attackStrings.category,
                    icon: 'S',
                    budget: 100
                }
            ],
            settings: {
                currency: '$',
                defaultType: 'expense',
                defaultPayment: '',
                defaultCategory: '',
                giftCards: [
                    {
                        id: 'security-hostile-gift',
                        merchantName: attackStrings.giftCard,
                        nickname: attackStrings.giftCard,
                        originalAmount: 50,
                        amountLeft: 25,
                        lastFour: '1111',
                        notes: attackStrings.note
                    }
                ]
            }
        }, { remoteUpdatedAt: '2026-06-21T12:00:00.000Z' });
        window.render?.();
    }, ATTACK_STRINGS);
}

test.describe('security hardening smoke', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('static headers enforce the current browser security baseline', () => {
        const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');

        expect(headers).toContain('Content-Security-Policy:');
        expect(headers).toContain("default-src 'self'");
        expect(headers).toContain("base-uri 'self'");
        expect(headers).toContain("object-src 'none'");
        expect(headers).toContain("frame-ancestors 'none'");
        expect(headers).toContain('upgrade-insecure-requests');
        expect(headers).toContain('Permissions-Policy: clipboard-read=()');
    });

    test('runtime pages use vendored scripts instead of third-party script CDNs', () => {
        const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
        const remoteScriptMatches = [];

        for (const file of htmlFiles) {
            const html = fs.readFileSync(path.join(root, file), 'utf8');
            const matches = html.match(/<script\b[^>]+src=["'](?:https?:)?\/\//gi) || [];
            matches.forEach(match => remoteScriptMatches.push(`${file}: ${match}`));
        }

        const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
        const packageEntries = Object.entries(packageLock.packages || {})
            .filter(([key]) => key && key.startsWith('node_modules/'));

        expect(remoteScriptMatches).toEqual([]);
        expect(packageLock.lockfileVersion).toBeGreaterThanOrEqual(2);
        expect(packageEntries.length).toBeGreaterThan(0);
        packageEntries.forEach(([packagePath, metadata]) => {
            expect(metadata.integrity, `${packagePath} should be pinned by integrity hash`).toBeTruthy();
        });
    });

    test('hostile budget strings render as inert text across primary views and import details', async ({ page }) => {
        const browserIssues = [];
        page.on('console', message => {
            if (['warning', 'error'].includes(message.type())) {
                browserIssues.push(`[${message.type()}] ${message.text()}`);
            }
        });
        page.on('pageerror', error => {
            browserIssues.push(`[pageerror] ${error.message}`);
        });

        await seedHostileBudget(page);
        await page.locator('#tab-recent').click();
        await expect(page.locator('#recentTxList')).toContainText(ATTACK_STRINGS.description);
        await page.evaluate(() => window.openRecentEditTransactionModal?.(null, 'security-hostile-tx'));
        await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
        await expect(page.locator('#recentEditTransactionModal')).toContainText('Original CSV Values');
        await expect(page.locator('#recentEditTransactionModal')).toContainText(ATTACK_STRINGS.csv);
        await page.locator('#recentEditTransactionModal .modal-close').click();

        await page.locator('#tab-savings').click();
        await page.locator('#tab-add').click();
        await page.evaluate(() => window.openGiftCardModal?.('edit', 'security-hostile-gift'));
        await expect(page.locator('#giftCardModal')).toBeVisible();
        await expect(page.locator('#giftCardModalMerchant')).toHaveValue(ATTACK_STRINGS.giftCard);
        await expect(page.locator('#giftCardModalNickname')).toHaveValue(ATTACK_STRINGS.giftCard);
        await expect(page.locator('#giftCardModalNotes')).toHaveValue(ATTACK_STRINGS.note);

        const result = await page.evaluate(() => ({
            xssFired: window.__xssFired || 0,
            injectedImages: document.querySelectorAll('img[onerror], svg[onload], iframe[srcdoc], math[href^="javascript:"]').length,
            bodyHtml: document.body.innerHTML
        }));

        expect(result.xssFired).toBe(0);
        expect(result.injectedImages).toBe(0);
        expect(result.bodyHtml).not.toContain('<img src=x onerror="window.__xssFired');
        expect(result.bodyHtml).not.toContain('<svg onload="window.__xssFired');
        expect(result.bodyHtml).not.toContain('<svg onload=__xssFired');
        expect(result.bodyHtml).not.toContain('<iframe srcdoc=');
        expect(result.bodyHtml).not.toContain('href="javascript:window.__xssFired');
        expect(browserIssues.join('\n')).not.toContain('__xssFired');
    });

    test('CSV export neutralizes spreadsheet formula injection in text fields', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);
        await page.evaluate(() => {
            window.currentUser = { id: 'csv-formula-injection-user' };
            window.replaceSnapshot({
                transactions: [
                    {
                        id: 'formula-tx',
                        type: 'expense',
                        description: '=HYPERLINK("https://evil.example","click")',
                        category: '+SUM(1,1)',
                        amount: 12.5,
                        date: '2026-06-21',
                        paymentMethod: '@PAYMENT',
                        notes: '\t=cmd|/C calc!A0',
                        createdAt: '2026-06-21T12:00:00.000Z'
                    },
                    {
                        id: 'negative-amount-stays-numeric',
                        type: 'expense',
                        description: 'Normal purchase',
                        category: 'Groceries',
                        amount: 44.44,
                        date: '2026-06-22',
                        paymentMethod: 'card',
                        notes: '-not a formula because notes are text',
                        createdAt: '2026-06-22T12:00:00.000Z'
                    }
                ],
                categories: [
                    { id: 'formula-cat', type: 'expense', name: '+SUM(1,1)', budget: 50 },
                    { id: 'groceries-cat', type: 'expense', name: 'Groceries', budget: 100 }
                ],
                settings: { currency: '$', giftCards: [] }
            }, { remoteUpdatedAt: '2026-06-21T12:00:00.000Z' });
            window.render?.();
        });

        await page.evaluate(() => window.openCsvExportModal());
        await page.locator('#csvExportDateRange').selectOption('all');

        const downloadPromise = page.waitForEvent('download');
        await page.locator('#csvExportConfirmBtn').click();
        const download = await downloadPromise;
        const csv = fs.readFileSync(await download.path(), 'utf8');

        expect(csv).toContain('\'=HYPERLINK');
        expect(csv).toContain('"\'+SUM(1,1)"');
        expect(csv).toContain('\'@PAYMENT');
        expect(csv).toContain('"\'\t=cmd|/C calc!A0"');
        expect(csv).toContain(',-44.44,');
        expect(csv).toContain('\'-not a formula because notes are text');
        expect(csv).not.toContain(',=HYPERLINK');
        expect(csv).not.toContain(',+SUM(1,1)');
        expect(csv).not.toContain(',@PAYMENT');
    });

    test('corrupt local budget vault does not queue a Cloud Sync overwrite', async ({ page }) => {
        await page.goto('/tests/fixtures/blank.html');
        const result = await page.evaluate(async ({ stateModulePath, vaultModulePath, sentinels }) => {
            const State = await import(stateModulePath);
            const Vault = await import(vaultModulePath);
            let queueCalls = 0;
            window.currentUser = { id: 'corrupt-cloud-overwrite-user' };
            window.BuddyCloud = {
                queuePush: () => { queueCalls += 1; }
            };
            window[State.LOCAL_VAULT_STORAGE_EXPERIMENT_FLAG] = true;
            const key = await Vault.generateLocalVaultKey();
            const envelope = await Vault.encryptLocalVaultPayload({
                transactions: [{ id: 'corrupt-cloud-tx', description: sentinels.description }],
                categories: [],
                settings: {}
            }, key);
            envelope.ciphertext = `${envelope.ciphertext.slice(0, -6)}broken`;
            localStorage.setItem('bb_data', JSON.stringify(envelope));

            let errorMessage = '';
            try {
                await State.initStateAsync();
            } catch (error) {
                errorMessage = error?.message || String(error || '');
            }

            return {
                errorMessage,
                queueCalls,
                stored: localStorage.getItem('bb_data') || ''
            };
        }, {
            stateModulePath: modulePath('/js/state.js'),
            vaultModulePath: modulePath('/js/localVaultStorage.js'),
            sentinels: ATTACK_STRINGS
        });

        expect(result.errorMessage).toBeTruthy();
        expect(result.queueCalls).toBe(0);
        expect(result.stored).not.toContain(ATTACK_STRINGS.description);
    });
});
