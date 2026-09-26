import { Platform } from 'react-native';
import { saveRecording } from '../../../src/services/recording/recorder';
import { loadRecording } from '../../../src/services/recording/database';
import { createExerciseEntry } from '../../../src/services/api/exerciseApi';

jest.mock('../../../modules/watch-link', () => ({
  updateWatchMetrics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  getRegisteredTasksAsync: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../src/services/recording/sensors', () => ({}));
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../../src/services/api/exerciseApi', () => ({
  createExerciseEntry: jest.fn().mockResolvedValue({ id: 'saved' }),
}));
jest.mock('../../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../../src/services/recording/database', () => ({
  loadRecording: jest.fn(),
  recordingSamples: jest.fn().mockResolvedValue([]),
  checkpointRecording: jest.fn().mockResolvedValue(undefined),
  clearRecording: jest.fn().mockResolvedValue(undefined),
}));

it('saves the provider overlap marker for a watch-backed recording', async () => {
  const watch = true;
  const os = Platform.OS;
  Platform.OS = 'ios';
  jest.mocked(loadRecording).mockResolvedValue({
    id: 'recording',
    scope: 'local',
    sport: 'run',
    phase: 'finished',
    exerciseId: 'run',
    watch,
    elapsed: 1860,
    distance: 4000,
    startedAt: 1,
    updatedAt: 1860001,
    entryDate: '2026-09-26',
    weightKg: 75,
  } as never);
  try {
    await saveRecording();
    const payload = jest.mocked(createExerciseEntry).mock.calls.at(-1)![0];
    expect(payload.activity_details?.[0].detail_data).toEqual(
      expect.objectContaining({
        recordingId: 'recording',
        ...(watch ? { healthSource: 'HealthKit' } : {}),
      })
    );
    if (!watch)
      expect(payload.activity_details?.[0].detail_data).not.toHaveProperty(
        'healthSource'
      );
  } finally {
    Platform.OS = os;
  }
});
