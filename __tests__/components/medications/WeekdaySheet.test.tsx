import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import WeekdaySheet, {
  type WeekdaySheetRef,
} from '../../../src/components/medications/WeekdaySheet';

jest.mock('../../../src/components/ui/PromptSheet', () =>
  require('../../helpers/promptSheetMock')
);

/** Renders the sheet and opens it, as its row would. */
const openSheet = (value: number[], onChange: (days: number[]) => void) => {
  const ref = React.createRef<WeekdaySheetRef>();
  const screen = render(
    <WeekdaySheet ref={ref} value={value} onChange={onChange} />
  );
  act(() => ref.current?.present());
  return screen;
};

describe('WeekdaySheet', () => {
  it('adds a tapped day and emits the selection sorted', () => {
    const onChange = jest.fn();
    const screen = openSheet([3], onChange);

    fireEvent.press(screen.getByLabelText('Monday, not selected'));

    expect(onChange).toHaveBeenCalledWith([1, 3]);
  });

  it('removes a tapped day that was already selected', () => {
    const onChange = jest.fn();
    const screen = openSheet([1, 3], onChange);

    fireEvent.press(screen.getByLabelText('Wednesday, selected'));

    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it('exposes selection through accessibilityState', () => {
    const screen = openSheet([3], jest.fn());

    expect(
      screen.getByLabelText('Wednesday, selected').props.accessibilityState
        .selected
    ).toBe(true);
    expect(
      screen.getByLabelText('Monday, not selected').props.accessibilityState
        .selected
    ).toBe(false);
  });
});
