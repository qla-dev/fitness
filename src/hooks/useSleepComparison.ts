import { useQuery } from '@tanstack/react-query';

import { fetchSleepEntries } from '../services/api/sleepApi';
import type { SleepEntry } from '../types/sleep';
import { addDays } from '../utils/dateUtils';
import { classifySleepDay } from './useSleepDay';
import { sleepRangeQueryKey } from './queryKeys';

/**
 * How far back the tile will reach for a night to compare against. Long enough
 * that someone who stopped wearing a watch for a fortnight still gets a
 * comparison; short enough that a months-old night is never presented as "the
 * night before".
 */
const LOOKBACK_DAYS = 30;

/** Seconds slept, preferring the measured figure over the time-in-bed span. */
const sleepSeconds = (entry: SleepEntry): number | null => {
  const seconds = entry.time_asleep_in_seconds ?? entry.duration_in_seconds;
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? seconds
    : null;
};

/**
 * The most recent main sleep *before* a given day, for the delta the wake tile
 * shows in its corner.
 *
 * Not yesterday specifically: a night missing from the record is common — the
 * watch was off the wrist — and reporting "no change" for it would be a
 * different claim from "nothing to compare against". So this walks back until
 * it finds a night that exists, and reports which day that was, leaving the
 * caller free to say so.
 *
 * Reuses the `sleepRange` query family, so a health sync's cache refresh
 * invalidates this along with every other sleep read.
 */
export function useSleepComparison(day: string, enabled = true) {
  const startDate = addDays(day, -LOOKBACK_DAYS);

  const query = useQuery({
    queryKey: sleepRangeQueryKey(startDate, day),
    queryFn: () => fetchSleepEntries(startDate, day),
    enabled,
    select: (entries: SleepEntry[]) => {
      // Newest first: the first day carrying a main sleep is the one wanted.
      for (let offset = 1; offset <= LOOKBACK_DAYS; offset += 1) {
        const candidate = addDays(day, -offset);
        const { mainSleep } = classifySleepDay(entries, candidate);
        if (!mainSleep) continue;
        const seconds = sleepSeconds(mainSleep);
        if (seconds === null) continue;
        return { day: candidate, seconds };
      }
      return null;
    },
  });

  return { previousSleep: query.data ?? null };
}
