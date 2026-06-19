const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

test.describe('clipboard privacy guardrails', () => {
    test('app code does not request clipboard read access', () => {
        const filesToCheck = [
            path.join(root, 'index.html'),
            path.join(root, 'login.html'),
            path.join(root, 'js', 'ui.js'),
            path.join(root, 'js', 'main.js'),
            path.join(root, 'js', 'cloudSync.js')
        ];

        const combined = filesToCheck
            .filter(file => fs.existsSync(file))
            .map(file => fs.readFileSync(file, 'utf8'))
            .join('\n');

        expect(combined).not.toContain('navigator.clipboard.readText');
        expect(combined).not.toContain('navigator.clipboard.read(');
    });

    test('static asset headers block clipboard read permission', () => {
        const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');

        expect(headers).toContain('Permissions-Policy: clipboard-read=()');
    });
});
