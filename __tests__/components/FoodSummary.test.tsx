import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FoodSummary from '../../src/components/FoodSummary';
import type { DailyGoals } from '../../src/types/goals';
import type { FoodEntry } from '../../src/types/foodEntries';
import type { MealType } from '../../src/types/mealTypes';

jest.mock('../../src/components/Icon', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

jest.mock('../../src/components/SwipeableFoodRow', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="food-row" /> };
});

const mealTypes: MealType[] = [
  {
    id: 'sys-b',
    name: 'breakfast',
    sort_order: 0,
    user_id: null,
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  {
    id: 'sys-l',
    name: 'lunch',
    sort_order: 1,
    user_id: null,
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  {
    id: 'custom-pw',
    name: 'Pre-Workout',
    sort_order: 0,
    user_id: 'user1',
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  {
    id: 'custom-ps',
    name: 'Post-Workout',
    sort_order: 5,
    user_id: 'user1',
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  // A CUSTOM category deliberately named like the system type.
  {
    id: 'custom-b',
    name: 'breakfast',
    sort_order: 0,
    user_id: 'user1',
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
];

const entry = (
  id: string,
  meal_type_id: string,
  meal_type: string
): FoodEntry => ({ id, meal_type_id, meal_type }) as FoodEntry;

const customBreakfastOnly = mealTypes.filter((mt) => mt.id === 'custom-b');

describe('FoodSummary', () => {
  it('renders custom meal types as their own sections (not merged into Other)', () => {
    const view = render(
      <FoodSummary
        foodEntries={[
          entry('1', 'custom-pw', 'Pre-Workout'),
          entry('2', 'custom-ps', 'Post-Workout'),
        ]}
        mealTypes={mealTypes}
      />
    );

    expect(view.getByText('Pre-Workout')).toBeTruthy();
    expect(view.getByText('Post-Workout')).toBeTruthy();
    expect(view.queryByText('Other')).toBeNull();
  });

  it('orders sections by sort_order and renders system labels with canonical English labels', () => {
    const view = render(
      <FoodSummary
        foodEntries={[
          entry('1', 'sys-l', 'lunch'),
          entry('2', 'sys-b', 'breakfast'),
          entry('3', 'custom-ps', 'Post-Workout'),
        ]}
        mealTypes={mealTypes}
      />
    );

    // Every visible meal type gets a card now, empty ones included, so this
    // only pins the ORDER of the canonical system labels and the custom type
    // among them: breakfast (0), lunch (1), Post-Workout (5).
    const texts = view
      .getAllByText(/Breakfast|Lunch|Post-Workout/)
      .map((n) => n.props.children);
    expect(texts).toEqual(['Breakfast', 'Lunch', 'Post-Workout']);
  });

  it('keeps hidden/deleted type entries visible in their own literal group', () => {
    const view = render(
      <FoodSummary
        foodEntries={[entry('1', 'gone-id', 'Deleted Meal')]}
        mealTypes={mealTypes}
      />
    );

    expect(view.getByText('Deleted Meal')).toBeTruthy();
    expect(view.queryByText('Other')).toBeNull();
  });

  it('passes the canonical meal type id and name when a section is pressed', () => {
    const onPressMealType = jest.fn();
    const view = render(
      <FoodSummary
        foodEntries={[entry('1', 'custom-pw', 'Pre-Workout')]}
        mealTypes={mealTypes}
        onPressMealType={onPressMealType}
      />
    );

    fireEvent.press(view.getByText('Pre-Workout'));
    expect(onPressMealType).toHaveBeenCalledWith(
      'custom-pw',
      'Pre-Workout',
      expect.any(Array)
    );
  });

  it('renders a custom category named breakfast literally (not the canonical Breakfast)', () => {
    const view = render(
      <FoodSummary
        foodEntries={[entry('1', 'custom-b', 'breakfast')]}
        mealTypes={customBreakfastOnly}
      />
    );

    expect(view.getByText('breakfast')).toBeTruthy();
    expect(view.queryByText('Breakfast')).toBeNull();
  });

  it('keeps the two apart when both a system and a custom breakfast exist', () => {
    const view = render(
      <FoodSummary
        foodEntries={[entry('1', 'custom-b', 'breakfast')]}
        mealTypes={mealTypes}
      />
    );

    // Every visible meal type now has a card, so the system Breakfast shows up
    // empty beside the custom one — each under its own label.
    expect(view.getByText('breakfast')).toBeTruthy();
    expect(view.getByText('Breakfast')).toBeTruthy();
  });

  it('uses the neutral icon for a custom category named breakfast', () => {
    const view = render(
      <FoodSummary
        foodEntries={[entry('1', 'custom-b', 'breakfast')]}
        mealTypes={customBreakfastOnly}
      />
    );

    // The custom group renders the neutral snack icon, not the system
    // breakfast icon.
    expect(view.queryByTestId('icon-meal-breakfast')).toBeNull();
    expect(view.getByTestId('icon-meal-snack')).toBeTruthy();
  });

  it('system breakfast receives the configured target calories', () => {
    const goals = { breakfast_percentage: 25 } as DailyGoals;
    const { getByText } = render(
      <FoodSummary
        foodEntries={[entry('e1', 'sys-b', 'breakfast')]}
        mealTypes={mealTypes}
        goals={goals}
        calorieGoal={2000}
      />
    );
    // 25% of 2000 = 500 Cal target shown alongside the meal calories.
    expect(getByText(/\/ 500/)).toBeTruthy();
  });

  it('a CUSTOM type named breakfast never inherits the system target calories', () => {
    const goals = { breakfast_percentage: 25 } as DailyGoals;
    const { queryByText } = render(
      <FoodSummary
        foodEntries={[entry('e2', 'custom-b', 'breakfast')]}
        mealTypes={customBreakfastOnly}
        goals={goals}
        calorieGoal={2000}
      />
    );
    // No target chip at all — the custom category must not receive the system
    // Breakfast target.
    expect(queryByText(/\/ 500/)).toBeNull();
    expect(queryByText(/\/ \d+/)).toBeNull();
  });

  it('a historical (unresolved) group never inherits target calories', () => {
    const goals = { breakfast_percentage: 25 } as DailyGoals;
    const { queryByText } = render(
      <FoodSummary
        // A deleted/unknown custom name with no id: falls into its own literal
        // historical group (isSystem=false) and must not receive any target.
        foodEntries={[
          {
            id: 'e3',
            meal_type_id: null,
            meal_type: 'my deleted custom',
          } as FoodEntry,
        ]}
        // No meal types, so the historical group is the only card on screen:
        // the system Breakfast card does carry a 500 target and would match
        // the query below, hiding what this test is actually about.
        mealTypes={[]}
        goals={goals}
        calorieGoal={2000}
      />
    );
    expect(queryByText(/\/ 500/)).toBeNull();
  });
});
