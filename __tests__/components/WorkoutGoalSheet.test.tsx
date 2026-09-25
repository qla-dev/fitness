import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WorkoutGoalSheet from '../../src/components/recording/WorkoutGoalSheet';

jest.mock(
  '../../src/components/ui/NativePromptSheet',
  () =>
    ({ children, footerLabel, onFooterPress, onClose }: any) => {
      const { View, Text, Pressable } = require('react-native');
      return (
        <View>
          {children}
          <Pressable onPress={onFooterPress}>
            <Text>{footerLabel}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text>Dismiss</Text>
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

it('uses the macro stepper and commits minutes only with Done', () => {
  const onChange = jest.fn(),
    onClose = jest.fn();
  const view = render(
    <WorkoutGoalSheet
      open
      kind="time"
      value={95}
      distanceUnit="km"
      onChange={onChange}
      onClose={onClose}
    />
  );
  fireEvent.press(view.getByLabelText('Increase goal'));
  expect(view.getByText('100')).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Done'));
  expect(onChange).toHaveBeenCalledWith(100);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('keeps fractional distances and cancels without committing', () => {
  const onChange = jest.fn(),
    onClose = jest.fn();
  const view = render(
    <WorkoutGoalSheet
      open
      kind="distance"
      value={5.2}
      distanceUnit="miles"
      onChange={onChange}
      onClose={onClose}
    />
  );
  fireEvent.press(view.getByLabelText('Increase goal'));
  expect(view.getByText('5.3')).toBeTruthy();
  expect(view.getByText('MI')).toBeTruthy();
  fireEvent.press(view.getByText('Dismiss'));
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});
it.each([
  ['time', 1],
  ['distance', 0.1],
  ['calories', 25],
] as const)('keeps %s above its minimum', (kind, value) => {
  const onChange = jest.fn();
  const view = render(
    <WorkoutGoalSheet
      open
      kind={kind}
      value={value}
      distanceUnit="km"
      onChange={onChange}
      onClose={jest.fn()}
    />
  );
  fireEvent.press(view.getByLabelText('Decrease goal'));
  fireEvent.press(view.getByText('Done'));
  expect(onChange).toHaveBeenCalledWith(value);
});
