import {
  uploadPhoto,
  fetchPhotosByDate,
  deletePhoto,
} from '../../src/services/api/checkInPhotosApi';
import {
  copyProgressPhoto,
  removeProgressPhoto,
} from '../../src/services/local/progressPhotoFiles';
import { getActiveServerConfig } from '../../src/services/storage';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../src/services/local/progressPhotoFiles', () => ({
  copyProgressPhoto: jest.fn(),
  removeProgressPhoto: jest.fn(),
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));

it('saves and replaces a picked progress image without consulting a server', async () => {
  const input = {
    date: '2026-09-26',
    type: 'front' as const,
    uri: 'file:///picked.jpg',
  };
  const first = await uploadPhoto(input);
  expect(copyProgressPhoto).toHaveBeenCalledWith(input.uri, first.id);
  const second = await uploadPhoto(input);
  expect(second.id).not.toBe(first.id);
  expect(removeProgressPhoto).toHaveBeenCalledWith(first.id);
  expect(await fetchPhotosByDate(input.date)).toHaveLength(1);
  await deletePhoto(second.id);
  expect(removeProgressPhoto).toHaveBeenCalledWith(second.id);
  expect(await fetchPhotosByDate(input.date)).toEqual([]);
  expect(getActiveServerConfig).not.toHaveBeenCalled();
});
