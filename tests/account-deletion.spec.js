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
                email: 'delete-safety@example.com'
            };
            window.handleDeleteBudgetBuddyAccount();
        });

        const modal = page.locator('#buddyCloudModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#buddyCloudModalTitle')).toHaveText('Delete BudgetBuddy Account?');
        await expect(modal).toContainText('encrypted Buddy Cloud vault');
        await expect(modal).toContainText('encrypted version-history snapshots');
        await expect(modal).toContainText('device/browser access records');
        await expect(modal).toContainText('inactive billing profile');
        await expect(modal).toContainText('Supabase auth identity');
        await expect(modal).toContainText('Household or family memberships are not currently stored');
        await expect(modal).toContainText('Active Stripe subscriptions must be cancelled');
        await expect(modal).toContainText('Stripe may retain billing records');
        await expect(modal).toContainText('This cannot be recovered');
        await expect(page.locator('#buddyCloudModalInput')).toHaveAttribute('placeholder', 'DELETE ACCOUNT');

        await modal.getByRole('button', { name: 'Back' }).click();
        await expect(modal).toBeHidden();
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
