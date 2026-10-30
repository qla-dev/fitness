import {
  createExercise,
  updateExercise,
  fetchSuggestedExercises,
  searchExercises,
  fetchExercisesPage,
  fetchExerciseHistory,
  transformExerciseRow,
} from '../../../src/services/api/exerciseApi';
import { apiFetch } from '../../../src/services/api/apiClient';
import {
  calculateCaloriesBurned,
  calculateActiveCalories,
  calculateOtherExerciseCalories,
  calculateExerciseDuration,
} from '../../../src/utils/workoutSession';
import type { ExerciseSessionResponse } from '@workspace/shared';

jest.mock('../../../src/services/api/apiClient', () => ({
  apiFetch: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

/** Helper to build an individual session with sensible defaults */
function individual(
  overrides: Partial<ExerciseSessionResponse & { type: 'individual' }> = {}
): ExerciseSessionResponse {
  return {
    type: 'individual',
    id: 'i-1',
    exercise_id: 'ex-1',
    entry_date: '2024-06-15',
    duration_minutes: 30,
    calories_burned: 0,
    notes: null,
    distance: null,
    avg_heart_rate: null,
    source: null,
    sets: [],
    exercise_snapshot: null,
    activity_details: [],
    ...overrides,
  };
}

/** Helper to build a preset session with sensible defaults */
function preset(
  overrides: Partial<ExerciseSessionResponse & { type: 'preset' }> = {}
): ExerciseSessionResponse {
  return {
    type: 'preset',
    id: 'p-1',
    entry_date: '2024-06-15',
    workout_preset_id: null,
    name: 'Test Workout',
    description: null,
    notes: null,
    source: 'manual',
    total_duration_minutes: 45,
    exercises: [],
    activity_details: [],
    ...overrides,
  } as ExerciseSessionResponse;
}

describe('exerciseApi', () => {
  describe('transformExerciseRow', () => {
    const baseRow = { id: 'ex-1', name: 'Plank', category: 'isometric' };

    it('passes a valid modality through', () => {
      expect(
        transformExerciseRow({ ...baseRow, modality: 'duration' }).modality
      ).toBe('duration');
    });

    it('maps an absent modality (pre-modality server) to null', () => {
      expect(transformExerciseRow(baseRow).modality).toBeNull();
    });

    it('sanitizes a garbage modality value to null', () => {
      expect(
        transformExerciseRow({ ...baseRow, modality: 'cardio!!' }).modality
      ).toBeNull();
      expect(
        transformExerciseRow({ ...baseRow, modality: 42 }).modality
      ).toBeNull();
    });
  });

  describe('calculateCaloriesBurned', () => {
    test('returns 0 for empty array', () => {
      expect(calculateCaloriesBurned([])).toBe(0);
    });

    test('sums calories_burned from individual entries', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 200 }),
        individual({ id: '2', calories_burned: 350 }),
      ];
      expect(calculateCaloriesBurned(entries)).toBe(550);
    });

    test('handles entries with undefined calories_burned as 0', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 200 }),
        individual({ id: '2', calories_burned: 0 }),
      ];
      expect(calculateCaloriesBurned(entries)).toBe(200);
    });

    test('handles single entry', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 150 }),
      ];
      expect(calculateCaloriesBurned(entries)).toBe(150);
    });

    test('sums nested exercise calories for program sessions', () => {
      const entries: ExerciseSessionResponse[] = [
        preset({
          exercises: [
            {
              id: 'e1',
              exercise_id: 'ex-1',
              duration_minutes: 10,
              calories_burned: 100,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
            {
              id: 'e2',
              exercise_id: 'ex-2',
              duration_minutes: 15,
              calories_burned: 200,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
          ],
        }),
      ];
      expect(calculateCaloriesBurned(entries)).toBe(300);
    });

    test('sums both individual and program entries', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 100 }),
        preset({
          exercises: [
            {
              id: 'e1',
              exercise_id: 'ex-1',
              duration_minutes: 10,
              calories_burned: 150,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
          ],
        }),
      ];
      expect(calculateCaloriesBurned(entries)).toBe(250);
    });
  });

  describe('calculateActiveCalories', () => {
    test('returns 0 for empty array', () => {
      expect(calculateActiveCalories([])).toBe(0);
    });

    test('returns 0 when no Active Calories exercises exist', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          calories_burned: 200,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        individual({
          id: '2',
          calories_burned: 150,
          exercise_snapshot: { id: 'e2', name: 'Cycling', category: 'Cardio' },
        }),
      ];
      expect(calculateActiveCalories(entries)).toBe(0);
    });

    test('sums only Active Calories exercises', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          calories_burned: 200,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        individual({
          id: '2',
          calories_burned: 450,
          exercise_snapshot: {
            id: 'e2',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
        individual({
          id: '3',
          calories_burned: 100,
          exercise_snapshot: {
            id: 'e3',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
      ];
      expect(calculateActiveCalories(entries)).toBe(550);
    });

    test('handles entries without exercise_snapshot', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 200 }),
        individual({
          id: '2',
          calories_burned: 300,
          exercise_snapshot: {
            id: 'e2',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
      ];
      expect(calculateActiveCalories(entries)).toBe(300);
    });

    test('returns 0 for program sessions', () => {
      const entries: ExerciseSessionResponse[] = [
        preset({
          exercises: [
            {
              id: 'e1',
              exercise_id: 'ex-1',
              duration_minutes: 10,
              calories_burned: 500,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
          ],
        }),
      ];
      expect(calculateActiveCalories(entries)).toBe(0);
    });
  });

  describe('calculateOtherExerciseCalories', () => {
    test('returns 0 for empty array', () => {
      expect(calculateOtherExerciseCalories([])).toBe(0);
    });

    test('returns all calories when no Active Calories exercises exist', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          calories_burned: 200,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        individual({
          id: '2',
          calories_burned: 150,
          exercise_snapshot: { id: 'e2', name: 'Cycling', category: 'Cardio' },
        }),
      ];
      expect(calculateOtherExerciseCalories(entries)).toBe(350);
    });

    test('excludes Active Calories exercises', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          calories_burned: 200,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        individual({
          id: '2',
          calories_burned: 450,
          exercise_snapshot: {
            id: 'e2',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
        individual({
          id: '3',
          calories_burned: 150,
          exercise_snapshot: { id: 'e3', name: 'Cycling', category: 'Cardio' },
        }),
      ];
      expect(calculateOtherExerciseCalories(entries)).toBe(350);
    });

    test('includes entries without exercise_snapshot', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({ id: '1', calories_burned: 200 }),
        individual({
          id: '2',
          calories_burned: 300,
          exercise_snapshot: {
            id: 'e2',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
      ];
      expect(calculateOtherExerciseCalories(entries)).toBe(200);
    });

    test('sums all nested exercise calories for program sessions', () => {
      const entries: ExerciseSessionResponse[] = [
        preset({
          exercises: [
            {
              id: 'e1',
              exercise_id: 'ex-1',
              duration_minutes: 10,
              calories_burned: 100,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
            {
              id: 'e2',
              exercise_id: 'ex-2',
              duration_minutes: 15,
              calories_burned: 200,
              entry_date: null,
              notes: null,
              distance: null,
              avg_heart_rate: null,
              source: null,
              sets: [],
              exercise_snapshot: null,
              activity_details: [],
            },
          ],
        }),
      ];
      expect(calculateOtherExerciseCalories(entries)).toBe(300);
    });
  });

  describe('calculateExerciseDuration', () => {
    test('returns 0 for empty array', () => {
      expect(calculateExerciseDuration([])).toBe(0);
    });

    test('sums duration from individual entries, excluding Active Calories', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          duration_minutes: 30,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        individual({
          id: '2',
          duration_minutes: 45,
          exercise_snapshot: {
            id: 'e2',
            name: 'Active Calories',
            category: 'Tracking',
          },
        }),
        individual({
          id: '3',
          duration_minutes: 20,
          exercise_snapshot: { id: 'e3', name: 'Cycling', category: 'Cardio' },
        }),
      ];
      expect(calculateExerciseDuration(entries)).toBe(50);
    });

    test('uses total_duration_minutes for program sessions', () => {
      const entries: ExerciseSessionResponse[] = [
        preset({ total_duration_minutes: 60 }),
      ];
      expect(calculateExerciseDuration(entries)).toBe(60);
    });

    test('sums both individual and program durations', () => {
      const entries: ExerciseSessionResponse[] = [
        individual({
          id: '1',
          duration_minutes: 30,
          exercise_snapshot: { id: 'e1', name: 'Running', category: 'Cardio' },
        }),
        preset({ total_duration_minutes: 45 }),
      ];
      expect(calculateExerciseDuration(entries)).toBe(75);
    });
  });
});

