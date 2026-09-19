import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';
import { withAlpha } from '../utils/colors';

/**
 * A training option as a full-width card rather than a list row.
 *
 * Modelled on the Workout app's cards: the whole tile is the start button, the
 * name is set large enough to read at arm's length in a gym, and the secondary
 * controls sit along the bottom where a thumb reaches them. A list row asks you
 * to hit a 44pt strip; this asks you to hit the card.
 *
 * Tinted with the app's own accent rather than that app's green — the shape is
 * the borrowed part, not the palette.
 */
export default function TrainingCard({
  title,
  subtitle,
  imageUri,
  onPress,
  onInfo,
  starting = false,
  testID,
}: {
  title: string;
  /** A short qualifier under the name — the category, or what it works. */
  subtitle?: string | null;
  /** The exercise's own artwork; a glyph stands in when there is none. */
  imageUri?: string | null;
  onPress: () => void;
  /** Opens the detail view. The pill is left out when nothing is passed. */
  onInfo?: () => void;
  /** Swaps the start glyph for a spinner-like disabled state. */
  starting?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const [accent, surface] = useCSSVariable([
    '--color-accent-primary',
    '--color-surface',
  ]) as string[];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={starting}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      className="rounded-3xl p-4 mb-3 overflow-hidden"
      style={{
        backgroundColor: withAlpha(accent, 0.12),
        opacity: starting ? 0.6 : 1,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center overflow-hidden"
          style={{ backgroundColor: withAlpha(surface, 0.6) }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Icon name="exercise-running" size={28} color={accent} />
          )}
        </View>
        <View className="flex-1" />
        {/* The start affordance. The card carries the press — this says so. */}
        <View
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: accent }}
          pointerEvents="none"
        >
          <Icon name="play" size={20} color={surface} />
        </View>
      </View>

      <Text
        className="text-text-primary text-2xl font-bold mt-3"
        numberOfLines={2}
      >
        {title}
      </Text>

      <View className="flex-row items-center gap-2 mt-3">
        {onInfo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('trainingCard.details', {
              defaultValue: 'Details',
            })}
            hitSlop={8}
            onPress={() => {
              fireSelectionHaptic();
              onInfo();
            }}
            className="flex-1 h-10 rounded-2xl items-center justify-center"
            style={{ backgroundColor: withAlpha(surface, 0.6) }}
          >
            <Icon name="info-circle" size={20} color={accent} />
          </Pressable>
        ) : null}
        {subtitle ? (
          <View
            className="flex-1 h-10 rounded-2xl items-center justify-center px-3"
            style={{ backgroundColor: withAlpha(surface, 0.6) }}
          >
            <Text className="text-text-secondary text-sm" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
