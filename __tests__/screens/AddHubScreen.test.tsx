import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AddHubScreen from '../../src/screens/AddHubScreen';
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (select: (state: { height: number }) => number) =>
    select({ height: 0 }),
  KeyboardStickyView: require('react-native').View,
}));

const mockActions = {
  newFood: jest.fn(),
  newMeal: jest.fn(),
  newGroceryList: jest.fn(),
  newMealPlan: jest.fn(),
  askMarkAI: jest.fn(),
  syncHealthData: jest.fn(),
  openCycle: jest.fn(),
};
const mockNavigation = {
  navigate: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
const mockUseNativeTabs = jest.fn(() => true);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useNavigationState: (select: (state: unknown) => unknown) =>
    select({ routes: [] }),
}));
jest.mock('../../src/components/AddActionsContext', () => ({
  useAddActions: () => mockActions,
}));
jest.mock('../../src/components/CustomTabBar', () => ({
  PILL_GAP: 8,
  PILL_HEIGHT: 48,
  TAB_ICONS: {},
}));
jest.mock('../../src/components/TabsLayout', () => ({ NON_ADD_TABS: [] }));
jest.mock('../../src/hooks', () => ({
  useCycleMode: () => ({ enabled: false }),
}));
jest.mock('../../src/hooks/useFoods', () => ({
  useFoods: () => ({ recentFoods: [] }),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/hooks/useTabPress', () => ({ useTabPress: () => {} }));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: () => mockUseNativeTabs(),
  useLiquidGlassActive: () => false,
}));
jest.mock('../../src/components/LibrarySearchBar', () => () => null);
jest.mock('../../src/components/AddHubSearchState', () => () => null);
jest.mock('../../src/components/ui/NativePromptSheet', () => () => null);
jest.mock('../../src/components/ui/PillInput', () => () => null);
jest.mock('../../src/components/foodSearch/FoodResultRow', () => () => null);
jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test.each([true, false])(
  'offers health sync and MarkAI without an account (native tabs: %s)',
  (nativeTabs) => {
    mockUseNativeTabs.mockReturnValue(nativeTabs);
    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}
      >
        <AddHubScreen />
      </SafeAreaProvider>
    );
    fireEvent.press(screen.getByText('Sync Health Data'));
    expect(mockActions.syncHealthData).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('MarkAI'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MarkAI');
  }
);
