import { useQuery } from '@tanstack/react-query';
import { fetchMeasurementsRange } from '../services/api/measurementsApi';
import { measurementsRangeQueryKey } from './queryKeys';
import { addDays } from '../utils/dateUtils';
import {
  MEASUREMENT_FIELDS,
  measurementValue,
  type MeasurementFieldId,
} from '../utils/measurementFields';
import type { CheckInMeasurement } from '../types/measurements';

/**
 * How far back a tile will reach for a value to show. Long enough that someone
 * who weighs in weekly, or monthly, still sees their last number instead of a
 * dash; short enough that a year-old figure is not presented as current.
 */
const LOOKBACK_DAYS = 120;

export interface MeasurementFieldHistory {
  /** The value shown on the tile: the selected day's, else the most recent. */
  shown: number | null;
  /** Which day `shown` came from — equal to the selected day when current. */
  shownDate: string | null;
  /** The day before the selected one, for the trend chip. */
  previous: number | null;
}

export type MeasurementHistory = Record<
  MeasurementFieldId,
  MeasurementFieldHistory
>;

const EMPTY_FIELD: MeasurementFieldHistory = {
  shown: null,
  shownDate: null,
  previous: null,
};

const emptyHistory = (): MeasurementHistory =>
  Object.fromEntries(
    MEASUREMENT_FIELDS.map((field) => [field.id, EMPTY_FIELD])
  ) as MeasurementHistory;

/**
 * Per-field history for one day: what to show, which day it came from, and
 * what the day before held. One range request rather than three per-day reads,
 * and the same query key the trend graphs already use for their window.
 */
export function useMeasurementHistory(date: string, enabled = true) {
  const startDate = addDays(date, -LOOKBACK_DAYS);

  const query = useQuery({
    queryKey: measurementsRangeQueryKey(startDate, date),
    queryFn: () => fetchMeasurementsRange(startDate, date),
    enabled,
    select: (rows): MeasurementHistory => {
      // The API returns DESC by updated_at, so the first row for a date is that
      // day's most recent write.
      const byDate = new Map<string, CheckInMeasurement>();
      for (const row of rows) {
        if (!byDate.has(row.entry_date)) byDate.set(row.entry_date, row);
      }
      // Newest first, so the first day carrying a value is the latest one.
      const days = [...byDate.keys()].sort().reverse();
      const yesterday = addDays(date, -1);

      const history = emptyHistory();
      for (const field of MEASUREMENT_FIELDS) {
        const today = measurementValue(byDate.get(date), field.id);
        let shown = today;
        let shownDate: string | null = today === null ? null : date;
        if (shown === null) {
          for (const day of days) {
            if (day > date) continue;
            const value = measurementValue(byDate.get(day), field.id);
            if (value !== null) {
              shown = value;
              shownDate = day;
              break;
            }
          }
        }
        history[field.id] = {
          shown,
          shownDate,
          previous: measurementValue(byDate.get(yesterday), field.id),
        };
      }
      return history;
    },
  });

  return {
    history: query.data,
    isLoading: query.isLoading,
  };
}
