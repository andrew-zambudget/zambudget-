const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('account deletion safeguards', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('delete account confirmation explains data scope, Stripe block, and recovery limits', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'account-delete-safety-user',
                email: 'delete-safety@gmail.com',
                app_metadata: {
                    provider: 'google',
                    providers: ['google']
                },
                identities: [
                    { provider: 'google' }
                ]
            };
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await expect(modal.locator('.buddy-cloud-account-delete-intro strong')).toHaveText('This permanently deletes the BudgetBuddy sign-in for delete-safety@gmail.com.');
        await expect(modal).toContainText('Signed in as delete-safety@gmail.com using Google');
        await expect(modal).toContainText('It does not delete your Google account');
        await expect(modal).toContainText('Google connected-app settings');
        await expect(modal.locator('.buddy-cloud-account-delete-scope')).toContainText('BudgetBuddy will delete:');
        await expect(modal.locator('.buddy-cloud-account-delete-scope li')).toHaveText([
            'Encrypted Buddy Cloud vault',
            'Encrypted version-history snapshots',
            'Device/browser access records',
            'Inactive billing profile',
            'Supabase auth identity for this account'
        ]);
        await expect(modal).toContainText('Household or family memberships are not currently stored');
        await expect(modal).toContainText('Active Stripe subscriptions must be cancelled');
        await expect(modal).toContainText('Stripe may retain billing records');
        await expect(modal).toContainText('This cannot be recovered');
        await expect(page.locator('#buddyCloudModalInput')).toHaveAttribute('placeholder', 'DELETE ACCOUNT');

        await modal.getByRole('button', { name: 'Back' }).click();
        await expect(modal).toBeHidden();
    });

    test('delete account confirmation clarifies Apple sign-in is not Apple ID deletion', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'account-delete-apple-user',
                email: 'apple-delete@example.com',
                app_metadata: {
                    provider: 'apple',
                    providers: ['apple']
                },
                identities: [
                    { provider: 'apple' }
                ]
            };
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await expect(modal).toContainText('Signed in as apple-delete@example.com using Apple');
        await expect(modal).toContainText('It does not delete your Apple ID');
        await expect(modal).toContainText('Apple account settings');
    });

    test('account settings tucks destructive actions under advanced warning', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.currentUser = {
                id: 'account-settings-advanced-user',
                email: 'advanced-settings@example.com'
            };
            window.handleAccountSettings();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Settings');
        await expect(modal.getByRole('button', { name: 'Advanced Features' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Version History' })).toHaveCount(0);
        await expect(modal.getByRole('button', { name: 'Reset Buddy Cloud' })).toHaveCount(0);
        await expect(modal.getByRole('button', { name: 'Delete Account' })).toHaveCount(0);

        await modal.getByRole('button', { name: 'Advanced Features' }).click();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Advanced Recovery & Destructive Actions');
        await expect(modal).toContainText('These tools can restore, replace, reset, or permanently delete account data.');
        await expect(modal).toContainText('Some actions can replace the current budget');
        await expect(modal.getByRole('button', { name: 'Version History' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Reset Buddy Cloud' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Delete Account' })).toBeVisible();

        await modal.getByRole('button', { name: 'Back to Settings' }).click();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Settings');
    });

    test('delete account requires a fresh verification code before invoking deletion', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const invokeCalls = await page.evaluate(() => {
            const calls = [];
            window.currentUser = {
                id: 'account-delete-reauth-user',
                email: 'reauth-delete@example.com'
            };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: false };
            window.sb = {
                auth: {
                    reauthenticate: async () => {
                        calls.push({ method: 'reauthenticate' });
                        return { error: null };
                    },
                    verifyOtp: async (payload) => {
                        calls.push({ method: 'verifyOtp', payload });
                        return { error: null };
                    },
                    refreshSession: async () => {
                        calls.push({ method: 'refreshSession' });
                        return { data: {}, error: null };
                    },
                    signOut: async () => ({ error: null })
                },
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ method: 'invoke', name, body: options?.body || null });
                        throw new Error('stop after invoke');
                    }
                }
            };
            window.__accountDeleteCalls = calls;
            window.handleDeleteBudgetBuddyAccount();
            return calls;
        });
        expect(invokeCalls).toEqual([]);

        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await page.locator('#buddyCloudModalInput').fill('DELETE ACCOUNT');
        await page.getByRole('button', { name: 'Delete Account' }).click();

        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Verify Account Deletion');
        await page.locator('#buddyCloudModalInput').fill('123456');
        await page.getByRole('button', { name: 'Verify Login' }).click();

        await expect.poll(() => page.evaluate(() => window.__accountDeleteCalls)).toEqual([
            { method: 'reauthenticate' },
            {
                method: 'verifyOtp',
                payload: {
                    email: 'reauth-delete@example.com',
                    token: '123456',
                    type: 'reauthentication'
                }
            },
            { method: 'refreshSession' },
            { method: 'invoke', name: 'account-delete', body: { deleteAuthUser: true } }
        ]);
    });

    test('premium billing preflight blocks delete confirmation before destructive prompt', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            const calls = [];
            window.currentUser = {
                id: 'account-delete-premium-user',
                email: 'premium-delete@example.com'
            };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ method: 'invoke', name, body: options?.body || null });
                        if (name === 'billing-status') {
                            return {
                                data: {
                                    active: true,
                                    subscriptionStatus: 'active',
                                    cancelAtPeriodEnd: false
                                },
                                error: null
                            };
                        }
                        return { data: null, error: null };
                    }
                }
            };
            window.__accountDeleteCalls = calls;
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Cancel Premium First');
        await expect(modal).toContainText('active Premium subscription');
        await expect(modal).toContainText('Cancel Premium in Stripe before deleting your BudgetBuddy account.');
        await expect(modal.getByRole('button', { name: 'Delete Account' })).toHaveCount(0);
        await expect(page.locator('#buddyCloudModalInput')).toHaveCount(0);

        await expect.poll(() => page.evaluate(() => window.__accountDeleteCalls)).toEqual([
            { method: 'invoke', name: 'billing-status', body: {} }
        ]);
    });

    test('billing preflight failure blocks delete confirmation', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            const calls = [];
            window.currentUser = {
                id: 'account-delete-billing-fail-user',
                email: 'billing-fail-delete@example.com'
            };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ method: 'invoke', name, body: options?.body || null });
                        return {
                            data: null,
                            error: { message: 'Billing status is temporarily unavailable.' }
                        };
                    }
                }
            };
            window.__accountDeleteCalls = calls;
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Billing Check Required');
        await expect(modal).toContainText('Billing status is temporarily unavailable.');
        await expect(modal).toContainText('Account deletion did not start');
        await expect(modal.getByRole('button', { name: 'Delete Account' })).toHaveCount(0);
        await expect(page.locator('#buddyCloudModalInput')).toHaveCount(0);

        await expect.poll(() => page.evaluate(() => window.__accountDeleteCalls)).toEqual([
            { method: 'invoke', name: 'billing-status', body: {} }
        ]);
    });

    test('inactive billing preflight allows delete confirmation to proceed', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            const calls = [];
            window.currentUser = {
                id: 'account-delete-free-user',
                email: 'free-delete@example.com'
            };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ method: 'invoke', name, body: options?.body || null });
                        if (name === 'billing-status') {
                            return {
                                data: {
                                    active: false,
                                    subscriptionStatus: 'inactive',
                                    cancelAtPeriodEnd: false
                                },
                                error: null
                            };
                        }
                        return { data: null, error: null };
                    }
                },
                auth: {
                    reauthenticate: async () => ({ error: null }),
                    verifyOtp: async () => ({ error: null }),
                    refreshSession: async () => ({ data: {}, error: null }),
                    signOut: async () => ({ error: null })
                }
            };
            window.__accountDeleteCalls = calls;
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await expect(page.locator('#buddyCloudModalInput')).toHaveAttribute('placeholder', 'DELETE ACCOUNT');
        await expect.poll(() => page.evaluate(() => window.__accountDeleteCalls)).toEqual([
            { method: 'invoke', name: 'billing-status', body: {} }
        ]);
    });

    test('login page shows account deletion confirmation instead of redirecting away', async ({ page }) => {
        await page.route('**/@supabase/supabase-js@2', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `
                window.supabase = {
                    createClient() {
                        return {
                            auth: {
                                getSession: async () => ({ data: { session: { user: { id: 'stale' } } }, error: null })
                            }
                        };
                    }
                };
            `
        }));

        await page.goto('/login.html?accountDeleted=true');
        await expect(page.locator('#authMessage')).toBeVisible();
        await expect(page.locator('#authMessage')).toContainText('Your BudgetBuddy account has been deleted');
        await expect(page).toHaveURL(/login\.html\?accountDeleted=true/);
    });
});
