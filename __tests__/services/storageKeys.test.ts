import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getStorageItem,
  legacyStorageKey,
  removeStorageItem,
  storageKey,
} from '../../src/services/storageKeys';

describe('storageKeys', () => {
  const KEY = storageKey('recent-searches');

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('maps an app key to the spelling older installs wrote', () => {
    // Pinned on purpose: a change here would strand every existing install's data.
    expect(legacyStorageKey(KEY)).toBe('@SparkyFitness/recent-searches');
    expect(legacyStorageKey('@HealthConnect:soundsEnabled')).toBeNull();
  });

  it('migrates a legacy value on first read and removes the legacy key', async () => {
    const legacyKey = legacyStorageKey(KEY)!;
    await AsyncStorage.setItem(legacyKey, '["apple"]');

    expect(await getStorageItem(KEY)).toBe('["apple"]');
    expect(await AsyncStorage.getItem(KEY)).toBe('["apple"]');
    expect(await AsyncStorage.getItem(legacyKey)).toBeNull();
  });

  it('prefers the new key and leaves an absent value absent', async () => {
    const legacyKey = legacyStorageKey(KEY)!;
    await AsyncStorage.setItem(KEY, 'new');
    await AsyncStorage.setItem(legacyKey, 'old');

    expect(await getStorageItem(KEY)).toBe('new');
    expect(await getStorageItem(storageKey('missing'))).toBeNull();
  });

  it('removes both spellings so a cleared value is not migrated back', async () => {
    const legacyKey = legacyStorageKey(KEY)!;
    await AsyncStorage.setItem(KEY, 'new');
    await AsyncStorage.setItem(legacyKey, 'old');

    await removeStorageItem(KEY);

    expect(await getStorageItem(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(legacyKey)).toBeNull();
  });
});
