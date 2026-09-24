import type { TFunction } from 'i18next';
import {
  startRecording,
  getRecordingSnapshot,
} from '../../../src/services/recording/recorder';
import { startWatchHeartRate } from '../../../src/services/recording/sensors';
import { checkpointRecording } from '../../../src/services/recording/database';

jest.mock('../../../modules/watch-link', () => ({
  updateWatchMetrics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('../../../src/services/api/exerciseApi', () => ({}));
jest.mock('../../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../../src/services/recording/database', () => ({
  loadRecording: jest.fn().mockResolvedValue(null),
  checkpointRecording: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/recording/sensors', () => ({
  startWatchHeartRate: jest.fn(),
}));

it('does not persist a phone session while the watch is pending or when it fails', async () => {
  let fail!: (error: Error) => void;
  jest.mocked(startWatchHeartRate).mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      })
  );
  const pending = startRecording(
    'run',
    75,
    ((key: string) => key) as TFunction,
    undefined,
    'running',
    false,
    true
  );
  const rejected = expect(pending).rejects.toThrow('Watch unavailable');
  // Allow hydration and the serialized start to reach the watch gate.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(startWatchHeartRate).toHaveBeenCalled();
  expect(checkpointRecording).not.toHaveBeenCalled();
  expect(getRecordingSnapshot().session).toBeNull();
  fail(new Error('Watch unavailable'));
  await rejected;
  expect(checkpointRecording).not.toHaveBeenCalled();
  expect(getRecordingSnapshot().session).toBeNull();
});
