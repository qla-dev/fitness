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
import {
  createPhotoPreview,
  createPhotoEditorLayers,
} from '../../src/services/recording/photos';
import { fireSelectionHaptic } from '../../src/services/haptics';
import type { RecordingPhoto } from '../../src/services/recording/types';

const mockDelete = jest.fn();
jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));
jest.mock(
  '../../src/components/recording/PhotoEditorCanvas',
  () => (props: any) => {
    const { View } = require('react-native');
    return <View testID="editable-layers" {...props} />;
  }
);
jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native');
  return { Canvas: View, Image: View, ColorMatrix: View, useImage: () => null };
});
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
  createPhotoEditorLayers: jest.fn(async () => ({
    background: 'file:///background.png',
    stats: 'file:///stats.png',
    route: 'file:///route.png',
  })),
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
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
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
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ layout: 'poster' })
  );
  fireEvent.press(screen.getByText('Discard'));
  expect(discard).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockDelete).toHaveBeenCalled();
});

it('ignores a stale preview that finishes after a newer selection', async () => {
  let resolveOld!: (layers: {
    background: string;
    stats: string;
    route: string;
  }) => void;
  jest.mocked(createPhotoEditorLayers).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  fireEvent(screen.getByTestId('workout-photo-stage'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 650 } },
  });
  await finishPreview();
  fireEvent.press(screen.getByText('Distance spotlight'));
  await finishPreview();
  await act(async () => {
    resolveOld({
      background: 'file:///old-background.png',
      stats: 'file:///old-stats.png',
      route: 'file:///old-route.png',
    });
  });
  expect(screen.getByTestId('editable-layers').props.layers.background).toBe(
    'file:///background.png'
  );
  expect(mockDelete).toHaveBeenCalled();
});

it('updates the overlay font and waits for its export before sharing', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  await finishPreview();
  fireEvent.press(screen.getByText('Anton'));
  fireEvent.press(screen.getByText('Share'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ font: 'anton' })
  );
});

it('selects a filter from the thumbnail strip and waits for its export', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  await finishPreview();
  fireEvent.press(screen.getByLabelText('Photo filter'));
  fireEvent.press(screen.getByLabelText('Monochrome'));
  expect(
    screen.getByLabelText('Monochrome').props.accessibilityState.selected
  ).toBe(true);
  fireEvent.press(screen.getByText('Share'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ filter: 'mono' })
  );
});

it('closes filters on an outside tap and provides sidebar haptics', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  await finishPreview();
  fireEvent(screen.getByLabelText('Photo filter'), 'pressIn');
  expect(fireSelectionHaptic).toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Photo filter'));
  expect(screen.getByLabelText('Monochrome')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close filters'));
  expect(screen.queryByLabelText('Monochrome')).toBeNull();
  fireEvent(screen.getByLabelText('Layout'), 'touchStart');
  expect(fireSelectionHaptic).toHaveBeenCalledTimes(2);
});

it('positions a full-width map independently of route visibility', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  await finishPreview();
  expect(screen.queryByLabelText('Move map to top')).toBeNull();
  fireEvent.press(screen.getByText('Faded map'));
  fireEvent.press(screen.getByLabelText('Move map to top'));
  fireEvent.press(screen.getByLabelText('Show route'));
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({
      routeStyle: 'map',
      mapPosition: 'top',
      showRoute: false,
    })
  );
  expect(screen.getByLabelText('Move map to bottom')).toBeTruthy();
});

it('exports independent transforms without regenerating layers, then resets them on layout selection', async () => {
  render(<WorkoutPhotoEditor photo={photo} onDiscard={jest.fn()} />);
  fireEvent(screen.getByTestId('workout-photo-stage'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 650 } },
  });
  await finishPreview();
  const before = jest.mocked(createPhotoEditorLayers).mock.calls.length;
  const stats = { x: 0.1, y: -0.2, scale: 1.8, rotation: 0.5 };
  const route = { x: -0.2, y: 0.1, scale: 0.6, rotation: -0.3 };
  fireEvent(screen.getByTestId('editable-layers'), 'commit', stats, route);
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenCalledTimes(before);
  await act(async () => fireEvent.press(screen.getByText('Share')));
  expect(createPhotoPreview).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ statsTransform: stats, routeTransform: route })
  );
  fireEvent.press(screen.getByText('Compact signature'));
  await finishPreview();
  await act(async () => fireEvent.press(screen.getByText('Share')));
  expect(createPhotoPreview).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({
      layout: 'compact',
      statsTransform: undefined,
      routeTransform: undefined,
    })
  );
});
