import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { useCSSVariable } from 'uniwind';

import CarbsIcon from './icons/nutrition/CarbsIcon';
import FatIcon from './icons/nutrition/FatIcon';
import ProteinIcon from './icons/nutrition/ProteinIcon';
import DashboardCardTitle from './DashboardCardTitle';
import Icon from './Icon';
import ProgressRing, { progressArcHeight } from './ProgressRing';
import ValueSkeleton from './ValueSkeleton';
import { formatLocalizedNumber } from '../localization';
import { localizeNutrientKey } from '../utils/nutrientLocalization';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import { MOVE_COLOR } from '../constants/activityGoals';
import type { DailySummary } from '../types/dailySummary';

const MAIN_ARC = 168;
const MAIN_STROKE = 11;
/** Nested inside the outer one, a stroke and a hairline gap in. */
const INNER_ARC = MAIN_ARC - 2 * (MAIN_STROKE + 5);
/** Room under the arcs for the figure that sits in their opening. */
const ARC_LABEL_BLOCK = 44;
const MACRO_RING = 74;
const MACRO_STROKE = 8;

/** The mark above each macro ring, drawn in that macro's own colour. */
type MacroIcon = React.ComponentType<{
  size?: number;
  color?: string;
  accentColor?: string;
}>;

const round = (value: number) =>
  formatLocalizedNumber(Math.round(value), { maximumFractionDigits: 0 });

/**
 * One of the two figures flanking the arcs.
 *
 * Plain numbers, not gauges of their own: eaten and burned are already drawn,
 * as the two arcs in the middle. Giving each its own arc as well said the same
 * thing twice and left three gauges competing for the one glance.
 */
function CalorieFlank({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon: 'food' | 'flame';
  label: string;
  value: number;
  color: string;
  loading?: boolean;
}) {
  return (
    <View className="items-center">
      <Icon name={icon} size={18} color={color} />
      <View className="h-7 justify-center mt-1">
        {loading ? (
          <ValueSkeleton width={48} />
        ) : (
          <Text className="font-bold text-xl" style={{ color }}>
            {round(value)}
          </Text>
        )}
      </View>
      <Text className="text-text-secondary text-xs">{label}</Text>
    </View>
  );
}

/**
 * One macro as a ring: what has been eaten inside it, what is left under it.
 *
 * A ring rather than the bar this card used to draw, because the arc above
 * asks the same question — how far through the day's allowance am I — and two
 * shapes for one question made the macros read as a different measurement.
 */
