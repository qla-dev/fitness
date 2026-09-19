import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import CarbsIcon from './icons/nutrition/CarbsIcon';
import FatIcon from './icons/nutrition/FatIcon';
import ProteinIcon from './icons/nutrition/ProteinIcon';
import DashboardCardTitle from './DashboardCardTitle';
import ProgressRing from './ProgressRing';
import ValueSkeleton from './ValueSkeleton';
import { formatLocalizedNumber } from '../localization';
import { localizeNutrientKey } from '../utils/nutrientLocalization';
import type { DailySummary } from '../types/dailySummary';

/** Stands in until the macro columns have been measured. */
const RING_FALLBACK = 104;
const RING_STROKE = 9;

/** The goal line under the ring, plus its top margin. */
const RING_LABEL_BLOCK = 24;

/** Bounds on the solved ring, so an extreme type size cannot deform the card. */
const RING_MIN = 64;
const RING_MAX = 140;

/**
 * The macro glyphs.
 *
 * Big enough to be read rather than merely noticed: at the size these started
 * at, the drawn detail — a bicep's fist, a wheat ear's grains — closed up and
 * every one of them looked like the same small smudge.
 */
const MACRO_GLYPH = 34;

const round = (value: number) =>
  formatLocalizedNumber(Math.round(value), { maximumFractionDigits: 0 });

/** The mark above each macro, drawn in that macro's own colour. */
type MacroIcon = React.ComponentType<{
  size?: number;
  color?: string;
  accentColor?: string;
}>;

/**
 * A macro's fill, which grows into place rather than appearing at length.
 *
 * The same motion the calorie ring has: the day's numbers arrive a moment
 * after the card does, and a bar that snapped to its final width read as a
 * layout glitch beside a ring that swept round to its own.
 */
function MacroBar({
  filled,
  color,
  trackColor,
}: {
  filled: number;
  color: string;
  trackColor: string;
}) {
  const grown = useSharedValue(0);
  useEffect(() => {
    grown.value = withTiming(filled, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [filled, grown]);
  const style = useAnimatedStyle(() => ({
    width: `${grown.value * 100}%`,
  }));

  return (
    <View
      className="rounded-full overflow-hidden mt-2"
      style={{ height: 5, backgroundColor: trackColor }}
    >
      <Animated.View
        style={[{ height: '100%', backgroundColor: color }, style]}
      />
    </View>
  );
}

/** One macro's column: what was eaten, what it is measured against, and a bar. */
function MacroColumn({
  label,
  consumed,
  goal,
  color,
  trackColor,
  Glyph,
  loading,
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
  trackColor: string;
  Glyph: MacroIcon;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const filled = goal > 0 ? Math.min(1, Math.max(0, consumed / goal)) : 0;

  return (
    <View className="flex-1">
      {/* Both tones are the macro's colour: a two-tone glyph at this size
          turns to noise. The shapes carry the meaning and the colour ties each
          icon to its own bar. */}
      <Glyph size={MACRO_GLYPH} color={color} accentColor={color} />
      <Text className="text-text-secondary text-xs mt-1" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1 mt-0.5">
        {loading ? (
          <View className="h-6 justify-center">
            <ValueSkeleton width={36} height={18} />
          </View>
        ) : (
          <>
            <Text className="text-text-primary text-xl font-bold">
              {round(consumed)}
            </Text>
            <Text className="text-text-secondary text-xs">
              {t('diaryNutrition.grams', { defaultValue: 'g' })}
            </Text>
          </>
        )}
      </View>
      {goal > 0 ? (
        <Text className="text-text-muted text-xs mt-0.5" numberOfLines={1}>
          {t('diaryNutrition.ofGrams', {
            defaultValue: 'of {{goal}} g',
            goal: round(goal),
          })}
        </Text>
      ) : null}
      <MacroBar
        filled={loading ? 0 : filled}
        color={color}
        trackColor={trackColor}
      />
    </View>
  );
}

/**
 * The day's nutrition at the head of the Tracker screen.
 *
 * The ring is measured against the calorie goal, and the one label under it
 * names that goal.
 *
 * It sizes itself from the macro columns beside it rather than from a constant:
 * the ring plus its label has to come to the same height as that block, and
 * those columns grow or shrink with the type size the reader has chosen. Fixed
 * at a number that looked right once, the left half hangs below the right at
 * every other setting.
 */
export default function DiaryNutritionCard({
  summary,
  loading,
}: {
  summary: DailySummary;
  /** Swaps the figures for placeholders; the chrome is drawn either way. */
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const [proteinColor, carbsColor, fatColor, trackColor, calorieColor] =
    useCSSVariable([
      '--color-macro-protein',
      '--color-macro-carbs',
      '--color-macro-fat',
      '--color-progress-track',
      '--color-calories',
    ]) as string[];

  const consumed = summary.caloriesConsumed;
  const goal = summary.calorieGoal;

  const [macrosHeight, setMacrosHeight] = useState(0);
  const ringSize = macrosHeight
    ? Math.min(RING_MAX, Math.max(RING_MIN, macrosHeight - RING_LABEL_BLOCK))
    : RING_FALLBACK;

  return (
    <View className="bg-surface rounded-2xl px-4 pt-3 pb-4">
      <DashboardCardTitle className="mb-3">
        {t('diaryNutrition.title', { defaultValue: 'Nutrition' })}
      </DashboardCardTitle>

      <View className="flex-row items-center gap-4">
        <View className="items-center">
          <View
            className="items-center justify-center"
            style={{ width: ringSize, height: ringSize }}
          >
            <ProgressRing
              progress={goal > 0 ? consumed / goal : 0}
              size={ringSize}
              strokeWidth={RING_STROKE}
              color={calorieColor}
              backgroundColor={trackColor}
            />
            <View className="absolute items-center justify-center">
              {loading ? (
                <View className="h-8 justify-center">
                  <ValueSkeleton width={56} height={22} />
                </View>
              ) : (
                <Text className="text-text-primary text-2xl font-bold">
                  {round(consumed)}
                </Text>
              )}
              <Text className="text-text-secondary text-xs">
                {t('nutrition.caloriesShort', { defaultValue: 'kcal' })}
              </Text>
            </View>
          </View>

          {goal > 0 ? (
            <Text className="text-text-muted text-xs mt-2" numberOfLines={1}>
              {t('diaryNutrition.ofGoal', {
                defaultValue: 'of {{goal}}',
                goal: round(goal),
              })}
            </Text>
          ) : null}
        </View>

        {/* Measured so the ring can be sized against it; the two halves have to
            finish at the same line. */}
        <View
          className="flex-1 flex-row gap-3"
          onLayout={(event) => setMacrosHeight(event.nativeEvent.layout.height)}
        >
          <MacroColumn
            label={localizeNutrientKey(t, 'protein')}
            consumed={summary.protein.consumed}
            goal={summary.protein.goal}
            color={proteinColor}
            trackColor={trackColor}
            Glyph={ProteinIcon}
            loading={loading}
          />
          <MacroColumn
            label={localizeNutrientKey(t, 'carbs')}
            consumed={summary.carbs.consumed}
            goal={summary.carbs.goal}
            color={carbsColor}
            trackColor={trackColor}
            Glyph={CarbsIcon}
            loading={loading}
          />
          <MacroColumn
            label={localizeNutrientKey(t, 'fat')}
            consumed={summary.fat.consumed}
            goal={summary.fat.goal}
            color={fatColor}
            trackColor={trackColor}
            Glyph={FatIcon}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}
