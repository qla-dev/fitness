import React from 'react';
import { Alert } from 'react-native';
import { act, render } from '@testing-library/react-native';

import PhotoDayCapture from '../../src/components/PhotoDayCapture';
import { useCheckInPhotoMutations } from '../../src/hooks/useCheckInPhotos';
import { useCheckInPhotoSource } from '../../src/hooks/useCheckInPhotoSource';
import { usePreferences } from '../../src/hooks/usePreferences';
import type { CheckInPhoto, PhotoType } from '../../src/types/checkInPhotos';

interface MenuAction {
  id?: string;
  title: string;
  attributes?: { destructive?: boolean };
}
interface MenuProps {
  actions: MenuAction[];
  onPressAction?: (event: { nativeEvent: { event: string } }) => void;
  shouldOpenOnLongPress?: boolean;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * The latest props each menu rendered with, by testID. Read rather than
 * "pressed" because the trigger is a native host: what the test can check is
 * the menu it was handed and the action it reports back.
 */
const mockMenus: Record<string, MenuProps> = {};

jest.mock('@expo/ui/community/menu', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    MenuView: (props: MenuProps) => {
      if (props.testID) mockMenus[props.testID] = props;
      return ReactActual.createElement(
        View,
        { testID: props.testID },
        props.children
      );
    },
  };
});

jest.mock('../../src/hooks/useCheckInPhotos', () => ({
  useCheckInPhotoMutations: jest.fn(),
}));
jest.mock('../../src/hooks/useCheckInPhotoSource', () => ({
  useCheckInPhotoSource: jest.fn(),
}));
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));
jest.mock('../../src/components/ProgressPhotoViewer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/utils/pickImage', () => ({
  pickImageFromCamera: jest.fn(async () => ({
    status: 'picked',
    image: { uri: 'file:///camera.jpg' },
  })),
  pickImagesFromLibrary: jest.fn(async () => [{ uri: 'file:///library.jpg' }]),
}));

const mockUseMutations = useCheckInPhotoMutations as jest.MockedFunction<
  typeof useCheckInPhotoMutations
>;
const mockUseSource = useCheckInPhotoSource as jest.MockedFunction<
  typeof useCheckInPhotoSource
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const uploadAsync = jest.fn();
const deleteAsync = jest.fn();

const photoMap = (angles: PhotoType[]): Map<PhotoType, CheckInPhoto> =>
  new Map(
    angles.map((angle) => [
      angle,
      {
        id: `photo-${angle}`,
        user_id: 'u1',
        check_in_measurement_id: null,
        entry_date: '2026-03-20',
        photo_type: angle,
        file_path: `uploads/${angle}.jpg`,
        created_at: '2026-03-20T00:00:00Z',
      } as CheckInPhoto,
    ])
  );

const renderCapture = (angles: PhotoType[] = []) =>
  render(<PhotoDayCapture date="2026-03-20" photos={photoMap(angles)} />);

/** The ids on a menu, which is what the user reads as its choices. */
const actionIds = (testID: string) =>
  mockMenus[testID]?.actions.map((action) => action.id);

describe('PhotoDayCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockMenus)) delete mockMenus[key];
    mockUseMutations.mockReturnValue({
      uploadAsync,
      deleteAsync,
      uploadingType: undefined,
      isUploading: false,
      isDeleting: false,
    } as unknown as ReturnType<typeof useCheckInPhotoMutations>);
    mockUseSource.mockReturnValue({
      getPhotoSource: jest.fn((id: string) => ({
        uri: `https://x/${id}`,
        headers: {},
      })),
      isReady: true,
    } as unknown as ReturnType<typeof useCheckInPhotoSource>);
    mockUsePreferences.mockReturnValue({
      preferences: { default_weight_unit: 'kg' },
    } as unknown as ReturnType<typeof usePreferences>);
  });

  it('offers a slot per angle so the day’s gaps read at a glance', () => {
    const { getByLabelText } = renderCapture(['front']);

    // Front is filled, so it is a view target; the other two invite a photo.
    expect(getByLabelText('View the front photo full screen')).toBeTruthy();
    expect(getByLabelText('Add the back photo')).toBeTruthy();
    expect(getByLabelText('Add the side photo')).toBeTruthy();
  });

  it('opens camera-or-library on a single tap of an empty slot', () => {
    // The point of the rewrite: an empty slot has nothing else a tap could
    // mean, so the system menu comes up on the tap rather than on a hold.
    renderCapture([]);

    expect(mockMenus['photo-slot-front']?.shouldOpenOnLongPress).toBeFalsy();
    expect(actionIds('photo-slot-front')).toEqual(['camera', 'library']);
  });

  it('uploads straight away rather than staging behind a Save', async () => {
    renderCapture([]);

    await act(async () => {
      mockMenus['photo-slot-front']?.onPressAction?.({
        nativeEvent: { event: 'camera' },
      });
    });

    expect(uploadAsync).toHaveBeenCalledWith({
      date: '2026-03-20',
      type: 'front',
      uri: 'file:///camera.jpg',
    });
  });

  it('records into the day it was given, not today', async () => {
    render(<PhotoDayCapture date="2026-01-02" photos={photoMap([])} />);

    await act(async () => {
      mockMenus['photo-slot-side']?.onPressAction?.({
        nativeEvent: { event: 'library' },
      });
    });

    expect(uploadAsync).toHaveBeenCalledWith({
      date: '2026-01-02',
      type: 'side',
      uri: 'file:///library.jpg',
    });
  });

  it('offers removal only on a slot that has a photo', () => {
    renderCapture(['front']);

    // The empty slots can only be filled; the filled one can also be emptied.
    expect(actionIds('photo-slot-back')).toEqual(['camera', 'library']);
    expect(actionIds('photo-slot-manage-front')).toEqual([
      'camera',
      'library',
      'remove',
    ]);
    expect(mockMenus['photo-slot-front']).toBeUndefined();
  });

  it('keeps viewing and managing on separate targets', () => {
    const { getByLabelText } = renderCapture(['front']);

    // A filled slot has both: the photo opens the viewer, the corner button
    // opens replace/remove. Neither is hidden behind a long press.
    expect(getByLabelText('View the front photo full screen')).toBeTruthy();
    expect(getByLabelText('Replace or remove the front photo')).toBeTruthy();
    expect(
      mockMenus['photo-slot-manage-front']?.shouldOpenOnLongPress
    ).toBeFalsy();
  });

  it('confirms before removing, because a photo cannot be taken again', async () => {
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        // The destructive button, as a confirming tap would.
        buttons?.find((button) => button.style === 'destructive')?.onPress?.();
      });
    renderCapture(['front']);

    await act(async () => {
      mockMenus['photo-slot-manage-front']?.onPressAction?.({
        nativeEvent: { event: 'remove' },
      });
    });

    expect(alert).toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledWith('photo-front');
    alert.mockRestore();
  });

  it('leaves the photo alone when the confirmation is dismissed', async () => {
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.style === 'cancel')?.onPress?.();
      });
    renderCapture(['front']);

    await act(async () => {
      mockMenus['photo-slot-manage-front']?.onPressAction?.({
        nativeEvent: { event: 'remove' },
      });
    });

    expect(deleteAsync).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
