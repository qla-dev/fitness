import type { QueryClient } from '@tanstack/react-query';
import { exerciseHistoryResetQueryKey } from './queryKeys';

const dailySummaryQueryFamily = ['dailySummary'] as const;
const measurementsQueryFamily = ['measurements'] as const;
const measurementsRangeQueryFamily = ['measurementsRange'] as const;
const exerciseHistoryQueryFamily = ['exerciseHistory'] as const;

/**
 * Invalidates data derived from HealthKit / Health Connect after an upload.
 *
 * The Dashboard can have a daily-summary request in flight when an upload
 * finishes. React Query only honours `cancelRefetch` for a query that already
 * holds data, so an initial request (`dataUpdatedAt === 0`) is not cancelled —
 * the invalidation piggybacks on the in-flight promise, waits for a response
 * that began before the upload, and then marks that stale response fresh.
 *
 * Any in-flight fetch counts here, not just the initial one: which branch
 * React Query takes depends on timing this function cannot observe, so it
 * settles the first pass and then issues one more Dashboard refresh. The
 * second pass starts from an idle query and is always a real request.
 */
export async function refreshHealthSyncCache(
  queryClient: QueryClient
): Promise<void> {
  const dashboardFetchWasInFlight = [
    dailySummaryQueryFamily,
    measurementsQueryFamily,
  ].some((queryKey) =>
    queryClient
      .getQueryCache()
      .findAll({ queryKey })
      .some((query) => query.state.fetchStatus !== 'idle')
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

  if (dashboardFetchWasInFlight) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dailySummaryQueryFamily }),
      queryClient.invalidateQueries({ queryKey: measurementsQueryFamily }),
    ]);
  }
}
