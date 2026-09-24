import React from 'react';
import { isProviderDayTotal } from '../utils/workoutSession';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import type { ExerciseSessionResponse } from '@workspace/shared';
import DashboardCardTitle from './DashboardCardTitle';
import SwipeableExerciseRow from './SwipeableExerciseRow';
import type { GetImageSource } from '../hooks/useExerciseImageSource';

interface ExerciseSummaryProps {
  exerciseEntries: ExerciseSessionResponse[];
  entryDate: string;
  onPressWorkout?: (session: ExerciseSessionResponse) => void;
  onAddExercise?: () => void;
  getImageSource?: GetImageSource;
  weightUnit?: 'kg' | 'lbs';
  distanceUnit?: 'km' | 'miles';
}

const ExerciseSummary: React.FC<ExerciseSummaryProps> = ({
  exerciseEntries,
  entryDate,
  onPressWorkout,
  onAddExercise,
  getImageSource,
  weightUnit = 'kg',
  distanceUnit = 'km',
}) => {
  const { t } = useTranslation();

  const logged = exerciseEntries.filter(
    (session) => !isProviderDayTotal(session)
  );

  if (logged.length === 0) {
    const emptyContent = (
      <Text className="text-text-muted text-base">
        {t('exerciseSummary.tapToAdd', { defaultValue: 'Tap to add exercise' })}
      </Text>
    );
    if (onAddExercise) {
      return (
        <Pressable
          onPress={onAddExercise}
          accessibilityRole="button"
          accessibilityLabel={t('exerciseSummary.addExercise', {
            defaultValue: 'Add exercise',
          })}
          className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3 items-center py-6"
        >
          {emptyContent}
        </Pressable>
      );
    }
    return (
      <View className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3 items-center py-6">
        {emptyContent}
      </View>
    );
  }

  return (
    <View className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3 overflow-hidden">
      <DashboardCardTitle className="mb-3">
        {t('exerciseSummary.title', { defaultValue: 'Exercise' })}
      </DashboardCardTitle>
      {logged.map((session, index) => (
        <SwipeableExerciseRow
          key={session.id || index}
          session={session}
          entryDate={entryDate}
          onPress={() => onPressWorkout?.(session)}
          getImageSource={getImageSource}
          weightUnit={weightUnit}
          distanceUnit={distanceUnit}
        />
      ))}
    </View>
  );
};

export default ExerciseSummary;
