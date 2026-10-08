import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RunRideRecorder from '../../src/components/recording/RunRideRecorder';
import { discardRecording } from '../../src/services/recording/recorder';

let mockSnapshot: any;
const mockSensors = { heartRate: null, heartRateAt: 0 };
jest.mock('../../src/services/recording/recorder', () => ({
  discardRecording: jest.fn(async () => {
    mockSnapshot = { ...mockSnapshot, session: null };
  }),
  getRecordingSnapshot: () => mockSnapshot,
  initializeRecorder: jest.fn(async () => undefined),
  pauseRecording: jest.fn(),
  resumeRecording: jest.fn(),
  saveRecording: jest.fn(),
  startRecording: jest.fn(async () => undefined),
  subscribeRecording: () => () => undefined,
}));
jest.mock('../../src/services/recording/sensors', () => ({
  getSensorSnapshot: () => mockSensors,
  stopWatchHeartRate: jest.fn(),
  WatchWorkoutStartError: class extends Error {},
  subscribeSensors: () => () => undefined,
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../src/components/RouteMap', () => () => null);
jest.mock('../../src/components/WorkoutHudBar', () => () => null);
jest.mock('../../src/components/recording/WorkoutCamera', () => () => null);
jest.mock('../../src/components/recording/MetricIcon', () => () => null);
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: {} }),
}));

const pausedSession = {
  id: 's1',
  sport: 'ride',
  phase: 'paused',
  distance: 0,
  updatedAt: 0,
  startedAt: 0,
  gps: false,
};
const navigation = () =>
  ({
    replace: jest.fn(),
    addListener: jest.fn(() => () => undefined),
    dispatch: jest.fn(),
  }) as any;

it('returns to workout setup for the same sport after a discard', async () => {
  mockSnapshot = { ready: true, points: [], session: pausedSession };
  const nav = navigation();
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });
  const view = render(
    <RunRideRecorder navigation={nav} initialSportId="cycling" />
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Discard'));
  });
  view.rerender(<RunRideRecorder navigation={nav} initialSportId="cycling" />);
  expect(discardRecording).toHaveBeenCalled();
  expect(nav.replace).toHaveBeenCalledTimes(1);
  expect(nav.replace).toHaveBeenCalledWith('WorkoutSetup', {
    sport: 'ride',
    sportId: 'cycling',
  });
  expect(screen.queryByText('Start recording')).toBeNull();
});

it('sends a bare entry with nothing recording to workout setup', () => {
  mockSnapshot = { ready: true, points: [], session: null };
  const nav = navigation();
  render(<RunRideRecorder navigation={nav} initialSport="run" />);
  expect(nav.replace).toHaveBeenCalledWith('WorkoutSetup', {
    sport: 'run',
    sportId: undefined,
  });
});

it('does not start a new recording after discarding the session it resumed', async () => {
  const { startRecording } = jest.requireMock(
    '../../src/services/recording/recorder'
  );
  startRecording.mockClear();
  mockSnapshot = { ready: true, points: [], session: pausedSession };
  const nav = navigation();
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });
  // Arrived from setup with everything an auto-start needs, onto a session
  // that was already under way.
  const view = render(
    <RunRideRecorder
      navigation={nav}
      initialSport="ride"
      initialSportId="cycling"
      initialWeightKg={80}
    />
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Discard'));
  });
  view.rerender(
    <RunRideRecorder
      navigation={nav}
      initialSport="ride"
      initialSportId="cycling"
      initialWeightKg={80}
    />
  );
  expect(discardRecording).toHaveBeenCalled();
  expect(startRecording).not.toHaveBeenCalled();
});
