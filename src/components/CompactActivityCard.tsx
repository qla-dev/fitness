import React from 'react';
import { isProviderDayTotal } from '../utils/workoutSession';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { ExerciseSessionResponse } from '@workspace/shared';
import DashboardCardTitle from './DashboardCardTitle';
import CompactActivityRow from './CompactActivityRow';
import SwipeableExerciseRow from './SwipeableExerciseRow';
import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

interface CompactActivityCardProps {
  sessions: ExerciseSessionResponse[];
  /** The day these cards belong to, which delete-by-swipe needs. */
  entryDate: string;
  onPressSession?: (session: ExerciseSessionResponse) => void;
  onAddExercise?: () => void;
  /** Opens the full history. Omit to drop the "More" link. */
  onPressMore?: () => void;
  distanceUnit?: 'km' | 'miles';
}

/**
 * The Home card for the selected day's activities.
 *
 * Day-scoped, like every other card on the Dashboard — the date in the header
 * is what it answers for. That is also why the rows carry no date of their own:
 * it would repeat the header on every line. The full list, where rows DO need a
 * date because they span months, is behind "More".
 */
const CompactActivityCard: React.FC<CompactActivityCardProps> = ({
  sessions,
  entryDate,
  onPressSession,
  onAddExercise,
  onPressMore,
  distanceUnit = 'km',
}) => {
  const { t } = useTranslation();
  const accentColor = useCSSVariable('--color-accent-primary') as string;

  const title = t('exerciseSummary.title', { defaultValue: 'Exercise' });
  const moreLabel = t('common.more', { defaultValue: 'More' });

  const header = (
    <View className="flex-row items-center mb-2">
      <DashboardCardTitle className="flex-1">{title}</DashboardCardTitle>
      {onPressMore ? (
        <Pressable
          onPress={() => {
            fireSelectionHaptic();
            onPressMore();
          }}
          accessibilityRole="button"
          accessibilityLabel={moreLabel}
          hitSlop={12}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm font-semibold text-accent-primary">
            {moreLabel}
          </Text>
          <Icon name="chevron-forward" size={12} color={accentColor} />
        </Pressable>
      ) : null}
    </View>
  );

  const logged = sessions.filter((session) => !isProviderDayTotal(session));

  if (logged.length === 0) {
    // The prompt is the whole card, so an empty day is a way in rather than a
    // dead readout — the same treatment the food and measurement rows get.
    const empty = (
      <Text className="text-text-muted text-base">
        {t('exerciseSummary.tapToAdd', { defaultValue: 'Tap to add exercise' })}
      </Text>
    );
    return (
      <View className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3">
        {header}
        {onAddExercise ? (
          <Pressable
            onPress={onAddExercise}
            accessibilityRole="button"
            accessibilityLabel={t('exerciseSummary.addExercise', {
              defaultValue: 'Add exercise',
            })}
            className="items-center py-6"
          >
            {empty}
          </Pressable>
        ) : (
          <View className="items-center py-6">{empty}</View>
        )}
      </View>
    );
  }

  // No surface of its own: each activity is already a card, and nesting them
  // inside another would draw a box around a stack of boxes.
  return (
    <View className="mb-1">
      {header}
      {/* Wrapped so the new look does not cost the swipe-to-delete and
          long-press these rows have always had. SwipeableExerciseRow renders
          whatever it is given and keeps its own gesture and delete. */}
      {logged.map((session, index) => (
        <SwipeableExerciseRow
          key={session.id || index}
          session={session}
          entryDate={entryDate}
          onPress={() => onPressSession?.(session)}
          distanceUnit={distanceUnit}
        >
          <CompactActivityRow session={session} distanceUnit={distanceUnit} />
        </SwipeableExerciseRow>
      ))}
    </View>
  );
};

export default CompactActivityCard;
