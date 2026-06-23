const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

const VIEWPORTS = [
    { name: 'small-phone-375', width: 375, height: 812 },
    { name: 'modern-phone-390', width: 390, height: 844 },
    { name: 'large-phone-430', width: 430, height: 932 },
    { name: 'tablet-portrait-768', width: 768, height: 1024 },
    { name: 'tablet-boundary-1024', width: 1024, height: 768 }
];

const DEEP_WORKFLOW_VIEWPORTS = [
    VIEWPORTS[1],
    VIEWPORTS[3],
    VIEWPORTS[4]
];

const IMPORT_CSV = [
    'Posted Date,Payee / Memo,Debit,Credit,Category Name,Account Name,User Note',
    '2026-06-01,Mobile Ready,12.50,,Groceries,Checking,ready row',
    '2026-06-02,Mobile Duplicate,4.00,,Groceries,Checking,duplicate row',
    '2026-06-03,,5.00,,Groceries,Checking,missing description'
].join('\n');

const ACCENT_PALETTES = [
    'teal',
    'blue',
    'green',
    'amber',
    'rose',
    'indigo',
    'slate',
    'orange',
    'cyan',
    'sky',
    'lime',
    'emerald',
    'red',
    'pink',
    'zinc',
    'violet',
    'purple',
    'fuchsia',
    'magenta',
    'coral',
    'mint',
    'jade',
    'gold',
    'lavender',
    'graphite'
];

async function startDemo(page, viewport) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await resetBrowserStorage(page);
    await page.evaluate(() => {
        sessionStorage.setItem('bb_demo_tutorial_skipped', 'true');
    });
    await page.goto('/index.html?demo=1');
    await waitForAppReady(page);
}

async function startSeededApp(page, viewport) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await resetBrowserStorage(page);
    await page.goto('/index.html');
    await waitForAppReady(page);
    await seedResponsiveHarness(page);
}

async function seedResponsiveHarness(page) {
    await page.evaluate(() => {
        window.currentUser = { id: 'mobile-tablet-aio-test-user' };
        window.replaceSnapshot({
            transactions: [
                {
                    id: 'mobile-ready-transaction',
                    type: 'expense',
                    description: 'Mobile coffee',
                    category: 'Groceries',
                    amount: 12.34,
                    date: '2026-06-01',
                    paymentMethod: 'card',
                    notes: '',
                    tag: 'expense',
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'mobile-duplicate-seed',
                    type: 'expense',
                    description: 'Mobile Duplicate',
                    category: 'Groceries',
                    amount: 4,
                    date: '2026-06-02',
                    paymentMethod: 'Checking',
                    notes: '',
                    tag: 'expense',
                    createdAt: '2026-06-02T12:00:00.000Z'
                },
                {
                    id: 'mobile-income-transaction',
                    type: 'income',
                    description: 'Mobile paycheck',
                    category: 'Paycheck',
                    amount: 2600,
                    date: '2026-06-03',
                    paymentMethod: 'bank',
                    notes: '',
                    tag: 'income',
                    createdAt: '2026-06-03T12:00:00.000Z'
                }
            ],
            categories: [
                {
                    id: 'cat-groceries',
                    type: 'expense',
                    name: 'Groceries',
                    icon: 'G',
                    budget: 500,
                    customOrder: 1,
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'cat-paycheck',
                    type: 'income',
                    name: 'Paycheck',
                    icon: 'P',
                    budget: 2600,
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'cat-emergency',
                    type: 'savings',
                    name: 'Emergency Fund',
                    icon: 'E',
                    budget: 1000,
                    createdAt: '2026-06-01T12:00:00.000Z'
                },
                {
                    id: 'cat-credit-card',
                    type: 'debt',
                    name: 'Credit Card',
                    icon: 'C',
                    budget: 1000,
                    createdAt: '2026-06-01T12:00:00.000Z'
                }
            ],
            settings: {
                currency: '$',
                defaultType: 'expense',
                defaultPayment: '',
                defaultCategory: '',
                lastCategorySort: 'manual',
                giftCards: [
                    {
                        id: 'gift-card-mobile',
                        merchant: 'Coffee Shop',
                        nickname: 'Coffee card',
                        originalAmount: 50,
                        currentBalance: 40,
                        createdAt: '2026-06-01T12:00:00.000Z',
                        updatedAt: '2026-06-01T12:00:00.000Z'
                    }
                ]
            }
        }, { remoteUpdatedAt: '2026-06-01T12:00:00.000Z' });
        window.render?.();
        window.initAddTransactionForm?.();
    });
}

