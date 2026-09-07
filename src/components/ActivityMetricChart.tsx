import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import Icon, { type IconName } from './Icon';

interface ActivityMetricChartProps {
  title: string;
  icon: IconName;
  color: string;
  value?: number | null;
  goal?: number;
  unit: string;
  /** 24 hourly totals for the selected local day; null means unavailable. */
  hourlyValues?: readonly (number | null)[];
  /** Standing uses full-height bars for hours with standing activity. */
  binary?: boolean;
}

export default function ActivityMetricChart({
  title,
  icon,
  color,
  value,
  goal,
  unit,
  hourlyValues,
  binary = false,
}: ActivityMetricChartProps) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const number = (amount: number) =>
    formatLocalizedNumber(amount, { maximumFractionDigits: 0 });
  const hasSamples =
    hourlyValues?.some((amount) => amount != null && Number.isFinite(amount)) ??
    false;
  const max = Math.max(
    1,
    ...(hourlyValues ?? []).filter(
      (amount): amount is number => amount != null && Number.isFinite(amount)
    )
  );
  const hourFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={20} color={color} />
        <DashboardCardTitle>{title}</DashboardCardTitle>
      </View>
      <Text style={{ color }} className="text-3xl font-semibold mt-1 mb-3">
        {value == null ? '—' : number(value)}
        {goal && goal > 0 ? `/${number(goal)}` : ''} {unit}
      </Text>
      <View style={{ height: 88 }}>
        <Svg
          width="100%"
          height={88}
          viewBox="0 0 288 88"
          preserveAspectRatio="none"
          accessible={false}
        >
          {[8, 32, 56, 80].map((y) => (
            <Line
              key={y}
              x1={0}
              x2={288}
              y1={y}
              y2={y}
              stroke={color}
              strokeOpacity={0.18}
              strokeDasharray="1 3"
            />
          ))}
          {Array.from({ length: 24 }, (_, hour) => {
            const amount = hourlyValues?.[hour];
            if (amount == null || !Number.isFinite(amount) || amount <= 0)
              return null;
            const height = binary ? 72 : Math.max(2, (amount / max) * 72);
            return (
              <Rect
                key={hour}
                x={hour * 12 + 2}
                y={80 - height}
                width={8}
                height={height}
                rx={binary ? 4 : 1}
                fill={color}
              />
            );
          })}
        </Svg>
        {!hasSamples && (
          <View className="absolute inset-0 items-center justify-center px-4">
            <Text className="text-text-muted text-sm text-center bg-surface px-2 py-1">
              {t('dashboard.hourlyActivityUnavailable', {
                defaultValue: 'Hourly data unavailable',
              })}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-row mt-1">
        {[0, 6, 12, 18].map((hour) => (
          <Text key={hour} className="text-text-muted text-xs flex-1">
            {hourFormatter.format(new Date(2000, 0, 1, hour))}
          </Text>
        ))}
      </View>
    </View>
  );
}
