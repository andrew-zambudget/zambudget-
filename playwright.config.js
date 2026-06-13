const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30 * 1000,
    expect: {
        timeout: 5 * 1000
    },
    fullyParallel: false,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL,
        trace: 'retain-on-failure'
    },
    webServer: {
        command: `node scripts/serve-static.js --port ${port}`,
        url: `${baseURL}/tests/fixtures/blank.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 15 * 1000
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ]
});
