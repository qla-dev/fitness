import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
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
 *
 * A tap drinks. Hydration is the one tile on the grid that is logged several
 * times a day and always in the same direction, so putting a screen between
 * the thumb and the serving costs three taps for what is one fact. Everything
 * rarer — taking a serving back, moving the goal — is on the long press, where
 * the system draws the menu itself.
 */
export default function WaterTile({
  consumedMl,
  goalMl,
  onPress,
  onDecrease,
  onChangeGoal,
}: {
  consumedMl: number;
  goalMl: number;
  onPress: () => void;
  /**
   * Takes one serving back. Supplying this and {@link onChangeGoal} is what
   * puts the tile on a long-press menu; without them it stays a plain tile,
   * which is what the More sheet wants — there a tap picks the row.
   */
  onDecrease?: () => void;
  onChangeGoal?: () => void;
}) {
  const { t } = useTranslation();
  const [accentPrimary, iconDecorative, mutedColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
    '--color-text-muted',
  ]) as [string, string, string];

  // The menu dismisses itself with an animation, and a navigation that starts
  // inside that animation lands on a screen the menu is still drawn over. The
  // same wait FoodRowMenu takes, for the same reason.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The menu's trigger is a SwiftUI host that sizes itself to its content, so
  // it takes no width from the grid cell and a percentage has nothing to
  // resolve against — the card came out narrower than every tile around it.
  // Measuring the cell and handing the host that number is what FoodRowMenu
  // does, for the same reason.
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    []
  );

  const hasMenu = Boolean(onDecrease || onChangeGoal);
  const fill = goalMl > 0 ? consumedMl / goalMl : 0;
  const amount = formatLocalizedNumber(consumedMl, {
    maximumFractionDigits: 0,
  });

  const tile = (
    <Pressable
      testID="water-tile"
      accessibilityRole="button"
      accessibilityLabel={t('measurements.water', { defaultValue: 'Water' })}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      // The system opens the menu from its own long-press recognizer, which
      // does not cancel this one: holding the tile poured a serving as well.
      // Claiming the long press here is what suppresses the tap — Pressable
      // drops onPress once onLongPress has fired — and it must land before the
      // menu appears, so it waits less than UIKit's own half second.
      onLongPress={hasMenu ? () => {} : undefined}
      delayLongPress={300}
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
              {t('measurements.waterAmount', {
                defaultValue: '{{amount}} ml',
                amount,
              })}
            </Text>
            <Text className="text-sm text-text-secondary" numberOfLines={1}>
              {t('measurements.water', { defaultValue: 'Water' })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (!onDecrease && !onChangeGoal) return tile;

  const actions: MenuAction[] = [
    ...(onDecrease
      ? [
          {
            id: 'decrease',
            title: t('measurements.waterDecrease', {
              defaultValue: 'Decrease',
            }),
            image: 'minus.circle' as const,
            attributes: { disabled: consumedMl <= 0 },
          },
        ]
      : []),
    ...(onChangeGoal
      ? [
          {
            id: 'goal',
            title: t('measurements.waterChangeGoal', {
              defaultValue: 'Change goal',
            }),
            image: 'target' as const,
          },
        ]
      : []),
  ];

  return (
    <View
      style={{ alignSelf: 'stretch' }}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        setCellWidth((current) => (current === width ? current : width));
      }}
    >
      <MenuView
        style={{ width: cellWidth ?? '100%' }}
        actions={actions}
        shouldOpenOnLongPress
        onPressAction={({ nativeEvent }) => {
          const action =
            nativeEvent.event === 'decrease'
              ? onDecrease
              : nativeEvent.event === 'goal'
                ? onChangeGoal
                : undefined;
          if (!action) return;
          if (pending.current) clearTimeout(pending.current);
          pending.current = setTimeout(action, 250);
        }}
      >
        <View collapsable={false} style={{ width: cellWidth ?? '100%' }}>
          {tile}
        </View>
      </MenuView>
    </View>
  );
}
