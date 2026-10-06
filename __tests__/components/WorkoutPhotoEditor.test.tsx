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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  recordingPhotoUri: (photo: { fileName: string }) =>
    `file:///${photo.fileName}`,
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
// The location sheet's map is native; the editor only needs it to mount.
jest.mock('../../src/components/recording/PlacePicker', () => () => null);
jest.mock('../../src/components/ui/NativePromptSheet', () => () => null);
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
// Layers render only once the stage reports its proportions.
function measureStage() {
  fireEvent(screen.getByTestId('workout-photo-stage'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 650 } },
  });
}
async function finishPreview() {
  // Let a saved draft load before the debounced layer render starts.
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(150);
  });
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

it('fills the image width, exports the stage proportions and shares through the system sheet', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  fireEvent(screen.getByTestId('workout-photo-stage'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 650 } },
  });
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ aspectRatio: 0.6, layout: 'classic' })
  );
  // The clean capture, not the saved file with the camera HUD burnt in.
  expect(screen.UNSAFE_getByType(Image).props).toMatchObject({
    resizeMode: 'cover',
    source: { uri: 'file:///bbbb.jpg' },
  });
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

it('renders no layers until the stage is measured, so it opens on the final layout', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  await finishPreview();
  expect(createPhotoEditorLayers).not.toHaveBeenCalled();
  measureStage();
  // The stage stays covered until the first layers are ready.
  expect(screen.getByTestId('photo-loading-overlay')).toBeTruthy();
  await finishPreview();
  expect(screen.queryByTestId('photo-loading-overlay')).toBeNull();
  expect(createPhotoEditorLayers).toHaveBeenCalledTimes(1);
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ aspectRatio: 0.6 })
  );
});

it('waits for the selected layout before allowing sharing and discards only the editor', async () => {
  const discard = jest.fn();
  const view = render(<WorkoutPhotoEditor photo={photo} onClose={discard} />);
  measureStage();
  await finishPreview();
  fireEvent.press(screen.getByText('Route poster'));
  fireEvent.press(screen.getByText('Adjusting'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ layout: 'poster' })
  );
  fireEvent.press(screen.getByLabelText('Close'));
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
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
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
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  measureStage();
  await finishPreview();
  fireEvent.press(screen.getByLabelText('Text font'));
  expect(screen.getAllByText('Aa')).toHaveLength(5);
  fireEvent.press(screen.getByLabelText('Anton'));
  fireEvent.press(screen.getByText('Adjusting'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ font: 'anton' })
  );
});

it('selects a filter from the thumbnail strip and waits for its export', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  measureStage();
  await finishPreview();
  fireEvent.press(screen.getByLabelText('More options'));
  fireEvent.press(screen.getByLabelText('Photo filter'));
  fireEvent.press(screen.getByLabelText('Monochrome'));
  expect(
    screen.getByLabelText('Monochrome').props.accessibilityState.selected
  ).toBe(true);
  fireEvent.press(screen.getByText('Adjusting'));
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ filter: 'mono' })
  );
});

it('closes filters on an outside tap and provides sidebar haptics', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  measureStage();
  await finishPreview();
  fireEvent.press(screen.getByLabelText('More options'));
  fireEvent(screen.getByLabelText('Photo filter'), 'pressIn');
  expect(fireSelectionHaptic).toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Photo filter'));
  expect(screen.getByLabelText('Monochrome')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close filters'));
  expect(screen.queryByLabelText('Monochrome')).toBeNull();
  fireEvent(screen.getByLabelText('Layout'), 'touchStart');
  expect(fireSelectionHaptic).toHaveBeenCalledTimes(2);
});

it('picks hiding the route, the outline or a faded map from one route style menu', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  measureStage();
  await finishPreview();
  // No separate show or move toggles beside the menu.
  expect(screen.queryByLabelText('Show route')).toBeNull();
  expect(screen.queryByLabelText('Move map to top')).toBeNull();
  fireEvent.press(screen.getByLabelText('More options'));
  fireEvent.press(screen.getByText('Faded map top'));
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({
      routeStyle: 'map',
      mapPosition: 'top',
      showRoute: true,
    })
  );
  // The overlay menu has a None too; the route style menu comes after it.
  fireEvent.press(screen.getAllByText('None').at(-1)!);
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ showRoute: false })
  );
  fireEvent.press(screen.getByText('Faded map bottom'));
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({
      routeStyle: 'map',
      mapPosition: 'bottom',
      showRoute: true,
    })
  );
});

it('exports independent transforms without regenerating layers, then resets them on layout selection', async () => {
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
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
    expect.objectContaining({ statsTransform: stats, routeTransform: route }),
    expect.stringMatching(/^qla.fit-.*.jpg$/)
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
    }),
    expect.any(String)
  );
});

it('shares a file named after the workout and the person', async () => {
  render(
    <WorkoutPhotoEditor
      photo={{ ...photo, capturedAt: new Date(2026, 8, 27, 16, 52).getTime() }}
      onClose={jest.fn()}
      workoutName="Running"
      userName="Ćamil Sijarić"
    />
  );
  measureStage();
  await finishPreview();
  await act(async () => fireEvent.press(screen.getByText('Share')));
  expect(createPhotoPreview).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    'qla.fit-running-camil-2026-09-27-1652.jpg'
  );
});

it('saves the setup as a draft and resumes it on the next open', async () => {
  const close = jest.fn();
  const view = render(<WorkoutPhotoEditor photo={photo} onClose={close} />);
  measureStage();
  await finishPreview();
  fireEvent.press(screen.getByLabelText('Text font'));
  fireEvent.press(screen.getByLabelText('Anton'));
  await finishPreview();
  await act(async () => {
    fireEvent.press(screen.getByText('Save as draft'));
  });
  expect(close).toHaveBeenCalledTimes(1);
  view.unmount();
  jest.mocked(createPhotoEditorLayers).mockClear();
  render(<WorkoutPhotoEditor photo={photo} onClose={jest.fn()} />);
  measureStage();
  await finishPreview();
  expect(createPhotoEditorLayers).toHaveBeenCalledTimes(1);
  expect(createPhotoEditorLayers).toHaveBeenLastCalledWith(
    photo,
    expect.objectContaining({ font: 'anton' })
  );
});
