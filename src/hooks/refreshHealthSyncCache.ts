import type { QueryClient } from '@tanstack/react-query';
import { exerciseHistoryResetQueryKey } from './queryKeys';

const dailySummaryQueryFamily = ['dailySummary'] as const;
const measurementsQueryFamily = ['measurements'] as const;
const measurementsRangeQueryFamily = ['measurementsRange'] as const;
const exerciseHistoryQueryFamily = ['exerciseHistory'] as const;

/**
 * Invalidates data derived from HealthKit / Health Connect after an upload.
 *
 * The Dashboard starts its initial daily-summary request while sync-on-open is
 * also starting. React Query deliberately keeps an in-flight first request
 * (there is no cached data to cancel), so a normal invalidation can wait for a
 * response that began before the upload and then mark that stale response
 * fresh. When that race is present, issue one more Dashboard refresh after the
 * first request settles.
 */
export async function refreshHealthSyncCache(
  queryClient: QueryClient
): Promise<void> {
  const dashboardInitialFetchWasInFlight = [
    dailySummaryQueryFamily,
    measurementsQueryFamily,
  ].some((queryKey) =>
    queryClient
      .getQueryCache()
      .findAll({ queryKey })
      .some(
        (query) =>
          query.state.data === undefined && query.state.fetchStatus !== 'idle'
      )
  );

  for (const family of [
    'sleep',
    'sleepRange',
    'customCategories',
    'customMeasurements',
  ]) {
    void queryClient.invalidateQueries({ queryKey: [family] });
  }
  const dashboardRefreshes = [
    queryClient.invalidateQueries({ queryKey: dailySummaryQueryFamily }),
    queryClient.invalidateQueries({ queryKey: measurementsQueryFamily }),
  ];
  void queryClient.invalidateQueries({
    queryKey: measurementsRangeQueryFamily,
  });
  void queryClient.invalidateQueries({
    queryKey: exerciseHistoryQueryFamily,
    refetchType: 'none',
  });

  queryClient.removeQueries({
    queryKey: exerciseHistoryQueryFamily,
    type: 'inactive',
  });
  queryClient.setQueryData(exerciseHistoryResetQueryKey, Date.now());

  await Promise.all(dashboardRefreshes);

  if (dashboardInitialFetchWasInFlight) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dailySummaryQueryFamily }),
      queryClient.invalidateQueries({ queryKey: measurementsQueryFamily }),
    ]);
  }
}
