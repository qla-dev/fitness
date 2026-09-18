import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import TileIconSlot from './TileIconSlot';
import WaterBottleIcon from './icons/measurements/WaterBottleIcon';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * Hydration in the tracker grid, shaped like the measurement tiles beside it.
 *
 * The bottle fills with the share of the day's goal that has been drunk, so
 * the tile reads at a glance without the number — which is the one thing a
 * measurement tile cannot do, since weight has no "full".
 */
export default function WaterTile({
  consumedMl,
  goalMl,
  onPress,
}: {
  consumedMl: number;
  goalMl: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [accentPrimary, iconDecorative, mutedColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
    '--color-text-muted',
  ]) as [string, string, string];

  const fill = goalMl > 0 ? consumedMl / goalMl : 0;
  const amount = formatLocalizedNumber(consumedMl, {
    maximumFractionDigits: 0,
  });

  return (
    <Pressable
      testID="water-tile"
      accessibilityRole="button"
      accessibilityLabel={t('measurements.water', { defaultValue: 'Water' })}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
    >
      <View className="bg-surface rounded-xl py-3 px-3">
        {/* The same corner row the measurement tiles carry, so the four line
            up. Left says what the goal is; there is no day-before comparison
            to make, so the right keeps the flat rule. */}
        <View
          className="flex-row items-center justify-between"
          style={{ minHeight: 16 }}
        >
          <Text
            className="text-[10px] text-text-muted flex-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {goalMl > 0
              ? t('measurements.waterGoal', {
                  defaultValue: 'Goal {{goal}} ml',
                  goal: formatLocalizedNumber(goalMl, {
                    maximumFractionDigits: 0,
                  }),
                })
              : t('measurements.noGoal', { defaultValue: 'No goal set' })}
          </Text>
          <View
            style={{ width: 10, height: 2, backgroundColor: mutedColor }}
            accessibilityElementsHidden
          />
        </View>
        <View className="flex-row items-center">
          <TileIconSlot>
            <WaterBottleIcon
              size={56}
              color={iconDecorative}
              accentColor={accentPrimary}
              fill={fill}
            />
          </TileIconSlot>
          <View className="flex-1 ml-2 items-center">
            <Text
              className={`text-lg font-bold ${
                consumedMl > 0 ? 'text-text-primary' : 'text-text-muted'
              }`}
              numberOfLines={1}
            >
              {amount}
            </Text>
            <Text className="text-sm text-text-secondary" numberOfLines={1}>
              {t('measurements.water', { defaultValue: 'Water' })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
