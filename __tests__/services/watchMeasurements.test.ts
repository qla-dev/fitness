import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { resetLocalDatabaseCache } from '../../src/services/local/database';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
});

const entry = {
  entryId: '12345678-1234-1234-1234-123456789abc',
  kind: 'water',
  value: 250,
  date: '2026-09-25',
};
const save = (body: object) =>
  localApiFetch({ endpoint: '/api/measurements/watch', method: 'POST', body });

it('adds water once when a reply is lost and the same entry is retried after restart', async () => {
  await save(entry);
  resetLocalDatabaseCache();
  await save(entry);
  await expect(
    localApiFetch({ endpoint: '/api/measurements/water-intake/2026-09-25' })
  ).resolves.toMatchObject({ water_ml: 250 });
  await save({ ...entry, entryId: '22345678-1234-1234-1234-123456789abc' });
  await expect(
    localApiFetch({ endpoint: '/api/measurements/water-intake/2026-09-25' })
  ).resolves.toMatchObject({ water_ml: 500 });
});

it('updates only weight and preserves other check-in fields', async () => {
  await localApiFetch({
    endpoint: '/api/measurements/check-in',
    method: 'POST',
    body: { entry_date: entry.date, height: 180, steps: 9000 },
  });
  await save({ ...entry, kind: 'weight', value: 72.5 });
  await expect(
    localApiFetch({
      endpoint: `/api/measurements/check-in-measurements-range/${entry.date}/${entry.date}`,
    })
  ).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ weight: 72.5, height: 180, steps: 9000 }),
    ])
  );
});

it('does not leave a receipt or increment behind if storage fails', async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(save(entry)).rejects.toThrow('Disk full');
  await save(entry);
  await expect(
    localApiFetch({ endpoint: '/api/measurements/water-intake/2026-09-25' })
  ).resolves.toMatchObject({ water_ml: 250 });
});

it.each([
  { value: -1 },
  { value: NaN },
  { kind: 'other' },
  { kind: 'weight', value: 301 },
  { value: 2001 },
  { date: 'bad-date' },
])('rejects invalid measurements: %p', async (patch) => {
  await expect(save({ ...entry, ...patch })).rejects.toThrow(
    'Invalid watch measurement'
  );
});

it('rejects changing a saved entry under the same identity', async () => {
  await save(entry);
  await expect(save({ ...entry, value: 500 })).rejects.toThrow(
    'identity reused'
  );
});
