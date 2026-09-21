import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PresetSearchScreen from '../../src/screens/PresetSearchScreen';
import { useNavigationActionGuard } from '../../src/hooks/useNavigationActionGuard';
import { useScreenHeader } from '../../src/hooks/useScreenHeader';
import { useStartLiveWorkout } from '../../src/hooks/useStartLiveWorkout';
import { useCreateExercise } from '../../src/hooks/useExerciseMutations';
import { useExercisesLibrary } from '../../src/hooks/useExercisesLibrary';
import type { Exercise } from '../../src/types/exercise';

jest.mock('../../src/hooks/useNavigationActionGuard', () => ({
  useNavigationActionGuard: jest.fn(),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: jest.fn(
    (config: { accessory?: React.ReactNode }) => config?.accessory ?? null
  ),
  // The screen offsets its list by the measured native bar; off the native
  // path there is nothing to clear.
  useNativeHeaderOffset: jest.fn(() => 0),
  HEADER_CONTENT_GAP: 12,
}));
jest.mock('../../src/hooks/useStartLiveWorkout', () => ({
  useStartLiveWorkout: jest.fn(),
}));
jest.mock('../../src/hooks/useExerciseMutations', () => ({
  useCreateExercise: jest.fn(),
}));
jest.mock('../../src/hooks/useExercisesLibrary', () => ({
  useExercisesLibrary: jest.fn(),
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
const mockCreate = useCreateExercise as jest.MockedFunction<
  typeof useCreateExercise
>;
const mockLibrary = useExercisesLibrary as jest.MockedFunction<
  typeof useExercisesLibrary
>;

const exercise = (id: string, name: string): Exercise =>
  ({
    id,
    name,
    category: 'Cardio',
    modality: 'duration',
    images: [],
  }) as unknown as Exercise;

let navigation: { goBack: jest.Mock; navigate: jest.Mock };
let startLiveWorkout: jest.Mock;
let createExerciseAsync: jest.Mock;

const renderScreen = (library: Exercise[] = []) => {
  mockLibrary.mockReturnValue({
    exercises: library,
  } as unknown as ReturnType<typeof useExercisesLibrary>);
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PresetSearchScreen
        navigation={navigation as never}
        route={{ key: 'preset', name: 'PresetSearch' } as never}
      />
    </SafeAreaProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  startLiveWorkout = jest.fn().mockResolvedValue(undefined);
  createExerciseAsync = jest.fn(async ({ name }: { name: string }) =>
    exercise('created-1', name)
  );
  mockStart.mockReturnValue({
    startLiveWorkout,
    isStarting: false,
  } as unknown as ReturnType<typeof useStartLiveWorkout>);
  mockCreate.mockReturnValue({
    createExerciseAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateExercise>);
  mockGuard.mockReturnValue({
    runNavigationAction: (action: () => void) => action(),
  } as unknown as ReturnType<typeof useNavigationActionGuard>);
  // The header renders the screen's accessory, which is where the search field
  // and the chip row live.
  mockHeader.mockImplementation(
    (config) => (config?.accessory as React.ReactElement) ?? null
  );
});

describe('PresetSearchScreen', () => {
  it('titles itself Start Workout and offers a way out', () => {
    renderScreen();

    const config = mockHeader.mock.calls[0][0];
    expect(config.title).toBe('Start Workout');
    config.left?.kind === 'dismiss' && config.left.onPress?.();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('lists sports rather than saved exercises, each one only once', () => {
    const { getByTestId, queryAllByText } = renderScreen([
      exercise('lib-1', 'Running'),
    ]);

    // The library also holds a "Running"; the catalogue is what the list shows,
    // so the sport appears once rather than twice.
    expect(getByTestId('start-workout-running')).toBeTruthy();
    expect(queryAllByText('Running')).toHaveLength(1);
  });

  it('calls the ball sport football', () => {
    const { getByTestId, getByText } = renderScreen();

    // Searched for rather than scrolled to: the list is virtualized, and this
    // one sits far enough down that it is not mounted on first render.
    fireEvent.changeText(getByTestId('start-workout-search'), 'foot');

    expect(getByText('Football')).toBeTruthy();
  });

  it('records a GPS sport through setup', () => {
    const { getAllByLabelText } = renderScreen();

    fireEvent.press(getAllByLabelText('GPS tracked')[0]);

    // The sport travels alongside the recording profile: the recorder needs
    // both how to record and what it is recording.
    expect(navigation.navigate).toHaveBeenCalledWith('WorkoutSetup', {
      sport: 'run',
      sportId: 'running',
    });
  });

  it('offers no GPS on a studio sport, which has no route to trace', () => {
    const { getByTestId, queryByText } = renderScreen();

    fireEvent.changeText(getByTestId('start-workout-search'), 'yoga');

    expect(getByTestId('start-workout-yoga')).toBeTruthy();
    expect(queryByText('GPS tracked')).toBeNull();
  });

  it('starts a watch session on an exercise the sport already has', async () => {
    const saved = exercise('lib-yoga', 'Yoga');
    const { getByTestId, getAllByLabelText } = renderScreen([saved]);

    fireEvent.changeText(getByTestId('start-workout-search'), 'yoga');
    fireEvent.press(getAllByLabelText('Smart watch')[0]);

    await waitFor(() => expect(startLiveWorkout).toHaveBeenCalled());
    expect(createExerciseAsync).not.toHaveBeenCalled();
  });

  it('creates the exercise the first time a sport is started', async () => {
    const { getByTestId, getAllByLabelText } = renderScreen();

    fireEvent.changeText(getByTestId('start-workout-search'), 'pilates');
    fireEvent.press(getAllByLabelText('Smart watch')[0]);

    await waitFor(() => expect(createExerciseAsync).toHaveBeenCalled());
    expect(createExerciseAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pilates', category: 'Pilates' })
    );
    expect(startLiveWorkout).toHaveBeenCalled();
  });

  it('filters by where a sport happens, not just by what it is like', () => {
    const { getByText, queryByTestId, getByTestId } = renderScreen();

    fireEvent.press(getByText('Indoor'));

    expect(queryByTestId('start-workout-running')).toBeNull();
    expect(getByTestId('start-workout-yoga')).toBeTruthy();
  });
});
