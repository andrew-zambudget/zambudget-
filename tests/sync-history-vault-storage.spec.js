const { test, expect } = require('@playwright/test');

const BLANK_FIXTURE = '/tests/fixtures/blank.html';

const SYNC_SENTINELS = Object.freeze({
    message: 'PHASE1_SYNC_HISTORY_MESSAGE_SENTINEL',
    time: '2026-06-21T18:30:00.000Z',
    rawMerchant: 'PHASE1_SYNC_HISTORY_RAW_MERCHANT',
    snapshotBefore: 'snap-before-sensitive',
    snapshotAfter: 'snap-after-sensitive'
});

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

test.describe('sync history encrypted metadata scaffold', () => {
    test.beforeEach(async ({ page }) => {
        await resetStorage(page);
    });

    test('encrypts sanitized sync history without exposing messages or event times', async ({ page }) => {
        const result = await page.evaluate(async ({ syncModulePath, sentinels }) => {
            const SyncHistoryVault = await import(syncModulePath);
            const events = [
                {
                    id: 'sync-sentinel-event',
                    time: sentinels.time,
                    status: 'synced',
                    message: sentinels.message,
                    details: {
                        kind: 'buddy_cloud_sync_summary',
                        privacySafe: true,
                        transactions: { added: 2, updated: 1, deleted: 0 },
                        snapshot: { before: sentinels.snapshotBefore, after: sentinels.snapshotAfter },
                        resultStatus: 'success'
                    }
                },
                {
                    id: 'legacy-unsafe-event',
                    time: '2026-06-21T18:31:00.000Z',
                    status: 'synced',
                    message: 'Budget synced.',
                    details: {
                        transaction: {
                            amount: 123.45,
                            description: sentinels.rawMerchant
                        }
                    }
                }
            ];

            const sanitized = await SyncHistoryVault.writeEncryptedSyncHistory(events, {
                userId: 'sync-history-phase1-user',
                createdAt: '2026-06-21T18:35:00.000Z',
                updatedAt: '2026-06-21T18:35:00.000Z'
            });
            const raw = localStorage.getItem(SyncHistoryVault.SYNC_HISTORY_STORAGE_KEY) || '';
            const restored = await SyncHistoryVault.readEncryptedSyncHistory({
                userId: 'sync-history-phase1-user'
            });

            return {
                raw,
                sanitized,
                restored,
                classification: SyncHistoryVault.classifySyncHistoryRecord(localStorage)
            };
        }, {
            syncModulePath: modulePath('/js/syncHistoryVaultStorage.js'),
            sentinels: SYNC_SENTINELS
        });

        expect(result.classification.kind).toBe('encrypted');
        expect(result.raw).toContain('zam_local_metadata_vault');
        expect(result.raw).toContain('sync_history');
        expect(result.raw).not.toContain(SYNC_SENTINELS.message);
        expect(result.raw).not.toContain(SYNC_SENTINELS.time);
        expect(result.raw).not.toContain(SYNC_SENTINELS.rawMerchant);
        expect(result.raw).not.toContain(SYNC_SENTINELS.snapshotBefore);
        expect(result.restored).toHaveLength(2);
        expect(result.restored[0]).toMatchObject({
            status: 'synced',
            message: SYNC_SENTINELS.message,
            details: {
                kind: 'buddy_cloud_sync_summary',
                privacySafe: true,
                transactions: { added: 2, updated: 1, deleted: 0 },
                snapshot: {
                    before: SYNC_SENTINELS.snapshotBefore,
                    after: SYNC_SENTINELS.snapshotAfter
                }
            }
        });
        expect(result.restored[1].details).toBeUndefined();
        expect(JSON.stringify(result.restored)).not.toContain(SYNC_SENTINELS.rawMerchant);
        expect(result.sanitized).toEqual(result.restored);
    });

    test('limits and sanitizes sync history before encryption', async ({ page }) => {
        const result = await page.evaluate(async ({ syncModulePath }) => {
            const SyncHistoryVault = await import(syncModulePath);
            const events = Array.from({ length: 8 }, (_, index) => ({
                id: `event-${index}`,
                time: index === 0 ? 'not-a-real-date' : `2026-06-21T18:3${index}:00.000Z`,
                status: index === 1 ? 'made-up-status' : 'local',
                message: `Saved locally ${index}`,
                details: {
                    kind: 'buddy_cloud_sync_summary',
                    privacySafe: index !== 2,
                    transactions: { added: index, updated: '2', deleted: -10 },
                    snapshot: { before: `before-${index}`, after: `after-${index}` },
                    resultStatus: 'success'
                }
            }));
            const sanitized = await SyncHistoryVault.writeEncryptedSyncHistory(events, {
                userId: 'sync-history-sanitize-user'
            });

            return {
                sanitized,
                restored: await SyncHistoryVault.readEncryptedSyncHistory({
                    userId: 'sync-history-sanitize-user'
                })
            };
        }, {
            syncModulePath: modulePath('/js/syncHistoryVaultStorage.js')
        });

        expect(result.sanitized).toHaveLength(5);
        expect(result.restored).toEqual(result.sanitized);
        expect(result.restored[0].status).toBe('local');
        expect(Number.isNaN(new Date(result.restored[0].time).getTime())).toBe(false);
        expect(result.restored[1].status).toBe('local');
        expect(result.restored[2].details).toBeUndefined();
    });

    test('corrupt encrypted sync history fails safe to an empty list', async ({ page }) => {
        const result = await page.evaluate(async ({ syncModulePath }) => {
            const SyncHistoryVault = await import(syncModulePath);
            await SyncHistoryVault.writeEncryptedSyncHistory([
                {
                    id: 'corrupt-source-event',
                    time: '2026-06-21T18:30:00.000Z',
                    status: 'synced',
                    message: 'Cloud Sync is up to date.'
                }
            ], { userId: 'sync-history-corrupt-user' });

            const raw = localStorage.getItem(SyncHistoryVault.SYNC_HISTORY_STORAGE_KEY) || '';
            const parsed = JSON.parse(raw);
            parsed.ciphertext = `${parsed.ciphertext.slice(0, -4)}xxxx`;
            localStorage.setItem(SyncHistoryVault.SYNC_HISTORY_STORAGE_KEY, JSON.stringify(parsed));

            const restored = await SyncHistoryVault.readEncryptedSyncHistory({
                userId: 'sync-history-corrupt-user'
            });
            const thrown = await SyncHistoryVault.readEncryptedSyncHistory({
                userId: 'sync-history-corrupt-user',
                throwOnError: true
            }).then(() => '').catch(error => error?.name || error?.message || 'error');

            return { restored, thrown };
        }, {
            syncModulePath: modulePath('/js/syncHistoryVaultStorage.js')
        });

        expect(result.restored).toEqual([]);
        expect(result.thrown).toBeTruthy();
    });

    test('encrypted sync history helper does not touch Cloud Sync or budget storage', async ({ page }) => {
        const result = await page.evaluate(async ({ syncModulePath }) => {
            const SyncHistoryVault = await import(syncModulePath);
            const calls = [];
            window.BuddyCloud = {
                queuePush: (...args) => calls.push(args)
            };
            localStorage.setItem('bb_data', JSON.stringify({
                transactions: [{ id: 'budget-should-not-change', description: 'Budget plaintext for boundary check' }],
                categories: [],
                settings: {}
            }));

            await SyncHistoryVault.writeEncryptedSyncHistory([
                {
                    id: 'no-cloud-touch-event',
                    time: '2026-06-21T18:30:00.000Z',
                    status: 'local',
                    message: 'Saved locally. Cloud Sync not active.'
                }
            ], { userId: 'sync-history-boundary-user' });

            return {
                calls,
                budget: localStorage.getItem('bb_data'),
                historyClassification: SyncHistoryVault.classifySyncHistoryRecord(localStorage)
            };
        }, {
            syncModulePath: modulePath('/js/syncHistoryVaultStorage.js')
        });

        expect(result.calls).toEqual([]);
        expect(result.budget).toContain('Budget plaintext for boundary check');
        expect(result.historyClassification.kind).toBe('encrypted');
    });
});
