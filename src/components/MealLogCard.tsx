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
  /** Adds food to this meal. The card's one accented action. */
  onLog?: () => void;
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
  children,
}) => {
  const { t } = useTranslation();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const hasItems = React.Children.toArray(children).length > 0;

  const header = (
    <>
      <Icon name={icon} size={18} color={accentPrimary} />
      {/* The same type as a measurement tile's value above it: both are the
          headline of their card, and a meal sitting a size smaller and a shade
          lighter read as secondary to the tiles rather than beside them. */}
      <Text
        className="text-lg font-bold text-text-primary flex-1"
        numberOfLines={1}
      >
        {label}
      </Text>
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
            onPress={onOpen}
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
        {/* The overflow button and the row behind it go to the same place: the
            row is the shortcut, this is the affordance that says so out loud.
            It replaces the chevron that used to sit here. */}
        {onOpen ? (
          <Pressable
            onPress={onOpen}
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
        {badge ? (
          <View className="bg-accent-primary/5 rounded-full px-4 py-1.5">
            <Text className="text-sm font-bold text-accent-primary">
              {badge}
            </Text>
          </View>
        ) : null}
        {onLog ? (
          <Pressable
            onPress={() => {
              fireSelectionHaptic();
              onLog();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('foodSummary.logMeal', {
              defaultValue: 'Log food to {{label}}',
              label,
            })}
            className="bg-accent-primary/10 rounded-full px-4 py-1.5"
          >
            <Text className="text-sm font-bold text-accent-primary">
              {t('foodSummary.log', { defaultValue: 'Log' })}
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
