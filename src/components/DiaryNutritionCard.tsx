import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  View,
  Text,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import DashboardCardTitle from './DashboardCardTitle';
import Icon from './Icon';
import MacroRingGauge from './MacroRingGauge';
import ArcGauge, { arcGaugeHeight } from './ArcGauge';
import ValueSkeleton from './ValueSkeleton';
import { formatLocalizedNumber } from '../localization';
import { MOVE_COLOR } from '../constants/activityGoals';
import { SCREEN_GUTTER } from '../constants/layout';
import { useIsFocusedWhenNavigable } from '../hooks/useIsFocusedWhenNavigable';
import { fireSelectionHaptic } from '../services/haptics';
import {
  CENTRED_MACRO_KEY,
  MACRO_RINGS,
  resolveMacroRing,
  type MacroGlyph,
} from '../constants/macroRings';
import type { DailySummary } from '../types/dailySummary';

const MAIN_STROKE = 11;
/** How much narrower the inner arc is: a stroke and a hairline gap each side. */
const ARC_INSET = 2 * (MAIN_STROKE + 5);
/**
 * Fixed, so the arc between the flanks can be what is left over.
 *
 * Wide enough for "Burned", the longer of the two labels, and for a
 * four-figure calorie count.
 */
const FLANK_WIDTH = 52;
/**
 * Room under the arcs for the figure that sits in their opening.
 *
 * Constant whatever the arc measures, because both the label's top and the
 * arc's bottom are offsets from the same centre line: the block needs the
 * label's own height (36 + 2 + 16) less the 30 it starts above the centre and
 * the stroke the arc ends below it, which is 13 at any size. Sized generously
 * it left a band of empty card that read as a missing row.
 */
const ARC_LABEL_BLOCK = 14;
const MACRO_RING = 64;
const MACRO_STROKE = 7;
/** Compact label box; long translated names truncate to one line. */
const MACRO_ITEM = 78;
const MACRO_GAP = 4;
/** The card's own `px-4`, which the macro strip has to cancel and restore. */
const CARD_PADDING = 16;
/**
 * The space either side of the arcs.
 *
 * The same width as the card's own padding, so the gap between Eaten and the
 * arcs matches the gap between Eaten and the card edge.
 */
const ARC_GUTTER = CARD_PADDING;
/**
 * The strip's leading padding when nothing is being centred.
 *
 * Short of the card's padding by half the gap between an item and its ring,
 * which is what lands the first RING's edge on the card's content edge rather
 * than its item box's.
 */
const STRIP_PADDING = CARD_PADDING - (MACRO_ITEM - MACRO_RING) / 2;
/** How far into the content the centred ring's middle sits, before padding. */
const CENTRED_RING_OFFSET =
  MACRO_RINGS.findIndex((spec) => spec.key === CENTRED_MACRO_KEY) *
    (MACRO_ITEM + MACRO_GAP) +
  MACRO_ITEM / 2;

/**
 * What it takes to put the centred ring in the middle of a strip this wide.
 *
 * Scroll to protein's position in the middle of the list. Extra leading
 * padding is only needed if the viewport is wider than twice that position.
 */
function centreStrip(stripWidth: number) {
  const offset = STRIP_PADDING + CENTRED_RING_OFFSET - stripWidth / 2;
  return {
    paddingLeft: STRIP_PADDING + Math.max(0, -offset),
    scrollX: Math.max(0, offset),
  };
}

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
    <View className="items-center" style={{ width: FLANK_WIDTH }}>
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
 * One nutrient as a ring: what has been eaten inside it, what is left under it.
 *
 * A ring rather than the bar this card used to draw, because the arc above
 * asks the same question — how far through the day's allowance am I — and two
 * shapes for one question made the macros read as a different measurement.
 */
