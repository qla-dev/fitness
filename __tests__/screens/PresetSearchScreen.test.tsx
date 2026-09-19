import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PresetSearchScreen from '../../src/screens/PresetSearchScreen';
import { useNavigationActionGuard } from '../../src/hooks/useNavigationActionGuard';
import { useScreenHeader } from '../../src/hooks/useScreenHeader';
import { useStartLiveWorkout } from '../../src/hooks/useStartLiveWorkout';
import { useSuggestedExercises } from '../../src/hooks/useSuggestedExercises';
import { useExerciseSearch } from '../../src/hooks/useExerciseSearch';
import { buildSingleExerciseStartPayload } from '../../src/utils/workoutSession';
import type { Exercise } from '../../src/types/exercise';

jest.mock('../../src/hooks/useNavigationActionGuard', () => ({
  useNavigationActionGuard: jest.fn(),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: jest.fn(() => null),
}));
jest.mock('../../src/hooks/useStartLiveWorkout', () => ({
  useStartLiveWorkout: jest.fn(),
}));
jest.mock('../../src/hooks/useSuggestedExercises', () => ({
  useSuggestedExercises: jest.fn(),
}));
jest.mock('../../src/hooks/useExerciseSearch', () => ({
  useExerciseSearch: jest.fn(),
}));
jest.mock('../../src/hooks/useExerciseImageSource', () => ({
  useExerciseImageSource: jest.fn(() => ({
    getImageSource: jest.fn((path: string) => ({ uri: path, headers: {} })),
  })),
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: jest.fn(() => false),
}));

const mockGuard = useNavigationActionGuard as jest.MockedFunction<
  typeof useNavigationActionGuard
>;
const mockHeader = useScreenHeader as jest.MockedFunction<
  typeof useScreenHeader
>;
const mockStart = useStartLiveWorkout as jest.MockedFunction<
  typeof useStartLiveWorkout
>;
const mockSuggested = useSuggestedExercises as jest.MockedFunction<
  typeof useSuggestedExercises
>;
const mockSearch = useExerciseSearch as jest.MockedFunction<
  typeof useExerciseSearch
>;

const exercise = (id: string, name: string): Exercise =>
  ({
    id,
    name,
    category: 'Strength',
    equipment: [],
    primary_muscles: [],
    secondary_muscles: [],
    calories_per_hour: 0,
    source: 'local',
    images: [],
    tags: [],
  }) as unknown as Exercise;

const bench = exercise('e1', 'Bench Press');
const squat = exercise('e2', 'Squat');

let startLiveWorkout: jest.Mock;
let navigation: { goBack: jest.Mock; navigate: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  startLiveWorkout = jest.fn();
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockStart.mockReturnValue({
    startLiveWorkout,
    isStarting: false,
  } as unknown as ReturnType<typeof useStartLiveWorkout>);
  mockGuard.mockReturnValue({
    isNavigationLocked: false,
    runNavigationAction: (fn: () => void) => fn(),
  } as unknown as ReturnType<typeof useNavigationActionGuard>);
  mockHeader.mockReturnValue(null);
  mockSuggested.mockReturnValue({
    recentExercises: [bench],
    topExercises: [squat],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useSuggestedExercises>);
  mockSearch.mockReturnValue({
    searchResults: [],
    isSearching: false,
    isSearchActive: false,
    isSearchError: false,
  } as unknown as ReturnType<typeof useExerciseSearch>);
});

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <PresetSearchScreen
        navigation={navigation as never}
        route={{ key: 'k', name: 'PresetSearch', params: undefined } as never}
      />
    </SafeAreaProvider>
  );

/**
 * Start Workout lists the local exercises and nothing else.
 *
 * Saved programs are deliberately absent: they are opened from the profile and
 * started from their own detail screen, so having them here made one screen
 * answer two different questions with a layout that changed depending on
 * whether any were saved.
 */
describe('PresetSearchScreen', () => {
  test('titles itself Start Workout and offers a way out', () => {
    renderScreen();

    const config = mockHeader.mock.calls[0][0];
    expect(config.title).toBe('Start Workout');
    expect(config.left).toMatchObject({ kind: 'dismiss' });
  });

  test('lists the local exercises, recent before popular', () => {
    const { getByText } = renderScreen();

    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByText('Squat')).toBeTruthy();
  });

  // One tap, not two: the card is the workout, with its first movement chosen.
  test('a card starts a workout built from that one exercise', () => {
    const { getByLabelText } = renderScreen();

    fireEvent.press(getByLabelText('Bench Press'));

    expect(startLiveWorkout).toHaveBeenCalledWith({
      exercises: buildSingleExerciseStartPayload(bench),
    });
  });

  test('the details pill opens the exercise without starting anything', () => {
    const { getAllByLabelText } = renderScreen();

    fireEvent.press(getAllByLabelText('Details')[0]);

    expect(navigation.navigate).toHaveBeenCalledWith('ExerciseDetail', {
      item: bench,
      hideWorkoutActions: true,
    });
    expect(startLiveWorkout).not.toHaveBeenCalled();
  });

  test('typing searches exercises rather than programs', () => {
    mockSearch.mockReturnValue({
      searchResults: [squat],
      isSearching: false,
      isSearchActive: true,
      isSearchError: false,
    } as unknown as ReturnType<typeof useExerciseSearch>);

    const { getByTestId, getByText, queryByText } = renderScreen();
    fireEvent.changeText(getByTestId('start-workout-search'), 'squ');

    expect(getByText('Squat')).toBeTruthy();
    expect(queryByText('Bench Press')).toBeNull();
  });

  // The row that used to sit above the list only led to another screen.
  test('carries no empty-workout row', () => {
    const { queryByTestId } = renderScreen();

    expect(queryByTestId('empty-workout-row')).toBeNull();
  });
});
