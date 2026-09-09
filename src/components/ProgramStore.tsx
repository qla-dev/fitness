import React, { useMemo, useState } from 'react';
import { fireSelectionHaptic } from '../services/haptics';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import SafeImage from './SafeImage';
import { useProgramThumbnails } from '../hooks';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import {
  EXERCISE_PROGRAMS,
  FEATURED_PROGRAM_IDS,
  PROGRAM_CATEGORIES,
  PROGRAM_SHELVES,
  getProgramCategoryLabel,
  getProgramLevelLabel,
  getProgramShelfSubtitle,
  getProgramShelfTitle,
  getProgramsByIds,
} from '../constants/exercisePrograms';
import { countProgramExercises } from '../types/exerciseProgram';
import type {
  ExerciseProgram,
  ProgramCategoryId,
} from '../types/exerciseProgram';

/**
 * Every accent a program can claim, resolved in one hook call — CSS variables
 * cannot be read per-item inside a list without breaking the rules of hooks.
 */
const ACCENT_VARS = [
  '--color-cat-pink',
  '--color-cat-orange',
  '--color-cat-blue',
  '--color-cat-teal',
  '--color-cat-violet',
  '--color-cat-amber',
  '--color-cat-green',
  '--color-cat-slate',
  '--color-hydration',
  '--color-exercise',
  '--color-calories',
  '--color-pr',
  '--color-macro-carbs',
  '--color-macro-protein',
  '--color-wellness-follicular',
  '--color-wellness-pregnant',
] as const;

/** A shelf page holds at most this many rows before it pages sideways. */
export const SHELF_PAGE_SIZE = 4;
const GUTTER = 16;
/**
 * Inner padding of a featured card. The Start row is pinned to the bottom with
 * this same value, so its distance from the bottom edge matches the copy's
 * distance from the left edge.
 */
const FEATURED_CARD_PADDING = 20;

