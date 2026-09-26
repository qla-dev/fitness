import { syncWatchPrograms } from '../../src/services/watchPrograms';
import { updateWatchPrograms } from '../../modules/watch-link';
import { fetchWorkoutPresetsPage } from '../../src/services/api/workoutPresetsApi';
import {
  programAccessScope,
  readProgramAccess,
} from '../../src/services/programAccess';

jest.mock('../../modules/watch-link', () => ({
  updateWatchPrograms: jest.fn(),
}));
jest.mock('../../src/services/api/workoutPresetsApi', () => ({
  fetchWorkoutPresetsPage: jest.fn(),
}));
jest.mock('../../src/services/programAccess', () => ({
  programAccessScope: jest.fn(),
  readProgramAccess: jest.fn(),
}));
jest.mock('../../src/hooks/queryClient', () => ({ queryClient: {} }));

beforeEach(() => {
  jest.resetAllMocks();
  (programAccessScope as jest.Mock).mockResolvedValue('local');
  (readProgramAccess as jest.Mock).mockResolvedValue(null);
});

it('syncs all pages and preserves exercise prescriptions without null property-list values', async () => {
  const exercise = {
    exercise_name: 'Squat',
    sets: [
      {
        reps: 8,
        weight: 20,
        duration: null,
        distance: null,
        rest_time: 90,
        notes: 'Day 1',
      },
    ],
  };
  (fetchWorkoutPresetsPage as jest.Mock)
    .mockResolvedValueOnce({
      presets: [{ id: 1, name: 'Week 1', exercises: [exercise] }],
      pagination: { hasMore: true },
    })
    .mockResolvedValueOnce({
      presets: [{ id: 2, name: 'Week 2', exercises: [] }],
      pagination: { hasMore: false },
    });
  (readProgramAccess as jest.Mock).mockResolvedValueOnce({
    expiresAt: '2026-12-01T00:00:00.000Z',
  });
  await syncWatchPrograms();
  expect(fetchWorkoutPresetsPage).toHaveBeenLastCalledWith({
    page: 2,
    pageSize: 50,
  });
  expect(updateWatchPrograms).toHaveBeenCalledWith({
    updatedAt: expect.any(Number),
    programs: [
      {
        id: 1,
        name: 'Week 1',
        expiresAt: '2026-12-01T00:00:00.000Z',
        exercises: [
          {
            name: 'Squat',
            sets: [{ reps: 8, weight: 20, rest: 90, notes: 'Day 1' }],
          },
        ],
      },
      { id: 2, name: 'Week 2', exercises: [] },
    ],
  });
});

it('sends an empty snapshot after the last program is deleted', async () => {
  (fetchWorkoutPresetsPage as jest.Mock).mockResolvedValue({
    presets: [],
    pagination: { hasMore: false },
  });
  await syncWatchPrograms();
  expect(updateWatchPrograms).toHaveBeenCalledWith({
    updatedAt: expect.any(Number),
    programs: [],
  });
});

it('does not replace the watch library with an incomplete read', async () => {
  (fetchWorkoutPresetsPage as jest.Mock).mockRejectedValue(
    new Error('Read failed')
  );
  await expect(syncWatchPrograms()).rejects.toThrow('Read failed');
  expect(updateWatchPrograms).not.toHaveBeenCalled();
});

it('discards a snapshot if the active storage scope changed during the read', async () => {
  (programAccessScope as jest.Mock)
    .mockResolvedValueOnce('old')
    .mockResolvedValue('new');
  (fetchWorkoutPresetsPage as jest.Mock).mockResolvedValue({
    presets: [],
    pagination: { hasMore: false },
  });
  await syncWatchPrograms();
  expect(updateWatchPrograms).not.toHaveBeenCalled();
});
