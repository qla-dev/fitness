import React from 'react';
import { render } from '@testing-library/react-native';
import DashboardActivityCard from '../../src/components/DashboardActivityCard';
import type { DailySummary, MacroSummary } from '../../src/types/dailySummary';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../src/hooks/useManualHealthSync', () => ({
  useManualHealthSync: () => ({ sync: jest.fn(), isPending: false }),
}));

const noMacro: MacroSummary = { consumed: 0, goal: 0 };

const summary = {
  date: '2026-09-17',
  calorieGoal: 0,
  caloriesConsumed: 0,
  caloriesBurned: 0,
  activeCalories: 240,
  otherExerciseCalories: 160,
  netCalories: 0,
  remainingCalories: 0,
  protein: noMacro,
  carbs: noMacro,
  fat: noMacro,
  fiber: noMacro,
  stepCalories: 0,
  exerciseMinutes: 25,
  exerciseMinutesGoal: 30,
  exerciseCaloriesGoal: 500,
  waterConsumed: 0,
  waterGoal: 2500,
  foodEntries: [],
  supplementTotals: {} as unknown as DailySummary['supplementTotals'],
  exerciseEntries: [],
  calorieBalance: { eaten: 0, burned: 0, remaining: 0, goal: 0 },
  goals: {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    dietary_fiber: 0,
    steps: 10000,
  },
  customNutrientTotals: {},
  customNutrientGoals: {},
} as unknown as DailySummary;

// Only the numbers are unknown while a day loads. The titles, icons and ring
// tracks are identical either way, so skeletoning them made the whole card
// flash on every open.
test('skeletons the values while loading, and nothing else', () => {
  const { getAllByTestId, queryByText, getByText, getAllByText } = render(
    <DashboardActivityCard summary={summary} steps={8200} loading />
  );

  expect(getAllByTestId('value-skeleton').length).toBeGreaterThan(0);
  // Labels stay put.
  expect(getByText('Move')).toBeTruthy();
  expect(getAllByText('Exercise').length).toBeGreaterThan(0);
  // No figure is asserted until there is one.
  expect(queryByText(/400/)).toBeNull();
});

test('shows the values once the day has loaded', () => {
  const { queryByTestId, getByText } = render(
    <DashboardActivityCard summary={summary} steps={8200} />
  );

  expect(queryByTestId('value-skeleton')).toBeNull();
  expect(getByText(/400/)).toBeTruthy();
  expect(getByText('Move')).toBeTruthy();
});
