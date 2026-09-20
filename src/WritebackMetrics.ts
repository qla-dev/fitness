import type { ImageSourcePropType } from 'react-native';

// Writeback metrics (qla.fit → OS health store). Kept separate from the read
// HealthMetrics list: those drive background-delivery subscriptions and inbound
// sync, whereas these are outbound and opt-in. Supported on both platforms — Health
// Connect on Android (healthconnect/writeback.ts) and HealthKit on iOS
// (healthkit/writeback.ts), resolved via the top-level ./writeback shim. Off by default.
//
// Mirrors the read metrics' shape (icon + category) so the UI can group them in
// the same accordion style.

export type WritebackMetricId = 'nutrition' | 'hydration' | 'exerciseSession';

/** OS health-store record types writeback creates. Each is also the delete scope
 *  used by removeWrittenData, so a new id must bring its record type with it. */
export type WritebackRecordType = 'Nutrition' | 'Hydration' | 'ExerciseSession';

/** Inclusive local-calendar-day range (YYYY-MM-DD) for a targeted writeback removal.
 *  `null` removal means "all time" (full purge). */
export interface WritebackDateRange {
  from: string;
  to: string;
}

/** Result of a removal: `ok` is false if any record-type delete failed (partial). */
export interface WritebackRemovalResult {
  ok: boolean;
}

export interface WritebackMetric {
  id: WritebackMetricId;
  defaultLabel: string;
  /** Stable localization key for the application-owned metric label. */
  labelKey: string;
  /** loadHealthPreference/saveHealthPreference key (under the @HealthConnect prefix on
   *  Android, @HealthKit on iOS — the platform-resolved preferences module owns it). */
  preferenceKey: string;
  recordType: WritebackRecordType;
  permission: { accessType: 'write'; recordType: WritebackRecordType };
  icon: ImageSourcePropType;
  category: string;
}

export const WRITEBACK_METRICS: WritebackMetric[] = [
  {
    id: 'nutrition',
    labelKey: 'healthMetrics.nutrition',
    defaultLabel: 'Nutrition',
    preferenceKey: 'writebackNutritionEnabled',
    recordType: 'Nutrition',
    permission: { accessType: 'write', recordType: 'Nutrition' },
    icon: require('../assets/icons/health-metrics/nutrition.png'),
    category: 'Nutrition',
  },
  {
    id: 'hydration',
    labelKey: 'healthMetrics.hydration',
    defaultLabel: 'Hydration',
    preferenceKey: 'writebackHydrationEnabled',
    recordType: 'Hydration',
    permission: { accessType: 'write', recordType: 'Hydration' },
    icon: require('../assets/icons/health-metrics/hydration.png'),
    category: 'Nutrition',
  },
  {
    // Shares the read metric's id so getHealthMetricLabel resolves the same
    // "Exercise Session" label for both directions — the user sees one name for
    // one thing, read or written. The preference keys stay distinct.
    id: 'exerciseSession',
    labelKey: 'healthMetrics.exerciseSession',
    defaultLabel: 'Exercise Session',
    preferenceKey: 'writebackExerciseEnabled',
    recordType: 'ExerciseSession',
    permission: { accessType: 'write', recordType: 'ExerciseSession' },
    icon: require('../assets/icons/health-metrics/exercise_session.png'),
    category: 'Activity',
  },
];
