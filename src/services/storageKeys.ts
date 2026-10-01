import AsyncStorage from '@react-native-async-storage/async-storage';

/** Namespace for the app's own AsyncStorage keys. */
export const STORAGE_NAMESPACE = '@qla/';

// Pre-rebrand namespace: keys older installs wrote, read once to migrate them.
const LEGACY_STORAGE_NAMESPACE = '@SparkyFitness/';

/** The app-namespaced AsyncStorage key for `name`. */
export const storageKey = (name: string): string =>
  `${STORAGE_NAMESPACE}${name}`;

/**
 * The key an older install wrote for `key`, or null when `key` is not in the
 * app namespace (and so never had a pre-rebrand spelling).
 */
export const legacyStorageKey = (key: string): string | null =>
  key.startsWith(STORAGE_NAMESPACE)
    ? `${LEGACY_STORAGE_NAMESPACE}${key.slice(STORAGE_NAMESPACE.length)}`
    : null;

/**
 * Reads `key`, migrating the value an older install stored under the legacy
 * namespace on first read: when `key` is empty but its legacy spelling is not,
 * the value is copied to `key` and the legacy entry removed, so the move
 * happens once and the legacy key never shadows a later write.
 */
export async function getStorageItem(key: string): Promise<string | null> {
  const current = await AsyncStorage.getItem(key);
  if (current !== null) return current;

  const legacyKey = legacyStorageKey(key);
  if (!legacyKey) return null;
  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy === null) return null;

  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(legacyKey);
  return legacy;
}

/**
 * Removes `key` and its legacy spelling, so a value an older install left
 * behind cannot be migrated back in after the app has cleared it.
 */
export async function removeStorageItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  const legacyKey = legacyStorageKey(key);
  if (legacyKey) await AsyncStorage.removeItem(legacyKey);
}

/** AsyncStorage adapter for zustand `persist` that migrates legacy keys. */
export const migratingStorage = {
  getItem: getStorageItem,
  setItem: (name: string, value: string): Promise<void> =>
    AsyncStorage.setItem(name, value),
  removeItem: removeStorageItem,
};
