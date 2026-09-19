import React, { useMemo, useState, useCallback } from 'react';
import ChartSurface from './ChartSurface';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization/i18n';
import { CartesianChart, Bar } from 'victory-native';
import { useCSSVariable } from 'uniwind';
import {
  makeChartFont,
  CHART_LABEL_FONT_SIZE,
  formatXLabel7d,
  formatXLabel30d90d,
  formatTooltipDate,
  formatChartYLabel,
} from './charts/chartFormatting';
import type { StepsDataPoint } from '../hooks/useMeasurementsRange';
import type { HealthTrendDateRange } from '../types/healthTrends';
import {
  RANGE_INNER_PADDING,
  RANGE_X_TICKS,
  RANGE_LABELS_WEEKDAYS,
} from '../types/healthTrends';
import ChartTouchOverlay, {
  ChartLayoutReporter,
  EMPTY_CHART_TOUCH_LAYOUT,
  createChartTouchLayoutSignature,
  type ChartTouchLayout,
} from './ChartTouchOverlay';

/**
 * The copy a daily-bar chart needs. Supplied by hydration, which is the same
 * chart — one bar per day, a tooltip on touch, an empty state — differing only
 * in what the bars are counting.
 *
 * The y-key stays `steps` whatever the caller is plotting: it names the axis
 * the chart reads from its points, not the quantity.
 */
export type BarChartLabels = {
  title: string;
  loadFailed: string;
  empty: string;
  tooltip: (value: number) => string;
};

type StepsBarChartProps = {
  data: StepsDataPoint[];
  isLoading: boolean;
  isError: boolean;
  range: HealthTrendDateRange;
  labels?: BarChartLabels;
  /**
   * Drops the card this chart normally draws itself on, for a screen where
   * the chart is the content rather than one card among several.
   */
  bare?: boolean;
  /**
   * Bar fill, for a metric that owns a colour elsewhere in the app — Move's
   * red, Exercise's green. Defaults to the accent, which is what steps and
   * hydration have always drawn. A history that changed colour on the way down
   * from the ring it belongs to would read as a different measurement.
   */
  color?: string;
};

const font = makeChartFont(CHART_LABEL_FONT_SIZE);

const formatYLabel = (value: number) => formatChartYLabel(value);

const DEFAULT_TOOLTIP = '';

/**
 * Reserved whether or not a bar is selected, so picking one cannot shift the
 * chart. Its margins are even: it used to sit 12 below the title and 4 above
 * the chart, which read as a gap under the heading rather than as a line of
 * its own — obvious once the surrounding card came off.
 */
const StepsTooltip: React.FC<{ text: string }> = ({ text }) => (
  <View className="h-6 justify-center my-1">
    <Text className="text-text-secondary text-sm text-center">{text}</Text>
  </View>
);

/**
 * Builds the tooltip copy from the semantically selected data point. The text
 * is derived from the current `t` translator and the current application
 * locale on every render, so an already-visible tooltip can never retain stale
 * copy after a language switch.
 */
export const buildTooltipText = (
  point: StepsDataPoint | undefined,
  t: ReturnType<typeof useTranslation>['t'],
  labels?: BarChartLabels
): string => {
  if (!point) return DEFAULT_TOOLTIP;
  if (labels)
    return `${labels.tooltip(point.steps)} · ${formatTooltipDate(point.day)}`;
  const formattedCount = formatLocalizedNumber(point.steps);
  return `${t('charts.steps.tooltip', {
    count: point.steps,
    formattedCount,
    defaultValue: '{{formattedCount}} steps',
    defaultValue_one: '{{formattedCount}} step',
    defaultValue_other: '{{formattedCount}} steps',
  })} · ${formatTooltipDate(point.day)}`;
};

const StepsBarChart: React.FC<StepsBarChartProps> = ({
  labels,
  color,
  data,
  isLoading,
  isError,
  range,
  bare,
}) => {
  const { t } = useTranslation();
  const [accentColor, textMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [touchLayout, setTouchLayout] = useState<ChartTouchLayout>(
    EMPTY_CHART_TOUCH_LAYOUT
  );

  const hasData = useMemo(() => data.some((d) => d.steps > 0), [data]);

  const formatXLabel = RANGE_LABELS_WEEKDAYS.has(range)
    ? formatXLabel7d
    : formatXLabel30d90d;

  // Reset a lingering selection when the dataset or range changes. Done during
  // render (instead of in an effect) so the tooltip is already cleared on the
  // first render after the data changes.
  const [tooltipResetKey, setTooltipResetKey] = useState({ data, range });
  if (tooltipResetKey.data !== data || tooltipResetKey.range !== range) {
    setTooltipResetKey({ data, range });
    setSelectedIndex(null);
  }

  // Derive the presentation text from the selected point on every render, so
  // an already-visible tooltip reflects the current app language immediately.
  const selectedPoint = selectedIndex != null ? data[selectedIndex] : undefined;
  const tooltipText = buildTooltipText(selectedPoint, t, labels);

  const handleTouchLayoutChange = useCallback(
    (nextLayout: ChartTouchLayout) => {
      setTouchLayout((currentLayout) => {
        const currentSignature = createChartTouchLayoutSignature(currentLayout);
        const nextSignature = createChartTouchLayoutSignature(nextLayout);

        if (currentSignature === nextSignature) {
          return currentLayout;
        }

        return nextLayout;
      });
    },
    []
  );

  const handleSelectBar = useCallback(
    (index: number) => {
      const point = data[index];

      if (!point) {
        return;
      }

      setSelectedIndex(index);
    },
    [data]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  return (
    <ChartSurface bare={bare}>
      <Text className="text-text-primary text-lg font-semibold mb-2">
        {labels?.title ?? t('charts.steps.title', { defaultValue: 'Steps' })}
      </Text>

      <StepsTooltip text={tooltipText} />

      {isLoading ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        </View>
      ) : isError ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {labels?.loadFailed ??
              t('charts.steps.loadFailed', {
                defaultValue: 'Failed to load step data',
              })}
          </Text>
        </View>
      ) : !hasData ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {labels?.empty ??
              t('charts.steps.empty', {
                defaultValue: 'No step data for this period',
              })}
          </Text>
        </View>
      ) : (
        <View style={{ height: 175 }}>
          <CartesianChart
            data={data}
            xKey="day"
            yKeys={['steps']}
            domain={{ y: [0] }}
            domainPadding={{ left: 25, right: 25 }}
            xAxis={{
              font,
              tickCount: RANGE_X_TICKS[range],
              labelColor: textMuted,
              formatXLabel,
            }}
            yAxis={[
              {
                font,
                tickCount: 5,
                labelColor: textMuted,
                formatYLabel,
              },
            ]}
          >
            {({ points, chartBounds }) => (
              <>
                <ChartLayoutReporter
                  chartBounds={chartBounds}
                  points={points.steps}
                  onChange={handleTouchLayoutChange}
                />
                <Bar
                  points={points.steps}
                  chartBounds={chartBounds}
                  color={color ?? accentColor}
                  innerPadding={RANGE_INNER_PADDING[range]}
                  animate={{ type: 'timing', duration: 300 }}
                  roundedCorners={{ topLeft: 6, topRight: 6 }}
                />
              </>
            )}
          </CartesianChart>
          <ChartTouchOverlay
            layout={touchLayout}
            onSelect={handleSelectBar}
            onClear={handleClearSelection}
            testIDPrefix="steps-touch-overlay"
          />
        </View>
      )}
    </ChartSurface>
  );
};

export default StepsBarChart;