describe('device exercise API', () => {
  test('creates and updates custom exercises using diary records', async () => {
    jest.mocked(apiFetch).mockResolvedValue({
      id: 'ex-1',
      name: 'Custom run',
      is_custom: true,
      images: '[]',
    });
    expect(
      await createExercise({
        name: 'Custom run',
        category: 'Cardio',
        description: null,
      })
    ).toMatchObject({ id: 'ex-1', name: 'Custom run', isCustom: true });
    await updateExercise('ex-1', { name: 'Updated run' });
    expect(apiFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        endpoint: '/api/exercises/ex-1',
        method: 'PUT',
        body: { name: 'Updated run' },
      })
    );
  });

  test('does not swallow failed exercise saves', async () => {
    jest.mocked(apiFetch).mockRejectedValue(new Error('Storage full'));
    await expect(
      updateExercise('ex-1', { name: 'Updated run' })
    ).rejects.toThrow('Storage full');
  });

  test('keeps exercise filters and pagination when reading history', async () => {
    jest.mocked(apiFetch).mockResolvedValue({ sessions: [], total: 0 });
    await fetchExerciseHistory(2, 5, 'ex-1');
    expect(apiFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint:
          '/api/v2/exercise-entries/history?page=2&pageSize=5&exerciseId=ex-1',
      })
    );
  });
  it('runs every row through the transformer (surfaces userId/isCustom)', async () => {
    const responseData = {
      recentExercises: [
        {
          id: 'ex-1',
          name: 'Running',
          user_id: 'user-1',
          is_custom: true,
          equipment: '[]',
          primary_muscles: '[]',
          secondary_muscles: '[]',
          instructions: '[]',
        },
      ],
      topExercises: [
        {
          id: 'ex-2',
          name: 'Bench Press',
          user_id: null,
          is_custom: false,
          equipment: '["barbell"]',
          primary_muscles: '[]',
          secondary_muscles: '[]',
          instructions: '[]',
        },
      ],
    };
    jest.mocked(apiFetch).mockResolvedValue(responseData);

    const result = await fetchSuggestedExercises();

    expect(result.recentExercises[0]).toMatchObject({
      id: 'ex-1',
      name: 'Running',
      userId: 'user-1',
      isCustom: true,
    });
    expect(result.topExercises[0]).toMatchObject({
      id: 'ex-2',
      userId: null,
      isCustom: false,
      equipment: ['barbell'],
    });
  });
  it('runs each result through the transformer', async () => {
    const responseData = [
      {
        id: 'ex-1',
        name: 'Bench Press',
        user_id: 'user-1',
        is_custom: true,
        equipment: '["barbell","bench"]',
        primary_muscles: '[]',
        secondary_muscles: '[]',
        instructions: '[]',
      },
    ];
    jest.mocked(apiFetch).mockResolvedValue(responseData);

    const result = await searchExercises('bench');
    expect(result[0]).toMatchObject({
      id: 'ex-1',
      name: 'Bench Press',
      userId: 'user-1',
      isCustom: true,
      equipment: ['barbell', 'bench'],
    });
  });
  it('runs each exercise through the transformer and preserves pagination', async () => {
    const responseData = {
      exercises: [
        {
          id: 'ex-1',
          name: 'Squat',
          user_id: 'user-2',
          is_custom: false,
          equipment: '[]',
          primary_muscles: '["quadriceps"]',
          secondary_muscles: '[]',
          instructions: '[]',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
    };
    jest.mocked(apiFetch).mockResolvedValue(responseData);

    const result = await fetchExercisesPage({ page: 1, pageSize: 20 });

    expect(result.pagination).toEqual(responseData.pagination);
    expect(result.exercises[0]).toMatchObject({
      id: 'ex-1',
      userId: 'user-2',
      isCustom: false,
      primary_muscles: ['quadriceps'],
    });
  });
  it('normalizes nested JSON array strings from exercise endpoints', async () => {
    const responseData = {
      exercises: [
        {
          id: 'ex-1',
          name: 'Custom Movement',
          equipment: ['["barbell","bench"]'],
          primary_muscles: '"[\\"chest\\"]"',
          secondary_muscles: '[]',
          instructions: ['[]'],
          images: ['[]'],
        },
      ],
      pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
    };
    jest.mocked(apiFetch).mockResolvedValue(responseData);

    const result = await fetchExercisesPage({ page: 1, pageSize: 20 });

    expect(result.exercises[0]).toMatchObject({
      equipment: ['barbell', 'bench'],
      primary_muscles: ['chest'],
      secondary_muscles: [],
      instructions: [],
      images: [],
    });
  });
});
