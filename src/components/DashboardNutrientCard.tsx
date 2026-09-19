import DashboardCardTitle from './DashboardCardTitle';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatLocalizedNumber } from '../localization';
import Icon, { type IconName } from './Icon';

const CORE_ORDER = ['calories', 'protein', 'carbs', 'fat', 'dietary_fiber'];
const METRIC_ICONS: Record<string, IconName> = {
  calories: 'flame',
  protein: 'exercise-weights',
  carbs: 'food',
  fat: 'flame',
  dietary_fiber: 'wellness',
};

interface NutrientMetric {
  key: string;
  label: string;
  consumed: number;
  goal?: number;
  progress?: number;
  color: string;
  unit: string;
}

function Rings({
  metrics,
  size = 144,
}: {
  metrics: NutrientMetric[];
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 144 144" accessible={false}>
      {metrics.map((metric, index) => {
        const radius = 61 - index * 11;
        const length = 2 * Math.PI * radius;
        const progress = Math.min(
          1,
          Math.max(
            0,
            metric.progress ??
              (metric.goal && metric.goal > 0
                ? metric.consumed / metric.goal
                : 0)
          )
        );
        return (
          <Fragment key={metric.key}>
            <Circle
              cx={72}
              cy={72}
              r={radius}
              fill="none"
              stroke={metric.color}
              strokeOpacity={0.18}
              strokeWidth={8}
            />
            {progress > 0 && (
              <Circle
                cx={72}
                cy={72}
                r={radius}
                fill="none"
                stroke={metric.color}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${length * progress} ${length}`}
                rotation={-90}
                origin="72, 72"
              />
            )}
          </Fragment>
        );
      })}
    </Svg>
  );
}

export default function DashboardNutrientCard({
  metrics,
  remaining,
  burned,
  onDetails,
}: {
  metrics: NutrientMetric[];
  remaining: number;
  burned: number;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  const number = (value: number) =>
    formatLocalizedNumber(value, { maximumFractionDigits: 0 });
  const value = (metric: NutrientMetric) =>
    `${number(metric.consumed)}${metric.goal && metric.goal > 0 ? `/${number(metric.goal)}` : ''} ${metric.unit}`;
  const mainMetrics = CORE_ORDER.flatMap((key) =>
    metrics.filter((metric) => metric.key === key)
  );
  const extraMetrics = metrics.filter(
    (metric) => !CORE_ORDER.includes(metric.key)
  );
  const metricLabel = (metric: NutrientMetric) => (
    <View className="flex-row items-center gap-2">
      <Icon
        name={METRIC_ICONS[metric.key] ?? 'food'}
        size={18}
        color={metric.color}
      />
      <Text className="text-text-secondary text-base flex-shrink">
        {metric.label}
      </Text>
    </View>
  );
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={onDetails}
        className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3"
      >
        <View className="flex-row justify-between items-center mb-3">
          <DashboardCardTitle>
            {t('dashboard.nutrientRings', { defaultValue: 'Nutrient Rings' })}
          </DashboardCardTitle>
          <Text className="text-accent-primary text-base">
            {t('common.details', { defaultValue: 'Details' })}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Rings metrics={mainMetrics} />
          <View className="flex-1 gap-2">
            {[['calories'], ['protein', 'carbs'], ['fat', 'dietary_fiber']].map(
              (row) => (
                <View key={row[0]} className="flex-row gap-2">
                  {row.map((key) => {
                    const metric = mainMetrics.find((item) => item.key === key);
                    return (
                      <View key={key} className="flex-1 min-w-0">
                        {metric && (
                          <>
                            {metricLabel(metric)}
                            <Text
                              style={{ color: metric.color }}
                              className="font-bold text-xl"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {value(metric)}
                            </Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )
            )}
          </View>
        </View>
      </Pressable>
      <View className="flex-row gap-3 mb-3">
        {[
          {
            key: 'remaining',
            label: t('dashboard.remainingTitle', { defaultValue: 'Remaining' }),
            value: remaining,
          },
          {
            key: 'burned',
            label: t('dashboard.burned', { defaultValue: 'Burned' }),
            value: burned,
          },
        ].map((stat) => (
          <View
            key={stat.key}
            className="flex-1 bg-surface rounded-2xl px-4 pt-3 pb-4"
          >
            <View className="flex-row items-center gap-2">
              <Icon
                name={stat.key === 'burned' ? 'flame' : 'clock'}
                size={18}
                color={metrics[0]?.color ?? '#FF375F'}
              />
              <DashboardCardTitle>{stat.label}</DashboardCardTitle>
            </View>
            <Text className="text-text-primary text-3xl font-semibold mt-1">
              {number(stat.value)}
            </Text>
            <Text className="text-text-muted text-sm mt-1">
              {t('dashboard.activityKcal', { defaultValue: 'kcal' })}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap justify-between">
        {extraMetrics.map((metric) => (
          <Pressable
            key={metric.key}
            accessibilityRole="button"
            onPress={onDetails}
            style={{ width: '48%' }}
            className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3 items-center"
          >
            <View className="mb-3">{metricLabel(metric)}</View>
            <Rings metrics={[metric]} size={80} />
            <Text
              style={{ color: metric.color }}
              className="font-bold text-lg mt-2"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {value(metric)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
