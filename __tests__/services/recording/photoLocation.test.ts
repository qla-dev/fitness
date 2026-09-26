import * as Location from 'expo-location';
import { capturePhotoLocation } from '../../../src/services/recording/photoLocation';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
});

it('records a fresh position at capture time', async () => {
  const timestamp = Date.now();
  jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue({ coords: { latitude: 43.8, longitude: 18.4 }, timestamp } as never);
  expect(await capturePhotoLocation()).toEqual({ latitude: 43.8, longitude: 18.4, timestamp });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('requests a fix when no recent cached position exists', async () => {
  const timestamp = Date.now();
  jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 43, longitude: 18 }, timestamp } as never);
  expect(await capturePhotoLocation()).toEqual({ latitude: 43, longitude: 18, timestamp });
});

it('does not invent a location or request permission when GPS access is denied', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: false } as never);
  expect(await capturePhotoLocation()).toBeUndefined();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('lets capture finish when the location provider stalls', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(Location.getLastKnownPositionAsync).mockImplementation(() => new Promise(() => {}));
    const capture = capturePhotoLocation();
    await jest.advanceTimersByTimeAsync(4000);
    expect(await capture).toBeUndefined();
  } finally {
    jest.useRealTimers();
  }
});
