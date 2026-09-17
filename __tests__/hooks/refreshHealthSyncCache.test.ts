import { refreshHealthSyncCache } from '../../src/hooks/refreshHealthSyncCache';
import { QueryObserver } from '@tanstack/react-query';
import {
  dailySummaryQueryKey,
  exerciseHistoryQueryKey,
  exerciseHistoryResetQueryKey,
  foodsQueryKey,
} from '../../src/hooks/queryKeys';
import { createTestQueryClient, type QueryClient } from './queryTestUtils';

describe('refreshHealthSyncCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('invalidates health-derived families and resets exercise history', async () => {
    const now = 1_713_182_400_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    queryClient.setQueryData(exerciseHistoryQueryKey, {
      pages: [],
      pageParams: [],
    });
    queryClient.setQueryData(foodsQueryKey, [{ id: 'food-1' }]);

    await refreshHealthSyncCache(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dailySummary'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['measurements'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['measurementsRange'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['exerciseHistory'],
      refetchType: 'none',
    });
    expect(queryClient.getQueryData(exerciseHistoryQueryKey)).toBeUndefined();
    expect(queryClient.getQueryData(exerciseHistoryResetQueryKey)).toBe(now);
    expect(queryClient.getQueryData(foodsQueryKey)).toEqual([{ id: 'food-1' }]);
  });

  test('retries an initial Dashboard request that began before sync completed', async () => {
    const queryKey = dailySummaryQueryKey('2024-04-01');
    let resolveInitial: (value: { source: string }) => void;
    const initialResponse = new Promise<{ source: string }>((resolve) => {
      resolveInitial = resolve;
    });
    const queryFn = jest
      .fn<Promise<{ source: string }>, []>()
      .mockReturnValueOnce(initialResponse)
      .mockResolvedValueOnce({ source: 'post-sync' });
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});

    expect(queryFn).toHaveBeenCalledTimes(1);

    const refresh = refreshHealthSyncCache(queryClient);
    resolveInitial!({ source: 'pre-sync' });
    await refresh;

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(queryKey)).toEqual({
      source: 'post-sync',
    });

    unsubscribe();
  });
});
