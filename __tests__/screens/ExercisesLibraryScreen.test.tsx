import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExercisesLibraryScreen from '../../src/screens/ExercisesLibraryScreen';
import { useExercisesLibrary, useServerConnection } from '../../src/hooks';
import type { Exercise } from '../../src/types/exercise';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';
import { pressHeaderMenuAction } from './helpers/nativeHeaderTestUtils';
import { useExternalProviders } from '../../src/hooks/useExternalProviders';
import { useExternalExerciseSearch } from '../../src/hooks/useExternalExerciseSearch';
import { importExercise } from '../../src/services/api/externalExerciseSearchApi';

jest.mock('../../src/hooks', () => ({
  useExercisesLibrary: jest.fn(),
  useServerConnection: jest.fn(),
  useProfile: jest.fn(() => ({ profile: undefined, isLoading: false })),
  // The store shelves resolve program covers through the API; this suite is
  // about the library list, so every program keeps its icon.
  useProgramThumbnails: jest.fn(() => ({})),
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: jest.fn(() => 0),
}));

jest.mock('../../src/hooks/useExternalProviders', () => ({
  useExternalProviders: jest.fn(() => ({ providers: [], isLoading: false })),
}));

jest.mock('../../src/hooks/useExternalExerciseSearch', () => ({
  useExternalExerciseSearch: jest.fn(() => ({
    searchResults: [],
    isSearching: false,
    isSearchActive: false,
    isSearchError: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  })),
}));

jest.mock('../../src/services/api/externalExerciseSearchApi', () => ({
  importExercise: jest.fn(),
}));

// The row thumbnail's hook calls useFocusEffect, which needs a navigation
// context this screen's tests don't mount. Mocked the same way
// ExerciseSearchScreen's tests do.
jest.mock('../../src/hooks/useExerciseImageSource', () => ({
  useExerciseImageSource: jest.fn(() => ({
    getImageSource: jest.fn((path: string) => ({ uri: path, headers: {} })),
  })),
}));

const mockUseExercisesLibrary = useExercisesLibrary as jest.MockedFunction<
  typeof useExercisesLibrary
>;
const mockUseServerConnection = useServerConnection as jest.MockedFunction<
  typeof useServerConnection
>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  // The screen is a Library drill-in here, so it has somewhere to go back to.
  canGoBack: jest.fn(() => true),
  // The import handler only navigates while the screen is still focused.
  isFocused: jest.fn(() => true),
} as any;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function createExercise(
  id: string,
  name: string,
  category: string | null = 'strength'
): Exercise {
  return {
    id,
    name,
    category,
    equipment: ['barbell'],
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps'],
    calories_per_hour: 300,
    source: 'sparky',
    images: [],
    tags: [],
  };
}

type LibraryHookReturn = ReturnType<typeof useExercisesLibrary>;

const buildHookReturn = (
  overrides: Partial<LibraryHookReturn> = {}
): LibraryHookReturn => ({
  exercises: [],
  isLoading: false,
  isSearching: false,
  isError: false,
  isFetchNextPageError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  loadMore: jest.fn(),
  refetch: jest.fn(),
  ...overrides,
});

