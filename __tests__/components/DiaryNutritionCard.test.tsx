import { fireEvent, render } from '@testing-library/react-native';

// The rings open the GoalEdit modal route, so the card asks for a navigator.
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import DiaryNutritionCard from '../../src/components/DiaryNutritionCard';
import type { DailySummary } from '../../src/types/dailySummary';
import type { FoodEntry } from '../../src/types/foodEntries';

const entry = (fields: Partial<FoodEntry>): FoodEntry =>
  ({ quantity: 1, serving_size: 1, ...fields }) as FoodEntry;

const summary = {
  caloriesConsumed: 1240,
  calorieGoal: 2500,
  protein: { consumed: 62, goal: 150 },
  carbs: { consumed: 145, goal: 300 },
  fat: { consumed: 38, goal: 100 },
  fiber: { consumed: 12, goal: 30 },
  // Everything past the four typed totals is summed from the day's entries.
  foodEntries: [entry({ sodium: 900, vitamin_a: 300 })],
  goals: { sodium: 2300 },
} as unknown as DailySummary;

/**
 * The head of the Tracker screen: the day's calories against their goal, and
 * each macro against its own.
 */
describe('DiaryNutritionCard', () => {
  test('toggles the macro row while keeping the calorie summary visible', () => {
    const { getByRole, getByText, queryByText } = render(
      <DiaryNutritionCard summary={summary} />
    );

    fireEvent.press(getByRole('button', { name: 'Collapse this section' }));
    expect(queryByText('Protein')).toBeNull();
    expect(queryByText('Vitamin A')).toBeNull();
    expect(getByText('kcal left of 2,500')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Expand this section' }).props
        .accessibilityState
    ).toEqual({ expanded: false });

    fireEvent.press(getByRole('button', { name: 'Expand this section' }));
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Vitamin A')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Collapse this section' }).props
        .accessibilityState
    ).toEqual({ expanded: true });
  });

  test('reads the calories against their goal', () => {
    const { getByText } = render(<DiaryNutritionCard summary={summary} />);

    expect(getByText('1,240')).toBeTruthy();
    expect(getByText('kcal left of 2,500')).toBeTruthy();
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

  // The row runs past the three the goals are set in terms of: the rest are
  // summed from the day's entries, in their own units.
  test('carries a ring for every nutrient, not just the big three', () => {
    const { getByText } = render(<DiaryNutritionCard summary={summary} />);

    expect(getByText('Fiber')).toBeTruthy();
    expect(getByText('18g left')).toBeTruthy();
    expect(getByText('Sodium')).toBeTruthy();
    expect(getByText('1,400mg left')).toBeTruthy();
    // No goal set for it, so the figure stands alone.
    expect(getByText('Vitamin A')).toBeTruthy();
    expect(getByText('300')).toBeTruthy();
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
            fiber: { consumed: 0, goal: 0 },
            foodEntries: [],
            goals: {},
          } as unknown as DailySummary
        }
      />
    );

    expect(getByText('400')).toBeTruthy();
    expect(getByText('kcal left')).toBeTruthy();
    expect(queryByText(/kcal left of/)).toBeNull();
  });
});
