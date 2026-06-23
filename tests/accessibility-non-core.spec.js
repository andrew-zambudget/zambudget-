const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

async function visibleUnnamedControls(page, contextLabel) {
    return page.evaluate((label) => {
        const isHidden = (el) => {
            if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display === 'none'
                || style.visibility === 'hidden'
                || rect.width === 0
                || rect.height === 0;
        };

        const controlName = (el) => {
            if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
            const labelledby = el.getAttribute('aria-labelledby');
            if (labelledby) {
                return labelledby
                    .split(/\s+/)
                    .map((id) => document.getElementById(id)?.textContent?.trim() || '')
                    .join(' ')
                    .trim();
            }
            if (el.id) {
                const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (label) return label.textContent.trim();
            }
            const parentLabel = el.closest('label');
            if (parentLabel) return parentLabel.textContent.trim();
            if (el.title) return el.title.trim();
            return (el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
        };

        return [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
            .filter((el) => !isHidden(el) && el.type !== 'hidden')
            .map((el) => ({
                context: label,
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                className: String(el.className || ''),
                html: el.outerHTML.slice(0, 160),
                name: controlName(el)
            }))
            .filter((item) => !item.name);
    }, contextLabel);
}

async function expectVisibleFocus(page, selector) {
    const locator = page.locator(selector).first();
    await locator.focus();
    const focusStyle = await locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            outlineWidth: parseFloat(style.outlineWidth || '0') || 0,
            outlineStyle: style.outlineStyle,
            boxShadow: style.boxShadow || '',
            active: document.activeElement === el
        };
    });

    expect(focusStyle.active).toBe(true);
    expect(
        focusStyle.outlineWidth > 0
        || (focusStyle.boxShadow && focusStyle.boxShadow !== 'none')
    ).toBe(true);
}

test.describe('non-core accessibility guardrails', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('visible app, settings, and transaction detail controls have accessible names', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const unnamed = [];
        unnamed.push(...await visibleUnnamedControls(page, 'app shell'));

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        unnamed.push(...await visibleUnnamedControls(page, 'settings'));
        await page.evaluate(() => window.closeSettingsModal());
        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);

        await page.evaluate(() => window.switchTab('add'));
        await page.locator('#toggleDetailsBtn').click();
        await expect(page.locator('#txHiddenDetails')).toHaveClass(/open/);
        unnamed.push(...await visibleUnnamedControls(page, 'add more details'));

        expect(unnamed).toEqual([]);
    });

    test('keyboard focus remains visible on common app controls', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await expectVisibleFocus(page, '#toggleDetailsBtn');
        await page.locator('#toggleDetailsBtn').click();
        await expectVisibleFocus(page, '#txPaymentMethod');

        await page.evaluate(() => window.openSettingsModal());
        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        await expectVisibleFocus(page, '.settings-theme-option');
    });
});
