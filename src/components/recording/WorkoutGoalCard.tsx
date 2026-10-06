import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';
import { canUseLiquidGlass } from '../../utils/liquidGlass';
import { fireSelectionHaptic } from '../../services/haptics';
import { withAlpha } from '../../utils/colors';

/**
 * One way to start a session: a tinted card naming the target, with a round
 * play control that starts it. Workout setup lists one per goal; MarkAI shows
 * one under a Moving help reply for the session it suggests.
 */
export default function WorkoutGoalCard({
  color,
  icon,
  label,
  value,
  onEdit,
  onStart,
  startDisabled,
  className = 'mb-3',
}: {
  color: string;
  icon: IconName;
  label: string;
  value?: string;
  /** Tapping the card itself; without it only the play control acts. */
  onEdit?: () => void;
  onStart: () => void;
  startDisabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const surface = useCSSVariable('--color-surface') as string;
  const usesGlass = canUseLiquidGlass();
  return (
    <Pressable
      accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityLabel={
        onEdit
          ? t('workoutSetup.editGoal', {
              defaultValue: 'Edit {{goal}}',
              goal: label,
            })
          : undefined
      }
      disabled={!onEdit}
      onPress={() => {
        if (!onEdit) return;
        fireSelectionHaptic();
        onEdit();
      }}
      className={`rounded-3xl p-4 ${className}`}
      style={{ backgroundColor: withAlpha(color, 0.16) }}
    >
      <View className="flex-row items-center">
        <Icon name={icon} size={30} color={color} />
        <View className="flex-1 ml-3">
          <Text className="text-text-primary text-xl font-bold">{label}</Text>
          {value ? (
            <Text
              className="text-base font-semibold mt-0.5"
              style={{ color }}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
        </View>
        {/* Glass, like the tab bar: the start control is the one thing on the
            card that acts on its own, so it gets the material that reacts to
            a press rather than a flat disc. */}
        <LiquidGlassSurface
          isInteractive
          tintColor={color}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workoutSetup.startGoal', {
              defaultValue: 'Start {{goal}}',
              goal: label,
            })}
            disabled={startDisabled}
            onPress={onStart}
            className="w-full h-full items-center justify-center"
            style={{
              backgroundColor: usesGlass ? undefined : color,
              opacity: startDisabled ? 0.4 : 1,
            }}
          >
            <Icon name="play" size={24} color={surface} />
          </Pressable>
        </LiquidGlassSurface>
      </View>
    </Pressable>
  );
}
