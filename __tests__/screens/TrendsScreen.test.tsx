import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrendsScreen from '../../src/screens/TrendsScreen';
import { useHealthTrends } from '../../src/hooks';
import DashboardTrendCards from '../../src/components/DashboardTrendCards';

jest.mock('../../src/hooks', () => ({
  useHealthTrends: jest.fn(),
  usePreferences: () => ({ preferences: { default_weight_unit: 'lbs' } }),
  useServerConnection: () => ({ isConnected: true, isLoading: false }),
}));
jest.mock('../../src/hooks/useProfileSetup', () => ({
  useProfileSetup: () => ({ openWizard: jest.fn() }),
}));
jest.mock('../../src/components/DashboardTrendCards', () =>
  jest.fn(() => null)
);
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: () => false,
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => {},
}));

test('shows the independent Trends tab, switches range and opens Profile', () => {
  const series = { data: [], isLoading: false, isError: false };
  (useHealthTrends as jest.Mock).mockReturnValue({
    steps: series,
    sleep: series,
    weight: { ...series, data: [{ date: '2026-09-08', weight: 100 }] },
    refetch: jest.fn(),
  });
  const navigate = jest.fn();
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <TrendsScreen
        navigation={{ navigate } as never}
        route={{ name: 'Trends', key: 'trends', params: undefined }}
      />
    </SafeAreaProvider>
  );
  expect(screen.getByText('Trends')).toBeTruthy();
  expect(screen.queryByText('Activity')).toBeNull();
  // The ranges are periods now — D / W / M / 6M / Y, as the Health app spells
  // them — rather than day counts.
  fireEvent.press(screen.getByText('M'));
  expect(useHealthTrends).toHaveBeenLastCalledWith(
    expect.objectContaining({ range: 'm', enabled: true })
  );
  const props = (DashboardTrendCards as jest.Mock).mock.calls.at(-1)[0];
  expect(props.weightUnit).toBe('lbs');
  expect(props.weight.data[0].weight).toBeCloseTo(220.46, 1);
  fireEvent.press(screen.getByLabelText('Profile'));
  expect(navigate).toHaveBeenCalledWith('Profile');
});