async function expectNoHorizontalOverflow(page, contextLabel = 'page') {
    const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const width = window.innerWidth;
        return {
            viewportWidth: width,
            documentScrollWidth: doc.scrollWidth,
            bodyScrollWidth: body.scrollWidth,
            overflowingElements: [...document.body.querySelectorAll('*')]
                .filter((el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    if (rect.width === 0 || rect.height === 0) return false;
                    return rect.left < -2 || rect.right > width + 2;
                })
                .slice(0, 12)
                .map((el) => ({
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: String(el.className || '').slice(0, 120),
                    left: Math.round(el.getBoundingClientRect().left),
                    right: Math.round(el.getBoundingClientRect().right),
                    width: Math.round(el.getBoundingClientRect().width)
                }))
        };
    });

    expect(overflow, `${contextLabel} should not create horizontal overflow`).toMatchObject({
        documentScrollWidth: expect.any(Number),
        bodyScrollWidth: expect.any(Number)
    });
    expect(overflow.documentScrollWidth, `${contextLabel} document width`).toBeLessThanOrEqual(overflow.viewportWidth + 2);
    expect(overflow.bodyScrollWidth, `${contextLabel} body width`).toBeLessThanOrEqual(overflow.viewportWidth + 2);
    if (overflow.documentScrollWidth > overflow.viewportWidth + 2 || overflow.bodyScrollWidth > overflow.viewportWidth + 2) {
        expect(overflow.overflowingElements, `${contextLabel} overflowing elements`).toEqual([]);
    }
}

async function expectBoxInsideViewport(page, selector, label) {
    await page.waitForFunction((targetSelector) => {
        const el = document.querySelector(targetSelector);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0
            && rect.height > 0
            && rect.left >= -2
            && rect.right <= window.innerWidth + 2;
    }, selector, { timeout: 1500 }).catch(() => {});

    const result = await page.evaluate((targetSelector) => {
        const el = document.querySelector(targetSelector);
        if (!el) return { exists: false };
        const rect = el.getBoundingClientRect();
        return {
            exists: true,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
    }, selector);

    expect(result.exists, `${label} exists`).toBe(true);
    expect(result.left, `${label} left edge`).toBeGreaterThanOrEqual(-2);
    expect(result.right, `${label} right edge`).toBeLessThanOrEqual(result.viewportWidth + 2);
    expect(result.width, `${label} width`).toBeGreaterThan(0);
    expect(result.height, `${label} height`).toBeGreaterThan(0);
}

async function expectNoElementOverlap(page, firstSelector, secondSelector, label) {
    const overlap = await page.evaluate(({ first, second }) => {
        const firstEl = document.querySelector(first);
        const secondEl = document.querySelector(second);
        if (!firstEl || !secondEl) return { exists: false };
        const a = firstEl.getBoundingClientRect();
        const b = secondEl.getBoundingClientRect();
        const intersects = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        return {
            exists: true,
            intersects,
            first: { top: a.top, right: a.right, bottom: a.bottom, left: a.left },
            second: { top: b.top, right: b.right, bottom: b.bottom, left: b.left }
        };
    }, { first: firstSelector, second: secondSelector });

    expect(overlap.exists, `${label} elements exist`).toBe(true);
    expect(overlap.intersects, label).toBe(false);
}

async function expectMobileCommandNavOrder(page, label) {
    const navState = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('.command-tabs .cmd-tab')]
            .filter((tab) => {
                const rect = tab.getBoundingClientRect();
                const style = window.getComputedStyle(tab);
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 1
                    && rect.height > 1
                    && tab.id !== 'tab-calendar';
            })
            .map((tab) => {
                const rect = tab.getBoundingClientRect();
                return {
                    id: tab.id,
                    label: tab.textContent.trim(),
                    left: rect.left,
                    center: rect.left + rect.width / 2
                };
            })
            .sort((a, b) => a.left - b.left);
        const add = tabs.find((tab) => tab.id === 'tab-add');
        return {
            labels: tabs.map((tab) => tab.label),
            addCenter: add?.center || 0,
            viewportCenter: window.innerWidth / 2
        };
    });

    expect(navState.labels, `${label} command nav order`).toEqual(['Income', 'Savings', 'Add', 'Debt', 'Recent']);
    expect(Math.abs(navState.addCenter - navState.viewportCenter), `${label} Add tab centered`).toBeLessThanOrEqual(24);
}

