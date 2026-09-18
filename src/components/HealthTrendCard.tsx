import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import DashboardCardTitle from './DashboardCardTitle';
import Icon, { type IconName } from './Icon';

interface HealthTrendCardProps {
  title: string;
  icon: IconName;
  color: string;
  description: string;
  average: number | null;
  averageLabel: string;
  values: readonly (number | null)[];
  days: number;
  line?: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Opens this trend's own screen, where the full chart lives. */
  onOpen: () => void;
}

/**
 * A trend's summary: its average, a sparkline, and a way through to the chart.
 *
 * It used to unfold in place. The interactive chart is a screenful on its own —
 * scrubbable, with its own range — and opening one pushed every card below it
 * off the screen, so reading two trends meant closing the first. It now sits on
 * its own screen and this card is the link to it, which is also why the chevron
 * points the way it does.
 */
export default function HealthTrendCard({
  title,
  icon,
  color,
  description,
  average,
  averageLabel,
  values,
  days,
  line = false,
  isLoading,
  isError,
  onOpen,
}: HealthTrendCardProps) {
  const { t } = useTranslation();
  const valid = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  const min = line && valid.length ? Math.min(...valid) * 0.98 : 0;
  const max = Math.max(min + 1, ...valid) * 1.02;
  const y = (value: number) => 108 - ((value - min) / (max - min)) * 92;
  const x = (index: number) =>
    5 + (index / Math.max(1, values.length - 1)) * 290;
  return (
    <View className="bg-surface rounded-3xl p-4 mb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onOpen}
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Icon name={icon} size={20} color={color} />
          <View className="flex-1">
            <DashboardCardTitle>{title}</DashboardCardTitle>
          </View>
          <Icon name="chevron-forward" size={18} color={color} />
        </View>
        {isLoading ? (
          <ActivityIndicator color={color} />
        ) : isError ? (
          <Text className="text-text-muted text-base">
            {t('dashboard.trendLoadFailed', {
              defaultValue: 'Unable to load this trend.',
            })}
          </Text>
        ) : average == null ? (
          <Text className="text-text-muted text-base">
            {t('dashboard.trendNoData', {
              defaultValue: 'No recorded data for this period.',
            })}
          </Text>
        ) : (
          <>
            <Text className="text-text-primary text-lg font-semibold mb-4">
              {description}
            </Text>
            <View className="border-t border-border pt-3">
              <Text style={{ color }} className="text-sm font-semibold mb-1">
                {averageLabel}
              </Text>
              <Svg
                width="100%"
                height={120}
                viewBox="0 0 300 120"
                preserveAspectRatio="none"
                accessible={false}
              >
                {line ? (
                  <>
                    <Polyline
                      points={values
                        .flatMap((value, index) =>
                          value == null ? [] : [`${x(index)},${y(value)}`]
                        )
                        .join(' ')}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.3}
                      strokeWidth={2}
                    />
                    {values.map((value, index) =>
                      value == null ? null : (
                        <Circle
                          key={index}
                          cx={x(index)}
                          cy={y(value)}
                          r={2}
                          fill={color}
                          opacity={0.4}
                        />
                      )
                    )}
                  </>
                ) : (
                  values.map((value, index) =>
                    value == null ? null : (
                      <Rect
                        key={index}
                        x={(index * 300) / values.length + 1}
                        y={y(value)}
                        width={Math.max(1, 300 / values.length - 3)}
                        height={Math.max(0, 108 - y(value))}
                        rx={2}
                        fill={color}
                        opacity={0.25}
                      />
                    )
                  )
                )}
                <Line
                  x1={0}
                  x2={300}
                  y1={y(average)}
                  y2={y(average)}
                  stroke={color}
                  strokeWidth={3}
                />
              </Svg>
            </View>
          </>
        )}
        <Text style={{ color }} className="text-sm font-medium mt-2">
          {t('dashboard.trendPeriod', {
            count: days,
            defaultValue: 'Last {{count}} days',
            defaultValue_one: 'Last {{count}} day',
            defaultValue_other: 'Last {{count}} days',
          })}
        </Text>
      </Pressable>
    </View>
  );
}
