import { Platform } from 'react-native';
import {
  addWatchHeartRateListener,
  startWatchWorkout,
  isWatchLinkAvailable,
} from '../../../modules/watch-link';
import {
  getSensorSnapshot,
  startWatchHeartRate,
  stopWatchHeartRate,
  WatchWorkoutStartError,
} from '../../../src/services/recording/sensors';

jest.mock('../../../modules/watch-link', () => ({
  isWatchLinkAvailable: jest.fn(() => true),
  isWatchAppInstalled: jest.fn(() => true),
  isWatchPaired: jest.fn(() => true),
  getWatchName: jest.fn(() => 'Apple Watch Ultra'),
  addWatchReachabilityListener: jest.fn(),
  addWatchHeartRateListener: jest.fn(() => ({ remove: jest.fn() })),
  addWatchWorkoutStateListener: jest.fn(() => ({ remove: jest.fn() })),
  startWatchWorkout: jest.fn(),
  stopWatchWorkout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/LogService', () => ({ addLog: jest.fn() }));

beforeEach(async () => {
  Platform.OS = 'ios';
  await stopWatchHeartRate();
  jest.clearAllMocks();
  jest.mocked(isWatchLinkAvailable).mockReturnValue(true);
});

it('keeps all callers waiting until the native running acknowledgment', async () => {
  let confirm!: () => void;
  jest.mocked(startWatchWorkout).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      })
  );
  const completed = jest.fn();
  const first = startWatchHeartRate('run').then(completed);
  const second = startWatchHeartRate('run').then(completed);
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  expect(startWatchWorkout).toHaveBeenCalledTimes(1);
  confirm();
  await Promise.all([first, second]);
  expect(getSensorSnapshot().watchStreaming).toBe(true);
  await startWatchHeartRate('run');
  expect(startWatchWorkout).toHaveBeenCalledTimes(1);
});

it('rejects a failed launch, detaches listeners, and allows a fresh retry', async () => {
  jest.mocked(startWatchWorkout).mockRejectedValueOnce(new Error('Timed out'));
  await expect(startWatchHeartRate('ride')).rejects.toBeInstanceOf(
    WatchWorkoutStartError
  );
  expect(
    jest.mocked(addWatchHeartRateListener).mock.results[0].value.remove
  ).toHaveBeenCalled();
  expect(getSensorSnapshot().watchStreaming).toBe(false);
  jest.mocked(startWatchWorkout).mockResolvedValueOnce(undefined);
  await startWatchHeartRate('ride');
  expect(startWatchWorkout).toHaveBeenCalledTimes(2);
});

it('does not accept a late confirmation after cancellation', async () => {
  let confirm!: () => void;
  jest.mocked(startWatchWorkout).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      })
  );
  const pending = startWatchHeartRate('run');
  const rejected = expect(pending).rejects.toBeInstanceOf(
    WatchWorkoutStartError
  );
  await stopWatchHeartRate();
  confirm();
  await rejected;
  expect(getSensorSnapshot().watchStreaming).toBe(false);
});

it('requires the watch bridge on iOS instead of silently starting without it', async () => {
  jest.mocked(isWatchLinkAvailable).mockReturnValue(false);
  await expect(startWatchHeartRate('run')).rejects.toBeInstanceOf(
    WatchWorkoutStartError
  );
  expect(startWatchWorkout).not.toHaveBeenCalled();
});
