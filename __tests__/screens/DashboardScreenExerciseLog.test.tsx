import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardScreen from '../../src/screens/DashboardScreen';
import { useDailySummary } from '../../src/hooks';
import type { DailySummary, MacroSummary } from '../../src/types/dailySummary';

type DashboardScreenProps = React.ComponentProps<typeof DashboardScreen>;

const mockNavigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  isFocused: jest.fn(() => true),
} as unknown as DashboardScreenProps['navigation'];

const dashboardRoute = {
  key: 'Dashboard-1',
  name: 'Dashboard',
  params: undefined,
} as unknown as DashboardScreenProps['route'];

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (callback: () => void) => {
      callback();
    },
    useNavigation: () => mockNavigation,
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('../../src/hooks', () => ({
  fastingRootQueryKey: ['fasting'],
  medicationsRootQueryKey: ['medications'],
  useServerConnection: jest.fn(() => ({
    isConnected: true,
    isLoading: false,
  })),
  useDailySummary: jest.fn(),
  useCustomNutrients: jest.fn(() => ({ refetch: jest.fn() })),
  useNutrientDisplayPreferences: jest.fn(() => ({ refetch: jest.fn() })),
  useMeasurements: jest.fn(() => ({
    measurements: { steps: 0 },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })),
  usePreferences: jest.fn(() => ({
    preferences: {
      default_weight_unit: 'kg',
      default_distance_unit: 'km',
      show_net_carbs: false,
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })),
  useWidgetSync: jest.fn(),
}));

jest.mock('../../src/hooks/useCheckInPhotos', () => ({
  useCheckInPhotoDates: () => ({ dates: [] as string[], isLoading: false }),
}));

jest.mock('../../src/hooks/useExerciseImageSource', () => ({
  useExerciseImageSource: jest.fn(() => ({ getImageSource: jest.fn() })),
}));

jest.mock('../../src/hooks/useHeaderActionColors', () => ({
  useHeaderActionColors: jest.fn(() => ({ defaultColor: '#000000' })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: jest.fn(() => false),
  useNativeIOSHeadersActive: jest.fn(() => false),
}));

jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => false,
}));

jest.mock('../../src/utils/nativeHeaderDatePicker', () => ({
  setNativeHeaderDatePickerOptions: jest.fn(),
  createNativeProfileAction: (
    onPress: () => void,
    accessibilityLabel: string
  ) => ({
    sfSymbol: 'person.crop.circle',
    onPress,
    accessibilityLabel,
    identifier: 'tab-header-profile',
  }),
}));

jest.mock('../../src/stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: { getState: () => ({ sessionId: null }) },
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: jest.fn(() => 0),
}));

jest.mock('../../src/components/AddSheet', () => ({
  addSheetRef: { current: null },
}));

const stub = (testID: string) => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID={testID} /> };
};

jest.mock('../../src/components/CalendarSheet', () => stub('calendar-sheet'));
jest.mock('../../src/components/TabHeader', () => stub('tab-header'));
jest.mock('../../src/components/DashboardActivityCard', () =>
  stub('activity-card')
);
jest.mock('../../src/components/DashboardActivityDetails', () =>
  stub('activity-details')
);
jest.mock('../../src/components/FastingCard', () => stub('fasting-card'));
jest.mock('../../src/components/FastingGoalReconciler', () =>
  stub('fasting-reconciler')
);
jest.mock('../../src/components/CycleCard', () => stub('cycle-card'));
jest.mock('../../src/components/MedicationsCard', () => stub('medications'));
jest.mock('../../src/components/ProgressPhotosCard', () => stub('photos-card'));
jest.mock('../../src/components/StatusView', () => stub('status-view'));

// The subject of this suite: a probe standing in for ExerciseSummary that
// reports which sessions the screen handed it.
jest.mock('../../src/components/ExerciseSummary', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ exerciseEntries }: { exerciseEntries: { id: string }[] }) => (
      <View testID="exercise-summary">
        {exerciseEntries.map((entry) => (
          <Text key={entry.id}>{entry.id}</Text>
        ))}
      </View>
    ),
  };
});

const noMacro: MacroSummary = { consumed: 0, goal: 0 };

const baseSummary: DailySummary = {
  date: '2024-06-15',
  calorieGoal: 0,
  caloriesConsumed: 0,
  caloriesBurned: 0,
  activeCalories: 0,
  otherExerciseCalories: 0,
  netCalories: 0,
  remainingCalories: 0,
  protein: noMacro,
  carbs: noMacro,
  fat: noMacro,
  fiber: noMacro,
  stepCalories: 0,
  exerciseMinutes: 0,
  exerciseMinutesGoal: 0,
  exerciseCaloriesGoal: 0,
  waterConsumed: 0,
  waterGoal: 2500,
  foodEntries: [],
  supplementTotals: {} as unknown as DailySummary['supplementTotals'],
  exerciseEntries: [],
  calorieBalance: { eaten: 0, burned: 0, remaining: 0, goal: 0 },
  goals: { calories: 0, protein: 0, carbs: 0, fat: 0, dietary_fiber: 0 },
  customNutrientTotals: {},
  customNutrientGoals: {},
};

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <DashboardScreen navigation={mockNavigation} route={dashboardRoute} />
    </SafeAreaProvider>
  );

const setSummary = (summary: DailySummary) => {
  (useDailySummary as jest.Mock).mockReturnValue({
    summary,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
};

/** Depth-first index of every rendered node, so ordering is asserted, not hoped for. */
const depthFirstIndex = (root: { children: unknown[] }, node: unknown) => {
  const all: unknown[] = [];
  const walk = (current: { children: unknown[] }) => {
    all.push(current);
    current.children.forEach((child) => {
      if (typeof child !== 'string')
        walk(child as { children: unknown[] });
    });
  };
  walk(root);
  return all.indexOf(node);
};

describe('Activities screen exercise log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSummary(baseSummary);
  });

  test('renders the day sessions in a log after the last card', () => {
    setSummary({
      ...baseSummary,
      exerciseEntries: [
        { id: 'session-1' },
        { id: 'session-2' },
      ] as unknown as DailySummary['exerciseEntries'],
    });

    const { getByTestId, getByText, UNSAFE_root } = renderScreen();

    const log = getByTestId('exercise-summary');
    expect(getByText('session-1')).toBeTruthy();
    expect(getByText('session-2')).toBeTruthy();

    const root = UNSAFE_root as unknown as { children: unknown[] };
    expect(depthFirstIndex(root, log)).toBeGreaterThan(
      depthFirstIndex(root, getByTestId('activity-details'))
    );
    expect(depthFirstIndex(root, log)).toBeGreaterThan(
      depthFirstIndex(root, getByTestId('photos-card'))
    );
  });

  test('keeps the log card on a day with no sessions, as the add affordance', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('exercise-summary')).toBeTruthy();
  });

  test('no longer offers the Activity / Nutrients switcher', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('Activity')).toBeNull();
    expect(queryByText('Nutrients')).toBeNull();
  });
});