describe('ExercisesLibraryScreen', () => {
  const navigation = mockNavigation;

  const route = {
    key: 'ExercisesLibrary-key',
    name: 'ExercisesLibrary' as const,
    params: undefined,
  };

  const renderScreen = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={{ insets, frame }}>
          <ExercisesLibraryScreen navigation={navigation} route={route} />
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAppPreferencesStoreForTests();
    mockUseServerConnection.mockReturnValue({
      isConnected: true,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseExercisesLibrary.mockReturnValue(buildHookReturn());
  });

  it('lists exercises from the library hook and navigates to ExerciseDetail', async () => {
    mockUseExercisesLibrary.mockReturnValue(
      buildHookReturn({
        exercises: [
          createExercise('ex-1', 'Bench Press'),
          createExercise('ex-2', 'Squat'),
        ],
      })
    );

    const screen = renderScreen();

    await waitFor(() => expect(screen.getByText('Bench Press')).toBeTruthy());
    expect(screen.getByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByText('Bench Press'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExerciseDetail',
      expect.objectContaining({
        item: expect.objectContaining({ id: 'ex-1', name: 'Bench Press' }),
      })
    );
  });

  it('passes the typed term to useExercisesLibrary as the user types', async () => {
    const screen = renderScreen();

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search exercises...'),
        'sq'
      );
    });

    expect(mockUseExercisesLibrary).toHaveBeenLastCalledWith('sq', {
      enabled: true,
    });
  });

  it('persists an ownership filter chosen from the header menu and filters the list', async () => {
    mockUseExercisesLibrary.mockReturnValue(
      buildHookReturn({
        exercises: [
          createExercise('ex-1', 'Bench Press'),
          {
            ...createExercise('ex-2', 'Community Squat'),
            sharedWithPublic: true,
          } as Exercise,
        ],
      })
    );

    const screen = renderScreen();
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeTruthy());

    pressHeaderMenuAction(navigation, 'Public');

    expect(
      useAppPreferencesStore.getState().exercisesLibraryOwnershipFilter
    ).toBe('public');
    expect(screen.getByText('Community Squat')).toBeTruthy();
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  it('renders the no-server state when disconnected', () => {
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = renderScreen();

    expect(screen.getByText('No server configured')).toBeTruthy();
    fireEvent.press(screen.getByText('Go to Settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Profile');
  });

  it('renders an error state with a working Retry button', () => {
    const refetch = jest.fn();
    mockUseExercisesLibrary.mockReturnValue(
      buildHookReturn({ isError: true, refetch })
    );

    const screen = renderScreen();

    expect(screen.getByText('Failed to load exercises')).toBeTruthy();
    fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('ExercisesLibraryScreen online search', () => {
  const navigation = mockNavigation;
  const route = {
    key: 'ExercisesLibrary-key',
    name: 'ExercisesLibrary' as const,
    params: undefined,
  };

  const mockUseExternalProviders = useExternalProviders as jest.MockedFunction<
    typeof useExternalProviders
  >;
  const mockUseExternalExerciseSearch =
    useExternalExerciseSearch as jest.MockedFunction<
      typeof useExternalExerciseSearch
    >;
  const mockImportExercise = importExercise as jest.MockedFunction<
    typeof importExercise
  >;

  const renderScreen = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={{ insets, frame }}>
          <ExercisesLibraryScreen navigation={navigation} route={route} />
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  };

  const configureOnline = (results: { id: string; name: string }[]) => {
    mockUseExternalProviders.mockReturnValue({
      providers: [{ id: 'p1', provider_type: 'wger', provider_name: 'wger' }],
    } as unknown as ReturnType<typeof useExternalProviders>);
    mockUseExternalExerciseSearch.mockReturnValue({
      searchResults: results.map((r) => ({ ...r, source: 'wger' })),
      isSearching: false,
      isSearchActive: true,
      isSearchError: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
    } as unknown as ReturnType<typeof useExternalExerciseSearch>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAppPreferencesStoreForTests();
    mockUseServerConnection.mockReturnValue({
      isConnected: true,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useServerConnection>);
  });

  it('shows saved exercises first, then only the online results that are not already saved', async () => {
    mockUseExercisesLibrary.mockReturnValue(
      buildHookReturn({ exercises: [createExercise('1', 'Bench Press')] })
    );
    configureOnline([
      // Same name as the saved one: it must not appear twice in the list.
      { id: 'w1', name: 'Bench Press' },
      { id: 'w2', name: 'Incline Bench' },
    ]);

    const screen = renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Search exercises...'),
      'bench'
    );

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.getByText('My exercises')).toBeTruthy();
    expect(screen.getByText('Incline Bench')).toBeTruthy();
    // The duplicate is filtered out, so the saved row is the only match.
    expect(screen.getAllByText('Bench Press')).toHaveLength(1);
  });

  it('imports an online exercise on tap and opens the saved copy', async () => {
    const imported = createExercise('new-1', 'Incline Bench');
    mockImportExercise.mockResolvedValue(imported);
    mockUseExercisesLibrary.mockReturnValue(buildHookReturn({ exercises: [] }));
    configureOnline([{ id: 'w2', name: 'Incline Bench' }]);

    const screen = renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Search exercises...'),
      'bench'
    );

    await waitFor(() => expect(screen.getByText('Incline Bench')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Incline Bench'));
    });

    expect(mockImportExercise).toHaveBeenCalledWith('wger', 'w2');
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('ExerciseDetail', {
        item: imported,
      })
    );
  });

  it('keeps the plain library list when the search box is empty', () => {
    mockUseExercisesLibrary.mockReturnValue(
      buildHookReturn({ exercises: [createExercise('1', 'Bench Press')] })
    );
    configureOnline([{ id: 'w2', name: 'Incline Bench' }]);

    const screen = renderScreen();

    // The store sits above the library, and the library keeps its heading —
    // but nothing from the provider shows until the user actually searches.
    expect(screen.getByText('Featured')).toBeTruthy();
    expect(screen.getByText('Build Serious Muscle')).toBeTruthy();
    expect(screen.getByText('My exercises')).toBeTruthy();
    expect(screen.queryByText('Online')).toBeNull();
    expect(screen.queryByText('Incline Bench')).toBeNull();
  });
});
