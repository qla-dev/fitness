import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import CardPressable from '../../src/components/CardPressable';
import { fireSelectionHaptic } from '../../src/services/haptics';

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

const haptic = fireSelectionHaptic as jest.Mock;

beforeEach(() => {
  haptic.mockClear();
});

/**
 * The chevron is a 24pt target in the corner of a card hundreds of points
 * wide, so pressing the card — the obvious gesture — used to do nothing.
 */
describe('CardPressable', () => {
  test('the whole card opens what its chevron points at', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <CardPressable accessibilityLabel="Exercise" onPress={onPress}>
        <Text>21/30</Text>
      </CardPressable>
    );

    fireEvent.press(getByLabelText('Exercise'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('a press gives the same feedback every other card action does', () => {
    const { getByLabelText } = render(
      <CardPressable accessibilityLabel="Steps" onPress={jest.fn()}>
        <Text>7.5k</Text>
      </CardPressable>
    );

    fireEvent.press(getByLabelText('Steps'));

    expect(haptic).toHaveBeenCalledTimes(1);
  });

  test('a card that leads nowhere is not a button at all', () => {
    const { queryByLabelText, getByText } = render(
      <CardPressable accessibilityLabel="Steps">
        <Text>7.5k</Text>
      </CardPressable>
    );

    // Still rendered, just not a target — no stray feedback on a card with
    // nothing behind it.
    expect(getByText('7.5k')).toBeTruthy();
    expect(queryByLabelText('Steps')).toBeNull();
    expect(haptic).not.toHaveBeenCalled();
  });
});
