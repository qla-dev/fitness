import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { ActivityExtraBlock } from '../constants/activityExtras';
import type { RecordingSource } from '../utils/activityRecordingSource';
import DashboardCardTitle from './DashboardCardTitle';
import Icon from './Icon';

/**
 * Where the session was measured, stated plainly.
 *
 * A badge rather than a line of body text: it qualifies every number on the
 * screen rather than being one of them, and the user reads it once to decide
 * how much to trust the rest. `unknown` renders nothing — a badge saying
 * "unknown" is worse than no badge, because it draws the eye to a non-answer.
 */
export function RecordingSourceBadge({
  source,
  hasTrack,
}: {
  source: RecordingSource;
  hasTrack: boolean;
}) {
  const { t } = useTranslation();
  const muted = useCSSVariable('--color-text-muted') as string;
  if (source === 'unknown') return null;

  const label =
    source === 'watch'
      ? t('activityDetail.sourceWatch', { defaultValue: 'Recorded on watch' })
      : source === 'app'
        ? t('activityDetail.sourceApp', { defaultValue: 'Recorded in qla.fit' })
        : t('activityDetail.sourcePhone', {
            defaultValue: 'Recorded on phone',
          });

  return (
    <View className="flex-row items-center gap-2 mt-1">
      <Icon
        name={source === 'watch' ? 'device-watch' : 'device-phone'}
        size={14}
        color={muted}
      />
      <Text className="text-sm text-text-muted" numberOfLines={1}>
        {label}
      </Text>
      {hasTrack ? (
        <>
          <Text className="text-sm text-text-muted">·</Text>
          <Icon name="gps-track" size={14} color={muted} />
          <Text className="text-sm text-text-muted">
            {t('activityDetail.hasTrack', { defaultValue: 'GPS track' })}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** A pitch-shaped occupancy grid. Opacity carries the value; no legend, because
 *  the only question it answers is "where was I", not "how much exactly". */
function Heatmap({ grid, color }: { grid: number[][]; color: string }) {
  return (
    <View className="rounded-2xl overflow-hidden border border-border">
      {grid.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((cell, c) => (
            <View
              key={c}
              className="flex-1"
              style={{
                aspectRatio: 1,
                backgroundColor: color,
                opacity: 0.08 + cell * 0.62,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Shooting({
  block,
  color,
}: {
  block: Extract<ActivityExtraBlock, { kind: 'shooting' }>;
  color: string;
}) {
  const { t } = useTranslation();
  const pct = (made: number, attempted: number) =>
    attempted > 0 ? Math.round((made / attempted) * 100) : 0;
  return (
    <View>
      <Text style={{ color }} className="text-3xl font-bold mb-1">
        {pct(block.made, block.attempted)}%
      </Text>
      <Text className="text-sm text-text-muted mb-3">
        {t('activityExtras.madeOf', {
          defaultValue: '{{made}} of {{attempted}} shots',
          made: block.made,
          attempted: block.attempted,
        })}
      </Text>
      {block.zones.map((zone) => (
        <View
          key={zone.zone}
          className="flex-row items-center justify-between py-1.5 border-t border-border"
        >
          <Text
            className="text-base text-text-primary flex-1"
            numberOfLines={1}
          >
            {zone.zone}
          </Text>
          <Text className="text-sm text-text-muted mr-3">
            {zone.made}/{zone.attempted}
          </Text>
          <Text style={{ color }} className="text-base font-semibold">
            {pct(zone.made, zone.attempted)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The sport-specific blocks under a session's standard stats.
 *
 * Purely presentational — what a session earns is decided by
 * `constants/activityExtras`, so adding a sport means adding a builder there,
 * not a branch here or in the detail screen.
 */
export default function ActivityExtras({
  blocks,
}: {
  blocks: readonly ActivityExtraBlock[];
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  if (blocks.length === 0) return null;

  return (
    <View className="mt-2">
      {blocks.map((block) => (
        <View key={block.titleKey} className="bg-surface rounded-2xl p-4 mb-3">
          <View className="mb-3">
            <DashboardCardTitle>
              {t(block.titleKey, { defaultValue: block.defaultTitle })}
            </DashboardCardTitle>
          </View>
          {block.kind === 'heatmap' ? (
            <Heatmap grid={block.grid} color={accent} />
          ) : block.kind === 'shooting' ? (
            <Shooting block={block} color={accent} />
          ) : (
            <View className="flex-row flex-wrap">
              {block.items.map((item) => (
                <View key={item.label} className="w-1/2 mb-3">
                  <Text className="text-sm text-text-muted" numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text
                    style={{ color: accent }}
                    className="text-xl font-semibold"
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
