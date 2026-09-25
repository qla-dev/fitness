import React from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native/pure';
import * as Sharing from 'expo-sharing';
import WorkoutPhotoEditor from '../../src/components/recording/WorkoutPhotoEditor';
import { createPhotoPreview } from '../../src/services/recording/photos';
import type { RecordingPhoto } from '../../src/services/recording/types';

const mockDelete = jest.fn();
jest.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ delete: mockDelete })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/recording/photos', () => ({
  recordingPhotoUri: () => 'file:///saved.jpg',
  createPhotoPreview: jest.fn(async () => 'file:///preview.jpg'),
}));
jest.mock(
  '../../src/components/LiquidGlassSurface',
  () => require('react-native').View
);
jest.mock('../../src/components/recording/PhotoTextColor', () => () => null);
jest.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ actions, onPressAction, children }: any) => {
    const { View, Pressable, Text } = require('react-native');
    return (
      <View>
        {children}
        {actions.map((action: any) => (
          <Pressable
            key={action.id}
            onPress={() => onPressAction({ nativeEvent: { event: action.id } })}
          >
            <Text>{action.title}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));
const photo: RecordingPhoto = {
  fileName: 'aaaa.jpg',
  originalFileName: 'bbbb.jpg',
  capturedAt: 0,
  composition: {
    width: 390,
    height: 844,
    top: 60,
    metrics: [{ text: '5 km', x: 24, y: 60, size: 48 }],
    route: [],
  },
};
async function finishPreview() {
  await act(async () => {
    jest.advanceTimersByTime(150);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

it('fills the image width, exports the stage proportions and shares through the system sheet', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  fireEvent(screen.getByTestId('workout-photo-stage'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 650 } },
  });
  await finishPreview();
  expect(createPhotoPreview).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ aspectRatio: 0.6, layout: 'classic' })
  );
  expect(screen.UNSAFE_getByType(Image).props.resizeMode).toBe('cover');
  expect(
    StyleSheet.flatten(screen.getByTestId('workout-photo-stage').props.style)
  ).toMatchObject({ width: '100%' });
  await act(async () => {
    fireEvent.press(screen.getByText('Share'));
  });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    'file:///preview.jpg',
    expect.objectContaining({ mimeType: 'image/jpeg' })
  );
  expect(screen.queryByText('Share to Instagram')).toBeNull();
  expect(screen.queryByText('Close')).toBeNull();
});

it('waits for the selected layout before allowing sharing and discards only the editor', async () => {
  const discard = jest.fn();
  const view = render(<WorkoutPhotoEditor photo={photo} onDiscard={discard} />);
  await finishPreview();
  fireEvent.press(screen.getByText('Route poster'));
  fireEvent.press(screen.getByText('Share'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoPreview).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ layout: 'poster' })
  );
  fireEvent.press(screen.getByText('Discard'));
  expect(discard).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockDelete).toHaveBeenCalled();
});

it('ignores a stale preview that finishes after a newer selection', async () => {
  let resolveOld!: (uri: string) => void;
  jest.mocked(createPhotoPreview).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  await finishPreview();
  fireEvent.press(screen.getByText('Distance spotlight'));
  await finishPreview();
  await act(async () => {
    resolveOld('file:///stale.jpg');
  });
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(
    'file:///preview.jpg'
  );
  expect(mockDelete).toHaveBeenCalled();
});
