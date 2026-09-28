import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetLocalDatabaseCache } from '../../src/services/local/database';
import {
  createWeeklyPlan,
  deleteWeeklyPlan,
  listWeeklyPlans,
  NotSignedInError,
  planGroceryList,
  setActiveWeeklyPlan,
  type PlanDay,
  type WeeklyPlan,
} from '../../src/services/weeklyPlans';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
} from '../../src/services/online/account';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/online/account', () => ({
  onlineRequest: jest.fn(),
  updateOnlineAccount: jest.fn(async () => undefined),
  useOnlineAccount: { getState: jest.fn() },
}));

const day = (weekday: number, beans: number, price: number): PlanDay => ({
  weekday,
  cost: price,
  meals: [
    {
      slot: 'lunch',
      name: 'Grah',
      calories: 600,
      protein: 30,
      carbs: 80,
      fat: 12,
      ingredients: [
        { name: 'Beans', quantity: beans, unit: 'g', price },
        { name: 'Onions', quantity: 1, unit: 'piece', price: null },
      ],
    },
  ],
});

const servedPlan = (days: PlanDay[]) => ({
  title: 'Budget week',
  summary: null,
  region: 'HR',
  currency: 'EUR',
  prices: 'cijene' as const,
  price_date: '2026-09-28',
  weekly_cost: 3,
  days,
});

const signIn = () =>
  jest.mocked(useOnlineAccount.getState).mockReturnValue({
    session: { token: 't', user: { id: '1', name: 'N', ai_coins: 10 } },
    ready: true,
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
  jest.clearAllMocks();
});

it('adds the same ingredient up across days, scaled by servings', () => {
  const plan = {
    ...servedPlan([day(1, 200, 0.75), day(2, 150, 0.5)]),
    id: 'p',
    servings: 2,
    is_active: true,
  } as WeeklyPlan;
  const list = planGroceryList(plan, plan.days, 'Week', 'note');
  expect(
    list.items.map(({ name, quantity, price }) => [name, quantity, price])
  ).toEqual([
    ['Beans', '700 g', 2.5],
    ['Onions', '4 pcs', undefined],
  ]);
  const monday = planGroceryList(plan, [plan.days[0]], 'Monday', 'note');
  expect(monday.items[0].quantity).toBe('400 g');
});

it('saves a new plan as the active one and keeps one active at a time', async () => {
  signIn();
  jest
    .mocked(onlineRequest)
    .mockResolvedValue({ plan: servedPlan([day(1, 100, 1)]), ai_coins: 7 });

  const first = await createWeeklyPlan({ region: 'HR', servings: '2' }, 'hr');
  const second = await createWeeklyPlan({ region: 'HR' }, 'hr');

  expect(updateOnlineAccount).toHaveBeenLastCalledWith(
    expect.objectContaining({ ai_coins: 7 })
  );
  // Croatia is priced in euros whatever currency was picked.
  expect(onlineRequest).toHaveBeenLastCalledWith(
    '/markai/meal-plans',
    expect.objectContaining({ region: 'HR', currency: 'EUR', language: 'hr' })
  );
  let plans = await listWeeklyPlans();
  expect(plans.filter((plan) => plan.is_active).map((plan) => plan.id)).toEqual(
    [second.id]
  );
  expect(plans.find((plan) => plan.id === first.id)?.servings).toBe(2);

  await setActiveWeeklyPlan(first.id);
  plans = await listWeeklyPlans();
  expect(plans.filter((plan) => plan.is_active).map((plan) => plan.id)).toEqual(
    [first.id]
  );

  // Deleting the active plan hands the badge to the newest one left.
  await deleteWeeklyPlan(first.id);
  plans = await listWeeklyPlans();
  expect(plans.map((plan) => [plan.id, plan.is_active])).toEqual([
    [second.id, true],
  ]);
});

it('needs a signed-in account to plan', async () => {
  jest.mocked(useOnlineAccount.getState).mockReturnValue({
    session: null,
    ready: true,
  });
  await expect(createWeeklyPlan({ region: 'BA' }, 'bs')).rejects.toBeInstanceOf(
    NotSignedInError
  );
  expect(onlineRequest).not.toHaveBeenCalled();
});
