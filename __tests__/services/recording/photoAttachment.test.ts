import {
  attachRecordingPhoto,
  discardRecording,
  getRecordingSnapshot,
} from '../../../src/services/recording/recorder';
import {
  checkpointRecording,
  clearRecording,
} from '../../../src/services/recording/database';
import { deleteRecordingPhoto } from '../../../src/services/recording/photos';

jest.mock('../../../modules/watch-link', () => ({
  updateWatchMetrics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../../src/services/api/exerciseApi', () => ({}));
jest.mock('../../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../../src/services/recording/photos', () => ({
  deleteRecordingPhoto: jest.fn(),
}));
jest.mock('../../../src/services/recording/database', () => ({
  loadRecording: jest
    .fn()
    .mockResolvedValue({
      id: 'current',
      sport: 'run',
      phase: 'paused',
      watch: false,
    }),
  recordingSamples: jest.fn().mockResolvedValue([]),
  checkpointRecording: jest.fn().mockResolvedValue(undefined),
  clearRecording: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/recording/sensors', () => ({
  stopWatchHeartRate: jest.fn().mockResolvedValue(undefined),
}));

it('persists captures on their recording, rejects stale captures, and cleans up discarded photos', async () => {
  const photo = { fileName: 'abc-123.jpg', capturedAt: 100 };
  await expect(attachRecordingPhoto('old-session', photo)).rejects.toThrow(
    'Recording ended'
  );
  expect(checkpointRecording).not.toHaveBeenCalled();
  await attachRecordingPhoto('current', photo);
  expect(checkpointRecording).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'current', photos: [photo] })
  );
  expect(getRecordingSnapshot().session?.photos).toEqual([photo]);
  await discardRecording();
  expect(clearRecording).toHaveBeenCalledWith('current');
  expect(deleteRecordingPhoto).toHaveBeenCalledWith(photo);
  await expect(attachRecordingPhoto('current', photo)).rejects.toThrow(
    'Recording ended'
  );
});
