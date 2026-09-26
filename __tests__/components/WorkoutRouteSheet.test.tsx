import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import WorkoutRouteSheet from '../../src/components/recording/WorkoutRouteSheet';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../src/components/ui/NativePromptSheet', () => {
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
});
jest.mock('../../src/components/FormInput', () => {
  const { TextInput } = require('react-native');
  return TextInput;
});
jest.mock('../../src/components/FilterChipRow', () => () => null);
jest.mock('../../src/components/RouteMap', () => () => null);
jest.mock('../../src/components/Icon', () => () => null);

const permission = Location.requestForegroundPermissionsAsync as jest.Mock;
const position = Location.getCurrentPositionAsync as jest.Mock;
const screen = () =>
  render(
    <WorkoutRouteSheet
      sport="run"
      distanceUnit="km"
      onSave={jest.fn()}
      onClose={jest.fn()}
    />
  );

beforeEach(() => {
  jest.resetAllMocks();
  permission.mockResolvedValue({ granted: true });
});

it('covers the map until the current location arrives', async () => {
  let resolvePosition!: (value: unknown) => void;
  position.mockReturnValue(
    new Promise((resolve) => {
      resolvePosition = resolve;
    })
  );
  const view = screen();
  expect(view.getByText('Searching for your location…')).toBeTruthy();
  await waitFor(() => expect(position).toHaveBeenCalledTimes(1));
  await act(async () =>
    resolvePosition({ coords: { latitude: 43.85, longitude: 18.4 } })
  );
  expect(view.queryByTestId('route-location-loading')).toBeNull();
});

it('removes the overlay on permission failure and allows a successful retry', async () => {
  permission.mockResolvedValueOnce({ granted: false });
  position.mockResolvedValue({ coords: { latitude: 43.85, longitude: 18.4 } });
  const view = screen();
  await waitFor(() =>
    expect(view.queryByTestId('route-location-loading')).toBeNull()
  );
  expect(
    view.getByText(
      'Allow location access and try again to set your starting point.'
    )
  ).toBeTruthy();
  fireEvent.press(view.getByText('Find my starting point'));
  await waitFor(() => expect(position).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(view.queryByTestId('route-location-loading')).toBeNull()
  );
  expect(
    view.queryByText(
      'Allow location access and try again to set your starting point.'
    )
  ).toBeNull();
});
