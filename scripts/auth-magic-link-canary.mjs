#!/usr/bin/env node

import { chromium } from 'playwright';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_APP_URL = 'https://app.zambudget.com';
const DEFAULT_TEST_EMAIL = 'auth-smoke@zambudget.com';
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_POLL_INTERVAL_MS = 10000;
const DEFAULT_LOG_FILE = 'test-results/auth-magic-link-canary.jsonl';
const SENSITIVE_URL_PATTERN = /(?:access_token|refresh_token|token|token_hash|code)=/i;

const config = {
    appUrl: stripTrailingSlash(process.env.AUTH_SMOKE_APP_URL || DEFAULT_APP_URL),
    email: process.env.AUTH_SMOKE_EMAIL || DEFAULT_TEST_EMAIL,
    linkCommand: process.env.AUTH_SMOKE_LINK_COMMAND || '',
    linkFile: process.env.AUTH_SMOKE_MAGIC_LINK_FILE || '',
    timeoutMs: toPositiveNumber(process.env.AUTH_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    pollIntervalMs: toPositiveNumber(process.env.AUTH_SMOKE_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    logFile: process.env.AUTH_SMOKE_LOG_FILE || DEFAULT_LOG_FILE,
    alertWebhookUrl: process.env.AUTH_SMOKE_ALERT_WEBHOOK_URL || '',
    headless: process.env.AUTH_SMOKE_HEADED !== '1'
};

const runId = randomUUID();
const startedAt = new Date();
const consoleFindings = [];
const pageErrors = [];

function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function toPositiveNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? next : fallback;
}

function safeHost(value) {
    try {
        return new URL(value).host;
    } catch {
        return 'unknown-host';
    }
}

function safeEventDetails(details = {}) {
    const safe = {};
    for (const [key, value] of Object.entries(details)) {
        if (value === undefined || value === null) continue;
        if (/url|link|token|secret|key|session|payload/i.test(key)) {
            safe[key] = '[redacted]';
        } else if (typeof value === 'string') {
            safe[key] = value.slice(0, 240);
        } else {
            safe[key] = value;
        }
    }
    return safe;
}

async function logEvent(event, status = 'info', details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        run_id: runId,
        event,
        status,
        app_host: safeHost(config.appUrl),
        details: safeEventDetails(details)
    };

    await mkdir(dirname(resolve(config.logFile)), { recursive: true });
    await appendFile(config.logFile, `${JSON.stringify(entry)}\n`, 'utf8');
    console.log(`[auth-smoke] ${status} ${event}`);
}

async function sendAlert(event, reason) {
    if (!config.alertWebhookUrl) return;
    try {
        await fetch(config.alertWebhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                text: `Zam auth canary failed: ${event}`,
                event,
                reason: String(reason || 'Auth canary failure').slice(0, 240),
                run_id: runId,
                app_host: safeHost(config.appUrl),
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        await logEvent('auth_canary_alert_failed', 'warning', { message: error?.message || 'alert failed' });
    }
}

async function fail(event, reason, details = {}) {
    await logEvent(event, 'failed', { reason, ...details });
    await sendAlert(event, reason);
    const error = new Error(reason);
    error.authCanaryAlerted = true;
    throw error;
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function stripUrlJunk(value) {
    return String(value || '').replace(/[)\].,;]+$/g, '');
}

function extractMagicLink(rawText) {
    const text = decodeHtmlEntities(rawText);
    const candidates = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
    return candidates
        .map(stripUrlJunk)
        .find(url => /\/auth\/v1\/verify/i.test(url) || /type=(magiclink|signup|recovery)/i.test(url) || SENSITIVE_URL_PATTERN.test(url))
        || '';
}

function runLinkCommand(requestedAtIso) {
    return new Promise((resolveCommand) => {
        exec(config.linkCommand, {
            timeout: Math.max(1000, Math.min(config.pollIntervalMs - 500, 30000)),
            maxBuffer: 1024 * 1024,
            env: {
                ...process.env,
                AUTH_SMOKE_REQUESTED_AT: requestedAtIso,
                AUTH_SMOKE_TEST_EMAIL: config.email
            }
        }, (error, stdout) => {
            if (error) {
                resolveCommand('');
                return;
            }
            resolveCommand(String(stdout || ''));
        });
    });
}

async function readLinkSource(requestedAtIso) {
    if (config.linkFile) {
        try {
            return await readFile(config.linkFile, 'utf8');
        } catch {
            return '';
        }
    }

    if (config.linkCommand) {
        return runLinkCommand(requestedAtIso);
    }

    return '';
}

async function waitForMagicLink(requestedAtIso) {
    if (!config.linkFile && !config.linkCommand) {
        await fail(
            'magic_link_email_not_configured',
            'Set AUTH_SMOKE_LINK_COMMAND or AUTH_SMOKE_MAGIC_LINK_FILE so the canary can retrieve the test magic link.'
        );
    }

    const deadline = Date.now() + config.timeoutMs;
    while (Date.now() < deadline) {
        const raw = await readLinkSource(requestedAtIso);
        const link = extractMagicLink(raw);
        if (link) return link;
        await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
    }

    await fail('magic_link_email_timeout', 'Magic link email was not received within the expected window.', {
        timeoutMs: config.timeoutMs
    });
}

