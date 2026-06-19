/**
 * ============================================================================
 * ⚠️ CORE GUARDRAILS - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 * ============================================================================
 *
 * This file contains the IMMUTABLE CORE of Zam!
 * These functions handle the Free Tier baseline logic:
 * - Transaction Management (Add/Delete/Filter)
 * - Category System (Create/Sort/Safety Checks)
 * - Financial Aggregation (Balance/Income/Expense Math)
 * - Local Persistence (localStorage only)
 *
 * RULES:
 * 1. Do not gate these features behind login/paywalls.
 * 2. Do not remove functionality unless migrating to v2 architecture.
 * 3. If you need to change a formula, create a NEW function instead.
 *
 * Violating these rules breaks the "Open Source / Free" promise.
 * See docs/CORE_FEATURES_GUARDRAILS.md for full specification.
 * ============================================================================
 */

// js/main.js
import * as State from './state.js';
import * as UI from './ui.js';
import * as BuddyCloud from './cloudSync.js';
import * as DemoMode from './demoMode.js';
import * as BudgetPrep from './budgetPrep.js';
import * as AuthRouteGuard from './authRouteGuard.js';
import { runPrivacyStorageCleanup } from './privacyStorageCleanup.js';
import { guardSignedInLocalOwner } from './accountLocalState.js';

// Global Supabase variables
window.sb = null;
window.currentUser = null;
window.bbConfig = null;
window.ZamAuthRouteGuard = AuthRouteGuard;
let appStateInitialized = false;

