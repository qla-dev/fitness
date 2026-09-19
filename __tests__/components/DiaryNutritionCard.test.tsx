import { render } from '@testing-library/react-native';

import DiaryNutritionCard from '../../src/components/DiaryNutritionCard';
import type { DailySummary } from '../../src/types/dailySummary';

const summary = {
  caloriesConsumed: 1240,
  calorieGoal: 2500,
  protein: { consumed: 62, goal: 150 },
  carbs: { consumed: 145, goal: 300 },
  fat: { consumed: 38, goal: 100 },
} as DailySummary;

/**
 * The head of the Tracker screen: the day's calories against their goal, and
 * each macro against its own.
 */
describe('DiaryNutritionCard', () => {
  test('reads the calories against their goal', () => {
    const { getByText } = render(<DiaryNutritionCard summary={summary} />);

    expect(getByText('1,240')).toBeTruthy();
    expect(getByText('of 2,500')).toBeTruthy();
  });

  test('shows each macro against its own goal', () => {
    const { getByText } = render(<DiaryNutritionCard summary={summary} />);

    expect(getByText('62')).toBeTruthy();
    expect(getByText('88g left')).toBeTruthy();
    expect(getByText('145')).toBeTruthy();
    expect(getByText('155g left')).toBeTruthy();
    expect(getByText('38')).toBeTruthy();
    expect(getByText('62g left')).toBeTruthy();
  });

  // A day with no goals set still has numbers worth showing; only the lines
  // that measure against a goal drop out.
  test('survives a day with no goals set', () => {
    const { getByText, queryByText } = render(
      <DiaryNutritionCard
        summary={
          {
            caloriesConsumed: 400,
            calorieGoal: 0,
            protein: { consumed: 10, goal: 0 },
            carbs: { consumed: 20, goal: 0 },
            fat: { consumed: 5, goal: 0 },
          } as DailySummary
        }
      />
    );

    expect(getByText('400')).toBeTruthy();
    expect(queryByText(/^of /)).toBeNull();
  });
});
