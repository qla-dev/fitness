import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import { fireSelectionHaptic } from '../services/haptics';
import { MENU_ITEM_RIGHT_INSET } from './menuItemLayout';
import { MenuItemDivider } from './MenuItem';

export interface MealLogCardProps {
  /** Leading glyph — the meal's icon. */
  icon: IconName;
  /** The meal's display label. */
  label: string;
  /**
   * Optional calorie readout shown after the overflow button (e.g.
   * "320 / 500 Cal"). Omitted on a meal with nothing logged.
   */
  badge?: string;
  /**
   * Opens the meal itself. Given to both the header row and the trailing
   * overflow button, so the row stays a shortcut for the affordance the
   * button makes explicit. Omit and neither is rendered.
   */
  onOpen?: () => void;
  /**
   * Leaves out the trailing "…" button, so only the row opens the item. For
   * a card whose actions already fill the row (a medication's dose pills).
   */
  hideOverflow?: boolean;
  /** Adds food to this meal. The card's one accented action. */
  onLog?: () => void;
  /** A second line under the label, e.g. a medication's time and dose. */
  subtitle?: string;
  /** Replaces the Log button's label and its accessibility label. */
  logLabel?: string;
  logAccessibilityLabel?: string;
  /** A second pill before Log, in the same style (a dose's Skip). */
  secondaryAction?: {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
  };
  /** The logged entries, rendered under the header. */
  children?: React.ReactNode;
}

/**
 * One meal on the diary: its icon and name, what it has logged so far, a way
 * into the meal itself, and a Log button that adds food straight to it.
 *
 * Every meal gets a card whether or not it holds anything, so an untouched day
 * still offers a place to log each meal rather than one shared Add button —
 * the shape a food diary is expected to have.
 */
const MealLogCard: React.FC<MealLogCardProps> = ({
  icon,
  label,
  badge,
  onOpen,
  onLog,
  hideOverflow = false,
  subtitle,
  logLabel,
  logAccessibilityLabel,
  secondaryAction,
  children,
}) => {
  const { t } = useTranslation();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const hasItems = React.Children.toArray(children).length > 0;
  // The row and the "…" open the same thing, with the same tick.
  const open = onOpen
    ? () => {
        fireSelectionHaptic();
        onOpen();
      }
    : undefined;

  const header = (
    <>
      <Icon name={icon} size={18} color={accentPrimary} />
      {/* The type every row in the app is set in, from the dashboard cards to
          the settings rows: a meal is the name of a card, not a heading over
          the screen, and a size larger made the meals shout over everything
          they sit between. */}
      {subtitle ? (
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-text-primary"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            className="text-sm text-text-secondary mt-0.5"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      ) : (
        <Text
          className="text-base font-semibold text-text-primary flex-1"
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </>
  );

  return (
    <View className="bg-surface rounded-xl overflow-hidden">
      <View
        className="flex-row gap-2 items-center p-4"
        style={{ paddingRight: MENU_ITEM_RIGHT_INSET }}
      >
        {onOpen ? (
          <Pressable
            onPress={open}
            className="flex-row gap-2 items-center flex-1"
            accessibilityRole="button"
            accessibilityLabel={t('foodSummary.nutritionBreakdown', {
              defaultValue: '{{label}} nutrition breakdown',
              label,
            })}
          >
            {header}
          </Pressable>
        ) : (
          <View className="flex-row gap-2 items-center flex-1">{header}</View>
        )}
        {badge ? (
          <View className="bg-accent-primary/5 rounded-full px-4 py-1.5">
            <Text className="text-sm font-bold text-accent-primary">
              {badge}
            </Text>
          </View>
        ) : null}
        {/* The overflow button and the row behind it go to the same place: the
            row is the shortcut, this is the affordance that says so out loud.
            It replaces the chevron that used to sit here. */}
        {onOpen && !hideOverflow ? (
          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={t('foodSummary.mealOptions', {
              defaultValue: 'More options for {{label}}',
              label,
            })}
            className="items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <Icon name="ellipsis-horizontal" size={18} color={accentPrimary} />
          </Pressable>
        ) : null}
        {secondaryAction ? (
          <Pressable
            onPress={() => {
              fireSelectionHaptic();
              secondaryAction.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.accessibilityLabel}
            className="bg-accent-primary/10 rounded-full px-4 py-1.5"
          >
            <Text className="text-sm font-bold text-accent-primary">
              {secondaryAction.label}
            </Text>
          </Pressable>
        ) : null}
        {onLog ? (
          <Pressable
            onPress={() => {
              fireSelectionHaptic();
              onLog();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              logAccessibilityLabel ??
              t('foodSummary.logMeal', {
                defaultValue: 'Log food to {{label}}',
                label,
              })
            }
            className="bg-accent-primary/10 rounded-full px-4 py-1.5"
          >
            <Text className="text-sm font-bold text-accent-primary">
              {logLabel ?? t('foodSummary.log', { defaultValue: 'Log' })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hasItems && <MenuItemDivider inset={0} />}
      {children}
    </View>
  );
};

export default MealLogCard;
