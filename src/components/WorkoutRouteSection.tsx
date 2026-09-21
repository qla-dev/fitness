import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WorkoutGpsPoint } from '../types/healthRecords';
import RouteMap from './RouteMap';
import { DetailSectionHeading } from './WorkoutDetailsCard';

/**
 * The track an imported workout carried.
 *
 * Separate from RecordingSummary, which draws the map for sessions this app
 * recorded itself: those carry a different detail shape and a pile of recording
 * stats that an imported workout has no equivalent for. Sharing one component
 * would have meant a union of two payloads and a branch through every line of
 * it, for two blocks that happen to both contain a map.
 *
 * Points come off the provider already downsampled (see workoutTelemetry), so
 * there is no second thinning pass here.
 */
export default function WorkoutRouteSection({
  points,
}: {
  points: readonly WorkoutGpsPoint[];
}) {
  const { t } = useTranslation();
  // One fix is a location, not a route — drawing it would be a dot on a map.
  if (points.length < 2) return null;

  const segments = [points.map((p) => ({ latitude: p.lat, longitude: p.lon }))];

  return (
    <View className="py-2">
      <DetailSectionHeading
        title={t('activityDetail.map', { defaultValue: 'Map' })}
      />
      <View className="h-64 rounded-3xl overflow-hidden">
        <RouteMap
          center={{ latitude: points[0].lat, longitude: points[0].lon }}
          segments={segments}
        />
      </View>
    </View>
  );
}
