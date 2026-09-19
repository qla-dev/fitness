import { render, fireEvent } from '@testing-library/react-native';
import TrainingCard from '../../src/components/TrainingCard';
import { fireSelectionHaptic } from '../../src/services/haptics';

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

const haptic = fireSelectionHaptic as jest.Mock;

beforeEach(() => {
  haptic.mockClear();
});

/**
 * A training option as a card rather than a list row: the whole tile starts
 * the workout, and the details pill is the one thing on it that does not.
 */
describe('TrainingCard', () => {
  test('the whole card starts the workout', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TrainingCard title="Bench Press" onPress={onPress} />
    );

    fireEvent.press(getByLabelText('Bench Press'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(haptic).toHaveBeenCalledTimes(1);
  });

  test('the details pill opens the detail without starting anything', () => {
    const onPress = jest.fn();
    const onInfo = jest.fn();
    const { getByLabelText } = render(
      <TrainingCard title="Bench Press" onPress={onPress} onInfo={onInfo} />
    );

    fireEvent.press(getByLabelText('Details'));

    expect(onInfo).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('carries no details pill when there is nothing to open', () => {
    const { queryByLabelText } = render(
      <TrainingCard title="Bench Press" onPress={jest.fn()} />
    );

    expect(queryByLabelText('Details')).toBeNull();
  });

  // A second press while the session is being created would start two.
  test('stops taking presses while it is starting', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TrainingCard title="Bench Press" onPress={onPress} starting />
    );

    fireEvent.press(getByLabelText('Bench Press'));

    expect(onPress).not.toHaveBeenCalled();
  });

  test('shows the qualifier it was given', () => {
    const { getByText } = render(
      <TrainingCard title="Bench Press" subtitle="Chest" onPress={jest.fn()} />
    );

    expect(getByText('Chest')).toBeTruthy();
  });
});
