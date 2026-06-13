const { test, expect } = require('@playwright/test');

const QUARANTINE_TAG = 'LEGACY_STORAGE_QUARANTINE_2026_06';

const SUPABASE_SIGNED_OUT_STUB = `
window.supabase = {
  createClient() {
    const emptyQuery = {
      select() { return this; },
      insert() { return Promise.resolve({ data: null, error: null }); },
      update() { return this; },
      upsert() { return Promise.resolve({ data: null, error: null }); },
      delete() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      single() { return Promise.resolve({ data: null, error: null }); },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
    };

    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null })
      },
      from: () => emptyQuery,
      functions: {
        invoke: async () => ({ data: null, error: null })
      },
      channel: () => ({
        on() { return this; },
        subscribe(callback) {
          if (typeof callback === 'function') callback('SUBSCRIBED');
          return this;
        },
        unsubscribe() {}
      }),
      removeChannel: async () => ({ error: null })
    };
  }
};
`;

async function resetBrowserStorage(page) {
    await page.goto('/tests/fixtures/blank.html');
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

async function waitForAppReady(page) {
    await expect(page.locator('.app-header')).toBeVisible();
    await page.waitForFunction(() => (
        typeof window.switchTab === 'function'
        && typeof window.submitTransaction === 'function'
        && typeof window.getCategories === 'function'
        && Array.isArray(window.getCategories())
    ), null, { timeout: 15000 });
}

test.describe('legacy quarantine warnings', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/@supabase/supabase-js@2', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: SUPABASE_SIGNED_OUT_STUB
        }));
        await resetBrowserStorage(page);
    });

    test('browser-only boot and basic budget flow do not hit quarantined fallbacks', async ({ page }) => {
        const quarantineWarnings = [];
        page.on('console', message => {
            const text = message.text();
            if (text.includes(QUARANTINE_TAG)) quarantineWarnings.push(text);
        });

        await page.goto('/index.html');
        await waitForAppReady(page);

        await page.evaluate(() => {
            window.switchTab('income');
            window.switchTab('savings');
            window.switchTab('debt');
            window.switchTab('recent');
            window.switchTab('add');
        });

        const categoryName = await page.evaluate(() => {
            const existing = window.getCategories().find(category => category.type === 'expense')?.name;
            if (existing) return existing;

            const result = window.addCategory?.('Quarantine Test', 'QT', 'expense', 100);
            return result?.success ? result.name : '';
        });
        expect(categoryName).not.toBe('');

        await page.fill('#txAmount', '12.34');
        await page.fill('#txDescription', 'Quarantine smoke');
        await page.evaluate((category) => {
            const categoryInput = document.getElementById('txCategory');
            if (categoryInput) categoryInput.value = category;
            window.setType?.('expense');
            window.submitTransaction();
            window.switchTab('recent');
            window.switchTab('savings');
        }, categoryName);

        expect(quarantineWarnings).toEqual([]);
    });
});
