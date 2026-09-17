import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimeRange } from '../services/storage';

interface TimeRangeOption {
  label: string;
  value: TimeRange;
}

/** The "Sync Range" choices shared by the Sync and Apple Health check screens. */
export function useSyncTimeRangeOptions(): TimeRangeOption[] {
  const { t } = useTranslation();
  return useMemo<TimeRangeOption[]>(
    () => [
      {
        label: t('syncScreen.timeRanges.today', { defaultValue: 'Today' }),
        value: 'today',
      },
      {
        label: t('syncScreen.timeRanges.last24Hours', {
          defaultValue: 'Last 24 Hours',
        }),
        value: '24h',
      },
      {
        label: t('syncScreen.timeRanges.last3Days', {
          defaultValue: 'Last 3 Days',
        }),
        value: '3d',
      },
      {
        label: t('syncScreen.timeRanges.last7Days', {
          defaultValue: 'Last 7 Days',
        }),
        value: '7d',
      },
      {
        label: t('syncScreen.timeRanges.last30Days', {
          defaultValue: 'Last 30 Days',
        }),
        value: '30d',
      },
      {
        label: t('syncScreen.timeRanges.last90Days', {
          defaultValue: 'Last 90 Days',
        }),
        value: '90d',
      },
      {
        label: t('syncScreen.timeRanges.last6Months', {
          defaultValue: 'Last 6 Months',
        }),
        value: '180d',
      },
      {
        label: t('syncScreen.timeRanges.lastYear', {
          defaultValue: 'Last Year',
        }),
        value: '365d',
      },
    ],
    [t]
  );
}
