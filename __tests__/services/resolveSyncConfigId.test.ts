/**
 * Regression: local mode has no server config on purpose — getActiveServerConfig
 * returns null before it reads anything — and every piece of sync bookkeeping
 * was keyed off that call. The backfill read it as "no server" and returned
 * before probing, so Sync History Now spun its button and imported nothing on
 * every local-first build, and the checkpoint it resumes from was never
 * reachable either.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { dataMode: 'local' } } },
}));

import {
  LOCAL_SYNC_CONFIG_ID,
  getActiveServerConfig,
  resolveSyncConfigId,
} from '../../src/services/storage';
import { isLocalDataMode } from '../../src/services/dataMode';

test('local mode has a sync config id although it has no server config', async () => {
  expect(isLocalDataMode()).toBe(true);
  await expect(getActiveServerConfig()).resolves.toBeNull();
  await expect(resolveSyncConfigId()).resolves.toBe(LOCAL_SYNC_CONFIG_ID);
});
