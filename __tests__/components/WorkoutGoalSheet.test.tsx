import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WorkoutGoalSheet from '../../src/components/recording/WorkoutGoalSheet.ios';

jest.mock('@expo/ui/swift-ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Host: View,
    BottomSheet: View,
    HStack: View,
    VStack: View,
    Text,
    Picker: ({
      label,
      children,
      ...props
    }: {
      label: string;
      children: React.ReactNode;
    }) => (
      <View testID={label} {...props}>
        {children}
      </View>
    ),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  buttonStyle: jest.fn(),
  font: jest.fn(),
  padding: jest.fn(),
  pickerStyle: jest.fn(),
  presentationDetents: jest.fn(),
  presentationDragIndicator: jest.fn(),
  tag: jest.fn(),
}));

it('edits hours and minutes together and never creates a zero-minute goal', () => {
  const changed = jest.fn();
  function Editor() {
    const [value, setValue] = useState(95);
    return (
      <WorkoutGoalSheet
        open
        kind="time"
        value={value}
        distanceUnit="km"
        onChange={(next) => {
          changed(next);
          setValue(next);
        }}
        onClose={jest.fn()}
      />
    );
  }
  const view = render(<Editor />);
  fireEvent(view.getByTestId('Hours'), 'selectionChange', 2);
  expect(changed).toHaveBeenLastCalledWith(155);
  fireEvent(view.getByTestId('Minutes'), 'selectionChange', 10);
  expect(changed).toHaveBeenLastCalledWith(130);
  fireEvent(view.getByTestId('Hours'), 'selectionChange', 0);
  fireEvent(view.getByTestId('Minutes'), 'selectionChange', 0);
  expect(changed).toHaveBeenLastCalledWith(1);
});

it('edits fractional distance in the selected display unit and closes with Done', () => {
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
  fireEvent(view.getByTestId('Decimal'), 'selectionChange', 7);
  expect(onChange).toHaveBeenLastCalledWith(5.7);
  expect(view.getByText('MI')).toBeTruthy();
  fireEvent.press(view.getByText('Done'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
