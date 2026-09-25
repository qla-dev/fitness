import {
  saveWatchGoal,
  subscribeWatchGoals,
} from '../../src/services/watchGoals';
import { localApiFetch } from '../../src/services/local/localApi';
import { queryClient } from '../../src/hooks/queryClient';
import {
  addWatchGoalListener,
  completeWatchGoalRequest,
} from '../../modules/watch-link';

jest.mock('../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn(),
}));
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock('../../modules/watch-link', () => ({
  addWatchGoalListener: jest.fn(),
  completeWatchGoalRequest: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('patches only the requested nutrient and refreshes phone goal and summary caches', async () => {
  await saveWatchGoal({ id: 'request', key: 'protein', value: 120 });
  expect(localApiFetch).toHaveBeenCalledWith({
    endpoint: '/api/goals',
    method: 'PUT',
    body: { protein: 120 },
  });
  const { predicate } = jest.mocked(queryClient.invalidateQueries).mock
    .calls[0][0]!;
  for (const key of ['goals', 'dailySummary', 'daily-summary']) {
    expect(predicate!({ queryKey: [key] } as never)).toBe(true);
  }
  expect(predicate!({ queryKey: ['foods'] } as never)).toBe(false);
});

it.each([
  ['unknown', 10],
  ['calories', 2000],
  ['protein', 0],
  ['protein', -1],
  ['protein', NaN],
  ['protein', Infinity],
  ['protein', '100'],
])('rejects invalid watch goals (%s, %s)', async (key, value) => {
  await expect(
    saveWatchGoal({ id: 'request', key: key as string, value: value as number })
  ).rejects.toThrow();
  expect(localApiFetch).not.toHaveBeenCalled();
});

it('acknowledges only after persistence and reports save failures', async () => {
  subscribeWatchGoals();
  const listener = jest.mocked(addWatchGoalListener).mock.calls[0][0];
  let finish!: () => void;
  jest.mocked(localApiFetch).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }) as never
  );
  listener({ id: 'one', key: 'fat', value: 60 });
  expect(completeWatchGoalRequest).not.toHaveBeenCalled();
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(completeWatchGoalRequest).toHaveBeenCalledWith('one', true);
  jest.mocked(localApiFetch).mockRejectedValueOnce(new Error('Storage failed'));
  listener({ id: 'two', key: 'fat', value: 70 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(completeWatchGoalRequest).toHaveBeenCalledWith('two', false);
});
