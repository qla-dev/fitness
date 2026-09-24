import React from 'react';
import { render } from '@testing-library/react-native';
import GoalFacts from '../../src/components/GoalFacts';
import SmallGraphFact from '../../src/components/SmallGraphFact';
import CoverFact from '../../src/components/CoverFact';
import TextFact from '../../src/components/TextFact';
import { initializeI18n } from '../../src/localization/i18n';
import { useGoalFactHistory } from '../../src/hooks/useGoalFactHistory';

jest.mock('../../src/hooks/useGoalFactHistory', () => ({
  useGoalFactHistory: jest.fn(),
}));
const mockHistory = jest.mocked(useGoalFactHistory);

beforeEach(async () => {
  await initializeI18n('en');
  mockHistory.mockReturnValue({ points: [], isLoading: false, isError: false });
});

it.each([
  'steps',
  'move',
  'exercise',
  'stand',
  'distance',
  'water',
  'weight',
  'sleep',
] as const)(
  'gives %s a generated cover, text and at least two graph facts even without history',
  (metric) => {
    const screen = render(
      <GoalFacts
        metric={metric}
        date="2026-09-23"
        title={metric}
        icon="flame"
        color="#FF5500"
        weightUnit="kg"
        distanceUnit="km"
      />
    );
    // Move carries a second cover, about BMR.
    const covers = screen.UNSAFE_getAllByType(CoverFact);
    expect(covers).toHaveLength(metric === 'move' ? 2 : 1);
    for (const cover of covers) expect(cover.props.image).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(TextFact)).toHaveLength(1);
    expect(
      screen.UNSAFE_getAllByType(SmallGraphFact).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText(
        'Your comparisons will appear as you record more data.'
      ).length
    ).toBeGreaterThanOrEqual(2);
  }
);

it('uses converted weight history without summing weigh-ins', () => {
  mockHistory.mockReturnValue({
    points: [
      { day: '2026-09-02', value: 180 },
      { day: '2026-09-21', value: 176 },
    ],
    isLoading: false,
    isError: false,
  });
  const screen = render(
    <GoalFacts
      metric="weight"
      date="2026-09-23"
      title="Weight"
      icon="scale"
      color="#FF5500"
      weightUnit="lbs"
      distanceUnit="km"
    />
  );
  const graphs = screen.UNSAFE_getAllByType(SmallGraphFact);
  expect(graphs[0].props.series.map((s: { value: number }) => s.value)).toEqual(
    [180, 176]
  );
  expect(graphs[1].props.series.map((s: { value: number }) => s.value)).toEqual(
    [176, 180]
  );
  expect(graphs[0].props.formatValue(180)).toBe('180 lbs');
});
