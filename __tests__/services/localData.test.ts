import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import {
  LOCAL_DATABASE_KEY,
  type LocalRecord,
} from '../../src/services/local/database';
import {
  exerciseSessionResponseSchema,
  workoutPresetResponseSchema,
} from '@workspace/shared';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = LocalRecord>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });
const date = '2026-09-06';
const foodPayload = {
  name: 'Oats',
  brand: null,
  serving_size: 100,
  serving_unit: 'g',
  calories: 380,
  protein: 13,
  carbs: 68,
  fat: 7,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('persists food and diary snapshots across module reload, edits and deletes', async () => {
  const mealTypes = await request<LocalRecord[]>('/api/meal-types');
  const food = await request('/api/foods', 'POST', foodPayload);
  const variant = food.default_variant as LocalRecord;
  const entry = await request('/api/food-entries/', 'POST', {
    food_id: food.id,
    variant_id: variant.id,
    meal_type_id: mealTypes[0].id,
    quantity: 50,
    unit: 'g',
    entry_date: date,
  });
  await request(`/api/foods/food-variants/${variant.id}`, 'PUT', {
    ...foodPayload,
    food_id: food.id,
    calories: 400,
  });
  const summary = await request('/api/daily-summary?date=' + date);
  expect((summary.foodEntries as LocalRecord[])[0]).toMatchObject({
    id: entry.id,
    calories: 380,
    quantity: 50,
    serving_size: 100,
  });
  // Reload the adapter: no module cache is allowed to be the source of truth.
  let reloaded!: typeof localApiFetch;
  jest.isolateModules(() => {
    reloaded = require('../../src/services/local/localApi').localApiFetch;
  });
  expect(
    await reloaded({ endpoint: `/api/food-entries/${entry.id}` })
  ).toMatchObject({ calories: 380 });
  await request(`/api/food-entries/${entry.id}`, 'PUT', { quantity: 75 });
  expect(await request(`/api/food-entries/${entry.id}`)).toMatchObject({
    quantity: 75,
    calories: 380,
  });
  await request(`/api/food-entries/${entry.id}`, 'DELETE');
  expect(
    (await request('/api/daily-summary?date=' + date)).foodEntries
  ).toEqual([]);
  const db = JSON.parse((await AsyncStorage.getItem(LOCAL_DATABASE_KEY))!);
  expect(db.schemaVersion).toBe(1);
  expect(db.changes.at(-1)).toMatchObject({
    method: 'DELETE',
    endpoint: `/api/food-entries/${entry.id}`,
  });
});

test('concurrent hydration writes are not lost and measurement nulls are preserved', async () => {
  await Promise.all(
    Array.from({ length: 12 }, () =>
      request('/api/measurements/water-intake', 'POST', {
        entry_date: date,
        container_id: 1,
        change_drinks: 1,
      })
    )
  );
  expect(await request(`/api/measurements/water-intake/${date}`)).toMatchObject(
    { water_ml: 3000 }
  );
  await request('/api/measurements/check-in', 'POST', {
    entry_date: date,
    weight: 80,
    waist: 90,
  });
  await request('/api/measurements/check-in', 'POST', {
    entry_date: date,
    weight: undefined,
    waist: null,
  });
  expect(
    await request(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    )
  ).toEqual([expect.objectContaining({ weight: 80, waist: null })]);
});

test('workouts and presets match shared backend schemas and preserve set IDs', async () => {
  const exercise = await request('/api/exercises', 'POST', {
    name: 'Squat',
    category: 'strength',
  });
  const exercises = [
    {
      exercise_id: exercise.id,
      duration_minutes: 10,
      sets: [{ set_number: 1, reps: 8, weight: 40 }],
    },
  ];
  const preset = await request('/api/workout-presets', 'POST', {
    name: 'Legs',
    exercises,
  });
  expect(workoutPresetResponseSchema.safeParse(preset).success).toBe(true);
  const workout = await request('/api/exercise-preset-entries', 'POST', {
    name: 'Legs',
    entry_date: date,
    exercises,
  });
  expect(exerciseSessionResponseSchema.safeParse(workout).success).toBe(true);
  const originalExercise = (workout.exercises as LocalRecord[])[0];
  const updated = await request(
    `/api/exercise-preset-entries/${workout.id}`,
    'PUT',
    {
      exercises: [
        {
          ...originalExercise,
          sets: (originalExercise.sets as LocalRecord[]).map((set) => ({
            ...set,
            completed_at: '2026-09-06T12:00:00.000Z',
          })),
        },
      ],
    }
  );
  expect((updated.exercises as LocalRecord[])[0].id).toBe(originalExercise.id);
  expect(
    ((updated.exercises as LocalRecord[])[0].sets as LocalRecord[])[0].id
  ).toBe((originalExercise.sets as LocalRecord[])[0].id);
  const activity = await request('/api/exercise-entries', 'POST', {
    exercise_id: exercise.id,
    entry_date: date,
    duration_minutes: 15,
    calories_burned: 80,
  });
  expect(
    (await request('/api/daily-summary?date=' + date)).exerciseSessions
  ).toHaveLength(2);
  await request(`/api/exercise-entries/${activity.id}`, 'DELETE');
  await request(`/api/exercise-preset-entries/${workout.id}`, 'DELETE');
  expect(
    (await request('/api/daily-summary?date=' + date)).exerciseSessions
  ).toEqual([]);
});

test('a failed disk write does not report success or poison subsequent saves', async () => {
  await request('/api/meal-types');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(request('/api/foods', 'POST', foodPayload)).rejects.toThrow(
    'disk full'
  );
  expect((await request('/api/foods/foods-paginated')).totalCount).toBe(0);
  await request('/api/foods', 'POST', foodPayload);
  expect((await request('/api/foods/foods-paginated')).totalCount).toBe(1);
});

test('unsupported mutations and damaged databases never silently reset data', async () => {
  await expect(request('/api/unknown', 'POST', {})).rejects.toThrow(
    'Local data does not support'
  );
  await AsyncStorage.setItem(LOCAL_DATABASE_KEY, '{broken');
  await expect(request('/api/meal-types')).rejects.toThrow();
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBe('{broken');
});

test('meal logging scales recipe ingredients once and cascades deletes', async () => {
  const types = await request<LocalRecord[]>('/api/meal-types');
  const food = await request('/api/foods', 'POST', foodPayload);
  const meal = await request('/api/meals', 'POST', {
    name: 'Porridge',
    total_servings: 2,
    foods: [{ food_id: food.id, quantity: 100, unit: 'g' }],
  });
  const logged = await request('/api/food-entry-meals', 'POST', {
    meal_template_id: meal.id,
    name: 'Porridge',
    meal_type_id: types[0].id,
    meal_type: types[0].name,
    entry_date: date,
    quantity: 1,
    unit: 'serving',
  });
  expect(logged.calories).toBe(190);
  expect(
    (await request('/api/daily-summary?date=' + date)).foodEntries
  ).toEqual([expect.objectContaining({ quantity: 50, calories: 380 })]);
  await request(`/api/food-entry-meals/${logged.id}`, 'DELETE');
  expect(
    (await request('/api/daily-summary?date=' + date)).foodEntries
  ).toEqual([]);
});
