import React from 'react';
import { render } from '@testing-library/react-native';
import type { ExerciseSessionResponse } from '@workspace/shared';
import CompactActivityCard from '../../src/components/CompactActivityCard';
import ExerciseSummary from '../../src/components/ExerciseSummary';

jest.mock('../../src/components/SwipeableExerciseRow', () => {
  const { Text } = require('react-native');
  return ({ session }: { session: ExerciseSessionResponse }) => (
    <Text>
      {session.type === 'individual'
        ? session.exercise_snapshot?.name
        : session.name}
    </Text>
  );
});
jest.mock('../../src/components/CompactActivityRow', () => () => null);

const sessions = ['Run', 'Apple Exercise Time', 'Active Calories'].map(
  (name, id) => ({
    id: String(id),
    type: 'individual',
    exercise_snapshot: { name, source: 'HealthKit' },
  })
) as ExerciseSessionResponse[];

describe.each(['home', 'summary'])('%s exercise list', (surface) => {
  const view = (entries: ExerciseSessionResponse[]) =>
    render(
      surface === 'home' ? (
        <CompactActivityCard sessions={entries} entryDate="2026-09-24" />
      ) : (
        <ExerciseSummary exerciseEntries={entries} entryDate="2026-09-24" />
      )
    );

  it('shows the actual workout without listing daily ring totals as workouts', () => {
    const screen = view(sessions);
    expect(screen.getAllByText('Run')).toHaveLength(1);
    expect(screen.queryByText('Apple Exercise Time')).toBeNull();
    expect(screen.queryByText('Active Calories')).toBeNull();
  });

  it('shows the empty state on days with only provider totals', () => {
    expect(
      view(sessions.slice(1)).getByText('Tap to add exercise')
    ).toBeTruthy();
  });
});
