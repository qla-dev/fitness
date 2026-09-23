import React, { useMemo, useState, useCallback } from 'react';
import ChartSurface from './ChartSurface';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { Line as SkiaLine } from '@shopify/react-native-skia';
import { useCSSVariable } from 'uniwind';
import {
  makeChartFont,
  formatXLabelForRange,
  formatTooltipDate,
  formatChartYLabel,
} from './charts/chartFormatting';
import { formatLocalizedNumber } from '../localization';
import type { TrendRange } from '../hooks/useNutritionTrends';
import {
  RANGE_INNER_PADDING,
  RANGE_X_TICKS,
} from '../types/healthTrends';
import ChartTouchOverlay, {
  ChartLayoutReporter,
  EMPTY_CHART_TOUCH_LAYOUT,
  createChartTouchLayoutSignature,
  type ChartTouchLayout,
} from './ChartTouchOverlay';

export type NutrientChartDataPoint = {
  day: string;
  value: number;
};

type NutrientBarChartProps = {
  data: NutrientChartDataPoint[];
  isLoading: boolean;
  isError: boolean;
  range: TrendRange;
  /**
   * Drops the card this chart normally draws itself on, for a screen where
   * the chart is the content rather than one card among several.
   */
  bare?: boolean;
  nutrientLabel: string;
  unit: string;
  goal?: number;
};

const font = makeChartFont(11);

const formatYLabel = (value: number) => {
  if (value >= 1000) return formatChartYLabel(value);
  if (value % 1 !== 0)
    return formatLocalizedNumber(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  return formatChartYLabel(value);
};

const DEFAULT_TOOLTIP = '';

const NutrientTooltip: React.FC<{ text: string }> = ({ text }) => (
  <View className="h-6 justify-center mt-3 mb-1">
    <Text className="text-text-secondary text-sm text-center">{text}</Text>
  </View>
);

/**
 * Builds the tooltip copy from the semantically selected data point using the
 * current translator and application locale on every render, so an
 * already-visible tooltip can never retain stale copy after a language switch.
 */
export const buildNutrientTooltipText = (
  point: { day: string; value: number } | undefined,
  unit: string,
  t: ReturnType<typeof useTranslation>['t']
): string => {
  if (!point) return DEFAULT_TOOLTIP;
  const formattedVal = formatLocalizedNumber(point.value, {
    minimumFractionDigits: point.value % 1 !== 0 ? 1 : 0,
    maximumFractionDigits: point.value % 1 !== 0 ? 1 : 0,
  });
  return t('charts.tooltip', {
    defaultValue: '{{value}}{{unit}} consumed · {{date}}',
    value: formattedVal,
    unit,
    date: formatTooltipDate(point.day),
  });
};

const NutrientBarChart: React.FC<NutrientBarChartProps> = ({
  data,
  isLoading,
  isError,
  range,
  bare,
  nutrientLabel,
  unit,
  goal,
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

  const hasData = useMemo(() => data.some((d) => d.value > 0), [data]);

  const maxVal = useMemo(() => {
    const dataMax = Math.max(...data.map((d) => d.value), 0);
    if (goal && goal > 0) {
      return Math.max(dataMax, goal) * 1.1;
    }
    return undefined;
  }, [data, goal]);

  const formatXLabel = formatXLabelForRange(range);

  const [tooltipResetKey, setTooltipResetKey] = useState({ data, range });
  if (tooltipResetKey.data !== data || tooltipResetKey.range !== range) {
    setTooltipResetKey({ data, range });
    setSelectedIndex(null);
  }

  // Derive the presentation text from the selected point on every render, so
  // an already-visible tooltip reflects the current app language immediately.
  const selectedPoint = selectedIndex != null ? data[selectedIndex] : undefined;
  const tooltipText = buildNutrientTooltipText(selectedPoint, unit, t);

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
        {nutrientLabel} ({unit})
      </Text>

      <NutrientTooltip text={tooltipText} />

      {isLoading ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        </View>
      ) : isError ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('charts.nutrients.loadFailed', {
              defaultValue: 'Failed to load trend data',
            })}
          </Text>
        </View>
      ) : !hasData ? (
        <View className="h-50 justify-center items-center">
          <Text className="text-text-muted text-sm">
            {t('charts.nutrients.empty', {
              defaultValue: 'No logged intake for this period',
            })}
          </Text>
        </View>
      ) : (
        <View style={{ height: 175 }}>
          <CartesianChart
            data={data}
            xKey="day"
            yKeys={['value']}
            domain={maxVal ? { y: [0, maxVal] } : { y: [0] }}
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
            {({ points, chartBounds }) => {
              let goalY: number | null = null;
              if (goal && goal > 0 && maxVal && maxVal > 0) {
                const height = chartBounds.bottom - chartBounds.top;
                const calculatedY =
                  chartBounds.bottom - (goal / maxVal) * height;
                // Only render if it lies within the chart's visible drawing area
                if (
                  calculatedY >= chartBounds.top &&
                  calculatedY <= chartBounds.bottom
                ) {
                  goalY = calculatedY;
                }
              }

              return (
                <>
                  <ChartLayoutReporter
                    chartBounds={chartBounds}
                    points={points.value}
                    onChange={handleTouchLayoutChange}
                  />
                  <Bar
                    points={points.value}
                    chartBounds={chartBounds}
                    color={accentColor}
                    innerPadding={RANGE_INNER_PADDING[range]}
                    animate={{ type: 'timing', duration: 300 }}
                    roundedCorners={{ topLeft: 6, topRight: 6 }}
                  />
                  {goalY !== null && (
                    <SkiaLine
                      p1={{ x: chartBounds.left, y: goalY }}
                      p2={{ x: chartBounds.right, y: goalY }}
                      color="#10B981"
                      strokeWidth={1.5}
                    />
                  )}
                </>
              );
            }}
          </CartesianChart>
          <ChartTouchOverlay
            layout={touchLayout}
            onSelect={handleSelectBar}
            onClear={handleClearSelection}
            testIDPrefix="nutrient-touch-overlay"
          />
        </View>
      )}
    </ChartSurface>
  );
};

export default NutrientBarChart;