export function useProgramAccents(): Record<string, string> {
  const values = useCSSVariable([...ACCENT_VARS]) as string[];
  return useMemo(
    () =>
      Object.fromEntries(
        ACCENT_VARS.map((name, index) => [name, values[index]])
      ),
    [values]
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

interface ProgramStoreProps {
  onSelectProgram: (program: ExerciseProgram) => void;
  /** Start opens the add sheet; the rest of the row opens the detail page. */
  onStartProgram: (program: ExerciseProgram) => void;
}

/**
 * The program store above the exercise library. A snapping carousel of
 * featured programs, then themed shelves — each shelf pages sideways four
 * rows at a time rather than growing into an endless column.
 */
const ProgramStore: React.FC<ProgramStoreProps> = ({
  onSelectProgram,
  onStartProgram,
}) => {
  const { t } = useTranslation();
  const accents = useProgramAccents();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<ProgramCategoryId | null>(null);
  const [textSecondary] = useCSSVariable(['--color-text-secondary']) as [
    string,
  ];

  // Covers are resolved for the whole catalogue rather than per shelf: the
  // shelves overlap and the chips re-filter in place, so a per-view list
  // would refetch the same programs as the user browses.
  const covers = useProgramThumbnails(EXERCISE_PROGRAMS);
  const { getImageSource } = useExerciseImageSource();

  /**
   * A program's cover, or its icon while the lookup is out (or if nothing
   * in it has artwork). Same shape either way so the row never reflows.
   */
  const renderCover = (
    program: ExerciseProgram,
    size: number,
    iconSize: number,
    fallbackBackground: string
  ) => {
    const cover = covers[program.id];
    const source = cover ? getImageSource(cover) : null;
    const placeholder = (
      <View
        className="rounded-2xl items-center justify-center"
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackBackground,
        }}
      >
        <Icon name={program.icon} size={iconSize} color="#FFFFFF" />
      </View>
    );
    if (!source) return placeholder;
    return (
      <SafeImage
        source={source}
        style={{ width: size, height: size, borderRadius: 16 }}
        fallback={placeholder}
      />
    );
  };

  // A page spans the screen minus the gutters, so the next one peeks in.
  const pageWidth = Math.max(240, width - GUTTER * 2);
  const snapInterval = pageWidth + GUTTER / 2;
  const featured = getProgramsByIds(FEATURED_PROGRAM_IDS);
  const filtered = useMemo(
    () =>
      category === null
        ? []
        : EXERCISE_PROGRAMS.filter((program) => program.category === category),
    [category]
  );

  const meta = (program: ExerciseProgram) =>
    t('programs.rowMeta', {
      defaultValue: '{{category}} · {{weeks}} weeks · {{days}}×/week',
      category: getProgramCategoryLabel(t, program.category),
      weeks: program.weeks,
      days: program.daysPerWeek,
    });

  const renderRow = (program: ExerciseProgram, isLast: boolean) => (
    <View key={program.id}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={() => {
          fireSelectionHaptic();
          onSelectProgram(program);
        }}
        className="flex-row items-stretch py-3 pr-2"
      >
        <View className="mr-3">
          {renderCover(program, 56, 26, accents[program.accentVar])}
        </View>
        <View className="flex-1 mr-2 justify-between">
          <View>
            <Text
              className="text-base font-semibold text-text-primary"
              style={{ lineHeight: 18, marginTop: -2 }}
              numberOfLines={1}
            >
              {program.name}
            </Text>
            <Text
              className="text-sm text-text-secondary mt-0.5"
              numberOfLines={1}
            >
              {meta(program)}
            </Text>
          </View>
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            {getProgramLevelLabel(t, program.level)}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('programs.startProgram', {
          defaultValue: 'Start {{name}}',
          name: program.name,
        })}
        onPress={() => {
          fireSelectionHaptic();
          onStartProgram(program);
        }}
        className="absolute right-2 top-5 px-4 py-1.5 rounded-full bg-raised"
      >
        <Text className="text-accent-primary text-sm font-bold">
          {t('programs.start', { defaultValue: 'Start' })}
        </Text>
      </TouchableOpacity>
      {!isLast && <View className="h-px bg-border-subtle ml-[68px]" />}
    </View>
  );

  const featuredCover = (program: ExerciseProgram) => {
    const cover = covers[program.id];
    const source = cover ? getImageSource(cover) : null;
    if (!source) return null;
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <SafeImage
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          fallback={null}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
      </View>
    );
  };

  const renderShelf = (
    key: string,
    title: string,
    subtitle: string,
    programs: ExerciseProgram[]
  ) => {
    const pages = chunk(programs, SHELF_PAGE_SIZE);
    return (
      <View key={key} className="mb-7">
        <View className="px-4 mb-3">
          <Text className="text-xl font-bold text-text-primary">{title}</Text>
          <Text className="text-sm text-text-secondary mt-0.5">{subtitle}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: GUTTER }}
        >
          {pages.map((page, pageIndex) => (
            // No card behind a page: the rows sit straight on the screen
            // background, separated by hairlines, the way a store shelf reads.
            <View
              key={`${key}-page-${pageIndex}`}
              style={{
                width: pageWidth,
                marginRight: pageIndex < pages.length - 1 ? GUTTER / 2 : 0,
              }}
            >
              {page.map((program, index) =>
                renderRow(program, index === page.length - 1)
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View className="mb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
        className="py-3"
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: category === null }}
          onPress={() => setCategory(null)}
          className={`px-4 py-2 rounded-full ${
            category === null ? 'bg-accent-primary' : 'bg-surface'
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              category === null ? 'text-accent-text' : 'text-text-primary'
            }`}
          >
            {t('programs.allCategories', { defaultValue: 'All' })}
          </Text>
        </TouchableOpacity>
        {PROGRAM_CATEGORIES.map((id) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: category === id }}
            onPress={() => setCategory(category === id ? null : id)}
            className={`px-4 py-2 rounded-full ${
              category === id ? 'bg-accent-primary' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                category === id ? 'text-accent-text' : 'text-text-primary'
              }`}
            >
              {getProgramCategoryLabel(t, id)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {category === null ? (
        <>
          <Text className="px-4 text-xs font-bold uppercase tracking-wider mb-2 text-accent-primary">
            {t('programs.featured', { defaultValue: 'Featured' })}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: GUTTER }}
            className="mb-7"
          >
            {featured.map((program, index) => (
              <TouchableOpacity
                key={program.id}
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => {
                  fireSelectionHaptic();
                  onSelectProgram(program);
                }}
                className="rounded-2xl overflow-hidden"
                style={{
                  width: pageWidth,
                  marginRight: index < featured.length - 1 ? GUTTER / 2 : 0,
                  backgroundColor: accents[program.accentVar],
                }}
              >
                {/* The cover sits behind the copy, with the accent still
                    painted underneath so a program with no artwork keeps
                    exactly the card it had. The scrim is what keeps white
                    text legible over an arbitrary photo. */}
                {featuredCover(program)}
                <View
                  style={{ padding: FEATURED_CARD_PADDING, minHeight: 176 }}
                >
                  <Text className="text-white text-2xl font-bold">
                    {program.name}
                  </Text>
                  <Text className="text-white text-base mt-1 opacity-90">
                    {program.tagline}
                  </Text>
                  {/* Pinned to the bottom rather than flowing under the
                      tagline, so every card's Start row sits on the same line
                      however long its copy runs. Inset by the card's own
                      padding, so the gap below it matches the gap to its left. */}
                  <View
                    className="flex-row items-center"
                    style={{
                      position: 'absolute',
                      left: FEATURED_CARD_PADDING,
                      right: FEATURED_CARD_PADDING,
                      bottom: FEATURED_CARD_PADDING,
                    }}
                  >
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('programs.startProgram', {
                        defaultValue: 'Start {{name}}',
                        name: program.name,
                      })}
                      onPress={() => {
                        fireSelectionHaptic();
                        onStartProgram(program);
                      }}
                      className="px-4 py-1.5 rounded-full bg-white/25"
                    >
                      <Text className="text-white text-sm font-bold">
                        {t('programs.start', { defaultValue: 'Start' })}
                      </Text>
                    </TouchableOpacity>
                    <Text className="text-white text-xs ml-3 opacity-90">
                      {t('programs.featuredMeta', {
                        count: countProgramExercises(program),
                        defaultValue: '{{weeks}} weeks · {{count}} exercises',
                        defaultValue_one:
                          '{{weeks}} weeks · {{count}} exercise',
                        defaultValue_other:
                          '{{weeks}} weeks · {{count}} exercises',
                        weeks: program.weeks,
                      })}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {PROGRAM_SHELVES.map((shelf) =>
            renderShelf(
              shelf.id,
              getProgramShelfTitle(t, shelf.id),
              getProgramShelfSubtitle(t, shelf.id),
              getProgramsByIds(shelf.programIds)
            )
          )}
        </>
      ) : filtered.length > 0 ? (
        renderShelf(
          `category-${category}`,
          getProgramCategoryLabel(t, category),
          t('programs.listSubtitle', {
            defaultValue: 'Pick one, follow the sessions, eat to match.',
          }),
          filtered
        )
      ) : (
        <View className="p-6 items-center">
          <Icon name="search" size={22} color={textSecondary} />
          <Text className="text-text-secondary text-sm mt-2 text-center">
            {t('programs.emptyCategory', {
              defaultValue: 'No programs in this category yet.',
            })}
          </Text>
        </View>
      )}
    </View>
  );
};

export default ProgramStore;
