import React, { useMemo, useState, useCallback } from 'react';
import ChartSurface from './ChartSurface';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { CartesianChart } from 'victory-native';
import { useCSSVariable } from 'uniwind';
import { formatLocalizedNumber } from '../localization/i18n';
import {
  makeChartFont,
  CHART_LABEL_FONT_SIZE,
  formatXLabelForRange,
  formatTooltipDate,
} from './charts/chartFormatting';
import LineSeriesMark from './charts/LineSeriesMark';
import type { WeightDataPoint } from '../hooks/useMeasurementsRange';
import type { HealthTrendDateRange } from '../types/healthTrends';
import { RANGE_X_TICKS } from '../types/healthTrends';
import { CHART_GRID_LINE_COLOR, CHART_PLOT_HEIGHT } from '../constants/charts';
import ChartCaption from './ChartCaption';
import { useChartRise } from '../hooks/useChartRise';
import ChartTouchOverlay, {
  ChartLayoutReporter,
  EMPTY_CHART_TOUCH_LAYOUT,
  createChartTouchLayoutSignature,
  type ChartTouchLayout,
} from './ChartTouchOverlay';

type WeightLineChartProps = {
  data: WeightDataPoint[];
  isLoading: boolean;
  isError: boolean;
  range: HealthTrendDateRange;
  /**
   * Drops the card this chart normally draws itself on, for a screen where
   * the chart is the content rather than one card among several.
   */
  bare?: boolean;
  /** Drops the chart's own heading, for a screen that names the metric itself. */
  hideTitle?: boolean;
  unit: string;
};

const font = makeChartFont(CHART_LABEL_FONT_SIZE);

/**
 * The plot area's height, shared by the chart and by every state that stands
 * in for it.
 *
 * Each range is its own query, so switching one starts a fetch with no cached
 * rows and the chart briefly has nothing to draw. When the loading, error and
 * empty states were shorter than the plot, that moment collapsed the card and
 * sprang it back — which reads as the chart disappearing rather than as the
 * range changing. Holding one height means the surface stays put and only the
 * bars redraw.
 */
const PLOT_HEIGHT = CHART_PLOT_HEIGHT;
const DEFAULT_TOOLTIP = '';

const WeightTooltip: React.FC<{ text: string }> = ({ text }) => (
  <ChartCaption>
    <Text className="text-text-secondary text-sm text-center">{text}</Text>
  </ChartCaption>
);

/**
 * Builds the tooltip copy from the semantically selected data point. The weight
 * value, unit, and date are derived from the current application locale on
 * every render, so an already-visible tooltip can never retain stale copy after
 * a language switch.
 */
export const buildWeightTooltipText = (
  point: { weight: number; day: string } | undefined,
  unit: string
): string => {
  if (!point) return DEFAULT_TOOLTIP;
  const formattedWeight = formatLocalizedNumber(point.weight, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formattedWeight} ${unit} · ${formatTooltipDate(point.day)}`;
};

const WeightLineChart: React.FC<WeightLineChartProps> = ({
  data,
  isLoading,
  isError,
  range,
  bare,
  hideTitle,
  unit,
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

  const hasData = useMemo(() => data.length > 0, [data]);

  // Pinned from the real readings rather than left to Victory to derive, so
  // the flat frame the rise starts from cannot drag the axis and flash a
  // different scale on the way in. These are the bounds Victory would compute
  // for itself, written out.
  const yDomain = useMemo((): [number, number] | undefined => {
    if (!data.length) return undefined;
    let low = data[0].weight;
    let high = data[0].weight;
    for (const point of data) {
      if (point.weight < low) low = point.weight;
      if (point.weight > high) high = point.weight;
    }
    return [low, high];
  }, [data]);

  // A line's floor is the bottom of its domain, not zero: a weight flattened to
  // zero would start below the plot and fly in from off-screen rather than rise
  // out of the axis.
  const flattenWeight = useCallback(
    (point: WeightDataPoint): WeightDataPoint => ({
      ...point,
      weight: yDomain ? yDomain[0] : point.weight,
    }),
    [yDomain]
  );
  const series = useChartRise(data, flattenWeight);

  const formatXLabel = formatXLabelForRange(range);

  // Reset a lingering selection when the dataset, range, or unit changes. Done
  // during render (instead of in an effect) so the tooltip is already cleared on
  // the first render after the data changes.
  const [tooltipResetKey, setTooltipResetKey] = useState({ data, range, unit });
  if (
    tooltipResetKey.data !== data ||
    tooltipResetKey.range !== range ||
    tooltipResetKey.unit !== unit
  ) {
    setTooltipResetKey({ data, range, unit });
    setSelectedIndex(null);
  }

  // Derive the presentation text from the selected point on every render, so
  // an already-visible tooltip reflects the current app language immediately.
  const selectedPoint = selectedIndex != null ? data[selectedIndex] : undefined;
  const tooltipText = buildWeightTooltipText(selectedPoint, unit);

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

  const handleSelectPoint = useCallback(
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
      {hideTitle ? null : (
        <Text className="text-text-primary text-lg font-semibold mb-2">
          {t('charts.weight.title', { defaultValue: 'Weight' })}
        </Text>
      )}

      <WeightTooltip text={tooltipText} />

      {isLoading ? (
        <View style={{ height: PLOT_HEIGHT }}
          className="justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        </View>
      ) : isError ? (
        <View style={{ height: PLOT_HEIGHT }}
          className="justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('charts.weight.loadFailed', {
              defaultValue: 'Failed to load weight data',
            })}
          </Text>
        </View>
      ) : !hasData ? (
        <View style={{ height: PLOT_HEIGHT }}
          className="justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('charts.weight.empty', {
              defaultValue: 'No weight data for this period',
            })}
          </Text>
        </View>
      ) : (
        <View style={{ height: PLOT_HEIGHT }}>
          <CartesianChart
            data={series}
            xKey="day"
            yKeys={['weight']}
            {...(yDomain ? { domain: { y: yDomain } } : {})}
            domainPadding={{ left: 25, right: 25 }}
            xAxis={{
              font,
              tickCount: RANGE_X_TICKS[range],
              labelColor: textMuted,
              lineColor: CHART_GRID_LINE_COLOR,
              formatXLabel,
            }}
            yAxis={[
              {
                font,
                tickCount: 5,
                labelColor: textMuted,
                lineColor: CHART_GRID_LINE_COLOR,
              },
            ]}
          >
            {({ points, chartBounds }) => (
              <>
                <ChartLayoutReporter
                  chartBounds={chartBounds}
                  points={points.weight}
                  onChange={handleTouchLayoutChange}
                />
                <LineSeriesMark
                  points={points.weight}
                  color={accentColor}
                  strokeWidth={2}
                  animate={{ type: 'timing', duration: 300 }}
                  curveType="cardinal"
                  connectMissingData
                />
              </>
            )}
          </CartesianChart>
          <ChartTouchOverlay
            layout={touchLayout}
            onSelect={handleSelectPoint}
            onClear={handleClearSelection}
            testIDPrefix="weight-touch-overlay"
          />
        </View>
      )}
    </ChartSurface>
  );
};

export default WeightLineChart;
