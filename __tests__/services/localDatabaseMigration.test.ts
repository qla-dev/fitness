import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCAL_DATABASE_KEY,
  localTransaction,
  resetLocalDatabaseCache,
  saveRecord,
  table,
  warmLocalDatabase,
} from '../../src/services/local/database';
import * as localStore from '../../src/services/local/localStore';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const legacyDatabase = (revision: number, foods: string[]) => ({
  schemaVersion: 1,
  deviceId: 'device',
  userId: 'user',
  revision,
  nextId: 1,
  tables: {
    foods: foods.map((name, index) => ({ id: `f${index}`, name })),
    water: [{ id: 'w1', water_ml: 250 }],
  },
  changes: [],
});

const foodNames = () =>
  localTransaction((db) => table(db, 'foods').map((row) => row.name));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
  jest.restoreAllMocks();
});

it('moves an AsyncStorage database into SQLite and then deletes the old copy', async () => {
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(3, ['Oats', 'Rice']))
  );

  await warmLocalDatabase();

  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBeNull();
  const { stored } = (await localStore.readStoredDatabase())!;
  expect(stored.meta.revision).toBe(3);
  expect(stored.tables.foods).toEqual([
    { id: 'f0', name: 'Oats' },
    { id: 'f1', name: 'Rice' },
  ]);
  // Served from SQLite after a fresh load, with nothing lost.
  resetLocalDatabaseCache();
  expect(await foodNames()).toEqual(['Oats', 'Rice']);
});

it('keeps the AsyncStorage copy when the transfer fails, and retries next launch', async () => {
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(3, ['Oats']))
  );
  jest
    .spyOn(localStore, 'writeStoredDatabase')
    .mockRejectedValueOnce(new Error('disk full'));

  // The data is still there for this session.
  expect(await foodNames()).toEqual(['Oats']);
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).not.toBeNull();

  // Edits made meanwhile go to AsyncStorage, and then move over too.
  await localTransaction((db) => saveRecord(db, 'foods', { name: 'Rice' }), {
    method: 'POST',
    endpoint: '/api/foods',
  });
  resetLocalDatabaseCache();
  expect(await foodNames()).toEqual(['Oats', 'Rice']);
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBeNull();
});

it('prefers an AsyncStorage copy newer than SQLite, as after a fallback session', async () => {
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(2, ['Oats']))
  );
  await warmLocalDatabase();
  // A later session could not open SQLite and wrote revision 5 here instead.
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(5, ['Oats', 'Rice', 'Eggs']))
  );

  resetLocalDatabaseCache();
  expect(await foodNames()).toEqual(['Oats', 'Rice', 'Eggs']);
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBeNull();
  expect((await localStore.readStoredDatabase())!.stored.meta.revision).toBe(5);
});

it('drops an older leftover AsyncStorage copy and keeps SQLite', async () => {
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(4, ['Oats', 'Rice']))
  );
  await warmLocalDatabase();
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(1, ['Stale']))
  );

  resetLocalDatabaseCache();
  expect(await foodNames()).toEqual(['Oats', 'Rice']);
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBeNull();
});

it('does not let a damaged leftover lock out a good SQLite copy', async () => {
  await AsyncStorage.setItem(
    LOCAL_DATABASE_KEY,
    JSON.stringify(legacyDatabase(2, ['Oats']))
  );
  await warmLocalDatabase();
  await AsyncStorage.setItem(LOCAL_DATABASE_KEY, '{broken');

  resetLocalDatabaseCache();
  expect(await foodNames()).toEqual(['Oats']);
  // Left untouched rather than deleted.
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBe('{broken');
});

it('writes only the tables that changed and removes deleted ones', async () => {
  const first = await localStore.writeStoredDatabase(
    { meta: { revision: 1 }, tables: { foods: [{ id: 'a' }], water: [] } },
    new Map()
  );
  const second = await localStore.writeStoredDatabase(
    { meta: { revision: 2 }, tables: { foods: [{ id: 'a' }, { id: 'b' }] } },
    first
  );
  const { stored } = (await localStore.readStoredDatabase())!;
  expect(stored.tables).toEqual({ foods: [{ id: 'a' }, { id: 'b' }] });
  expect([...second.keys()]).toEqual(['foods']);
  expect(stored.meta.revision).toBe(2);
});
