const { test, expect } = require('@playwright/test');
const {
    installSignedOutSupabaseStub,
    resetBrowserStorage,
    waitForAppReady
} = require('./helpers/appHarness');

test.describe('Premium billing copy', () => {
    test.beforeEach(async ({ page }) => {
        await installSignedOutSupabaseStub(page);
        await resetBrowserStorage(page);
    });

    test('upgrade modal uses direct subscription pricing without trial copy', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.openUpgradeModal?.('Buddy Cloud Plus'));

        const modal = page.locator('#upgradeModal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('$3.99');
        await expect(modal).toContainText('Subscribe to Premium');
        await expect(modal).not.toContainText(/trial/i);
    });

    test('terms show the direct monthly Premium price without trial language', async ({ page }) => {
        await page.goto('/terms.html');

        await expect(page.locator('body')).toContainText('The current Premium plan is $3.99 per month.');
        await expect(page.locator('body')).not.toContainText(/trial/i);
    });

    test('success modal uses an ASCII-safe billing icon', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => window.showPremiumSuccessModal?.('Payment received', 'Premium access is being verified.'));

        const modal = page.locator('#premiumSuccessModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.icon-large')).toHaveText('$');
        await expect(modal).not.toContainText('â');
    });

    test('pending payment return does not claim Premium is usable yet', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(async () => {
            window.currentUser = { id: 'billing-pending-user', email: 'billing-pending@example.com' };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                ...(window.sb || {}),
                functions: {
                    invoke: async () => ({
                        data: {
                            active: false,
                            subscriptionStatus: 'incomplete',
                            checkoutSessionId: 'cs_live_pending'
                        },
                        error: null
                    })
                }
            };
            window.history.pushState({}, '', '/index.html?payment=success&session_id=cs_live_pending');
            await window.handleStripeCheckoutReturn();
        });

        const modal = page.locator('#premiumSuccessModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#premiumSuccessTitle')).toHaveText('Payment received');
        await expect(modal).toContainText('Stripe is still confirming your subscription');
        await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
        await expect(modal).not.toContainText('Start using Pro');
    });

    test('wrong-account checkout return explains the account mismatch', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(async () => {
            window.currentUser = { id: 'billing-wrong-user', email: 'billing-wrong@example.com' };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                ...(window.sb || {}),
                functions: {
                    invoke: async () => ({
                        data: null,
                        error: {
                            message: 'Edge Function returned a non-2xx status code',
                            context: {
                                json: async () => ({
                                    error: 'Checkout session does not belong to this account.'
                                })
                            }
                        }
                    })
                }
            };
            window.history.pushState({}, '', '/index.html?payment=success&session_id=cs_live_wrong_account');
            await window.handleStripeCheckoutReturn();
        });

        const modal = page.locator('#premiumSuccessModal');
        await expect(modal).toBeVisible();
        await expect(page.locator('#premiumSuccessTitle')).toHaveText('Payment Linked To Another Account');
        await expect(modal).toContainText('completed for a different BudgetBuddy sign-in');
        await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
        await expect(modal).not.toContainText('Stripe is still confirming your subscription');
    });

    test('live billing is blocked from localhost before checkout starts', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const calls = [];
            window.currentUser = { id: 'billing-localhost-user', email: 'billing-localhost@example.com' };
            window.bbConfig = {
                ...(window.bbConfig || {}),
                billingEnabled: true,
                billingMode: 'beta-live',
                stripePublishableKey: 'pk_live_test_local_guard'
            };
            window.sb = {
                ...(window.sb || {}),
                functions: {
                    invoke: async (name, options) => {
                        calls.push({ name, options });
                        return { data: { url: 'https://checkout.stripe.com/test' }, error: null };
                    }
                }
            };
            const messages = [];
            window.showToast = message => messages.push(message);

            await window.startStripeCheckout();
            return { calls, messages };
        });

        expect(result.calls).toHaveLength(0);
        expect(result.messages.join(' ')).toContain('Live billing must be started from https://app.budget-buddy.io');
    });

    test('period-end cancellation shows Premium access is ending', async ({ page }) => {
        await page.goto('/index.html');
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            window.currentUser = { id: 'billing-canceling-user', email: 'billing-canceling@example.com' };
            window.bbConfig = { ...(window.bbConfig || {}), billingEnabled: true };
            window.sb = {
                ...(window.sb || {}),
                functions: {
                    invoke: async () => ({
                        data: {
                            active: true,
                            subscriptionStatus: 'active',
                            cancelAtPeriodEnd: true,
                            currentPeriodEnd: '2026-07-13T23:59:59.000Z'
                        },
                        error: null
                    })
                }
            };

            await window.refreshPremiumAccess({ silent: true });
            const badge = document.getElementById('accountBillingStatus');
            const manageButton = document.getElementById('accountUpgradeBtn');
            return {
                text: badge?.textContent || '',
                active: badge?.classList.contains('is-active') || false,
                canceling: badge?.classList.contains('is-canceling') || false,
                tooltip: badge?.getAttribute('data-tooltip') || '',
                title: badge?.getAttribute('title') || '',
                manageLabel: manageButton?.querySelector('.account-action-label')?.textContent || '',
                manageSubline: manageButton?.querySelector('.account-action-subline')?.textContent || '',
                manageSublineHidden: manageButton?.querySelector('.account-action-subline')?.hidden ?? true
            };
        });

        expect(result.text).toContain('Premium until');
        expect(result.text).toContain('Jul 13, 2026');
        expect(result.active).toBe(true);
        expect(result.canceling).toBe(true);
        expect(result.tooltip).toContain('scheduled to cancel');
        expect(result.title).toBe('');
        expect(result.manageLabel).toBe('Manage');
        expect(result.manageSubline).toBe('Thank you');
        expect(result.manageSublineHidden).toBe(false);
    });
});
