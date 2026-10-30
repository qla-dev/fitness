import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCAL_SYNC_CONFIG_ID,
  getActiveServerConfig,
  resolveSyncConfigId,
} from '../../src/services/storage';

test('health sync keeps its diary destination even with saved legacy server settings', async () => {
  await AsyncStorage.setItem('activeServerConfigId', 'legacy-server');
  await AsyncStorage.setItem(
    'serverConfigs',
    JSON.stringify([{ id: 'legacy-server', url: 'https://example.com' }])
  );
  await expect(getActiveServerConfig()).resolves.toBeNull();
  await expect(resolveSyncConfigId()).resolves.toBe(LOCAL_SYNC_CONFIG_ID);
});