function shouldTreatConsoleAsCritical(message) {
    const text = String(message || '');
    return /(auth|supabase|cloud sync|buddycloud|recovery)/i.test(text)
        && /(error|failed|uncaught|denied|invalid|cannot|missing)/i.test(text);
}

async function requestMagicLink(page) {
    await page.goto(`${config.appUrl}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#magicEmail', { timeout: 15000 });
    await page.fill('#magicEmail', config.email);
    await page.click('#magicLinkBtn');
    await logEvent('magic_link_requested', 'ok');

    await page.waitForSelector('#authMessage', { state: 'visible', timeout: 15000 }).catch(() => {});
    const messageState = await page.evaluate(() => {
        const message = document.getElementById('authMessage');
        return {
            visible: Boolean(message && getComputedStyle(message).display !== 'none'),
            className: message?.className || '',
            text: message?.textContent || ''
        };
    });

    if (messageState.className.includes('error')) {
        await fail('magic_link_request_failed', 'Magic link request produced a visible auth error.', {
            message: messageState.text
        });
    }
}

async function verifyDashboard(page) {
    await page.waitForSelector('.app-header', { timeout: 30000 });
    await page.waitForFunction((expectedEmail) => {
        const email = window.currentUser?.email || '';
        return Boolean(window.sb?.auth)
            && Boolean(window.currentUser?.id)
            && email.toLowerCase() === expectedEmail.toLowerCase();
    }, config.email, { timeout: 30000 });

    const status = await page.evaluate(async (expectedEmail) => {
        const sessionResult = await window.sb?.auth?.getSession?.();
        const cloudStatus = window.BuddyCloud?.getStatus?.() || {};
        const email = window.currentUser?.email || sessionResult?.data?.session?.user?.email || '';
        return {
            hasSession: Boolean(sessionResult?.data?.session?.user?.id),
            sessionError: Boolean(sessionResult?.error),
            emailMatches: email.toLowerCase() === expectedEmail.toLowerCase(),
            hasCloudStatus: Boolean(window.BuddyCloud?.getStatus),
            cloudSignedIn: Boolean(cloudStatus.signedIn),
            cloudStatus: cloudStatus.status || '',
            cloudHasError: Boolean(cloudStatus.lastError)
        };
    }, config.email);

    if (status.sessionError || !status.hasSession || !status.emailMatches) {
        await fail('session_created', 'Auth callback did not create the expected session.', status);
    }

    await logEvent('session_created', 'ok', {
        hasCloudStatus: status.hasCloudStatus,
        cloudSignedIn: status.cloudSignedIn
    });

    if (status.cloudHasError || status.cloudStatus === 'error') {
        await fail('magic_link_callback_failed', 'Dashboard loaded with a Cloud Sync or recovery error state.', {
            cloudStatus: status.cloudStatus || 'unknown'
        });
    }

    const criticalConsole = consoleFindings.filter(shouldTreatConsoleAsCritical);
    if (criticalConsole.length || pageErrors.length) {
        await fail('magic_link_callback_failed', 'Dashboard logged auth, recovery, or Cloud Sync errors.', {
            consoleFindings: criticalConsole.length,
            pageErrors: pageErrors.length
        });
    }
}

async function cleanup(page) {
    await page.evaluate(async () => {
        try {
            await window.sb?.auth?.signOut?.({ scope: 'local' });
        } catch {
            // Best-effort cleanup only.
        }
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch {
            // Storage may be blocked in a failed run.
        }
    }).catch(() => {});
    await logEvent('logout_success', 'ok');
}

async function main() {
    await logEvent('auth_canary_started', 'info', {
        appHost: safeHost(config.appUrl),
        account: 'auth-smoke',
        hasLinkCommand: Boolean(config.linkCommand),
        hasLinkFile: Boolean(config.linkFile)
    });

    const browser = await chromium.launch({ headless: config.headless });
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        ignoreHTTPSErrors: false
    });

    page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) {
            const text = message.text();
            if (!SENSITIVE_URL_PATTERN.test(text)) consoleFindings.push(text);
        }
    });
    page.on('pageerror', (error) => {
        const message = error?.message || 'page error';
        if (!SENSITIVE_URL_PATTERN.test(message)) pageErrors.push(message);
    });

    try {
        const requestedAtIso = new Date().toISOString();
        await requestMagicLink(page);

        const magicLink = await waitForMagicLink(requestedAtIso);
        await logEvent('magic_link_email_sent', 'ok', {
            elapsedMs: Date.now() - startedAt.getTime()
        });

        await logEvent('magic_link_callback_started', 'ok');
        await page.goto(magicLink, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await verifyDashboard(page);
        await logEvent('magic_link_callback_success', 'ok');
        await cleanup(page);
        await logEvent('auth_canary_completed', 'ok');
    } catch (error) {
        if (!error?.authCanaryAlerted) {
            await sendAlert('auth_canary_failed', error?.message || 'Auth canary failed');
        }
        throw error;
    } finally {
        await browser.close().catch(() => {});
    }
}

main().catch(async (error) => {
    await logEvent('auth_canary_failed', 'failed', { reason: error?.message || 'Auth canary failed' }).catch(() => {});
    process.exitCode = 1;
});
