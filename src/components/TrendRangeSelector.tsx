import { useTranslation } from 'react-i18next';
import SegmentedControl from './SegmentedControl';
import {
  HEALTH_TREND_RANGES,
  type HealthTrendDateRange,
} from '../types/healthTrends';

/**
 * The window picker above a trend chart.
 *
 * One component rather than the same five-item array written out on each
 * screen that plots a history: the labels are abbreviations, and three copies
 * of them is three places for a range to be added, renamed or reordered in
 * only two.
 *
 * Resolvers rather than a key built from the range, because the i18n audit
 * rejects a dynamic `t()` key — the literal has to be at the call site.
 */
const LABELS: Record<
  HealthTrendDateRange,
  (t: ReturnType<typeof useTranslation>['t']) => string
> = {
  d: (t) => t('ranges.d', { defaultValue: 'D' }),
  w: (t) => t('ranges.w', { defaultValue: 'W' }),
  m: (t) => t('ranges.m', { defaultValue: 'M' }),
  '6m': (t) => t('ranges.6m', { defaultValue: '6M' }),
  y: (t) => t('ranges.y', { defaultValue: 'Y' }),
};

export default function TrendRangeSelector({
  range,
  onSelect,
}: {
  range: HealthTrendDateRange;
  onSelect: (range: HealthTrendDateRange) => void;
}) {
  const { t } = useTranslation();

  return (
    <SegmentedControl<HealthTrendDateRange>
      segments={HEALTH_TREND_RANGES.map((key) => ({
        key,
        label: LABELS[key](t),
      }))}
      activeKey={range}
      onSelect={onSelect}
      label={t('goalDetail.rangeLabel', { defaultValue: 'Range' })}
    />
  );
}
