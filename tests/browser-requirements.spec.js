const { test, expect } = require('@playwright/test');

test.describe('browser requirements messaging', () => {
    test('app shell explains JavaScript and required site data when scripts are blocked', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();

        await page.goto('/index.html');
        await expect(page.getByRole('heading', { name: 'JavaScript is required' })).toBeVisible();
        await expect(page.locator('.noscript-fallback')).toContainText('required site data');
        await expect(page.locator('.noscript-fallback')).toContainText('app.zambudget.com');

        await context.close();
    });

    test('login explains JavaScript and required site data when scripts are blocked', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();

        await page.goto('/login.html');
        await expect(page.getByRole('heading', { name: 'JavaScript is required' })).toBeVisible();
        await expect(page.locator('.noscript-fallback')).toContainText('secure authentication');
        await expect(page.locator('.noscript-fallback')).toContainText('app.zambudget.com');

        await context.close();
    });
});
