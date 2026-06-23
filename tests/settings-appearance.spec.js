const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('settings appearance panel', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('shows theme mode and expanded accent controls', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openSettingsModal());
        const appearance = page.locator('#settingsAppearance');
        await expect(appearance).toBeVisible();

        await expect(appearance).toContainText('Theme Mode');
        await expect(appearance).toContainText('Choose how Zam appears on this device.');
        await expect(appearance).toContainText('System follows your device setting automatically.');
        await expect(appearance.locator('.settings-theme-option', { hasText: 'Light' })).toBeVisible();
        await expect(appearance.locator('.settings-theme-option', { hasText: 'Dark' })).toBeVisible();
        await expect(appearance.locator('.settings-theme-option', { hasText: 'System' })).toBeVisible();
        await expect(appearance).toContainText('Built-in Themes');
        await expect(appearance).toContainText('Choose a ready-made look for this mode.');
        await appearance.locator('.settings-theme-option', { hasText: 'Light' }).click();
        await expect(page.locator('#settingsThemePresetStatus')).toContainText('Light themes');
        const lightPresetCards = page.locator('#settingsThemePresetGrid .settings-theme-preset-card');
        const burgerStandPreset = page.locator('#settingsThemePresetGrid .settings-theme-preset-card[data-theme-preset="light:burger-stand"]');
        await expect(lightPresetCards).toHaveCount(2);
        await expect(page.locator('#settingsThemePresetGrid .settings-theme-preset-card[data-theme-preset="light:tbd"]')).toContainText('Light Theme');
        await expect(page.locator('#settingsThemePresetGrid .settings-theme-preset-card[data-theme-preset="light:tbd"]')).toContainText('Default');
        await expect(burgerStandPreset).toContainText('Burger Stand Light');
        await expect(burgerStandPreset).not.toContainText('Warm diner colors with ketchup red, mustard gold, and teal accents.');
        await burgerStandPreset.click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('bb_theme_preset'))).toBe('light:burger-stand');
        await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'light:burger-stand');
        await expect.poll(() => page.evaluate(() => {
            const styles = getComputedStyle(document.documentElement);
            return {
                accent: styles.getPropertyValue('--accent').trim(),
                background: styles.getPropertyValue('--bg').trim(),
                border: styles.getPropertyValue('--border').trim(),
                mint: styles.getPropertyValue('--burger-stand-mint').trim(),
                pink: styles.getPropertyValue('--burger-stand-pink').trim(),
                sodaBlue: styles.getPropertyValue('--burger-stand-soda-blue').trim()
            };
        })).toEqual({
            accent: '#24b8b0',
            background: '#fff8ec',
            border: '#ead7bf',
            mint: '#7bd88f',
            pink: '#f472b6',
            sodaBlue: '#60a5fa'
        });
        await expect(burgerStandPreset.locator('.settings-theme-preset-preview')).toHaveCSS('border-color', 'rgb(36, 184, 176)');
        await expect(page.locator('#submitBtn')).toHaveCSS('color', 'rgb(255, 255, 255)');
        await expect(page.locator('#submitBtn')).toHaveCSS('border-color', 'rgb(214, 40, 40)');

        await appearance.locator('.settings-theme-option', { hasText: 'Dark' }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('html')).not.toHaveAttribute('data-theme-preset', 'light:burger-stand');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('bb_theme_mode'))).toBe('dark');
        await expect(page.locator('#settingsThemePresetStatus')).toContainText('Dark themes');
        await expect(page.locator('#settingsThemePresetGrid .settings-theme-preset-card')).toContainText('Dark Theme');
        await expect(page.locator('#settingsThemePresetGrid .settings-theme-preset-card')).toContainText('Default');
        await page.locator('#settingsThemePresetGrid .settings-theme-preset-card').click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('bb_theme_preset'))).toBe('dark:tbd');

        await appearance.locator('.settings-theme-option', { hasText: 'System' }).click();
        await expect(page.locator('#settingsThemePresetStatus')).toContainText(/System is currently using (Light|Dark) themes/);

        await expect(appearance).toContainText('Accent Color');
        await expect(appearance).toContainText('Choose the color used for buttons, highlights, focus states, and progress accents.');
        await expect(appearance.locator('label.accent-swatch-option', { hasText: 'Jade' })).toBeVisible();
        await expect(appearance.locator('label.accent-swatch-option', { hasText: 'Graphite' })).toBeVisible();
        await expect(appearance.locator('label.accent-swatch-option', { hasText: 'Lavender' })).toBeVisible();

        await appearance.locator('label.accent-swatch-option', { hasText: 'Jade' }).click();
        await expect(page.locator('#settingsAccentSelected')).toHaveText('Selected: Jade');
        await expect(page.locator('html')).toHaveAttribute('data-accent', 'jade');

        await appearance.getByRole('button', { name: 'Randomize' }).click();
        await expect.poll(() => page.evaluate(() => Boolean(sessionStorage.getItem('bb_session_accent_color')))).toBe(true);
        await expect(appearance.getByRole('button', { name: 'Randomize' })).toBeEnabled();

        await appearance.getByRole('button', { name: 'Save Accent Color' }).click();
        await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('bb_accent_color')))).toBe(true);

        await appearance.getByRole('button', { name: 'Use Random by Default' }).click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('bb_accent_color'))).toBeNull();
        await expect.poll(() => page.evaluate(() => Boolean(sessionStorage.getItem('bb_session_accent_color')))).toBe(true);
        await expect(page.locator('#settingsAccentModeStatus')).toContainText('Random by default');
    });
});
