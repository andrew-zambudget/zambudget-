const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';
const OPERATIONAL_STORAGE_KEY = 'bb_local_operational_metadata_v1';
const LOCAL_UPDATED_SENTINEL = '2026-06-21T22:01:02.003Z';
const CLOUD_PUSHED_SENTINEL = '2026-06-21T22:02:03.004Z';
const CLOUD_REMOTE_SENTINEL = '2026-06-21T22:03:04.005Z';
const SYNC_SLOT_SENTINEL = 'OPERATIONAL_SYNC_SLOT_TOKEN_SENTINEL';

function modulePath(pathname) {
    return `${pathname}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resetStorage(page) {
    await page.goto(BLANK_FIXTURE);
    await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();
        await new Promise(resolve => {
            const request = indexedDB.deleteDatabase('zam_local_vault_keys');
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    });
}

test.describe('encrypted local operational metadata storage', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('migrates visible operational metadata into an encrypted envelope', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Operational = await import(moduleUrl);

            localStorage.setItem('bb_local_updated_at', sentinels.localUpdatedAt);
            localStorage.setItem('bb_cloud_last_pushed_at', sentinels.cloudLastPushedAt);
            localStorage.setItem('bb_cloud_last_remote_at', sentinels.cloudLastRemoteAt);
            localStorage.setItem('bb_cloud_sync_slot_sync-user-id', sentinels.syncSlotToken);

            const initResult = await Operational.initLocalOperationalMetadataStorage();
            await Operational.flushLocalOperationalMetadataWrites();

            const raw = localStorage.getItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY) || '';

            return {
                initResult,
                classification: Operational.classifyLocalOperationalMetadataRecord(),
                snapshot: Operational.getOperationalMetadataSnapshot(),
                raw,
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/localOperationalMetadataStorage.js'),
            sentinels: {
                localUpdatedAt: LOCAL_UPDATED_SENTINEL,
                cloudLastPushedAt: CLOUD_PUSHED_SENTINEL,
                cloudLastRemoteAt: CLOUD_REMOTE_SENTINEL,
                syncSlotToken: SYNC_SLOT_SENTINEL
            }
        });

        expect(result.initResult.migratedLegacy).toBe(true);
        expect(result.classification.kind).toBe('encrypted');
        expect(result.keys).toEqual([OPERATIONAL_STORAGE_KEY]);
        expect(result.snapshot).toEqual({
            localUpdatedAt: LOCAL_UPDATED_SENTINEL,
            cloudLastPushedAt: CLOUD_PUSHED_SENTINEL,
            cloudLastRemoteAt: CLOUD_REMOTE_SENTINEL,
            cloudSyncSlotToken: SYNC_SLOT_SENTINEL
        });
        expect(result.raw).toContain('zam_local_metadata_vault');
        expect(result.raw).toContain('local_operational_metadata');
        expect(result.raw).not.toContain(LOCAL_UPDATED_SENTINEL);
        expect(result.raw).not.toContain(CLOUD_PUSHED_SENTINEL);
        expect(result.raw).not.toContain(CLOUD_REMOTE_SENTINEL);
        expect(result.raw).not.toContain(SYNC_SLOT_SENTINEL);
    });

    test('writes operational metadata without exposing timestamps or sync slot tokens', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Operational = await import(moduleUrl);

            await Operational.initLocalOperationalMetadataStorage();
            Operational.setLocalUpdatedAt(sentinels.localUpdatedAt);
            Operational.setCloudLastPushedAt(sentinels.cloudLastPushedAt);
            Operational.setCloudLastRemoteAt(sentinels.cloudLastRemoteAt);
            Operational.setCloudSyncSlotToken(sentinels.syncSlotToken);
            await Operational.flushLocalOperationalMetadataWrites();

            const raw = localStorage.getItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY) || '';

            return {
                classification: Operational.classifyLocalOperationalMetadataRecord(),
                snapshot: Operational.getOperationalMetadataSnapshot(),
                raw,
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/localOperationalMetadataStorage.js'),
            sentinels: {
                localUpdatedAt: LOCAL_UPDATED_SENTINEL,
                cloudLastPushedAt: CLOUD_PUSHED_SENTINEL,
                cloudLastRemoteAt: CLOUD_REMOTE_SENTINEL,
                syncSlotToken: SYNC_SLOT_SENTINEL
            }
        });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.keys).toEqual([OPERATIONAL_STORAGE_KEY]);
        expect(result.snapshot.cloudSyncSlotToken).toBe(SYNC_SLOT_SENTINEL);
        expect(result.raw).not.toContain(LOCAL_UPDATED_SENTINEL);
        expect(result.raw).not.toContain(CLOUD_PUSHED_SENTINEL);
        expect(result.raw).not.toContain(CLOUD_REMOTE_SENTINEL);
        expect(result.raw).not.toContain(SYNC_SLOT_SENTINEL);
    });

    test('corrupt encrypted operational metadata fails safe and keeps no stale cache', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Operational = await import(moduleUrl);

            await Operational.initLocalOperationalMetadataStorage();
            Operational.setCloudSyncSlotToken(sentinels.syncSlotToken);
            await Operational.flushLocalOperationalMetadataWrites();

            const parsed = JSON.parse(localStorage.getItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY));
            parsed.ciphertext = `${parsed.ciphertext.slice(0, -4)}xxxx`;
            localStorage.setItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY, JSON.stringify(parsed));

            const initResult = await Operational.initLocalOperationalMetadataStorage();

            return {
                initResult,
                snapshot: Operational.getOperationalMetadataSnapshot(),
                raw: localStorage.getItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/localOperationalMetadataStorage.js'),
            sentinels: {
                syncSlotToken: SYNC_SLOT_SENTINEL
            }
        });

        expect(result.initResult.migratedLegacy).toBe(false);
        expect(result.snapshot.cloudSyncSlotToken).toBe('');
        expect(result.raw).toBeNull();
        expect(result.keys).toEqual([]);
    });

    test('clear removes encrypted operational metadata and resets sync cache', async ({ page }) => {
        const result = await page.evaluate(async ({ moduleUrl, sentinels }) => {
            const Operational = await import(moduleUrl);

            await Operational.initLocalOperationalMetadataStorage();
            Operational.setCloudSyncSlotToken(sentinels.syncSlotToken);
            await Operational.flushLocalOperationalMetadataWrites();
            Operational.clearLocalOperationalMetadataStorage();

            return {
                slotToken: Operational.getCloudSyncSlotToken(),
                raw: localStorage.getItem(Operational.LOCAL_OPERATIONAL_METADATA_KEY),
                keys: Object.keys(localStorage).sort()
            };
        }, {
            moduleUrl: modulePath('/js/localOperationalMetadataStorage.js'),
            sentinels: {
                syncSlotToken: SYNC_SLOT_SENTINEL
            }
        });

        expect(result.slotToken).toBe('');
        expect(result.raw).toBeNull();
        expect(result.keys).toEqual([]);
    });
});
