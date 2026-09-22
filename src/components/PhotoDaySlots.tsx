import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import SafeImage from './SafeImage';
import { useCheckInPhotoSource } from '../hooks/useCheckInPhotoSource';
import {
  PHOTO_TYPES,
  type CheckInPhoto,
  type PhotoType,
} from '../types/checkInPhotos';

/** Gap between the three cells, in px — `gap-2`, read back for the measure. */
const CELL_GAP = 8;
/** Portrait, like the photos themselves. */
const CELL_ASPECT = 4 / 3;
/** The overflow button on a filled slot. */
const MANAGE_SIZE = 28;

export type PhotoPickSource = 'camera' | 'library';

interface PhotoDaySlotsProps {
  photos: Map<PhotoType, CheckInPhoto>;
  /** Angle currently uploading, so only its slot shows a spinner. */
  uploadingType?: PhotoType;
  /** A source was chosen for an angle: take a picture, or choose one. */
  onPick: (type: PhotoType, source: PhotoPickSource) => void;
  /** Stored photo tapped: open it full screen. */
  onView: (photo: CheckInPhoto) => void;
  /** Remove chosen for an angle. */
  onRemove: (type: PhotoType) => void;
}

/**
 * One day's three angles side by side, so what the day is missing reads at a
 * glance.
 *
 * Camera-or-library is the system's own menu rather than a bottom sheet, the
 * way the water tile's actions are: it is two choices on the way to a native
 * picker, and putting an app-drawn sheet in front of a system picker means two
 * modals for one decision. The placeholder opens it on a single tap —
 * `shouldOpenOnLongPress` is off — because an empty slot has nothing else a
 * tap could mean, and a hold would hide the only way to fill it behind a
 * gesture nobody discovers.
 *
 * A filled slot keeps viewing and managing as separate targets: the photo
 * opens the viewer, the corner button opens the same menu plus Remove. Folding
 * both into one menu would put a step in front of looking at the picture,
 * which is the common thing to want.
 *
 * Both triggers are measured rather than stretched. A MenuView's trigger is a
 * native host that sizes itself to its content, so a percentage has nothing to
 * resolve against and the tap target collapses onto whatever is inside it —
 * the same reason WaterTile hands its menu an explicit width.
 */
const PhotoDaySlots: React.FC<PhotoDaySlotsProps> = ({
  photos,
  uploadingType,
  onPick,
  onView,
  onRemove,
}) => {
  const { t } = useTranslation();
  const { getPhotoSource } = useCheckInPhotoSource();
  const [accentPrimary, mutedColor, dangerColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
    '--color-icon-danger',
  ]) as [string, string, string];

  // One measure for the row: the three cells are identical, so deriving each
  // from the row's width beats three onLayouts that all report the same thing.
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const cellHeight = cellWidth != null ? cellWidth * CELL_ASPECT : null;

  const angleLabel = (type: PhotoType): string => {
    switch (type) {
      case 'front':
        return t('progressPhotos.angle.front', { defaultValue: 'Front' });
      case 'back':
        return t('progressPhotos.angle.back', { defaultValue: 'Back' });
      case 'side':
        return t('progressPhotos.angle.side', { defaultValue: 'Side' });
    }
  };

  const sourceActions = (): MenuAction[] => [
    {
      id: 'camera',
      title: t('progressPhotos.takePhoto', { defaultValue: 'Take Photo' }),
      image: 'camera',
    },
    {
      id: 'library',
      title: t('progressPhotos.chooseLibrary', {
        defaultValue: 'Choose from Library',
      }),
      image: 'photo.on.rectangle',
    },
  ];

  const handleAction = (type: PhotoType, event: string) => {
    if (event === 'camera') onPick(type, 'camera');
    else if (event === 'library') onPick(type, 'library');
    else if (event === 'remove') onRemove(type);
  };

  return (
    <View
      className="flex-row gap-2"
      onLayout={(event) => {
        const rowWidth = event.nativeEvent.layout.width;
        const next =
          (rowWidth - CELL_GAP * (PHOTO_TYPES.length - 1)) / PHOTO_TYPES.length;
        setCellWidth((current) => (current === next ? current : next));
      }}
    >
      {PHOTO_TYPES.map((type: PhotoType) => {
        const photo = photos.get(type);
        const label = angleLabel(type);
        const isUploading = uploadingType === type;
        const frame = { width: cellWidth ?? undefined, height: cellHeight };

        return (
          <View key={type} className="flex-1">
            <View
              className="bg-raised rounded-xl overflow-hidden"
              style={{ aspectRatio: 3 / 4 }}
            >
              {photo ? (
                <TouchableOpacity
                  onPress={() => onView(photo)}
                  activeOpacity={0.7}
                  className="flex-1"
                  accessibilityRole="button"
                  accessibilityLabel={t('progressPhotos.viewAngleA11y', {
                    defaultValue: 'View the {{angle}} photo full screen',
                    angle: label.toLowerCase(),
                  })}
                >
                  <SafeImage
                    source={getPhotoSource(photo.id)}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    fallback={
                      <View className="flex-1 items-center justify-center">
                        <Icon name="camera" size={18} color={mutedColor} />
                      </View>
                    }
                  />
                </TouchableOpacity>
              ) : (
                // The whole placeholder is the menu's trigger, so anywhere in
                // the frame opens camera-or-library.
                <MenuView
                  style={frame}
                  actions={sourceActions()}
                  onPressAction={({ nativeEvent }) =>
                    handleAction(type, nativeEvent.event)
                  }
                  testID={`photo-slot-${type}`}
                >
                  <View
                    collapsable={false}
                    style={frame}
                    className="items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={t('progressPhotos.addAngleA11y', {
                      defaultValue: 'Add the {{angle}} photo',
                      angle: label.toLowerCase(),
                    })}
                  >
                    <Icon name="add" size={26} color={accentPrimary} />
                  </View>
                </MenuView>
              )}

              {isUploading && (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}

              {photo && !isUploading && (
                <View className="absolute top-1 right-1">
                  <MenuView
                    style={{ width: MANAGE_SIZE, height: MANAGE_SIZE }}
                    actions={[
                      ...sourceActions(),
                      {
                        id: 'remove',
                        title: t('progressPhotos.remove', {
                          defaultValue: 'Remove Photo',
                        }),
                        image: 'trash',
                        imageColor: dangerColor,
                        attributes: { destructive: true },
                      },
                    ]}
                    onPressAction={({ nativeEvent }) =>
                      handleAction(type, nativeEvent.event)
                    }
                    testID={`photo-slot-manage-${type}`}
                  >
                    <View
                      collapsable={false}
                      style={{ width: MANAGE_SIZE, height: MANAGE_SIZE }}
                      className="rounded-full items-center justify-center bg-black/50"
                      accessibilityRole="button"
                      accessibilityLabel={t('progressPhotos.manageAngleA11y', {
                        defaultValue:
                          'Replace or remove the {{angle}} photo',
                        angle: label.toLowerCase(),
                      })}
                    >
                      <Icon
                        name="ellipsis-horizontal"
                        size={16}
                        color="#fff"
                      />
                    </View>
                  </MenuView>
                </View>
              )}
            </View>

            {/* Under the frame, where it reads as the caption of the picture
                it names. Above it, directly beneath the section's own line, it
                read as a second heading. */}
            <Text className="text-text-secondary text-xs mt-1 text-center">
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default PhotoDaySlots;
