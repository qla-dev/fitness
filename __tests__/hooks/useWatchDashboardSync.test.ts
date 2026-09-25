import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useWatchDashboardSync } from '../../src/hooks/useWatchDashboardSync';
import { updateWatchDashboard } from '../../modules/watch-link';
import { emptyDailySummary } from '../../src/services/dailySummaryService';
import { getTodayDate } from '../../src/utils/dateUtils';
import { addLog } from '../../src/services/LogService';

jest.mock('../../modules/watch-link', () => ({
  updateWatchDashboard: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const push = jest.mocked(updateWatchDashboard);
const originalOS = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  push.mockReset().mockResolvedValue(undefined);
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOS,
    configurable: true,
  });
});

it('sends the dashboard Move total and goals, measurements, and converted distance', () => {
  const summary = {
    ...emptyDailySummary(getTodayDate()),
    activeCalories: 310,
    otherExerciseCalories: 90,
    exerciseCaloriesGoal: 650,
    exerciseMinutes: 25,
    exerciseMinutesGoal: 40,
    protein: { consumed: 85, goal: 140 },
    carbs: { consumed: 110, goal: 200 },
    fiber: { consumed: 15, goal: 30 },
    goals: {
      ...emptyDailySummary(getTodayDate()).goals,
      stand_hours: 10,
      steps: 9000,
    },
  };
  renderHook(() =>
    useWatchDashboardSync(
      summary,
      { steps: 8123, stand_hours: 7, weight: 72.5 },
      3.1,
      'miles'
    )
  );
  expect(push).toHaveBeenCalledWith(
    expect.objectContaining({
      date: getTodayDate(),
      move: 400,
      moveGoal: 650,
      exercise: 25,
      exerciseGoal: 40,
      stand: 7,
      standGoal: 10,
      steps: 8123,
      stepsGoal: 9000,
      weight: 72.5,
      weightUnit: 'kg',
      distance: 3.1,
      distanceUnit: 'miles',
      nutrients: expect.arrayContaining([
        expect.objectContaining({
          key: 'protein',
          consumed: 85,
          goal: 140,
          unit: 'g',
        }),
        expect.objectContaining({ key: 'carbs', consumed: 110, goal: 200 }),
        expect.objectContaining({
          key: 'dietary_fiber',
          consumed: 15,
          goal: 30,
        }),
      ]),
    })
  );
});

it('uses the phone net-carb preference and sends all 16 nutrient rings', () => {
  const summary = {
    ...emptyDailySummary(getTodayDate()),
    carbs: { consumed: 110, goal: 200 },
    fiber: { consumed: 15, goal: 30 },
  };
  renderHook(() =>
    useWatchDashboardSync(summary, undefined, undefined, 'km', true)
  );
  const nutrients = push.mock.calls[0][0].nutrients;
  expect(nutrients).toHaveLength(16);
  expect(nutrients.find((row) => row.key === 'carbs')).toEqual(
    expect.objectContaining({ consumed: 95, goal: 200 })
  );
});

it('does not overwrite today on the watch when the user browses a past day', () => {
  const { rerender } = renderHook(
    ({ date }) =>
      useWatchDashboardSync(
        emptyDailySummary(date),
        undefined,
        undefined,
        'km'
      ),
    { initialProps: { date: getTodayDate() } }
  );
  rerender({ date: '2001-01-01' });
  expect(push).toHaveBeenCalledTimes(1);
});

it('does not send loading data or call the Apple bridge on Android', () => {
  renderHook(() =>
    useWatchDashboardSync(undefined, undefined, undefined, 'km')
  );
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  renderHook(() =>
    useWatchDashboardSync(
      emptyDailySummary(getTodayDate()),
      undefined,
      undefined,
      'km'
    )
  );
  expect(push).not.toHaveBeenCalled();
});

it('logs a bridge failure without interrupting the phone dashboard', async () => {
  push.mockRejectedValueOnce(new Error('unavailable'));
  renderHook(() =>
    useWatchDashboardSync(
      emptyDailySummary(getTodayDate()),
      undefined,
      undefined,
      'km'
    )
  );
  await waitFor(() =>
    expect(addLog).toHaveBeenCalledWith(
      '[Watch] Dashboard sync failed',
      'WARNING',
      ['Error: unavailable']
    )
  );
});