async function expectMobileAddButtonUsesPalette(page, label) {
    const colors = await page.evaluate((palettes) => {
        function parseColor(value) {
            const normalized = String(value || '').trim();
            if (normalized.startsWith('#')) {
                const hex = normalized.slice(1);
                const fullHex = hex.length === 3
                    ? hex.split('').map((part) => part + part).join('')
                    : hex;
                const int = Number.parseInt(fullHex, 16);
                return {
                    r: (int >> 16) & 255,
                    g: (int >> 8) & 255,
                    b: int & 255
                };
            }
            const match = normalized.match(/rgba?\(([^)]+)\)/i);
            if (!match) return null;
            const [r, g, b] = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
            return { r, g, b };
        }

        function luminance(color) {
            const channels = [color.r, color.g, color.b].map((channel) => {
                const value = channel / 255;
                return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
            });
            return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
        }

        function contrastRatio(first, second) {
            const firstLum = luminance(first);
            const secondLum = luminance(second);
            const lighter = Math.max(firstLum, secondLum);
            const darker = Math.min(firstLum, secondLum);
            return (lighter + 0.05) / (darker + 0.05);
        }

        function toRgbString(color) {
            if (!color) return '';
            return `rgb(${color.r}, ${color.g}, ${color.b})`;
        }

        const root = document.documentElement;
        const add = document.getElementById('tab-add');
        if (!add) return { exists: false };
        const results = [];

        palettes.forEach((palette) => {
            root.setAttribute('data-accent', palette);
            const rootStyles = window.getComputedStyle(root);
            const addStyles = window.getComputedStyle(add);
            const accentStrong = rootStyles.getPropertyValue('--accent-strong').trim();
            const accentOn = rootStyles.getPropertyValue('--accent-on').trim();
            const strongColor = parseColor(accentStrong);
            const onColor = parseColor(accentOn);
            results.push({
                palette,
                accentStrong,
                accentOn,
                addColor: addStyles.color,
                background: addStyles.backgroundImage,
                expectedStrongRgb: toRgbString(strongColor),
                contrast: strongColor && onColor ? contrastRatio(strongColor, onColor) : 0
            });
        });

        return { exists: true, results };
    }, ACCENT_PALETTES);

    expect(colors.exists, `${label} Add tab exists`).toBe(true);
    for (const result of colors.results) {
        expect(result.contrast, `${label} ${result.palette} contrast`).toBeGreaterThanOrEqual(4.5);
        expect(result.addColor, `${label} ${result.palette} Add text color`).toBe('rgb(255, 255, 255)');
        expect(result.background, `${label} ${result.palette} Add button uses strong palette`).toContain(result.expectedStrongRgb);
    }
}

async function revealRecentActions(page) {
    const firstCard = page.locator('#recentTxList .recent-tx-card').first();
    await expect(firstCard).toBeVisible();

    const menuButton = firstCard.locator('.recent-tx-menu-btn');
    if (await menuButton.isVisible()) {
        await menuButton.click();
        await expect(page.locator('#recentTxList .recent-tx-card.is-menu-open').first()).toBeVisible();
        return;
    }

    const box = await firstCard.boundingBox();
    expect(box, 'recent transaction card has a box for swipe testing').toBeTruthy();
    await page.mouse.move(box.x + box.width - 16, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.max(24, box.width - 150), box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(firstCard).toHaveClass(/is-swipe-delete-open/);
}

async function expectDrillDownVerticalScrollDoesNotRevealActions(page) {
    const firstCard = page.locator('#drillDownTxList .drilldown-tx-card').first();
    await expect(firstCard).toBeVisible();

    const box = await firstCard.boundingBox();
    expect(box, 'drilldown transaction card has a box for gesture testing').toBeTruthy();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 110, { steps: 8 });
    await page.mouse.up();

    await expect(firstCard).not.toHaveClass(/is-swipe-actions-open/);
}

