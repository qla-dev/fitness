import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProfileGoalsScreen from '../../src/screens/ProfileGoalsScreen';
import ProfileEditScreen from '../../src/screens/ProfileEditScreen';
import { fetchDailyGoals } from '../../src/services/api/goalsApi';
import { localApiFetch } from '../../src/services/local/localApi';

jest.mock('../../src/services/api/goalsApi', () => ({
  fetchDailyGoals: jest.fn(),
}));

jest.mock('../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/hooks', () => ({
  useCustomNutrients: () => ({ customNutrients: [], isLoading: false }),
}));

// Force the screen-owned header bar so the Save action is a pressable label
// rather than a native header item the renderer cannot reach.
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as never;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

const GOALS = {
  calories: 2100,
  protein: 150,
  carbs: 200,
  fat: 70,
  dietary_fiber: 30,
  water_goal_ml: 2500,
};

function renderWithClient(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>
  );
}

describe('the profile goals flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchDailyGoals as jest.Mock).mockResolvedValue(GOALS);
  });

  it('lists each goal with its current value and drills into the editor', async () => {
    const { findByText, getAllByText, getByText } = renderWithClient(
      <ProfileGoalsScreen
        navigation={mockNavigation}
        route={{ key: 'ProfileGoals', name: 'ProfileGoals' } as never}
      />
    );

    expect(await findByText('2100 kcal')).toBeTruthy();
    // A goal the payload does not carry still gets a row, so it can be set.
    expect(getAllByText('Not set').length).toBeGreaterThan(0);

    fireEvent.press(getByText('Calories'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ProfileEdit', {
      field: 'goal',
      goalKey: 'calories',
    });
  });

  it('saves one goal without disturbing the others', async () => {
    const { findByDisplayValue, getByLabelText, getByText } = renderWithClient(
      <ProfileEditScreen
        navigation={mockNavigation}
        route={
          {
            key: 'ProfileEdit',
            name: 'ProfileEdit',
            params: { field: 'goal', goalKey: 'calories' },
          } as never
        }
      />
    );

    // The stored value fills the field once the query resolves.
    expect(await findByDisplayValue('2100')).toBeTruthy();

    fireEvent.changeText(getByLabelText('Calories'), '2400');
    fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(localApiFetch).toHaveBeenCalledWith({
        endpoint: '/api/goals',
        method: 'PUT',
        body: { calories: 2400 },
      })
    );
    await waitFor(() => expect(mockNavigation.goBack).toHaveBeenCalled());
  });

  it('refuses a negative goal instead of writing it', async () => {
    const { findByDisplayValue, getByLabelText, getByText } = renderWithClient(
      <ProfileEditScreen
        navigation={mockNavigation}
        route={
          {
            key: 'ProfileEdit',
            name: 'ProfileEdit',
            params: { field: 'goal', goalKey: 'calories' },
          } as never
        }
      />
    );

    await findByDisplayValue('2100');
    fireEvent.changeText(getByLabelText('Calories'), '-5');
    fireEvent.press(getByText('Save'));

    expect(localApiFetch).not.toHaveBeenCalled();
    expect(
      getByText(
        'Enter a positive number or zero. Stand hours cannot exceed 24.'
      )
    ).toBeTruthy();
  });
});
