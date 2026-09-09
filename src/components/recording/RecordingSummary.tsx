import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Polyline } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { z } from 'zod';
import RouteMap from '../RouteMap';
import { RECORDING_DETAIL_TYPE } from '../../services/recording/types';
import { recordingSplits } from '../../services/recording/metrics';
import { recordingClock, routeSegments } from './format';
import { formatLocalizedNumber } from '../../localization';
import { usePreferences } from '../../hooks/usePreferences';
import { distanceFromKm } from '../../utils/unitConversions';
import type { ActivityDetailResponse } from '@workspace/shared';

const number = z.number().finite();
const nullable = number.nullable();
const pointSchema = z.object({
  timestamp: number,
  latitude: number.min(-90).max(90),
  longitude: number.min(-180).max(180),
  altitude: nullable,
  speed: number,
  distance: number,
  elapsed: number,
  segment: number,
  heartRate: nullable,
  cadence: nullable,
});
const detailSchema = z.object({
  version: z.literal(1),
  sport: z.enum(['run', 'ride']),
  maxSpeed: number,
  elevationGain: number,
  avgHeartRate: nullable,
  maxHeartRate: nullable,
  avgCadence: nullable,
  points: z.array(pointSchema),
  sensors: z.array(
    z.object({
      timestamp: number,
      heartRate: nullable,
      cadence: nullable,
      speed: nullable,
      wheelDistance: nullable,
    })
  ),
});

/** Render timestamped measurements without fabricating points in sensor gaps. */
function Trace({
  label,
  values,
}: {
  label: string;
  values: { timestamp: number; value: number }[];
}) {
  const color = useCSSVariable('--color-accent-primary') as string;
  if (values.length < 2) return null;
  const stride = Math.max(1, Math.ceil(values.length / 300));
  const min = values.reduce((n, v) => Math.min(n, v.value), Infinity);
  const max = values.reduce((n, v) => Math.max(n, v.value), -Infinity);
  const start = values[0].timestamp,
    end = values[values.length - 1].timestamp;
  const segments: string[][] = [[]];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i && v.timestamp - values[i - 1].timestamp > 15000) segments.push([]);
    if (i % stride && i !== values.length - 1) continue;
    segments[segments.length - 1].push(
      `${((v.timestamp - start) / Math.max(1, end - start)) * 300},${75 - ((v.value - min) / Math.max(1, max - min)) * 65}`
    );
  }
  return (
    <View
      className="py-2"
      accessible
      accessibilityLabel={`${label}: ${formatLocalizedNumber(min)} – ${formatLocalizedNumber(max)}`}
    >
      <Text className="text-text-secondary font-medium">{label}</Text>
      <Svg width="100%" height={85} viewBox="0 0 300 85">
        {segments.map((segment, index) => (
          <Polyline
            key={index}
            points={segment.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <Text className="text-text-muted text-xs">
        {formatLocalizedNumber(min, { maximumFractionDigits: 1 })} –{' '}
        {formatLocalizedNumber(max, { maximumFractionDigits: 1 })}
      </Text>
    </View>
  );
}

export default function RecordingSummary({
  details,
}: {
  details: ActivityDetailResponse[];
}) {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const unit = preferences?.default_distance_unit === 'miles' ? 'miles' : 'km';
  const detail = useMemo(() => {
    const blob = details.find(
      (d) => d.detail_type === RECORDING_DETAIL_TYPE
    )?.detail_data;
    const parsed = detailSchema.safeParse(blob);
    return parsed.success ? parsed.data : null;
  }, [details]);
  if (!detail) return null;
  const label =
    unit === 'miles'
      ? t('recording.miles', { defaultValue: 'mi' })
      : t('recording.km', { defaultValue: 'km' });
  const fmt = (value: number) =>
    formatLocalizedNumber(value, { maximumFractionDigits: 1 });
  const splits = recordingSplits(
    detail.points,
    unit === 'miles' ? 1609.344 : 1000
  );
  return (
    <View className="gap-2 py-4">
      <Text className="text-text-primary font-semibold">
        {t('recording.recordedSession', { defaultValue: 'Recorded session' })}
      </Text>
      {detail.points.length > 0 && (
        <View className="h-64 rounded-xl overflow-hidden">
          <RouteMap
            center={detail.points[0]}
            segments={routeSegments(detail.points)}
          />
        </View>
      )}
      <Text className="text-text-secondary">
        {t('recording.maxSpeed', { defaultValue: 'Max speed' })}:{' '}
        {fmt(distanceFromKm(detail.maxSpeed * 3.6, unit))} {label}/h
      </Text>
      <Text className="text-text-secondary">
        {t('recording.elevation', { defaultValue: 'Elevation gain' })}:{' '}
        {fmt(
          unit === 'miles'
            ? detail.elevationGain * 3.28084
            : detail.elevationGain
        )}{' '}
        {unit === 'miles'
          ? t('recording.feet', { defaultValue: 'ft' })
          : t('recording.meters', { defaultValue: 'm' })}
      </Text>
      {detail.avgHeartRate !== null && (
        <Text className="text-text-secondary">
          {t('recording.avgHeartRate', { defaultValue: 'Average heart rate' })}:{' '}
          {fmt(detail.avgHeartRate)}{' '}
          {t('recording.bpm', { defaultValue: 'bpm' })}
        </Text>
      )}
      {detail.maxHeartRate !== null && (
        <Text className="text-text-secondary">
          {t('recording.maxHeartRate', { defaultValue: 'Maximum heart rate' })}:{' '}
          {fmt(detail.maxHeartRate)}{' '}
          {t('recording.bpm', { defaultValue: 'bpm' })}
        </Text>
      )}
      {detail.avgCadence !== null && (
        <Text className="text-text-secondary">
          {t('recording.avgCadence', { defaultValue: 'Average cadence' })}:{' '}
          {fmt(detail.avgCadence)} {t('recording.rpm', { defaultValue: 'rpm' })}
        </Text>
      )}
      <Trace
        label={t('recording.heartRate', { defaultValue: 'Heart rate' })}
        values={detail.sensors.flatMap((s) =>
          s.heartRate === null
            ? []
            : [{ timestamp: s.timestamp, value: s.heartRate }]
        )}
      />
      <Trace
        label={t('recording.speed', { defaultValue: 'Speed' })}
        values={detail.points.map((p) => ({
          timestamp: p.timestamp,
          value: distanceFromKm(p.speed * 3.6, unit),
        }))}
      />
      {detail.sport === 'ride' && (
        <Trace
          label={t('recording.cadence', { defaultValue: 'Cadence' })}
          values={detail.sensors.flatMap((s) =>
            s.cadence === null
              ? []
              : [{ timestamp: s.timestamp, value: s.cadence }]
          )}
        />
      )}
      {splits.length > 0 && (
        <View className="gap-1">
          <Text className="text-text-primary font-semibold">
            {t('recording.splits', { defaultValue: 'Splits' })}
          </Text>
          {splits.map((split, i) => (
            <View key={i} className="flex-row justify-between">
              <Text className="text-text-secondary">
                {fmt(i + 1)} {label}
              </Text>
              <Text className="text-text-primary">
                {recordingClock(split.seconds)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