function readLocalStorageValue(key, fallback = '') {
    try {
        return localStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

/**
 * 1. THE BRIDGE (100% Bulletproof Version)
 * Force-binds all exported functions from State and UI modules to the window object.
 */
function bridgeAll() {
    // 1. Force bind UI functions using a strict loop (bypasses ES6 module spread bugs)
    for (const key in UI) {
        if (typeof UI[key] === 'function') {
            window[key] = UI[key];
        }
    }

    // 2. Force bind State functions
    for (const key in State) {
        if (typeof State[key] === 'function') {
            window[key] = State[key];
        }
    }

    // 3. The Ultimate Safety Net: Explicit bindings for our newest features
    if (UI.openAddDebtModal) window.openAddDebtModal = UI.openAddDebtModal;
    if (UI.saveNewDebt) window.saveNewDebt = UI.saveNewDebt;
    if (UI.renderDebtTab) window.renderDebtTab = UI.renderDebtTab;

    console.log('[Bridge] All UI and State functions successfully bound to window.');
}

// Execute bridge immediately
bridgeAll();

/**
 * 2. INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[main.js] Initializing Application...');
    const privacyCleanup = runPrivacyStorageCleanup();
    if (privacyCleanup?.blocked) return;

    if (State.isBrowserStorageAvailable?.({ refresh: true }) === false) {
        BudgetPrep.failPreparingBudget?.({
            title: 'Browser storage is blocked',
            detail: 'Zam needs required browser site data to save and load your budget on this device. Enable site data for app.zambudget.com or use your browser settings to clear/reset it.'
        });
        return;
    }

    try {
        // --- SUPABASE INITIALIZATION START ---
        try {
            const res = await fetch('/config.json');
            if (!res.ok) throw new Error('Config file not found or inaccessible.');
            const config = await res.json();
            window.bbConfig = config;
            
            if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
                // Initialize Client
                window.sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
                const routeGuard = await AuthRouteGuard.guardCurrentAppRoute({ supabaseClient: window.sb });
                if (routeGuard.redirected) return;

                window.currentUser = routeGuard.user || null;
                if (window.currentUser) {
                    BudgetPrep.showPreparingBudget?.({
                        title: 'Preparing budget...',
                        detail: 'Checking your account and encrypted sync state.'
                    });
                }
                
                // Listen for changes (like logging out)
                window.sb.auth.onAuthStateChange(async (event, session) => {
                    window.currentUser = session ? session.user : null;
                    if (!appStateInitialized) return;

                    if (!window.currentUser && AuthRouteGuard.isProtectedAppRoute()) {
                        try {
                            await BuddyCloud.refreshUser(null);
                        } catch (signOutRefreshError) {
                            console.warn('[main.js] Signed-out Cloud Sync cleanup failed:', signOutRefreshError);
                        }
                        AuthRouteGuard.redirectToLogin();
                        return;
                    }

                    if (window.currentUser) {
                        const ownerGuard = guardSignedInLocalOwner(window.currentUser.id);
                        if (ownerGuard.changed) {
                            console.warn('[main.js] Signed-in account changed. Clearing account-scoped local state before reload.');
                            window.location.reload();
                            return;
                        }
                    }

                    if (window.currentUser && DemoMode.isDemoModeActive?.()) {
                        const demoCleanup = DemoMode.prepareDemoMode?.({ user: window.currentUser });
                        if (demoCleanup?.disabledForSignedInUser) {
                            window.location.reload();
                            return;
                        }
                    }

                    const showAuthPrep = Boolean(window.currentUser);
                    if (showAuthPrep) {
                        BudgetPrep.showPreparingBudget?.({
                            title: 'Refreshing budget...',
                            detail: 'Checking your account before updating the dashboard.'
                        });
                    }

                    let authRefreshFailed = false;
                    try {
                        if (window.currentUser && typeof window.refreshPremiumAccess === 'function') {
                            BudgetPrep.updatePreparingBudget?.({ detail: 'Checking Premium status and account access.' });
                            await window.refreshPremiumAccess({ silent: true });
                        } else {
                            State.setIsPro?.(false, { source: 'auth_state_change' });
                        }

                        BudgetPrep.updatePreparingBudget?.({ detail: 'Checking whether this browser is still trusted.' });
                        const browserAccessOk = await UI.refreshBrowserAccessRegistry?.({ silent: true });
                        if (browserAccessOk === false) return;

                        BudgetPrep.updatePreparingBudget?.({ detail: 'Opening Cloud Sync without reading your budget.' });
                        await BuddyCloud.refreshUser(window.currentUser);
                        if (window.currentUser) {
                            BudgetPrep.updatePreparingBudget?.({ detail: 'Confirming encrypted Cloud Sync protection.' });
                            await UI.ensureBuddyCloudDefaultProtection?.();
                        }
                    } catch (authRefreshError) {
                        console.warn('[main.js] Auth refresh failed:', authRefreshError);
                        authRefreshFailed = true;
                        if (showAuthPrep) {
                            BudgetPrep.failPreparingBudget?.({
                                title: 'Budget refresh paused',
                                detail: 'Zam! could not finish refreshing the signed-in budget state.'
                            });
                        }
                    } finally {
                        if (typeof window.updateAuthUI === 'function') window.updateAuthUI();
                        if (showAuthPrep && !authRefreshFailed) BudgetPrep.hidePreparingBudget?.();
                    }
                });
                
                console.log('[main.js] Supabase initialized successfully.');
            } else {
                console.warn('[main.js] Supabase config missing or script not loaded. Running offline mode.');
                const routeGuard = await AuthRouteGuard.guardCurrentAppRoute({ supabaseClient: null });
                if (routeGuard.redirected) return;
            }
        } catch (e) {
            console.error("[main.js] Failed to initialize Supabase:", e);
            if (AuthRouteGuard.isProtectedAppRoute()) {
                AuthRouteGuard.redirectToLogin({ returnTo: true });
                return;
            }
            if (AuthRouteGuard.shouldRedirectRoot()) {
                AuthRouteGuard.redirectToLogin();
                return;
            }
            AuthRouteGuard.clearAuthPendingState();
        }
        // --- SUPABASE INITIALIZATION END ---

        const demoModeState = DemoMode.prepareDemoMode?.({ user: window.currentUser });
        if (window.currentUser) {
            const ownerGuard = guardSignedInLocalOwner(window.currentUser.id);
            if (ownerGuard.changed) {
                BudgetPrep.updatePreparingBudget?.({
                    title: 'Preparing fresh budget...',
                    detail: 'This browser was previously tied to a different Zam! account, so local account data was cleared.'
                });
            }
        }

        // Initialize the data engine
        BudgetPrep.updatePreparingBudget?.({ detail: 'Loading this browser budget before cloud checks.' });
        if (State.initState) State.initState();
        appStateInitialized = true;

        if (window.currentUser && typeof UI.refreshPremiumAccess === 'function') {
            BudgetPrep.updatePreparingBudget?.({ detail: 'Checking Premium status and account access.' });
            await UI.refreshPremiumAccess({ silent: true });
        } else {
            State.setIsPro?.(false, { source: 'billing_status_unavailable' });
        }

        BudgetPrep.updatePreparingBudget?.({ detail: 'Checking whether this browser is still trusted.' });
        const browserAccessOk = await UI.refreshBrowserAccessRegistry?.({ silent: true });
        if (browserAccessOk === false) {
            BudgetPrep.updatePreparingBudget?.({
                title: 'Clearing this browser...',
                detail: 'This browser was signed out from Account > Devices.'
            });
            return;
        }

        BudgetPrep.updatePreparingBudget?.({ detail: 'Opening Cloud Sync without reading your budget.' });
        await BuddyCloud.init({
            supabaseClient: window.sb,
            user: window.currentUser,
            getSnapshot: State.getSnapshot,
            replaceSnapshot: State.replaceSnapshot,
            isPremiumAccount: () => Boolean(State.getIsPro?.()),
            afterRemoteApply: () => {
                UI.render?.();
                UI.renderCategoryList?.();
                UI.renderDebtTab?.();
                UI.initSettingsUI?.();
                UI.initCategoryUI?.();
            }
        });

        // Wire up events
        BudgetPrep.updatePreparingBudget?.({ detail: 'Wiring up budget controls.' });
        try {
            const eventModule = await import('./events.js');
            if (eventModule.initEvents) {
                eventModule.initEvents();
                console.log('[main.js] Events initialized');
            }
        } catch (e) {
            console.warn('[main.js] Could not load events.js, continuing anyway.', e);
        }

        // Call UI update after checking session to update Avatar/Login button
        BudgetPrep.updatePreparingBudget?.({ detail: 'Painting the dashboard with the latest budget state.' });
        if (typeof window.updateAuthUI === 'function') window.updateAuthUI();

        // Initial render sequences safely mapped
        if (typeof UI.renderCategoryList === 'function') UI.renderCategoryList();
        if (typeof UI.renderDebtTab === 'function') UI.renderDebtTab();

        // Safely attempt to call future/missing functions using optional chaining
        UI.render?.();
        UI.initCalendar?.();
        UI.updateDateDisplay?.();
        UI.initSettingsUI?.();
        UI.initCategoryUI?.();
        UI.initAddTransactionForm?.();
        UI.initMobileCommandNav?.();
        UI.initDescriptionRollover?.();
        UI.initCategoryNameRollover?.();
        UI.handleStripeCheckoutReturn?.();
        UI.repairViewportLayout?.();
        setTimeout(() => UI.repairViewportLayout?.(), 150);

        // Apply theme safely
        const savedTheme = readLocalStorageValue('bb_theme_mode', 'system');
        if (UI.applyTheme) UI.applyTheme(savedTheme);
        UI.applyAccentTheme?.(readLocalStorageValue('bb_accent_color', 'teal'));

        if (!DemoMode.isDemoModeActive?.()) {
            BudgetPrep.updatePreparingBudget?.({ detail: 'Confirming encrypted Cloud Sync protection.' });
            await UI.ensureBuddyCloudDefaultProtection?.();
        }

        DemoMode.initDemoMode?.({
            demoModeState,
            user: window.currentUser,
            accountTier: State.getIsPro?.() ? 'premium' : 'free'
        });
        DemoMode.initSignedOutAccountPrompt?.({ user: window.currentUser });

        BudgetPrep.updatePreparingBudget?.({
            title: 'Budget ready.',
            detail: 'Dashboard is caught up. No spreadsheet panic required.'
        });
        BudgetPrep.hidePreparingBudget?.();

        console.log('[main.js] Application initialized successfully');
    } catch (err) {
        console.error('[main.js] Critical Init Error:', err);
        if (BudgetPrep.isPreparingBudgetVisible?.()) {
            BudgetPrep.failPreparingBudget?.({
                title: 'Budget did not finish loading',
                detail: 'Zam! hit a startup error before the dashboard finished preparing.'
            });
        }
        if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
            UI.showToast('Failed to start application.');
        } else {
            console.warn('Failed to start application: ' + err.message);
        }
    }
});

window.addEventListener('pageshow', () => {
    UI.repairViewportLayout?.();
    setTimeout(() => UI.repairViewportLayout?.(), 150);
});

/**
 * 3. GLOBAL ERROR CATCHER
 */
window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.message);
    if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
        UI.showToast('Error: ' + event.message);
    }
});
