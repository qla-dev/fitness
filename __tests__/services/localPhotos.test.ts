import { localApiFetch } from '../../src/services/local/localApi';
import { resetLocalDatabaseCache } from '../../src/services/local/database';
import type {
  CheckInPhoto,
  CheckInPhotoWithWeight,
} from '../../src/types/checkInPhotos';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
const endpoint = '/api/measurements/check-in-photos';
const first = '12345678-1234-4234-8234-123456789abc';
const second = '12345678-1234-4234-8234-123456789abd';

it('persists, replaces and deletes a local progress angle and joins daily weight', async () => {
  await localApiFetch({
    endpoint: '/api/measurements/check-in',
    method: 'POST',
    body: { entry_date: '2026-09-26', weight: 75 },
  });
  await localApiFetch({
    endpoint,
    method: 'POST',
    body: { id: first, entry_date: '2026-09-26', photo_type: 'front' },
  });
  resetLocalDatabaseCache();
  expect(
    await localApiFetch<string[]>({ endpoint: endpoint + '/dates' })
  ).toEqual(['2026-09-26']);
  expect(await localApiFetch<CheckInPhotoWithWeight[]>({ endpoint })).toEqual([
    expect.objectContaining({ id: first, weight: 75 }),
  ]);
  await localApiFetch({
    endpoint,
    method: 'POST',
    body: { id: second, entry_date: '2026-09-26', photo_type: 'front' },
  });
  const photos = await localApiFetch<CheckInPhoto[]>({
    endpoint: endpoint + '/2026-09-26',
  });
  expect(photos).toHaveLength(1);
  expect(photos[0].id).toBe(second);
  await localApiFetch({
    endpoint: endpoint + '/photo/' + second,
    method: 'DELETE',
  });
  expect(await localApiFetch({ endpoint })).toEqual([]);
});

it('keeps added workout photos across reloads and isolates sessions', async () => {
  const photo = { fileName: 'aaaa.jpg', capturedAt: 0 };
  await localApiFetch({
    endpoint: '/api/workout-photos/individual:1',
    method: 'POST',
    body: photo,
  });
  resetLocalDatabaseCache();
  expect(
    await localApiFetch({ endpoint: '/api/workout-photos/individual:1' })
  ).toEqual([photo]);
  expect(
    await localApiFetch({ endpoint: '/api/workout-photos/individual:2' })
  ).toEqual([]);
});
