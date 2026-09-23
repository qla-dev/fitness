import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import ChartTouchOverlay, { type ChartTouchLayout } from './ChartTouchOverlay';

export type FactSeries = {
  label: string;
  value: number | null;
  values?: readonly (number | null)[];
};

/** Compact comparisons, split trend bars, or two cumulative lines. */
export default function SmallGraphFact({
  title,
  body,
  icon,
  color,
  series,
  formatValue,
  variant = 'comparison',
  labels,
  emptyText,
}: {
  title: string;
  body: string;
  icon: IconName;
  color: string;
  series: readonly FactSeries[];
  formatValue: (value: number) => string;
  variant?: 'comparison' | 'trend' | 'line';
  labels?: readonly string[];
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const muted = useCSSVariable('--color-text-muted') as string;
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState<{
    key: string;
    index: number;
  } | null>(null);
  const selectionKey = JSON.stringify(series);
  const selected =
    selection && selection.key === selectionKey ? selection.index : null;
  const values =
    variant === 'trend'
      ? series.flatMap((s) => s.values ?? [])
      : Array.from(
          { length: Math.max(0, ...series.map((s) => s.values?.length ?? 0)) },
          (_, i) => series[0]?.values?.[i] ?? null
        );
  const count = values.length;
  const max = Math.max(
    1,
    ...series.flatMap((s) => [
      s.value ?? 0,
      ...(s.values ?? []).map((v) => v ?? 0),
    ])
  );
  const x = (index: number) =>
    6 + (index + 0.5) * (Math.max(0, width - 12) / Math.max(1, count));
  const y = (value: number) => 128 - (value / max) * 104;
  const layout: ChartTouchLayout = {
    chartBounds: { left: 0, right: width, top: 0, bottom: 136 },
    points: values.map((v, i) => ({
      x: x(i),
      y: y(v ?? 0),
      xValue: i,
      yValue: v,
    })),
  };
  const hasData = series.some((s) => s.value != null);
  const selectedValues =
    selected == null
      ? ''
      : variant === 'line'
        ? series
            .map(
              (s) =>
                `${s.label}: ${s.values?.[selected] == null ? '—' : formatValue(s.values[selected]!)}`
            )
            .join(' · ')
        : values[selected] == null
          ? '—'
          : formatValue(values[selected]!);
  return (
    <View className="bg-surface rounded-xl p-4 mb-4">
      <View className="flex-row items-center gap-1.5 mb-3">
        <Icon name={icon} size={18} color={color} />
        <Text className="text-sm font-semibold" style={{ color }}>
          {title}
        </Text>
      </View>
      <Text className="text-lg font-semibold text-text-primary mb-3">
        {body}
      </Text>
      <View className="border-t border-border-subtle pt-3">
        {variant === 'comparison' ? (
          series.map((s, i) => (
            <View key={s.label} className={i ? 'mt-4' : ''}>
              <Text className="text-2xl font-semibold text-text-primary mb-1">
                {s.value == null ? '—' : formatValue(s.value)}
              </Text>
              <View
                className="rounded-md overflow-hidden bg-raised"
                style={{ minHeight: 28 }}
              >
                <View
                  style={{
                    position: 'absolute',
                    height: '100%',
                    width: `${s.value == null || s.value === 0 ? 0 : Math.max(2, (s.value / max) * 100)}%`,
                    backgroundColor: i ? muted : color,
                    opacity: 0.3,
                  }}
                />
                <Text className="text-sm font-semibold text-text-primary px-2 py-1">
                  {s.label}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <>
            <View className="flex-row gap-3">
              {series.map((s, i) => (
                <View key={s.label} className="flex-1">
                  <Text className="text-xs text-text-secondary">{s.label}</Text>
                  <Text
                    className="text-xl font-semibold"
                    style={{ color: i ? muted : color }}
                  >
                    {s.value == null ? '—' : formatValue(s.value)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{ height: variant === 'line' ? 48 : 24 }}
              accessibilityLiveRegion="polite"
            >
              <Text
                className="text-xs text-text-secondary"
                numberOfLines={variant === 'line' ? 2 : 1}
              >
                {selected == null
                  ? ''
                  : `${labels?.[selected] ?? ''} · ${selectedValues}`}
              </Text>
            </View>
            <View
              onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
              style={{ height: 136 }}
              testID="fact-plot"
            >
              <Svg width={width} height={136} accessible={false}>
                {variant === 'trend' ? (
                  <>
                    {values.map((v, i) =>
                      v == null ? null : (
                        <Rect
                          key={i}
                          x={
                            x(i) -
                            Math.max(
                              1,
                              ((width - 12) / Math.max(1, count)) * 0.3
                            )
                          }
                          y={y(v)}
                          width={Math.max(
                            1,
                            ((width - 12) / Math.max(1, count)) * 0.6
                          )}
                          height={128 - y(v)}
                          rx={2}
                          fill={muted}
                          opacity={0.22}
                        />
                      )
                    )}
                    {series.map((s, i) => {
                      const offset = series
                        .slice(0, i)
                        .reduce(
                          (n, previous) => n + (previous.values?.length ?? 0),
                          0
                        );
                      return s.value == null ? null : (
                        <Line
                          key={s.label}
                          x1={x(offset)}
                          x2={x(offset + (s.values?.length ?? 1) - 1)}
                          y1={y(s.value)}
                          y2={y(s.value)}
                          stroke={i ? color : muted}
                          strokeWidth={4}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </>
                ) : (
                  series.map((s, i) => (
                    <Polyline
                      key={s.label}
                      points={(s.values ?? [])
                        .flatMap((v, j) =>
                          v == null ? [] : [`${x(j)},${y(v)}`]
                        )
                        .join(' ')}
                      fill="none"
                      stroke={i ? muted : color}
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))
                )}
                {variant === 'line' && selected != null
                  ? series.map((s, i) =>
                      s.values?.[selected] == null ? null : (
                        <Circle
                          key={s.label}
                          cx={x(selected)}
                          cy={y(s.values[selected]!)}
                          r={4}
                          fill={i ? muted : color}
                        />
                      )
                    )
                  : null}
              </Svg>
              <ChartTouchOverlay
                layout={layout}
                selectedIndex={selected}
                onSelect={(index) => setSelection({ key: selectionKey, index })}
                onClear={() => setSelection(null)}
                testIDPrefix="fact-touch-overlay"
              />
            </View>
            {labels?.length ? (
              <View className="flex-row justify-between mt-1">
                <Text className="text-xs text-text-muted">{labels[0]}</Text>
                <Text className="text-xs text-text-muted">
                  {labels[labels.length - 1]}
                </Text>
              </View>
            ) : null}
          </>
        )}
        {!hasData ? (
          <Text className="text-sm text-text-muted mt-3">
            {emptyText ??
              t('goalFacts.noData', {
                defaultValue:
                  'Your comparisons will appear as you record more data.',
              })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
