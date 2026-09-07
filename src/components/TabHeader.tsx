import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import type { IconName } from './Icon';
import { formatDateLabel } from '../utils/dateUtils';

/** Fixed width for the outer slots so the centered title stays centered. */
const SLOT_WIDTH = 96;

export interface TabHeaderAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}

interface TabHeaderProps {
  /** Centered title — the screen's own name. */
  title: string;
  /**
   * Left slot: the day this screen is showing. Tapping it opens the date
   * picker. Omit on tabs that are not scoped to a day.
   */
  selectedDate?: string;
  onDatePress?: () => void;
  /**
   * Previous/next day steppers. The tabs omit these — their content is
   * swipeable, so the bar stays uncluttered — but a pushed day-scoped screen
   * with no swipe gesture (the family diary) passes them so days can still be
   * stepped without opening the picker.
   */
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  /** Extra action placed left of the profile button (e.g. family diaries). */
  action?: TabHeaderAction;
  /**
   * Opens the profile screen. Passed in rather than resolved from navigation
   * context so the bar stays a plain presentational component; headers that
   * are not a tab root simply omit it and render no profile button.
   */
  onProfilePress?: () => void;
  skipTopInset?: boolean;
  dateControls?: {
    chooseDateLabel: string;
    chooseDateHint: string;
    previousDayLabel?: string;
    previousDayHint?: string;
    nextDayLabel?: string;
    nextDayHint?: string;
  };
}

/**
 * The header every tab shares: the day on the left, the screen name centered,
 * and the profile button always in the top-right corner. Days are changed by
 * the date picker or by swiping the content, so the bar carries no
 * previous/next chevrons.
 */
const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  selectedDate,
  onDatePress,
  onPreviousDay,
  onNextDay,
  action,
  onProfilePress,
  skipTopInset,
  dateControls,
}) => {
  // Subscribe to the reactive app language so the date label re-localizes
  // immediately on a runtime PL <-> EN switch without an app restart.
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('pl') ? 'pl-PL' : 'en-US';
  const insets = useSafeAreaInsets();
  const [secondaryTextColor, primaryTextColor] = useCSSVariable([
    '--color-text-secondary',
    '--color-text-primary',
  ]) as [string, string];

  const chooseDateLabel =
    dateControls?.chooseDateLabel ??
    t('familyDiary.chooseDate', { defaultValue: 'Choose date' });
  const chooseDateHint =
    dateControls?.chooseDateHint ??
    t('familyDiary.chooseDateHint', { defaultValue: 'Opens the date picker' });

  // Relative where it reads better (Today, Yesterday), the calendar date
  // otherwise — the left slot is short, so the shortest true label wins.
  const dateLabel =
    selectedDate === undefined
      ? null
      : formatDateLabel(selectedDate, t, locale);

  return (
    <View
      style={{
        paddingTop: skipTopInset ? 12 : insets.top + 12,
        paddingHorizontal: 8,
      }}
      className="flex-row items-center pb-4"
    >
      <View
        className="flex-row items-center"
        style={{ minWidth: SLOT_WIDTH, minHeight: 44 }}
      >
        {onPreviousDay && (
          <TouchableOpacity
            onPress={onPreviousDay}
            accessibilityRole="button"
            accessibilityLabel={
              dateControls?.previousDayLabel ??
              t('familyDiary.previousDay', { defaultValue: 'Previous day' })
            }
            accessibilityHint={
              dateControls?.previousDayHint ??
              t('familyDiary.previousDayHint', {
                defaultValue: 'Shows the previous day',
              })
            }
            className="items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon name="chevron-back" size={18} color={secondaryTextColor} />
          </TouchableOpacity>
        )}
        {dateLabel !== null && (
          <TouchableOpacity
            onPress={onDatePress}
            accessibilityRole="button"
            accessibilityLabel={chooseDateLabel}
            accessibilityHint={chooseDateHint}
            className="flex-row items-center px-2"
            style={{ minHeight: 44 }}
          >
            <Text
              className="text-text-primary text-base font-medium"
              numberOfLines={1}
            >
              {dateLabel}
            </Text>
            {onDatePress && (
              <Icon
                name="chevron-down"
                size={12}
                color={secondaryTextColor}
                style={{ marginLeft: 3 }}
              />
            )}
          </TouchableOpacity>
        )}
        {onNextDay && (
          <TouchableOpacity
            onPress={onNextDay}
            accessibilityRole="button"
            accessibilityLabel={
              dateControls?.nextDayLabel ??
              t('familyDiary.nextDay', { defaultValue: 'Next day' })
            }
            accessibilityHint={
              dateControls?.nextDayHint ??
              t('familyDiary.nextDayHint', {
                defaultValue: 'Shows the next day',
              })
            }
            className="items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon name="chevron-forward" size={18} color={secondaryTextColor} />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-1 items-center justify-center">
        <Text
          className="text-lg font-bold text-text-primary"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </View>

      <View
        className="flex-row items-center justify-end"
        style={{ width: SLOT_WIDTH, minHeight: 44 }}
      >
        {action ? (
          <TouchableOpacity
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            className="items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <Icon name={action.icon} size={22} color={primaryTextColor} />
          </TouchableOpacity>
        ) : null}
        {onProfilePress && (
          <TouchableOpacity
            onPress={onProfilePress}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title', { defaultValue: 'Profile' })}
            className="items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <Icon name="profile" size={24} color={primaryTextColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default TabHeader;