function MacroRing({
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
  const left = Math.max(0, goal - consumed);

  return (
    <View className="flex-1 items-center">
      <Glyph size={22} color={color} accentColor={color} />
      <View
        className="items-center justify-center mt-2"
        style={{ width: MACRO_RING, height: MACRO_RING }}
      >
        <ProgressRing
          progress={loading || goal <= 0 ? 0 : consumed / goal}
          size={MACRO_RING}
          strokeWidth={MACRO_STROKE}
          color={color}
          backgroundColor={trackColor}
        />
        <View className="absolute flex-row items-baseline">
          {loading ? (
            <ValueSkeleton width={28} height={16} />
          ) : (
            <>
              <Text className="text-text-primary text-base font-bold">
                {round(consumed)}
              </Text>
              <Text className="text-text-secondary text-[10px]">
                {t('diaryNutrition.grams', { defaultValue: 'g' })}
              </Text>
            </>
          )}
        </View>
      </View>
      <Text className="text-sm font-semibold mt-2" style={{ color }}>
        {label}
      </Text>
      {goal > 0 ? (
        <Text className="text-text-muted text-xs" numberOfLines={1}>
          {t('diaryNutrition.gramsLeft', {
            defaultValue: '{{grams}}g left',
            grams: round(left),
          })}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The day's nutrition at the head of the Tracker.
 *
 * The middle counts down rather than up — what is left of the allowance, not
 * what has gone — because that is the number a decision gets made against. Its
 * two nested arcs are eaten and burned; the figures beside them name the same
 * two, for the times a picture is not the answer.
 *
 * Burned is deliberately not added to the goal: it is the same active-energy
 * total the Activities screen reads as Move, and folding it in would move the
 * target every time the watch synced.
 */
export default function DiaryNutritionCard({
  summary,
  showNetCarbs = false,
  loading,
}: {
  summary: DailySummary;
  /** Swaps carbs for net carbs, following the user's nutrition preference. */
  showNetCarbs?: boolean;
  /** Swaps the figures for placeholders; the chrome is drawn either way. */
  loading?: boolean;
}) {
  const { t } = useTranslation();
  // Eaten takes the accent blue rather than --color-calories: the two are a
  // few degrees apart, and with the More link on the row above the card this
  // is the one screen where both are in a single glance.
  const [proteinColor, carbsColor, fatColor, trackColor, calorieColor] =
    useCSSVariable([
      '--color-macro-protein',
      '--color-macro-carbs',
      '--color-macro-fat',
      '--color-progress-track',
      '--color-accent-primary',
    ]) as string[];

  const eaten = summary.caloriesConsumed;
  const burned = summary.caloriesBurned;
  const goal = summary.calorieGoal;
  const burnGoal = summary.exerciseCaloriesGoal;
  const left = Math.max(0, goal - eaten);

  const share = (value: number, against: number) =>
    loading || against <= 0 ? 0 : value / against;

  const carbs = showNetCarbs
    ? getNetCarbsValue(summary.carbs.consumed, summary.fiber.consumed)
    : summary.carbs.consumed;
  const carbsLabel = showNetCarbs
    ? localizeNutrientKey(t, 'netCarbs')
    : localizeNutrientKey(t, 'carbs');

  return (
    // No bottom margin: the Tracker's scroll view already puts a gap between
    // every child, and carrying one here stacked on top of it.
    <View className="bg-surface rounded-2xl px-4 pt-3 pb-4">
      <DashboardCardTitle className="mb-3">
        {t('diaryNutrition.title', { defaultValue: 'Nutrition' })}
      </DashboardCardTitle>

      {/* Eaten and burned share one pair of nested arcs, the way the rings
          on Activities nest: two readings of the same day, concentric, so the
          relationship between them is the picture rather than something the
          labels have to state. */}
      <View className="flex-row items-center justify-between">
        <CalorieFlank
          icon="food"
          label={t('diaryNutrition.eaten', { defaultValue: 'Eaten' })}
          value={eaten}
          color={calorieColor}
          loading={loading}
        />

        <View
          style={{
            width: MAIN_ARC,
            height:
              progressArcHeight(MAIN_ARC, MAIN_STROKE, 'half') +
              ARC_LABEL_BLOCK,
          }}
        >
          <View className="absolute inset-x-0 top-0 items-center">
            <ProgressRing
              arc="half"
              progress={share(eaten, goal)}
              size={MAIN_ARC}
              strokeWidth={MAIN_STROKE}
              color={calorieColor}
              backgroundColor={trackColor}
            />
          </View>
          {/* Inset by half the size difference, which is what puts the two on
              the same centre — they share a stroke width, so nothing else has
              to be matched up. */}
          <View
            className="absolute inset-x-0 items-center"
            style={{ top: (MAIN_ARC - INNER_ARC) / 2 }}
          >
            <ProgressRing
              arc="half"
              progress={share(burned, burnGoal)}
              size={INNER_ARC}
              strokeWidth={MAIN_STROKE}
              color={MOVE_COLOR}
              backgroundColor={trackColor}
            />
          </View>

          {/* In the opening the arcs leave, starting just above their centre. */}
          <View
            className="absolute inset-x-0 items-center"
            style={{ top: MAIN_ARC / 2 - 30 }}
          >
            {loading ? (
              <ValueSkeleton width={62} height={30} />
            ) : (
              <Text
                className="text-3xl font-bold"
                style={{ color: calorieColor }}
              >
                {round(left)}
              </Text>
            )}
            <Text className="text-text-secondary text-xs mt-0.5">
              {t('diaryNutrition.kcalLeft', { defaultValue: 'kcal left' })}
            </Text>
            {goal > 0 ? (
              <Text className="text-text-muted text-xs">
                {t('diaryNutrition.ofGoal', {
                  defaultValue: 'of {{goal}}',
                  goal: round(goal),
                })}
              </Text>
            ) : null}
          </View>
        </View>

        <CalorieFlank
          icon="flame"
          label={t('diaryNutrition.burned', { defaultValue: 'Burned' })}
          value={burned}
          color={MOVE_COLOR}
          loading={loading}
        />
      </View>

      <View className="flex-row mt-5">
        <MacroRing
          label={localizeNutrientKey(t, 'protein')}
          consumed={summary.protein.consumed}
          goal={summary.protein.goal}
          color={proteinColor}
          trackColor={trackColor}
          Glyph={ProteinIcon}
          loading={loading}
        />
        <MacroRing
          label={carbsLabel}
          consumed={carbs}
          goal={summary.carbs.goal}
          color={carbsColor}
          trackColor={trackColor}
          Glyph={CarbsIcon}
          loading={loading}
        />
        <MacroRing
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
  );
}
