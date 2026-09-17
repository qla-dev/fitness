import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

type RefetchFn = () => void;

const DEFAULT_STALE_TIME = 30_000;

/**
 * Triggers a refetch when the screen gains focus, but only if enough time
 * has elapsed since the last refetch to avoid redundant network requests
 * on rapid tab switches.
 *
 * An invalidated query bypasses the cooldown. The cooldown exists to absorb
 * rapid tab switches, not to withhold data that something has already marked
 * out of date: a health sync run from the Sync screen invalidates the
 * Dashboard's queries while they are inactive, so `refetchType: 'active'`
 * skips them and focus is the only thing left to refresh them. Holding that
 * refetch back for 30s left Home showing pre-sync numbers until the user
 * pulled to refresh by hand.
 *
 * @param refetch - The refetch function from useQuery (stable reference per React Query)
 * @param enabled - Whether refetching is enabled (defaults to true)
 * @param staleTime - Minimum ms between refetches (defaults to 30 000)
 * @param isStale - Whether the query is currently stale/invalidated
 */
export function useRefetchOnFocus(
  refetch: RefetchFn,
  enabled: boolean = true,
  staleTime: number = DEFAULT_STALE_TIME,
  isStale: boolean = false
): void {
  const lastRefetchedAt = useRef(-Infinity);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const cooledDown = Date.now() - lastRefetchedAt.current >= staleTime;
      if (!isStale && !cooledDown) return;
      lastRefetchedAt.current = Date.now();
      refetch();
    }, [refetch, enabled, staleTime, isStale])
  );
}