async function revealDrillDownActions(page) {
    const firstCard = page.locator('#drillDownTxList .drilldown-tx-card').first();
    await expect(firstCard).toBeVisible();

    const menuButton = firstCard.locator('.drilldown-tx-menu-btn');
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(firstCard).toHaveClass(/is-swipe-actions-open/);

    await expect(firstCard.locator('.drilldown-tx-swipe-edit-btn')).toBeVisible();
    await expect(firstCard.locator('.drilldown-tx-swipe-move-btn')).toBeVisible();
    await expect(firstCard.locator('.drilldown-tx-swipe-delete-btn')).toBeVisible();
}

async function attachScreenshot(page, name) {
    await test.info().attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
    });
}

async function openImportReview(page) {
    await page.evaluate(async (csvText) => {
        const file = new File([csvText], 'mobile-tablet-import.csv', { type: 'text/csv' });
        await window.importTransactionsFromCSV({ target: { files: [file], value: '' } });
    }, IMPORT_CSV);
}

test.describe('mobile / tablet responsive acceptance suite', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
    });

    for (const viewport of VIEWPORTS) {
        test(`demo layout has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
            await startDemo(page, viewport);

            await expect(page.locator('#bbDemoModeBanner')).toBeVisible();
            await expectBoxInsideViewport(page, '.app-header', `${viewport.name} header`);
            await expectBoxInsideViewport(page, '.command-tabs', `${viewport.name} command tabs`);
            if (viewport.width <= 1024) {
                await expectNoElementOverlap(page, '#bbDemoModeBanner', '.command-center-card', `${viewport.name} expanded demo banner should not cover app content`);
            }
            if (viewport.width <= 767) {
                await expectMobileCommandNavOrder(page, viewport.name);
                await expectMobileAddButtonUsesPalette(page, viewport.name);
                await page.locator('[data-demo-action="toggle-banner"]').click();
                await expect(page.locator('#bbDemoModeBanner')).toHaveClass(/is-minimized/);
                await expectNoElementOverlap(page, '#bbDemoModeBanner', '.command-tabs', `${viewport.name} minimized demo badge should clear bottom nav`);
            }
            await expectNoHorizontalOverflow(page, `${viewport.name} demo`);
            await attachScreenshot(page, `${viewport.name}-demo-dashboard`);
        });
    }

    for (const viewport of DEEP_WORKFLOW_VIEWPORTS) {
        test(`core workflows remain reachable at ${viewport.name}`, async ({ page }) => {
            await startSeededApp(page, viewport);

            for (const tabName of ['income', 'savings', 'debt', 'add', 'recent']) {
                await page.evaluate((name) => window.switchTab?.(name), tabName);
                await expect(page.locator(`#view-${tabName}`)).toHaveClass(/active/);
                await expectBoxInsideViewport(page, `#view-${tabName}`, `${viewport.name} ${tabName} view`);
                await expectNoHorizontalOverflow(page, `${viewport.name} ${tabName} view`);
            }

            await page.evaluate(() => {
                window.switchTab?.('add');
                window.setType?.('expense');
            });
            await page.locator('#txAmount').fill('13.57');
            await page.locator('#txDescription').fill('Mobile add flow');
            await page.locator('.cat-pill-v2[data-cat="Groceries"]').first().click();
            await page.locator('.hero-save-btn').click();
            await expect.poll(() => page.evaluate(() => window.getTransactions?.().some(tx => tx.description === 'Mobile add flow'))).toBe(true);

            await page.evaluate(() => {
                window.switchTab?.('recent');
                window.renderRecentTransactions?.();
            });
            await expect(page.locator('#recentTxList .recent-tx-card').first()).toBeVisible();
            await expectNoHorizontalOverflow(page, `${viewport.name} recent with transaction`);

            await revealRecentActions(page);
            await page.locator('#recentTxList .recent-tx-card.is-menu-open .recent-tx-swipe-delete-btn').click();
            await expect(page.locator('#deleteTxModal')).toBeVisible();
            await expect(page.locator('#deleteTxConfirmBtn')).toBeVisible();
            await page.locator('#deleteTxModal .btn-cancel').click();
            await expect(page.locator('#deleteTxModal')).toBeHidden();

            await page.evaluate(() => window.openRecentEditTransactionModal?.(null, 'mobile-ready-transaction'));
            await expect(page.locator('#recentEditTransactionModal')).toBeVisible();
            await expectBoxInsideViewport(page, '#recentEditTransactionModal .modal-box', `${viewport.name} edit transaction modal`);
            await expectNoHorizontalOverflow(page, `${viewport.name} edit transaction modal`);
            await page.locator('#recentEditTransactionModal .modal-close').click();

            await page.evaluate(() => window.openCategoryDrillDown?.('Groceries', 'G'));
            await expect(page.locator('#categoryDrillDownPanel')).toHaveClass(/active/);
            await expectBoxInsideViewport(page, '#categoryDrillDownPanel', `${viewport.name} category drilldown`);
            await expectNoHorizontalOverflow(page, `${viewport.name} category drilldown`);
            await expectDrillDownVerticalScrollDoesNotRevealActions(page);
            await revealDrillDownActions(page);
            await page.locator('#drillDownTxList .drilldown-tx-card.is-swipe-actions-open .drilldown-tx-swipe-delete-btn').click();
            await expect(page.locator('#deleteTxModal')).toBeVisible();
            await page.locator('#deleteTxModal .btn-cancel').click();
            await expect(page.locator('#deleteTxModal')).toBeHidden();
            await page.evaluate(() => window.closeCategoryDrillDown?.());

            await page.evaluate(() => window.openGiftCardModal?.('create'));
            await expect(page.locator('#giftCardModal')).toBeVisible();
            await expectBoxInsideViewport(page, '#giftCardModal .modal-box', `${viewport.name} gift card modal`);
            await expectNoHorizontalOverflow(page, `${viewport.name} gift card modal`);
            await page.locator('#giftCardModal .modal-close').click();

            await page.evaluate(() => window.openCsvExportModal?.());
            await expect(page.locator('#csvExportModal')).toBeVisible();
            await expectBoxInsideViewport(page, '#csvExportModal .modal-box', `${viewport.name} CSV export modal`);
            await expectNoHorizontalOverflow(page, `${viewport.name} CSV export modal`);
            await page.locator('#csvExportModal .modal-close').click();

            await openImportReview(page);
            await expect(page.locator('#csvImportReviewModal')).toBeVisible();
            await expectBoxInsideViewport(page, '#csvImportReviewModal .modal-box', `${viewport.name} CSV import modal`);
            await expectNoHorizontalOverflow(page, `${viewport.name} CSV import modal`);
            await attachScreenshot(page, `${viewport.name}-csv-import-review`);
            await page.locator('#csvImportReviewModal .modal-close').click();
        });
    }

    test('visible buttons expose accessible names at phone width', async ({ page }) => {
        await startSeededApp(page, VIEWPORTS[1]);

        const unnamedButtons = await page.evaluate(() => {
            const isVisible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };

            return [...document.querySelectorAll('button')]
                .filter(isVisible)
                .filter((button) => {
                    const text = String(button.textContent || '').trim();
                    const aria = String(button.getAttribute('aria-label') || '').trim();
                    const title = String(button.getAttribute('title') || '').trim();
                    return !text && !aria && !title;
                })
                .map((button) => ({
                    id: button.id || '',
                    className: String(button.className || ''),
                    html: button.outerHTML.slice(0, 180)
                }));
        });

        expect(unnamedButtons).toEqual([]);
    });
});
