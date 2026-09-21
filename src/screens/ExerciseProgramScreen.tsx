import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import Icon from '../components/Icon';
import ProgramCover from '../components/ProgramCover';
import { formatLocalizedNumber } from '../localization';
import ProgramExerciseRow from '../components/ProgramExerciseRow';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import StatusView from '../components/StatusView';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useProgramAccents } from '../components/ProgramStore';
import {
  getProgramById,
  getProgramCategoryLabel,
  getProgramLevelLabel,
} from '../constants/exercisePrograms';
import { countProgramExercises } from '../types/exerciseProgram';
import ProgramPurchaseSheet from '../components/ProgramPurchaseSheet';
import { useProgramExerciseLookup } from '../hooks/useProgramExerciseLookup';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';

type ExerciseProgramScreenProps = RootStackScreenProps<'ExerciseProgram'>;

/**
 * A program's product page: what it is, what it costs you in time, every
 * session it contains, and how to eat while you run it. Laid out like an app
 * listing because that is the shape that answers "should I start this?".
 */
const ExerciseProgramScreen: React.FC<ExerciseProgramScreenProps> = ({
  route,
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const accents = useProgramAccents();
  const [textSecondary, accentPrimary] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as [string, string];

  const program = getProgramById(route.params.programId);
  const { resolve, resolvingName, lookup } = useProgramExerciseLookup(
    Boolean(program)
  );
  const { getImageSource } = useExerciseImageSource();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<
    Record<string, boolean>
  >({});

  // A program stores movement names; the real exercise is looked up on tap so
  // the user lands on the same detail screen the library and search open.
  const openExercise = async (name: string) => {
    const exercise = await resolve(name);
    if (exercise && navigation.isFocused()) {
      navigation.navigate('ExerciseDetail', { item: exercise });
    }
  };

  const header = useScreenHeader({
    variant: 'transparent',
    title: program?.name ?? t('programs.title', { defaultValue: 'Program' }),
    nativeTitle:
      program?.name ?? t('programs.title', { defaultValue: 'Program' }),
    left: { kind: 'back' },
    // The page opens on its cover art, so a hairline under the bar would draw
    // a line across the artwork rather than separating two panels.
    borderless: true,
  });

  if (!program) {
    return (
      <View
        className="flex-1 bg-background"
        style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
      >
        {header}
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('programs.missingTitle', {
            defaultValue: 'Program unavailable',
          })}
          subtitle={t('programs.missingSubtitle', {
            defaultValue: 'This program is no longer part of the library.',
          })}
        />
      </View>
    );
  }

  const accent = accents[program.accentVar];
  const stats: {
    label: string;
    value: string;
    caption?: string;
    stars?: boolean;
  }[] = [
    {
      label: t('programs.stats.ratingCount', {
        count: program.ratingCount,
        defaultValue: '{{count}} ratings',
        defaultValue_one: '{{count}} rating',
        defaultValue_other: '{{count}} ratings',
      }),
      value: program.rating.toFixed(1),
      stars: true,
    },
    {
      label: t('programs.stats.level', { defaultValue: 'LEVEL' }),
      value: getProgramLevelLabel(t, program.level),
      caption: getProgramCategoryLabel(t, program.category),
    },
    {
      label: t('programs.stats.length', { defaultValue: 'LENGTH' }),
      value: t('programs.stats.weeksValue', {
        count: program.weeks,
        defaultValue: '{{count}} wk',
        defaultValue_one: '{{count}} wk',
        defaultValue_other: '{{count}} wk',
      }),
      caption: t('programs.stats.perWeek', {
        count: program.daysPerWeek,
        defaultValue: '{{count}}×/week',
        defaultValue_one: '{{count}}×/week',
        defaultValue_other: '{{count}}×/week',
      }),
    },
    {
      label: t('programs.stats.session', { defaultValue: 'SESSION' }),
      value: t('programs.stats.minutesValue', {
        count: program.minutesPerSession,
        defaultValue: '{{count}} min',
        defaultValue_one: '{{count}} min',
        defaultValue_other: '{{count}} min',
      }),
      caption: t('programs.stats.exerciseCount', {
        count: countProgramExercises(program),
        defaultValue: '{{count}} exercises',
        defaultValue_one: '{{count}} exercise',
        defaultValue_other: '{{count}} exercises',
      }),
    },
  ];

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
        <View className="flex-row items-stretch px-4 pt-4 pb-5">
          <View className="mr-4">
            <ProgramCover
              program={program}
              size={96}
              iconSize={44}
              accent={accent}
              radius={24}
            />
          </View>
          <View className="flex-1 justify-between">
            <View>
              <Text
                className="text-text-primary text-2xl font-bold"
                style={{ lineHeight: 26, marginTop: -3 }}
              >
                {program.name}
              </Text>
              <Text className="text-text-secondary text-sm mt-0.5">
                {program.coach}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPurchasing(true)}
              className="px-3 py-1 rounded-full self-start"
              style={{ backgroundColor: accentPrimary }}
            >
              <Text className="text-accent-text text-base font-bold">
                {t('programs.startFor', {
                  defaultValue: 'Start for {{price}}',
                  price: formatLocalizedNumber(program.priceEur, {
                    style: 'currency',
                    currency: 'EUR',
                  }),
                })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-y border-border-subtle py-3"
        >
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              className={`items-center justify-center px-6 ${index > 0 ? 'border-l border-border-subtle' : ''}`}
              style={{ minWidth: 108 }}
            >
              <Text className="text-center text-[11px] font-semibold text-text-secondary tracking-wider">
                {stat.label}
              </Text>
              <Text className="text-center text-text-primary text-lg font-bold mt-1">
                {stat.value}
              </Text>
              {stat.stars ? (
                <View
                  className="flex-row items-center justify-center mt-0.5"
                  aria-hidden
                >
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <Icon
                      key={starIndex}
                      name="star"
                      size={14}
                      color={textSecondary}
                    />
                  ))}
                </View>
              ) : (
                <Text className="text-center text-text-secondary text-xs mt-0.5">
                  {stat.caption}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View className="px-4 pt-5">
          <Text className="text-text-primary text-base leading-6">
            {program.summary}
          </Text>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-text-primary mb-3">
            {t('programs.whatYouGet', { defaultValue: "What you'll get" })}
          </Text>
          {program.highlights.map((highlight) => (
            <View key={highlight} className="flex-row items-start mb-2">
              <Icon name="checkmark" size={18} color={accentPrimary} />
              <Text className="text-text-primary text-sm ml-2 flex-1">
                {highlight}
              </Text>
            </View>
          ))}
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-text-primary mb-1">
            {t('programs.schedule', { defaultValue: 'The sessions' })}
          </Text>
          <Text className="text-sm text-text-secondary mb-3">
            {t('programs.scheduleSubtitle', {
              defaultValue: 'Repeat this week for the length of the program.',
            })}
          </Text>
          {program.sessions.map((session, index) => {
            const sessionKey = `${program.id}:${session.day}`;
            const expanded = expandedSessions[sessionKey] ?? index === 0;
            return (
              <View key={session.day} className="mb-3">
                <TouchableOpacity
                  className="py-3 pr-2 flex-row items-center"
                  accessibilityRole="button"
                  accessibilityLabel={session.name}
                  accessibilityState={{ expanded }}
                  activeOpacity={0.7}
                  onPress={() =>
                    setExpandedSessions((current) => ({
                      ...current,
                      [sessionKey]: !(current[sessionKey] ?? index === 0),
                    }))
                  }
                >
                  <View className="flex-1">
                    <Text className="text-text-primary text-base font-semibold">
                      {t('programs.sessionHeading', {
                        defaultValue: 'Week {{number}} - {{name}}',
                        number: index + 1,
                        name: session.name,
                      })}
                    </Text>
                    <Text className="text-text-secondary text-sm mt-0.5">
                      {t('programs.sessionMeta', {
                        defaultValue: '{{focus}} · {{minutes}} min',
                        focus: session.focus,
                        minutes: session.minutes,
                      })}
                    </Text>
                  </View>
                  <View
                    style={{
                      transform: [{ rotate: expanded ? '-90deg' : '90deg' }],
                    }}
                  >
                    <Icon
                      name="chevron-forward"
                      size={14}
                      color={textSecondary}
                    />
                  </View>
                </TouchableOpacity>
                {expanded &&
                  session.exercises.map((exercise) => (
                    <ProgramExerciseRow
                      key={exercise.name}
                      exercise={exercise}
                      scrollOffset={scrollOffset}
                      lookup={lookup}
                      getImageSource={getImageSource}
                      disabled={resolvingName !== null}
                      busy={resolvingName === exercise.name}
                      onPress={() => void openExercise(exercise.name)}
                      color={textSecondary}
                    />
                  ))}
              </View>
            );
          })}
        </View>

        <View className="px-4 pt-3">
          <Text className="text-lg font-bold text-text-primary mb-1">
            {t('programs.nutrition', { defaultValue: 'Nutrition' })}
          </Text>
          <Text className="text-sm text-text-secondary mb-3">
            {program.nutrition.headline}
          </Text>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {[
              {
                label: t('programs.nutritionCalories', {
                  defaultValue: 'Calories',
                }),
                value: program.nutrition.calories,
              },
              {
                label: t('programs.nutritionProtein', {
                  defaultValue: 'Protein',
                }),
                value: t('programs.proteinValue', {
                  defaultValue: '{{value}} g per kg bodyweight',
                  value: program.nutrition.proteinPerKg,
                }),
              },
              {
                label: t('programs.nutritionCarbs', { defaultValue: 'Carbs' }),
                value: program.nutrition.carbs,
              },
              {
                label: t('programs.nutritionFat', { defaultValue: 'Fat' }),
                value: program.nutrition.fat,
              },
            ].map((row, index) => (
              <View
                key={row.label}
                className={`px-4 py-3 flex-row items-center ${
                  index > 0 ? 'border-t border-border-subtle' : ''
                }`}
              >
                <Text className="text-text-primary text-sm font-medium flex-1 mr-3">
                  {row.label}
                </Text>
                <Text className="text-text-secondary text-sm flex-1 text-right">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <View className="mt-3">
            {program.nutrition.tips.map((tip) => (
              <View key={tip} className="flex-row items-start mb-2">
                <Icon name="info-circle" size={16} color={textSecondary} />
                <Text className="text-text-secondary text-sm ml-2 flex-1">
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      {purchasing && (
        <ProgramPurchaseSheet
          program={program}
          onClose={() => setPurchasing(false)}
          onInstalled={(result) => {
            setPurchasing(false);
            Toast.show({
              type: 'success',
              text1: t('programs.purchase.added', {
                count: result.presetsCreated,
                defaultValue: '{{count}} workouts added to Programs',
                defaultValue_one: '{{count}} workout added to Programs',
                defaultValue_other: '{{count}} workouts added to Programs',
              }),
            });
          }}
        />
      )}
    </View>
  );
};

export default ExerciseProgramScreen;
