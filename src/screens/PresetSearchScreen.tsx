import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import StartWorkoutExercises from '../components/StartWorkoutExercises';
import { useNavigationActionGuard } from '../hooks/useNavigationActionGuard';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useStartLiveWorkout } from '../hooks/useStartLiveWorkout';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { buildSingleExerciseStartPayload } from '../utils/workoutSession';
import type { Exercise } from '../types/exercise';
import type { RootStackScreenProps } from '../types/navigation';

type PresetSearchScreenProps = RootStackScreenProps<'PresetSearch'>;

/**
 * Start Workout: the exercises you can begin a session from.
 *
 * Deliberately has nothing to do with saved programs. Those are their own
 * thing, opened from the profile and stocked from the store, and mixing them
 * in here made one screen answer two questions — "which of my programs do I
 * run today" and "what am I about to lift" — with a different layout depending
 * on whether the user happened to have saved any.
 *
 * Every card starts a workout with the movement on it. There is no separate
 * "empty workout" row because there is nothing for it to do that a card does
 * not already do in one tap instead of two.
 */
const PresetSearchScreen: React.FC<PresetSearchScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [accentColor, textMuted, borderSubtle] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
    '--color-border-subtle',
  ]) as [string, string, string];
  const usesNativeHeader = useNativeIOSHeadersActive();

  const [searchText, setSearchText] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const { startLiveWorkout } = useStartLiveWorkout(navigation);
  const { runNavigationAction } = useNavigationActionGuard(navigation);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const header = useScreenHeader({
    title: t('presetSearch.title', { defaultValue: 'Start Workout' }),
    left: {
      kind: 'dismiss',
      onPress: handleCancel,
      identifier: 'preset-search-cancel',
    },
  });

  // The pressed card is marked by its own id, so the spinner lands on the one
  // that was tapped rather than on the list as a whole.
  const handleStartFromExercise = useCallback(
    (exercise: Exercise) => {
      setStartingId(exercise.id);
      void startLiveWorkout({
        exercises: buildSingleExerciseStartPayload(exercise),
      });
    },
    [startLiveWorkout]
  );

  // The ⓘ on a card. Workout actions are hidden on the detail because the card
  // behind it already starts one, and two buttons for the same thing is worse
  // than one.
  const handlePreviewExercise = useCallback(
    (item: Exercise) => {
      runNavigationAction(() => {
        navigation.navigate('ExerciseDetail', {
          item,
          hideWorkoutActions: true,
        });
      });
    },
    [runNavigationAction, navigation]
  );

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      <View className="px-4 py-2">
        <View
          className="flex-row items-center bg-raised rounded-lg px-3 py-2.5"
          style={{
            borderWidth: 1,
            borderColor: isSearchFocused ? accentColor : borderSubtle,
          }}
        >
          <Icon name="search" size={18} color={textMuted} />
          <View className="flex-1 ml-2">
            <TextInput
              className="text-text-primary"
              style={{ fontSize: 16, padding: 0, includeFontPadding: false }}
              placeholder={t('exerciseSearch.search.placeholder', {
                defaultValue: 'Search exercises...',
              })}
              placeholderTextColor={textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="start-workout-search"
            />
          </View>
          {searchText.length > 0 && (
            <Button
              variant="header"
              onPress={() => setSearchText('')}
              hitSlop={8}
            >
              <Icon name="close" size={16} color={textMuted} />
            </Button>
          )}
        </View>
      </View>

      <StartWorkoutExercises
        searchText={searchText}
        startingId={startingId}
        onSelect={handleStartFromExercise}
        onInfo={handlePreviewExercise}
      />
    </View>
  );
};

export default PresetSearchScreen;
