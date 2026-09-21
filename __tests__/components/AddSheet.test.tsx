import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, act } from '@testing-library/react-native';
import AddSheet, { type AddSheetRef } from '../../src/components/AddSheet';
import * as dataMode from '../../src/services/dataMode';
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const mockBottomSheetControls = {
  openCount: 0,
  isPresentBlocked: false,
  present: jest.fn(() => {
    if (mockBottomSheetControls.isPresentBlocked) {
      return;
    }
    mockBottomSheetControls.openCount += 1;
  }),
  dismiss: jest.fn(),
  onDismiss: undefined as (() => void) | undefined,
  onAnimate: undefined as
    ((fromIndex: number, toIndex: number) => void) | undefined,
};

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    BottomSheetModal: React.forwardRef(
      ({ children, onDismiss, onAnimate }: any, ref) => {
        // Test mock stashes the latest handlers for assertions; writing to the
        // module-scoped controls during the mock's render is intentional.
        mockBottomSheetControls.onDismiss = onDismiss;
        mockBottomSheetControls.onAnimate = onAnimate;

        React.useImperativeHandle(ref, () => ({
          present: mockBottomSheetControls.present,
          dismiss: mockBottomSheetControls.dismiss,
        }));

        return React.createElement(
          View,
          { testID: 'add-sheet-modal' },
          children
        );
      }
    ),
    BottomSheetView: ({ children }: any) =>
      React.createElement(View, null, children),
    BottomSheetBackdrop: () => null,
  };
});

function renderAddSheet(
  overrides: Partial<React.ComponentProps<typeof AddSheet>> = {}
) {
  const ref = React.createRef<AddSheetRef>();
  const props = {
    onAddFood: jest.fn(),
    onStartWorkout: jest.fn(),
    onAddActivity: jest.fn(),
    onLogWorkout: jest.fn(),
    onSyncHealthData: jest.fn(),
    onBarcodeScan: jest.fn(),
    onAiMealScan: jest.fn(),
    onGroceryList: jest.fn(),
    onAddProgressPhotos: jest.fn(),
    onAskSparky: jest.fn(),
    ...overrides,
  };
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <AddSheet ref={ref} {...props} />
    </SafeAreaProvider>
  );
  return { ref, props, ...utils };
}

