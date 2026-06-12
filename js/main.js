/**
 * ============================================================================
 * ⚠️ CORE GUARDRAILS - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 * ============================================================================
 *
 * This file contains the IMMUTABLE CORE of BudgetBuddy.
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

// Global Supabase variables
window.sb = null;
window.currentUser = null;
window.bbConfig = null;
let appStateInitialized = false;

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

    try {
        // --- SUPABASE INITIALIZATION START ---
        try {
            const res = await fetch('./config.json');
            if (!res.ok) throw new Error('Config file not found or inaccessible.');
            const config = await res.json();
            window.bbConfig = config;
            
            if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
                // Initialize Client
                window.sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
                
                // Check for existing session securely
                const { data: { session }, error } = await window.sb.auth.getSession();
                if (error) throw error;
                
                window.currentUser = session ? session.user : null;
                
                // Listen for changes (like logging out)
                window.sb.auth.onAuthStateChange(async (event, session) => {
                    window.currentUser = session ? session.user : null;
                    if (!appStateInitialized) return;

                    if (window.currentUser && DemoMode.isDemoModeActive?.()) {
                        const demoCleanup = DemoMode.prepareDemoMode?.({ user: window.currentUser });
                        if (demoCleanup?.disabledForSignedInUser) {
                            window.location.reload();
                            return;
                        }
                    }

                    try {
                        if (window.currentUser && typeof window.refreshPremiumAccess === 'function') {
                            await window.refreshPremiumAccess({ silent: true });
                        } else {
                            State.setIsPro?.(false, { source: 'auth_state_change' });
                        }

                        const browserAccessOk = await UI.refreshBrowserAccessRegistry?.({ silent: true });
                        if (browserAccessOk === false) return;
                        await BuddyCloud.refreshUser(window.currentUser);
                        if (window.currentUser) {
                            await UI.ensureBuddyCloudDefaultProtection?.();
                        }
                    } catch (authRefreshError) {
                        console.warn('[main.js] Auth refresh failed:', authRefreshError);
                    } finally {
                        if (typeof window.updateAuthUI === 'function') window.updateAuthUI();
                    }
                });
                
                console.log('[main.js] Supabase initialized successfully.');
            } else {
                console.warn('[main.js] Supabase config missing or script not loaded. Running offline mode.');
            }
        } catch (e) {
            console.error("[main.js] Failed to initialize Supabase:", e);
        }
        // --- SUPABASE INITIALIZATION END ---

        const demoModeState = DemoMode.prepareDemoMode?.({ user: window.currentUser });

        // Initialize the data engine
        if (State.initState) State.initState();
        appStateInitialized = true;

        if (window.currentUser && typeof UI.refreshPremiumAccess === 'function') {
            await UI.refreshPremiumAccess({ silent: true });
        } else {
            State.setIsPro?.(false, { source: 'billing_status_unavailable' });
        }

        const browserAccessOk = await UI.refreshBrowserAccessRegistry?.({ silent: true });
        if (browserAccessOk === false) return;

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
        const savedTheme = localStorage.getItem('bb_theme_mode') || 'system';
        if (UI.applyTheme) UI.applyTheme(savedTheme);
        UI.applyAccentTheme?.(localStorage.getItem('bb_accent_color') || 'teal');

        DemoMode.initDemoMode?.({ demoModeState, user: window.currentUser });
        DemoMode.initSignedOutAccountPrompt?.({ user: window.currentUser });

        if (!DemoMode.isDemoModeActive?.()) {
            await UI.ensureBuddyCloudDefaultProtection?.();
        }

        console.log('[main.js] Application initialized successfully');
    } catch (err) {
        console.error('[main.js] Critical Init Error:', err);
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
