import React from 'react';
import { AppState } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import WorkoutCamera from '../../src/components/recording/WorkoutCamera';

const mockCapture = jest.fn();
const mockMount = jest.fn();
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: React.forwardRef((props: { facing: string }, ref: unknown) => {
      React.useState(() => {
        mockMount(props.facing);
        return null;
      });
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockCapture }));
      return <View testID="camera-preview" {...props} />;
    }),
  };
});
jest.mock('../../src/components/Icon', () => () => null);
jest.mock('../../src/services/recording/recorder', () => ({
  attachRecordingPhoto: jest.fn(),
}));
jest.mock('../../src/services/recording/photos', () => ({
  createRecordingPhoto: jest.fn(),
  deleteRecordingPhoto: jest.fn(),
  recordingPhotoUri: jest.fn(),
}));
jest.mock('../../src/services/haptics', () => ({
  fireRefreshHaptic: jest.fn(),
}));
jest.mock('../../src/services/sounds', () => ({
  playCameraShutterSound: jest.fn(),
}));

it('covers a lens restart in black and enables capture after the new camera is ready', async () => {
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  mockMount.mockClear();
  mockCapture.mockReturnValue(new Promise(() => {}));
  try {
    const view = render(
      <WorkoutCamera
        recordingId="recording"
        lines={['', '', '', '', '', '']}
        bottom={0}
        top={0}
        active
        viewport={{ width: 390, height: 844 }}
        route={[]}
      />
    );
    expect(view.getByTestId('camera-restarting-cover')).toBeTruthy();
    fireEvent(view.getByTestId('camera-preview'), 'cameraReady');
    expect(view.queryByTestId('camera-restarting-cover')).toBeNull();
    fireEvent.press(view.getByLabelText('Switch camera'));
    expect(mockMount.mock.calls.map(([facing]) => facing)).toEqual([
      'front',
      'back',
    ]);
    expect(view.getByTestId('camera-restarting-cover')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Capture photo with metrics'));
    expect(mockCapture).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('camera-preview'), 'cameraReady');
    expect(view.queryByTestId('camera-restarting-cover')).toBeNull();
    fireEvent.press(view.getByLabelText('Capture photo with metrics'));
    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(1));
  } finally {
    AppState.currentState = previousState;
  }
});
