import React, { useMemo, useState } from 'react';
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
        onPress={() => onSelectProgram(program)}
        className="flex-row items-center py-3 pr-2"
      >
        <View
          className="rounded-2xl items-center justify-center mr-3"
          style={{
            width: 56,
            height: 56,
            backgroundColor: accents[program.accentVar],
          }}
        >
          <Icon name={program.icon} size={26} color="#FFFFFF" />
        </View>
        <View className="flex-1 mr-2">
          <Text
            className="text-base font-semibold text-text-primary"
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
          <Text
            className="text-xs text-text-secondary mt-0.5"
            numberOfLines={1}
          >
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
        onPress={() => onStartProgram(program)}
        className="absolute right-2 top-5 px-4 py-1.5 rounded-full bg-raised"
      >
        <Text className="text-accent-primary text-sm font-bold">
          {t('programs.start', { defaultValue: 'Start' })}
        </Text>
      </TouchableOpacity>
      {!isLast && <View className="h-px bg-border-subtle ml-[68px]" />}
    </View>
  );

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
                onPress={() => onSelectProgram(program)}
                className="rounded-2xl overflow-hidden"
                style={{
                  width: pageWidth,
                  marginRight: index < featured.length - 1 ? GUTTER / 2 : 0,
                  backgroundColor: accents[program.accentVar],
                }}
              >
                <View className="p-5" style={{ minHeight: 176 }}>
                  <View
                    className="rounded-2xl items-center justify-center mb-4"
                    style={{
                      width: 52,
                      height: 52,
                      backgroundColor: 'rgba(0,0,0,0.22)',
                    }}
                  >
                    <Icon name={program.icon} size={26} color="#FFFFFF" />
                  </View>
                  <Text className="text-white text-2xl font-bold">
                    {program.name}
                  </Text>
                  <Text className="text-white text-base mt-1 opacity-90">
                    {program.tagline}
                  </Text>
                  <View className="flex-row items-center mt-4">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('programs.startProgram', {
                        defaultValue: 'Start {{name}}',
                        name: program.name,
                      })}
                      onPress={() => onStartProgram(program)}
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
