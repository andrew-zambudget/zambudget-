const { test, expect } = require('@playwright/test');
const { resetBrowserStorage } = require('./helpers/appHarness');

test.describe('login page safeguards', () => {
    test.beforeEach(async ({ page }) => {
        await resetBrowserStorage(page);
    });

    test('magic link rate limit shows clear cooldown guidance', async ({ page }) => {
        await page.route('**/js/vendor/supabase.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async () => ({
                                    data: null,
                                    error: { message: 'For security purposes, you can only request this after 12 seconds.' }
                                }),
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await expect(page.locator('#magicEmail')).toBeVisible();

        await page.locator('#magicEmail').fill('test-user@example.invalid');
        await page.locator('#magicLinkBtn').click();

        const message = page.locator('#authMessage');
        const button = page.locator('#magicLinkBtn');

        await expect(message).toBeVisible();
        await expect(message).toContainText('Please wait 12 seconds before requesting another email link.');
        await expect(message).not.toHaveText('For security purposes');
        await expect(button).toBeDisabled();
        await expect(button).toHaveText(/Try email again in (11|12)s/);
        await expect(page.locator('#googleSignInBtn')).toBeEnabled();
    });

    test('default email sign-in does not auto-create accounts', async ({ page }) => {
        await page.route('**/js/vendor/supabase.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.__otpCalls = [];
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async (payload) => {
                                    window.__otpCalls.push(payload);
                                    return { data: {}, error: null };
                                },
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await expect(page.locator('#authTitle')).toHaveText('Welcome Back');
        await expect(page.locator('#magicLinkBtn')).toHaveText('Email me a sign-in link');
        await expect(page.locator('.oauth-disclosure-note')).toContainText('browser privacy tools may show as a Google tracker/request');

        await page.locator('#magicEmail').fill('existing@example.com');
        await page.locator('#magicLinkBtn').click();

        await expect(page.locator('#authMessage')).toContainText('If this email belongs to a Zam! account');
        await expect(page.locator('#authMessage')).not.toContainText('account exists');
        await expect.poll(() => page.evaluate(() => window.__otpCalls)).toEqual([
            expect.objectContaining({
                email: 'existing@example.com',
                options: expect.objectContaining({
                    emailRedirectTo: 'https://app.zambudget.com/index.html',
                    shouldCreateUser: false
                })
            })
        ]);
    });

    test('magic link submit is single-flight during duplicate submit events', async ({ page }) => {
        await page.route('**/js/vendor/supabase.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.__otpCalls = [];
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async (payload) => {
                                    window.__otpCalls.push(payload);
                                    await new Promise(resolve => setTimeout(resolve, 150));
                                    return { data: {}, error: null };
                                },
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await page.locator('#magicEmail').fill('single-flight@example.com');
        await page.evaluate(() => {
            const form = document.getElementById('magicLinkForm');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });

        await expect(page.locator('#authMessage')).toContainText('If this email belongs to a Zam! account');
        await expect.poll(() => page.evaluate(() => window.__otpCalls)).toEqual([
            expect.objectContaining({
                email: 'single-flight@example.com',
                options: expect.objectContaining({
                    emailRedirectTo: 'https://app.zambudget.com/index.html',
                    shouldCreateUser: false
                })
            })
        ]);
    });

    test('unknown existing-account sign-in does not expose account absence', async ({ page }) => {
        await page.route('**/js/vendor/supabase.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.__otpCalls = [];
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async (payload) => {
                                    window.__otpCalls.push(payload);
                                    return {
                                        data: null,
                                        error: { message: 'Signups not allowed for otp' }
                                    };
                                },
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await page.locator('#magicEmail').fill('unknown@example.com');
        await page.locator('#magicLinkBtn').click();

        const message = page.locator('#authMessage');
        await expect(message).toBeVisible();
        await expect(message).toContainText('If this email belongs to a Zam! account');
        await expect(message).toContainText('If you are new, choose Create one.');
        await expect(message).not.toContainText('Signups not allowed');
        await expect(page.locator('#magicLinkBtn')).toBeDisabled();
        await expect.poll(() => page.evaluate(() => window.__otpCalls)).toEqual([
            expect.objectContaining({
                email: 'unknown@example.com',
                options: expect.objectContaining({
                    emailRedirectTo: 'https://app.zambudget.com/index.html',
                    shouldCreateUser: false
                })
            })
        ]);
    });

    test('create account mode explicitly allows account creation by email', async ({ page }) => {
        await page.route('**/js/vendor/supabase.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.__otpCalls = [];
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: null }, error: null }),
                                signInWithOtp: async (payload) => {
                                    window.__otpCalls.push(payload);
                                    return { data: {}, error: null };
                                },
                                signInWithOAuth: async () => ({ error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html');
        await page.getByRole('link', { name: 'Create one' }).click();

        await expect(page.locator('#authTitle')).toHaveText('Create Beta Account');
        await expect(page.locator('#magicLinkBtn')).toHaveText('Create beta account by email');

        await page.locator('#magicEmail').fill('new@example.com');
        await page.locator('#magicLinkBtn').click();

        await expect(page.locator('#authMessage')).toContainText('Check your inbox to finish creating or signing in');
        await expect.poll(() => page.evaluate(() => window.__otpCalls)).toEqual([
            expect.objectContaining({
                email: 'new@example.com',
                options: expect.objectContaining({
                    emailRedirectTo: 'https://app.zambudget.com/index.html',
                    shouldCreateUser: true
                })
            })
        ]);
    });
});