describe('AddSheet', () => {
  const originalPlatform = Platform.OS;
  it('offers the three ways into a meal, and the exercise menu behind none of them', () => {
    const screen = renderAddSheet();
    // The title mixes faces: the lead-in stays in the UI font while the
    // wordmark carries the brand face and the accent on ".fit", so the two
    // halves are separate Text nodes.
    expect(screen.getByText('Log data into qla.fit')).toBeTruthy();
    expect(screen.getByText('Log Food')).toBeTruthy();
    expect(screen.getByText('Scan Barcode')).toBeTruthy();
    expect(screen.getByText('AI meal')).toBeTruthy();
    // Workouts moved to the tab header; nothing here opens them.
    expect(screen.queryByText('Live sets & reps')).toBeNull();
  });

  it('opens the AI meal scan from its tile', () => {
    const onAiMealScan = jest.fn();
    const { getByText } = renderAddSheet({ onAiMealScan });
    fireEvent.press(getByText('AI meal'));
    expect(onAiMealScan).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetControls.dismiss).toHaveBeenCalled();
  });
  let requestAnimationFrameSpy: jest.SpyInstance<
    number,
    [FrameRequestCallback]
  >;
  let cancelAnimationFrameSpy: jest.SpyInstance<void, [number]>;

  beforeEach(() => {
    // These controls mock the Gorhom presentation used by Android.
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    jest.clearAllMocks();
    mockBottomSheetControls.openCount = 0;
    mockBottomSheetControls.isPresentBlocked = false;
    mockBottomSheetControls.onDismiss = undefined;
    mockBottomSheetControls.onAnimate = undefined;
    requestAnimationFrameSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    cancelAnimationFrameSpy = jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('re-presents after dismiss if present is requested while a close is still winding down', () => {
    const { ref } = renderAddSheet();

    act(() => ref.current?.present());
    expect(mockBottomSheetControls.openCount).toBe(1);

    mockBottomSheetControls.isPresentBlocked = true;
    mockBottomSheetControls.onAnimate?.(0, -1);
    act(() => ref.current?.present());

    expect(mockBottomSheetControls.openCount).toBe(1);

    mockBottomSheetControls.isPresentBlocked = false;
    act(() => mockBottomSheetControls.onDismiss?.());

    expect(mockBottomSheetControls.openCount).toBe(2);
  });

  it('does not re-present after dismiss when no new present was requested', () => {
    const onDismissWithoutAction = jest.fn();
    const { ref } = renderAddSheet({ onDismissWithoutAction });

    act(() => ref.current?.present());
    expect(mockBottomSheetControls.openCount).toBe(1);

    mockBottomSheetControls.onAnimate?.(0, -1);
    act(() => mockBottomSheetControls.onDismiss?.());

    expect(mockBottomSheetControls.openCount).toBe(1);
    expect(onDismissWithoutAction).toHaveBeenCalledTimes(1);
  });

  it('offers the grocery list as a full-width row under the tiles', () => {
    const onGroceryList = jest.fn();
    const { ref, getByText } = renderAddSheet({ onGroceryList });

    act(() => ref.current?.present());
    fireEvent.press(getByText('Grocery list'));
    expect(onGroceryList).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetControls.dismiss).toHaveBeenCalled();
  });

  it.each([false, true])(
    'opens Progress Photos with local mode %s',
    (localMode) => {
      const modeSpy = jest
        .spyOn(dataMode, 'isLocalDataMode')
        .mockReturnValue(localMode);
      const onAddProgressPhotos = jest.fn();
      const onDismissWithoutAction = jest.fn();
      const { ref, getByText } = renderAddSheet({
        onAddProgressPhotos,
        onDismissWithoutAction,
      });

      act(() => ref.current?.present());
      fireEvent.press(getByText('Progress Photos'));
      act(() => mockBottomSheetControls.onDismiss?.());

      expect(onAddProgressPhotos).toHaveBeenCalledTimes(1);
      expect(onDismissWithoutAction).not.toHaveBeenCalled();
      modeSpy.mockRestore();
    }
  );

  it('invokes onSyncHealthData when the secondary Sync Health Data row is pressed', () => {
    const onSyncHealthData = jest.fn();
    const onDismissWithoutAction = jest.fn();
    const { ref, getByText } = renderAddSheet({
      onSyncHealthData,
      onDismissWithoutAction,
    });

    act(() => ref.current?.present());
    fireEvent.press(getByText('Sync Health Data'));
    act(() => mockBottomSheetControls.onDismiss?.());

    expect(onSyncHealthData).toHaveBeenCalledTimes(1);
    expect(onDismissWithoutAction).not.toHaveBeenCalled();
  });

  it('offers live start, activity, and past logging in the exercise submenu', () => {
    const { ref, props, getByText, queryByText } = renderAddSheet();

    act(() => ref.current?.present({ initialMenu: 'exercise' }));

    expect(getByText('Workout')).toBeTruthy();
    expect(getByText('Live sets & reps')).toBeTruthy();
    expect(getByText('Activity')).toBeTruthy();
    expect(getByText('Log Workout')).toBeTruthy();
    expect(getByText('Past sets & reps')).toBeTruthy();
    expect(queryByText('Preset')).toBeNull();

    fireEvent.press(getByText('Workout'));
    expect(props.onStartWorkout).toHaveBeenCalledTimes(1);
    expect(props.onLogWorkout).not.toHaveBeenCalled();
  });

  it('renders Polish labels when the active i18n language is Polish', async () => {
    const {
      default: i18n,
      initializeI18n,
    } = require('../../src/localization/i18n');
    await initializeI18n('en');
    const { ref, getByText } = renderAddSheet();
    await i18n.changeLanguage('pl');
    act(() => ref.current?.present({ initialMenu: 'exercise' }));
    expect(getByText('Trening')).toBeTruthy();
    expect(getByText('Serie i powtórzenia na żywo')).toBeTruthy();
    expect(getByText('Wstecz')).toBeTruthy();
    await i18n.changeLanguage('en');
  });

  it('fires onLogWorkout from the Log Workout submenu option', () => {
    const { ref, props, getByText } = renderAddSheet();

    act(() => ref.current?.present({ initialMenu: 'exercise' }));
    fireEvent.press(getByText('Log Workout'));

    expect(props.onLogWorkout).toHaveBeenCalledTimes(1);
    expect(props.onStartWorkout).not.toHaveBeenCalled();
  });
});
