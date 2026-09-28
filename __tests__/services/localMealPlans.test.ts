import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { resetLocalDatabaseCache } from '../../src/services/local/database';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));

const request = <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

const plan = (name: string) => ({
  plan_name: name,
  description: null,
  start_date: '2026-09-29',
  end_date: null,
  is_active: true,
  currentClientDate: '2026-09-29',
  assignments: [
    {
      day_of_week: 1,
      meal_type_id: 'lunch-id',
      item_type: 'food',
      food_id: 'f1',
      food_name: 'Oats',
      quantity: 100,
      unit: 'g',
    },
  ],
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
});

it('keeps hand-built meal plans on the device without a server', async () => {
  expect(await request('/api/meal-plan-templates')).toEqual([]);

  const created = await request(
    '/api/meal-plan-templates',
    'POST',
    plan('Week A')
  );
  expect(created).toMatchObject({ plan_name: 'Week A', is_active: true });
  expect(created).not.toHaveProperty('currentClientDate');
  expect(created.assignments[0].id).toEqual(expect.any(String));

  await request(`/api/meal-plan-templates/${created.id}`, 'PUT', {
    ...plan('Week A, edited'),
  });
  const copy = await request(
    `/api/meal-plan-templates/${created.id}/duplicate`,
    'POST',
    { currentClientDate: '2026-09-29' }
  );
  expect(copy).toMatchObject({
    plan_name: 'Week A, edited (copy)',
    is_active: false,
  });

  let plans = await request<any[]>('/api/meal-plan-templates');
  expect(plans.map((row) => row.plan_name).sort()).toEqual([
    'Week A, edited',
    'Week A, edited (copy)',
  ]);

  await request(
    `/api/meal-plan-templates/${created.id}?currentClientDate=2026-09-29`,
    'DELETE'
  );
  plans = await request<any[]>('/api/meal-plan-templates');
  expect(plans.map((row) => row.id)).toEqual([copy.id]);
});
