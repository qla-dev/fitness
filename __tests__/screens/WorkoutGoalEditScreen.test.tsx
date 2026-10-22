import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WorkoutGoalEditScreen from '../../src/screens/WorkoutGoalEditScreen';

jest.mock(
  '../../src/components/ui/PromptScreen',
  () =>
    ({ children, footerLabel, onFooterPress }: any) => {
      const { View, Text, Pressable } = require('react-native');
      return (
        <View>
          {children}
          <Pressable onPress={onFooterPress}>
            <Text>{footerLabel}</Text>
          </Pressable>
        </View>
      );
    }
);
jest.mock(
  '../../src/components/LiquidGlassSurface',
  () => require('react-native').View
);
jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

const renderScreen = (
  kind: 'time' | 'distance' | 'calories',
  value: number,
  distanceUnit: 'km' | 'miles' = 'km'
) => {
  const navigation = { popTo: jest.fn() };
  const view = render(
    <WorkoutGoalEditScreen
      navigation={navigation as any}
      route={
        {
          key: 'WorkoutGoalEdit',
          name: 'WorkoutGoalEdit',
          params: { sport: 'run', kind, value, distanceUnit },
        } as any
      }
    />
  );
  return { view, popTo: navigation.popTo };
};

const handedBack = (popTo: jest.Mock) => popTo.mock.calls[0][1].editedGoal;

it('uses the macro stepper and hands minutes back only with Done', () => {
  const { view, popTo } = renderScreen('time', 95);
  fireEvent.press(view.getByLabelText('Increase goal'));
  expect(view.getByText('100')).toBeTruthy();
  expect(popTo).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Done'));
  expect(popTo).toHaveBeenCalledWith(
    'WorkoutSetup',
    expect.objectContaining({ sport: 'run' }),
    { merge: true }
  );
  expect(handedBack(popTo)).toMatchObject({ kind: 'time', value: 100 });
});
it('keeps fractional distances in the chosen unit', () => {
  const { view, popTo } = renderScreen('distance', 5.2, 'miles');
  fireEvent.press(view.getByLabelText('Increase goal'));
  expect(view.getByText('5.3')).toBeTruthy();
  expect(view.getByText('MI')).toBeTruthy();
  fireEvent.press(view.getByText('Done'));
  expect(handedBack(popTo)).toMatchObject({ kind: 'distance', value: 5.3 });
});
it.each([
  ['time', 1],
  ['distance', 0.1],
  ['calories', 25],
] as const)('keeps %s above its minimum', (kind, value) => {
  const { view, popTo } = renderScreen(kind, value);
  fireEvent.press(view.getByLabelText('Decrease goal'));
  fireEvent.press(view.getByText('Done'));
  expect(handedBack(popTo)).toMatchObject({ kind, value });
});
