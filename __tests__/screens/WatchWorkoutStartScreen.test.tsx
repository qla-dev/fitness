import {
  act,
  cleanup,
  fireEvent,
  render,
} from '@testing-library/react-native/pure';
import WatchWorkoutStartScreen from '../../src/screens/WatchWorkoutStartScreen';
import {
  startWatchHeartRate,
  stopWatchHeartRate,
} from '../../src/services/recording/sensors';
import type { RootStackScreenProps } from '../../src/types/navigation';

jest.mock('../../src/services/recording/sensors', () => ({
  getSensorSnapshot: () => mockSensors,
  subscribeSensors: () => () => {},
  startWatchHeartRate: jest.fn(),
  stopWatchHeartRate: jest.fn().mockResolvedValue(undefined),
}));
const mockSensors = { watchName: 'Apple Watch Ultra (49mm)' };
jest.mock('../../src/components/ui/PromptScreen', () => {
  const { View, Text, Pressable } = require('react-native');
  return ({
    title,
    description,
    footerLabel,
    onFooterPress,
    children,
  }: {
    title: string;
    description: string;
    footerLabel: string;
    onFooterPress: () => void;
    children: React.ReactNode;
  }) => (
    <View>
      <Text>{title}</Text>
      <Text>{description}</Text>
      {children}
      <Pressable onPress={onFooterPress}>
        <Text>{footerLabel}</Text>
      </Pressable>
    </View>
  );
});

let beforeRemove: () => void;
let opened: (event: { data: { closing: boolean } }) => void;
const navigation = {
  addListener: jest.fn((event, callback) => {
    if (event === 'beforeRemove') beforeRemove = callback;
    else if (event === 'transitionEnd') opened = callback;
    return jest.fn();
  }),
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const params = {
  sport: 'run',
  sportId: 'running',
  weightKg: 75,
  watch: true,
  gps: true,
} as const;
const props = {
  navigation,
  route: { key: 'pairing', name: 'WatchWorkoutStart', params },
} as unknown as RootStackScreenProps<'WatchWorkoutStart'>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(startWatchHeartRate).mockReset();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

it('shows the device name and waits for the watch before handing off to the recorder', async () => {
  let confirm!: () => void;
  jest.mocked(startWatchHeartRate).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      })
  );
  const screen = render(<WatchWorkoutStartScreen {...props} />);
  expect(
    screen.getByText('Connecting to Apple Watch Ultra (49mm)')
  ).toBeTruthy();
  expect(startWatchHeartRate).toHaveBeenCalledWith('run', {
    sportId: 'running',
  });
  expect(navigation.dispatch).not.toHaveBeenCalled();
  await act(async () => confirm());
  expect(screen.getByText('Apple Watch Ultra (49mm) is ready')).toBeTruthy();
  act(() => jest.advanceTimersByTime(400));
  expect(navigation.dispatch).not.toHaveBeenCalled();
  act(() => opened({ data: { closing: false } }));
  act(() => jest.advanceTimersByTime(400));
  const reset = navigation.dispatch.mock.calls[0][0]({
    routes: [
      { key: 'tabs', name: 'Tabs' },
      { key: 'setup', name: 'WorkoutSetup' },
      { key: 'pairing', name: 'WatchWorkoutStart' },
    ],
  });
  expect(reset.payload.routes).toEqual([
    { key: 'tabs', name: 'Tabs' },
    { name: 'RunOrRide', params },
  ]);
  screen.unmount();
  expect(stopWatchHeartRate).not.toHaveBeenCalled();
});

it('stops a cancelled launch immediately and ignores its late confirmation', async () => {
  let confirm!: () => void;
  jest.mocked(startWatchHeartRate).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      })
  );
  const screen = render(<WatchWorkoutStartScreen {...props} />);
  fireEvent.press(screen.getByText('Cancel'));
  expect(navigation.goBack).toHaveBeenCalled();
  act(() => beforeRemove());
  expect(stopWatchHeartRate).toHaveBeenCalledTimes(1);
  await act(async () => confirm());
  act(() => jest.runOnlyPendingTimers());
  expect(navigation.dispatch).not.toHaveBeenCalled();
});

it('keeps a failed start in the sheet and allows retry', async () => {
  jest
    .mocked(startWatchHeartRate)
    .mockRejectedValueOnce(new Error('Timeout'))
    .mockImplementationOnce(() => new Promise(() => {}));
  const screen = render(<WatchWorkoutStartScreen {...props} />);
  await act(async () => {});
  expect(screen.getByText('Watch workout did not start')).toBeTruthy();
  fireEvent.press(screen.getByText('Retry'));
  expect(startWatchHeartRate).toHaveBeenCalledTimes(2);
  expect(
    screen.getByText('Connecting to Apple Watch Ultra (49mm)')
  ).toBeTruthy();
  expect(navigation.dispatch).not.toHaveBeenCalled();
});

it('cancels the handoff when dismissed during the ready animation', async () => {
  jest.mocked(startWatchHeartRate).mockResolvedValue(undefined);
  render(<WatchWorkoutStartScreen {...props} />);
  await act(async () => {});
  act(() => beforeRemove());
  act(() => jest.advanceTimersByTime(400));
  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(stopWatchHeartRate).toHaveBeenCalledTimes(1);
});