function MacroRing({
  label,
  consumed,
  goal,
  unit,
  color,
  trackColor,
  Glyph,
  loading,
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  color: string;
  trackColor: string;
  Glyph: MacroGlyph;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const left = Math.max(0, goal - consumed);

  return (
    <View className="items-center" style={{ width: MACRO_ITEM }}>
      <Glyph size={22} color={color} accentColor={color} />
      <View
        className="items-center justify-center mt-2"
        style={{ width: MACRO_RING, height: MACRO_RING }}
      >
        <MacroRingGauge
          progress={loading || goal <= 0 ? 0 : consumed / goal}
          size={MACRO_RING}
          strokeWidth={MACRO_STROKE}
          color={color}
          trackColor={trackColor}
        />
        <View className="absolute flex-row items-baseline">
          {loading ? (
            <ValueSkeleton width={28} height={16} />
          ) : (
            <>
              <Text className="text-text-primary text-base font-bold">
                {round(consumed)}
              </Text>
              {/* i18n-audit-ignore-next-line hardcoded-ui-text -- g/mg/µg are unit symbols, carried literally the way every other nutrient readout carries them. */}
              <Text className="text-text-secondary text-[10px]">{unit}</Text>
            </>
          )}
        </View>
      </View>
      <Text
        className="text-xs font-semibold mt-2"
        numberOfLines={1}
        style={{ color }}
      >
        {label}
      </Text>
      {goal > 0 ? (
        <Text className="text-text-muted text-xs" numberOfLines={1}>
          {t('diaryNutrition.amountLeft', {
            defaultValue: '{{amount}} left',
            amount: `${round(left)}${unit}`,
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
  const [macrosVisible, setMacrosVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  const [macroHeight, setMacroHeight] = useState(0);
  const expansion = useSharedValue(1);
  useEffect(() => {
    expansion.value = withTiming(macrosVisible ? 1 : 0, {
      duration: reducedMotion ? 0 : 300,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [macrosVisible, reducedMotion, expansion]);
  const macroContainerStyle = useAnimatedStyle(() => ({
    height: macroHeight > 0 ? macroHeight * expansion.value : undefined,
    overflow: 'hidden',
  }));
  const macroContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 * (1 - expansion.value) }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${180 * expansion.value}deg` }],
  }));
  const toggleMacros = () => {
    fireSelectionHaptic();
    setMacrosVisible((visible) => !visible);
  };
  const [trackColor, calorieColor, textMuted, ...macroColors] = useCSSVariable([
    '--color-progress-track',
    '--color-accent-primary',
    '--color-text-muted',
    ...MACRO_RINGS.map((spec) => spec.colorVar),
  ]) as string[];

  const eaten = summary.caloriesConsumed;
  const burned = summary.caloriesBurned;
  const goal = summary.calorieGoal;
  const burnGoal = summary.exerciseCaloriesGoal;
  const left = Math.max(0, goal - eaten);

  const share = (value: number, against: number) =>
    loading || against <= 0 ? 0 : value / against;

  // The arcs take whatever the two flanks and their gutters leave, so they
  // grow with the screen instead of sitting at a width picked on one device.
  // Seeded from the window rather than waiting on layout: the card runs the
  // full width of the Tracker, so the answer is known before the first pass
  // and the arcs do not have to resize in front of the user. The measurement
  // still corrects it, which is what handles rotation and any other host.
  // Twelve of the sixteen are summed across the day's entries, so this is a
  // pass over them per nutrient. Held still across the arc's layout pass and
  // the animation frames that follow it.
  const rings = useMemo(
    () =>
      MACRO_RINGS.map((spec) =>
        resolveMacroRing(spec, summary, showNetCarbs, t)
      ),
    [summary, showNetCarbs, t]
  );

  const { width: windowWidth } = useWindowDimensions();
  const macroStripRef = useRef<ScrollView>(null);
  const isFocused = useIsFocusedWhenNavigable();
  const [stripWidth, setStripWidth] = useState(
    () => windowWidth - 2 * SCREEN_GUTTER
  );
  const { paddingLeft, scrollX } = centreStrip(stripWidth);

  // Re-centre on entry, expansion or a viewport resize, never on data updates.
  useEffect(() => {
    if (!isFocused || !macrosVisible) return;
    const frame = requestAnimationFrame(() => {
      macroStripRef.current?.scrollTo({ x: scrollX, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [isFocused, macrosVisible, scrollX, stripWidth]);

  const [arcSize, setArcSize] = useState(
    () =>
      windowWidth -
      2 * SCREEN_GUTTER -
      2 * CARD_PADDING -
      2 * FLANK_WIDTH -
      2 * ARC_GUTTER
  );
  const innerArc = arcSize - ARC_INSET;

  return (
    // No bottom margin: the Tracker's scroll view already puts a gap between
    // every child, and carrying one here stacked on top of it.
    <View className="bg-surface rounded-2xl px-4 pt-3 pb-4">
      <View className="flex-row items-center justify-between mb-3">
        <DashboardCardTitle>
          {t('diaryNutrition.title', { defaultValue: 'Nutrition' })}
        </DashboardCardTitle>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            macrosVisible
              ? t('common.collapseSection', {
                  defaultValue: 'Collapse this section',
                })
              : t('common.expandSection', {
                  defaultValue: 'Expand this section',
                })
          }
          accessibilityState={{ expanded: macrosVisible }}
          onPress={toggleMacros}
          hitSlop={12}
          className="h-6 flex-row items-center justify-center gap-1.5"
        >
          <Text className="text-xs text-text-muted">
            {t('diaryNutrition.allMacros', { defaultValue: 'All macros' })}
          </Text>
          <Animated.View style={chevronStyle}>
            <Icon name="chevron-down" size={18} color={textMuted} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Eaten and burned share one pair of nested arcs, the way the rings
          on Activities nest: two readings of the same day, concentric, so the
          relationship between them is the picture rather than something the
          labels have to state. */}
      <View className="flex-row items-center">
        <CalorieFlank
          icon="food"
          label={t('diaryNutrition.eaten', { defaultValue: 'Eaten' })}
          value={eaten}
          color={calorieColor}
          loading={loading}
        />

        {/* One gutter each side, the same width as the card's own padding, so
            the space around the arcs matches the space outside the flanks. */}
        <View
          className="flex-1"
          style={{
            marginHorizontal: ARC_GUTTER,
            height: arcGaugeHeight(arcSize, MAIN_STROKE) + ARC_LABEL_BLOCK,
          }}
          onLayout={(event) => setArcSize(event.nativeEvent.layout.width)}
        >
          <View className="absolute inset-x-0 top-0 items-center">
            <ArcGauge
              progress={share(eaten, goal)}
              size={arcSize}
              strokeWidth={MAIN_STROKE}
              color={calorieColor}
              trackColor={trackColor}
            />
          </View>
          {/* Inset by half the size difference, which is what puts the two on
              the same centre — they share a stroke width, so nothing else has
              to be matched up. */}
          <View
            className="absolute inset-x-0 items-center"
            style={{ top: ARC_INSET / 2 }}
          >
            <ArcGauge
              progress={share(burned, burnGoal)}
              size={innerArc}
              strokeWidth={MAIN_STROKE}
              color={MOVE_COLOR}
              trackColor={trackColor}
            />
          </View>

          {/* In the opening the arcs leave, starting just above their centre. */}
          <View
            className="absolute inset-x-0 items-center"
            style={{ top: arcSize / 2 - 30 }}
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
            {/* One sentence, not a unit stacked on a goal. Split across two
                spans it would have fixed the English word order for every
                translation of it. */}
            <Text
              className="text-text-secondary text-xs mt-0.5"
              numberOfLines={1}
            >
              {goal > 0
                ? t('diaryNutrition.kcalLeftOfGoal', {
                    defaultValue: 'kcal left of {{goal}}',
                    goal: round(goal),
                  })
                : t('diaryNutrition.kcalLeft', { defaultValue: 'kcal left' })}
            </Text>
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

      {/* The strip reaches the card edges, with enough leading space to put
          protein at the viewport centre even when no scroll offset is needed. */}
      <Animated.View
        style={[{ marginHorizontal: -CARD_PADDING }, macroContainerStyle]}
        pointerEvents={macrosVisible ? 'auto' : 'none'}
        accessibilityElementsHidden={!macrosVisible}
        importantForAccessibility={
          macrosVisible ? 'auto' : 'no-hide-descendants'
        }
      >
        <Animated.View
          style={[
            macroHeight > 0
              ? { position: 'absolute', left: 0, right: 0 }
              : undefined,
            macroContentStyle,
          ]}
          onLayout={(event) => setMacroHeight(event.nativeEvent.layout.height)}
        >
          <ScrollView
            ref={macroStripRef}
            horizontal
            onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            contentContainerStyle={{
              paddingLeft,
              paddingRight: STRIP_PADDING,
              gap: MACRO_GAP,
            }}
          >
            {MACRO_RINGS.map((spec, index) => {
              const ring = rings[index];
              return (
                <MacroRing
                  key={`${spec.key}-${macrosVisible}`}
                  label={ring.label}
                  consumed={ring.consumed}
                  goal={ring.goal}
                  unit={ring.unit}
                  color={macroColors[index]}
                  trackColor={trackColor}
                  Glyph={spec.Glyph}
                  loading={loading}
                />
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
