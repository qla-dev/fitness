import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import type { IconName } from './Icon';
import { formatDateLabel } from '../utils/dateUtils';
import { fireSelectionHaptic } from '../services/haptics';

/** Tap target for each header button, and the gap that keeps them apart. */
const BUTTON_SIZE = 44;
const BUTTON_GAP = 4;

/**
 * Base width for the outer slots, so the centered title stays centered. Both
 * sides use the same width; a header carrying more buttons than this fits
 * grows both slots together rather than shifting the title off centre.
 */
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
  /** Extra action placed left of the workouts button (e.g. family diaries). */
  action?: TabHeaderAction;
  /**
   * Opens the workouts list. Sits immediately left of the profile button, so
   * profile keeps the corner position it holds on every tab. Omitted by
   * headers that are not a tab root, the same way the profile button is.
   */
  onWorkoutsPress?: () => void;
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
  onWorkoutsPress,
  onProfilePress,
  skipTopInset,
  dateControls,
}) => {
  // Subscribe to the reactive app language so the date label re-localizes
  // immediately on a runtime PL <-> EN switch without an app restart.
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('pl') ? 'pl-PL' : 'en-US';
  const insets = useSafeAreaInsets();
  /**
   * Every button in this bar answers a press with the selection haptic, the
   * same as the buttons `useScreenHeader` renders on the screens that own
   * their header. Wrapped here rather than at each call site so a new button
   * cannot be added silently.
   */
  const withHaptic = (onPress?: () => void) =>
    onPress
      ? () => {
          fireSelectionHaptic();
          onPress();
        }
      : undefined;
  // Both slots share one width so the title stays centred, and it only grows
  // past the base when a header actually carries more buttons than that fits
  // (the family-diary bar: action + workouts + profile).
  const buttonCount =
    (action ? 1 : 0) + (onWorkoutsPress ? 1 : 0) + (onProfilePress ? 1 : 0);
  const slotWidth = Math.max(
    SLOT_WIDTH,
    buttonCount * BUTTON_SIZE + Math.max(buttonCount - 1, 0) * BUTTON_GAP
  );
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
        style={{ minWidth: slotWidth, minHeight: 44 }}
      >
        {onPreviousDay && (
          <TouchableOpacity
            onPress={withHaptic(onPreviousDay)}
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
            onPress={withHaptic(onDatePress)}
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
            onPress={withHaptic(onNextDay)}
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

      {/* Buttons are spaced apart rather than flush, so a row of icons reads
          as separate controls instead of one joined block. */}
      <View
        className="flex-row items-center justify-end"
        style={{ width: slotWidth, minHeight: 44, gap: BUTTON_GAP }}
      >
        {action ? (
          <TouchableOpacity
            onPress={withHaptic(action.onPress)}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            className="items-center justify-center"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
          >
            <Icon name={action.icon} size={22} color={primaryTextColor} />
          </TouchableOpacity>
        ) : null}
        {onWorkoutsPress && (
          <TouchableOpacity
            onPress={withHaptic(onWorkoutsPress)}
            accessibilityRole="button"
            accessibilityLabel={t('presetSearch.title', {
              defaultValue: 'Start Workout',
            })}
            className="items-center justify-center"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
          >
            <Icon
              name="exercise-running-filled"
              size={22}
              color={primaryTextColor}
            />
          </TouchableOpacity>
        )}
        {onProfilePress && (
          <TouchableOpacity
            onPress={withHaptic(onProfilePress)}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title', { defaultValue: 'Profile' })}
            className="items-center justify-center"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
          >
            <Icon name="profile" size={24} color={primaryTextColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default TabHeader;
