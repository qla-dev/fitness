import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ExerciseProgramScreen from '../../src/screens/ExerciseProgramScreen';
import ProgramExerciseRow from '../../src/components/ProgramExerciseRow';
import SafeImage from '../../src/components/SafeImage';
import {
  EXERCISE_PROGRAMS,
  getProgramById,
} from '../../src/constants/exercisePrograms';
import { countProgramExercises } from '../../src/types/exerciseProgram';
import { fetchExercisesPage } from '../../src/services/api/exerciseApi';

jest.mock('../../src/services/api/exerciseApi', () => ({
  fetchExercisesPage: jest.fn(),
}));

jest.mock('../../src/hooks/useExternalProviders', () => ({
  useExternalProviders: () => ({ providers: [], isLoading: false }),
}));

jest.mock('../../src/hooks/useExerciseImageSource', () => ({
  useExerciseImageSource: () => ({
    getImageSource: (uri: string) => ({ uri }),
  }),
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: jest.fn(() => 0),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  canGoBack: jest.fn(() => true),
  isFocused: jest.fn(() => true),
} as never;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function renderProgram(programId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <ExerciseProgramScreen
          navigation={mockNavigation}
          route={
            {
              key: 'ExerciseProgram-1',
              name: 'ExerciseProgram',
              params: { programId },
            } as never
          }
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

describe('the program catalogue', () => {
  it('ships at least twenty programs, each with at least twenty exercises', () => {
    expect(EXERCISE_PROGRAMS.length).toBeGreaterThanOrEqual(20);
    for (const program of EXERCISE_PROGRAMS) {
      expect(countProgramExercises(program)).toBeGreaterThanOrEqual(20);
    }
  });

  it('gives every program a unique id, sessions and nutrition', () => {
    const ids = EXERCISE_PROGRAMS.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const program of EXERCISE_PROGRAMS) {
      expect(program.sessions.length).toBeGreaterThan(0);
      expect(program.nutrition.tips.length).toBeGreaterThan(0);
      expect(program.highlights.length).toBeGreaterThan(0);
    }
  });
});

describe('ExerciseProgramScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens only the first session by default and toggles session exercises', () => {
    const program = getProgramById('glutes-for-days')!;
    const screen = renderProgram(program.id);
    const rows = screen.UNSAFE_getAllByType(ProgramExerciseRow);
    expect(rows).toHaveLength(program.sessions[0].exercises.length);
    for (const row of rows) {
      const thumbnail = row.findByType(SafeImage);
      expect(thumbnail.props.source).toBeNull();
      expect(thumbnail.props.fallback).toBeTruthy();
    }
    // The rows stay unresolved until they are tapped. The one lookup that does
    // run on mount is the program's cover, which reads the first movement.
    expect(fetchExercisesPage).toHaveBeenCalledTimes(1);
    expect(fetchExercisesPage).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: program.sessions[0].exercises[0].name,
      })
    );
    fireEvent.press(
      screen.getByRole('button', { name: program.sessions[0].name })
    );
    expect(screen.UNSAFE_queryAllByType(ProgramExerciseRow)).toHaveLength(0);
    fireEvent.press(
      screen.getByRole('button', { name: program.sessions[1].name })
    );
    expect(screen.UNSAFE_getAllByType(ProgramExerciseRow)).toHaveLength(
      program.sessions[1].exercises.length
    );
    expect(
      screen.getByRole('button', { name: program.sessions[1].name }).props
        .accessibilityState.expanded
    ).toBe(true);
  });

  it('renders the program, its sessions and its nutrition', () => {
    const program = getProgramById('glutes-for-days');
    expect(program).toBeDefined();

    const screen = renderProgram('glutes-for-days');

    // Twice on the fallback path: the header bar title and the hero.
    expect(screen.getAllByText(program!.name).length).toBeGreaterThan(0);
    expect(screen.getByText(program!.coach)).toBeTruthy();
    expect(screen.getByText(program!.summary)).toBeTruthy();
    // Every session heading and the nutrition block are on the page.
    for (const [index, session] of program!.sessions.entries()) {
      expect(screen.getByText(`Week ${index + 1} - ${session.name}`)).toBeTruthy();
    }
    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.getByText(program!.nutrition.calories)).toBeTruthy();
  });

  it('falls back to an explicit empty state for an unknown program', () => {
    const screen = renderProgram('not-a-real-program');

    expect(screen.getByText('Program unavailable')).toBeTruthy();
  });
});

describe('program exercises open the real exercise', () => {
  it('resolves a listed movement through the API and pushes its detail', async () => {
    const saved = {
      id: 'ex-1',
      name: 'Barbell Hip Thrust',
      category: 'strength',
      images: [],
    };
    (fetchExercisesPage as jest.Mock).mockResolvedValue({
      exercises: [saved],
      pagination: { page: 1, pageSize: 10, totalCount: 1, hasMore: false },
    });

    const screen = renderProgram('glutes-for-days');

    await act(async () => {
      fireEvent.press(screen.getAllByText('Barbell Hip Thrust')[0]);
    });

    expect(fetchExercisesPage).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: 'Barbell Hip Thrust' })
    );
    await waitFor(() =>
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ExerciseDetail', {
        item: saved,
      })
    );
  });
});
