import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';
import PhotoTextColor from './PhotoTextColor';
import PhotoFilterPreviews from './PhotoFilterPreviews';
import PhotoFontPreviews from './PhotoFontPreviews';
import PhotoEditorCanvas from './PhotoEditorCanvas';
import { fireSelectionHaptic } from '../../services/haptics';
import type { RecordingPhoto } from '../../services/recording/types';
import {
  createPhotoPreview,
  createPhotoEditorLayers,
  recordingPhotoUri,
  type PhotoEditorLayers,
} from '../../services/recording/photos';
import {
  defaultPhotoEditorOptions,
  type PhotoEditorOptions,
  type PhotoLayout,
  type PhotoFilter,
  type PhotoOverlay,
  type PhotoFont,
} from '../../services/recording/photoEditor';
import {
  loadPhotoDraft,
  savePhotoDraft,
} from '../../services/recording/photoDrafts';

function removePreview(uri: string | null, original: string) {
  if (!uri || uri === original) return;
  try {
    new File(uri).delete();
  } catch {
    /* Temporary cache cleanup only. */
  }
}

function EditorMenu({
  label,
  icon,
  actions,
  onSelect,
  onOpen,
}: {
  label: string;
  icon: IconName;
  actions: MenuAction[];
  onSelect: (id: string) => void;
  onOpen: () => void;
}) {
  return (
    <MenuView
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        fireSelectionHaptic();
        onSelect(nativeEvent.event);
      }}
    >
      <View
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        onTouchStart={() => {
          fireSelectionHaptic();
          onOpen();
        }}
      >
        <LiquidGlassSurface
          colorScheme="dark"
          isInteractive
          style={styles.tool}
        >
          <Icon name={icon} size={24} color="white" />
        </LiquidGlassSurface>
      </View>
    </MenuView>
  );
}

/** Labels only appear with the expanded toolbar, as in Instagram's editor. */
function ToolRow({
  label,
  expanded,
  children,
}: {
  label: string;
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.toolRow}>
      {expanded && (
        <Text
          style={styles.toolLabel}
          numberOfLines={1}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {label}
        </Text>
      )}
      {children}
    </View>
  );
}

export default function WorkoutPhotoEditor({
  photo,
  onClose,
}: {
  photo: RecordingPhoto;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const original = recordingPhotoUri(photo);
  const editable =
    !!photo.composition &&
    /^[a-f0-9-]+\.jpg$/i.test(photo.originalFileName ?? '');
  const [options, setOptions] = useState<PhotoEditorOptions>(() => ({
    ...defaultPhotoEditorOptions,
    routeColor: accent || defaultPhotoEditorOptions.routeColor,
  }));
  const [preview, setPreview] = useState<{
    layers: PhotoEditorLayers;
    options: PhotoEditorOptions;
  } | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [gesturing, setGesturing] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  // Transform-only edits animate the existing layers; they never regenerate tiles or text.
  const layerKey = JSON.stringify({
    ...options,
    statsTransform: undefined,
    routeTransform: undefined,
  });
  const layerOptions = useMemo<PhotoEditorOptions>(
    () => JSON.parse(layerKey),
    [layerKey]
  );
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [tray, setTray] = useState<'filters' | 'fonts' | null>(null);
  const [moreTools, setMoreTools] = useState(false);
  const [draftReady, setDraftReady] = useState(!editable);
  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    void loadPhotoDraft(photo).then((draft) => {
      if (cancelled) return;
      // The stage measures its own proportions; everything else resumes.
      if (draft)
        setOptions((current) => ({
          ...current,
          ...draft,
          aspectRatio: current.aspectRatio,
        }));
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [photo, editable]);
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  const currentFiles = useRef<string[]>([]);
  const rendering = editable && preview?.options !== layerOptions;
  useEffect(() => {
    let cancelled = false;
    // Native color pickers can emit continuously while dragging the spectrum.
    const timer = setTimeout(() => {
      if (!editable || !draftReady) return;
      void createPhotoEditorLayers(photo, layerOptions)
        .then((layers) => {
          // Vector layers are released by the GC; only the bitmap needs cleanup.
          if (cancelled) {
            removePreview(layers.background, original);
            return;
          }
          currentFiles.current.forEach((uri) => removePreview(uri, original));
          currentFiles.current = [layers.background];
          setPreview({ layers, options: layerOptions });
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [photo, layerOptions, original, retry, editable, draftReady]);
  useEffect(
    () => () =>
      currentFiles.current.forEach((uri) => removePreview(uri, original)),
    [original]
  );

  const saveDraft = async () => {
    if (shareLock.current) return;
    try {
      await savePhotoDraft(photo, options);
      onClose();
    } catch {
      Alert.alert(
        t('recording.editor.draftFailed', {
          defaultValue: 'Could not save this draft. Please try again.',
        })
      );
    }
  };
  const share = async () => {
    if (rendering || gesturing || shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    let exportUri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error('Sharing unavailable');
      exportUri = await createPhotoPreview(photo, options);
      await Sharing.shareAsync(exportUri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: t('recording.sharePhoto', {
          defaultValue: 'Share workout photo',
        }),
      });
    } catch {
      Alert.alert(
        t('recording.sharePhotoFailed', {
          defaultValue: 'Could not share this photo. Please try again.',
        })
      );
    } finally {
      removePreview(exportUri, original);
      shareLock.current = false;
      setSharing(false);
    }
  };
  const layouts: {
    id: PhotoLayout;
    title: string;
    image: MenuAction['image'];
  }[] = [
    {
      id: 'classic',
      title: t('recording.editor.classic', { defaultValue: 'Classic' }),
      image: 'text.alignleft',
    },
    {
      id: 'trail',
      title: t('recording.editor.trail', { defaultValue: 'Route story' }),
      image: 'map',
    },
    {
      id: 'compact',
      title: t('recording.editor.compact', {
        defaultValue: 'Compact signature',
      }),
      image: 'text.badge.star',
    },
    {
      id: 'summit',
      title: t('recording.editor.summit', {
        defaultValue: 'Stats above route',
      }),
      image: 'rectangle.topthird.inset.filled',
    },
    {
      id: 'hero',
      title: t('recording.editor.hero', { defaultValue: 'Distance spotlight' }),
      image: 'textformat.size.larger',
    },
    {
      id: 'poster',
      title: t('recording.editor.poster', { defaultValue: 'Route poster' }),
      image: 'photo.artframe',
    },
  ];
  const fonts: { id: PhotoFont; title: string }[] = [
    {
      id: 'system',
      title: t('recording.editor.systemFont', { defaultValue: 'System' }),
    },
    {
      id: 'anton',
      title: t('recording.editor.fonts.anton', { defaultValue: 'Anton' }),
    },
    {
      id: 'bebas',
      title: t('recording.editor.fonts.bebas', { defaultValue: 'Bebas Neue' }),
    },
    {
      id: 'rajdhani',
      title: t('recording.editor.fonts.rajdhani', { defaultValue: 'Rajdhani' }),
    },
    {
      id: 'oswald',
      title: t('recording.editor.fonts.oswald', { defaultValue: 'Oswald' }),
    },
  ];
  const overlays: { id: PhotoOverlay; title: string }[] = [
    { id: 'none', title: t('recording.editor.none', { defaultValue: 'None' }) },
    {
      id: 'black',
      title: t('recording.editor.blackBackground', {
        defaultValue: 'Black background',
      }),
    },
    {
      id: 'soft',
      title: t('recording.editor.soft', { defaultValue: 'Soft shade' }),
    },
    {
      id: 'dark',
      title: t('recording.editor.dark', { defaultValue: 'Deep shade' }),
    },
    {
      id: 'light',
      title: t('recording.editor.light', { defaultValue: 'Light wash' }),
    },
  ];
  const filters: { id: PhotoFilter; title: string }[] = [
    {
      id: 'original',
      title: t('recording.editor.original', { defaultValue: 'Original' }),
    },
    {
      id: 'mono',
      title: t('recording.editor.mono', { defaultValue: 'Monochrome' }),
    },
    {
      id: 'warm',
      title: t('recording.editor.warm', { defaultValue: 'Golden hour' }),
    },
    {
      id: 'cool',
      title: t('recording.editor.cool', { defaultValue: 'Cool light' }),
    },
  ];
  const actions = (
    items: { id: string; title: string; image?: MenuAction['image'] }[],
    selected: string
  ): MenuAction[] =>
    items.map((item) => ({
      ...item,
      state: item.id === selected ? 'on' : 'off',
      attributes: { disabled: sharing },
    }));

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!shareLock.current) onClose();
      }}
    >
      <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View
          testID="workout-photo-stage"
          style={styles.stage}
          onLayout={({ nativeEvent: { layout } }) => {
            if (layout.width > 0 && layout.height > 0) {
              setStage({ width: layout.width, height: layout.height });
              const aspectRatio = layout.width / layout.height;
              setOptions((current) =>
                Math.abs(current.aspectRatio - aspectRatio) < 0.001
                  ? current
                  : { ...current, aspectRatio }
              );
            }
          }}
        >
          <Image
            source={{ uri: original }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          {preview && photo.composition && stage.width > 0 && (
            <PhotoEditorCanvas
              key={`${layoutVersion}-${stage.width}-${stage.height}`}
              layers={preview.layers}
              composition={photo.composition}
              options={options}
              width={stage.width}
              height={stage.height}
              disabled={sharing || rendering || !!tray}
              onBusy={setGesturing}
              onCommit={(statsTransform, routeTransform) =>
                setOptions((current) => ({
                  ...current,
                  statsTransform,
                  routeTransform,
                }))
              }
            />
          )}
          {tray && (
            <Pressable
              style={StyleSheet.absoluteFill}
              testID="photo-filter-dismiss"
              accessibilityRole="button"
              accessibilityLabel={t('recording.editor.closeFilters', {
                defaultValue: 'Close filters',
              })}
              onPress={() => setTray(null)}
            />
          )}
          {editable && (
            <ScrollView
              style={styles.tools}
              contentContainerStyle={styles.toolsContent}
              showsVerticalScrollIndicator={false}
              pointerEvents={sharing ? 'none' : 'auto'}
            >
              <ToolRow
                label={t('recording.editor.layout', { defaultValue: 'Layout' })}
                expanded={moreTools}
              >
                <EditorMenu
                  onOpen={() => setTray(null)}
                  label={t('recording.editor.layout', {
                    defaultValue: 'Layout',
                  })}
                  icon="layout"
                  actions={actions(layouts, options.layout)}
                  onSelect={(id) => {
                    const layout = layouts.find((item) => item.id === id)?.id;
                    if (layout) {
                      setOptions((current) => ({
                        ...current,
                        layout,
                        statsTransform: undefined,
                        routeTransform: undefined,
                      }));
                      setLayoutVersion((value) => value + 1);
                      setGesturing(false);
                    }
                  }}
                />
              </ToolRow>
              <ToolRow
                label={t('recording.editor.font', {
                  defaultValue: 'Text font',
                })}
                expanded={moreTools}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.editor.font', {
                    defaultValue: 'Text font',
                  })}
                  accessibilityState={{
                    expanded: tray === 'fonts',
                    disabled: sharing,
                  }}
                  disabled={sharing}
                  onPressIn={fireSelectionHaptic}
                  onPress={() =>
                    setTray((open) => (open === 'fonts' ? null : 'fonts'))
                  }
                >
                  <LiquidGlassSurface
                    colorScheme="dark"
                    isInteractive
                    style={styles.tool}
                  >
                    <Icon name="font" size={24} color="white" />
                  </LiquidGlassSurface>
                </Pressable>
              </ToolRow>
              <ToolRow
                label={t('recording.editor.alignment', {
                  defaultValue: 'Text alignment',
                })}
                expanded={moreTools}
              >
                <EditorMenu
                  onOpen={() => setTray(null)}
                  label={t('recording.editor.alignment', {
                    defaultValue: 'Text alignment',
                  })}
                  icon="list"
                  actions={actions(
                    [
                      {
                        id: 'left',
                        title: t('recording.editor.alignLeft', {
                          defaultValue: 'Align left',
                        }),
                        image: 'text.alignleft',
                      },
                      {
                        id: 'center',
                        title: t('recording.editor.alignCenter', {
                          defaultValue: 'Align center',
                        }),
                        image: 'text.aligncenter',
                      },
                      {
                        id: 'right',
                        title: t('recording.editor.alignRight', {
                          defaultValue: 'Align right',
                        }),
                        image: 'text.alignright',
                      },
                    ],
                    options.textAlign ?? 'left'
                  )}
                  onSelect={(textAlign) => {
                    if (
                      textAlign === 'left' ||
                      textAlign === 'center' ||
                      textAlign === 'right'
                    )
                      setOptions((current) => ({ ...current, textAlign }));
                  }}
                />
              </ToolRow>
              <ToolRow
                label={t('recording.editor.textColor', {
                  defaultValue: 'Text color',
                })}
                expanded={moreTools}
              >
                <LiquidGlassSurface
                  colorScheme="dark"
                  style={styles.tool}
                  onTouchStart={() => {
                    fireSelectionHaptic();
                    setTray(null);
                  }}
                >
                  <PhotoTextColor
                    value={options.textColor}
                    onChange={(textColor) =>
                      setOptions((current) => ({ ...current, textColor }))
                    }
                  />
                </LiquidGlassSurface>
              </ToolRow>
              {moreTools && (
                <>
                  <ToolRow
                    label={t('recording.editor.routeColor', {
                      defaultValue: 'Route color',
                    })}
                    expanded={moreTools}
                  >
                    <LiquidGlassSurface
                      colorScheme="dark"
                      style={styles.tool}
                      onTouchStart={() => {
                        fireSelectionHaptic();
                        setTray(null);
                      }}
                    >
                      <PhotoTextColor
                        label={t('recording.editor.routeColor', {
                          defaultValue: 'Route color',
                        })}
                        value={options.routeColor}
                        onChange={(routeColor) =>
                          setOptions((current) => ({ ...current, routeColor }))
                        }
                      />
                    </LiquidGlassSurface>
                  </ToolRow>
                  <ToolRow
                    label={t('recording.editor.overlay', {
                      defaultValue: 'Image overlay',
                    })}
                    expanded={moreTools}
                  >
                    <EditorMenu
                      onOpen={() => setTray(null)}
                      label={t('recording.editor.overlay', {
                        defaultValue: 'Image overlay',
                      })}
                      icon="eye"
                      actions={actions(overlays, options.overlay)}
                      onSelect={(id) => {
                        const overlay = overlays.find(
                          (item) => item.id === id
                        )?.id;
                        if (overlay)
                          setOptions((current) => ({ ...current, overlay }));
                      }}
                    />
                  </ToolRow>
                  <ToolRow
                    label={t('recording.editor.filter', {
                      defaultValue: 'Photo filter',
                    })}
                    expanded={moreTools}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('recording.editor.filter', {
                        defaultValue: 'Photo filter',
                      })}
                      accessibilityState={{
                        expanded: tray === 'filters',
                        disabled: sharing,
                      }}
                      disabled={sharing}
                      onPressIn={fireSelectionHaptic}
                      onPress={() =>
                        setTray((open) =>
                          open === 'filters' ? null : 'filters'
                        )
                      }
                    >
                      <LiquidGlassSurface
                        colorScheme="dark"
                        isInteractive
                        style={styles.tool}
                      >
                        <Icon name="sparkles" size={24} color="white" />
                      </LiquidGlassSurface>
                    </Pressable>
                  </ToolRow>
                  <ToolRow
                    label={t('recording.editor.routeStyle', {
                      defaultValue: 'Route style',
                    })}
                    expanded={moreTools}
                  >
                    <EditorMenu
                      onOpen={() => setTray(null)}
                      label={t('recording.editor.routeStyle', {
                        defaultValue: 'Route style',
                      })}
                      icon="route-path"
                      actions={actions(
                        [
                          {
                            id: 'line',
                            title: t('recording.editor.routeLine', {
                              defaultValue: 'Route outline',
                            }),
                            image:
                              'point.topleft.down.to.point.bottomright.curvepath',
                          },
                          {
                            id: 'map',
                            title: t('recording.editor.fadedMap', {
                              defaultValue: 'Faded map',
                            }),
                            image: 'map',
                          },
                        ],
                        options.routeStyle ?? 'line'
                      )}
                      onSelect={(routeStyle) => {
                        if (routeStyle === 'line' || routeStyle === 'map')
                          setOptions((current) => ({ ...current, routeStyle }));
                      }}
                    />
                  </ToolRow>
                  {options.routeStyle === 'map' && (
                    <ToolRow
                      label={
                        options.mapPosition === 'top'
                          ? t('recording.editor.mapBottom', {
                              defaultValue: 'Move map to bottom',
                            })
                          : t('recording.editor.mapTop', {
                              defaultValue: 'Move map to top',
                            })
                      }
                      expanded={moreTools}
                    >
                      <Pressable
                        accessibilityRole="button"
                        disabled={sharing}
                        onPressIn={fireSelectionHaptic}
                        accessibilityLabel={
                          options.mapPosition === 'top'
                            ? t('recording.editor.mapBottom', {
                                defaultValue: 'Move map to bottom',
                              })
                            : t('recording.editor.mapTop', {
                                defaultValue: 'Move map to top',
                              })
                        }
                        onPress={() => {
                          setTray(null);
                          setOptions((current) => ({
                            ...current,
                            mapPosition:
                              current.mapPosition === 'top' ? 'bottom' : 'top',
                          }));
                        }}
                      >
                        <LiquidGlassSurface
                          colorScheme="dark"
                          isInteractive
                          style={styles.tool}
                        >
                          <Icon
                            name={
                              options.mapPosition === 'top'
                                ? 'arrow-down'
                                : 'arrow-up'
                            }
                            size={24}
                            color="white"
                          />
                        </LiquidGlassSurface>
                      </Pressable>
                    </ToolRow>
                  )}
                  <ToolRow
                    label={t('recording.editor.showRoute', {
                      defaultValue: 'Show route',
                    })}
                    expanded={moreTools}
                  >
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel={t('recording.editor.showRoute', {
                        defaultValue: 'Show route',
                      })}
                      accessibilityState={{
                        checked: options.showRoute !== false,
                        disabled: sharing,
                      }}
                      disabled={sharing}
                      onPressIn={fireSelectionHaptic}
                      onPress={() => {
                        setTray(null);
                        setOptions((current) => ({
                          ...current,
                          showRoute: current.showRoute === false,
                        }));
                      }}
                    >
                      <LiquidGlassSurface
                        colorScheme="dark"
                        isInteractive
                        style={styles.tool}
                      >
                        <Icon
                          name={options.showRoute === false ? 'eye-off' : 'eye'}
                          size={24}
                          color="white"
                        />
                      </LiquidGlassSurface>
                    </Pressable>
                  </ToolRow>
                  <ToolRow
                    label={t('recording.editor.capturePin', {
                      defaultValue: 'Pin photo location',
                    })}
                    expanded={moreTools}
                  >
                    <Pressable
                      accessibilityRole="switch"
                      onPressIn={() => {
                        fireSelectionHaptic();
                        setTray(null);
                      }}
                      accessibilityLabel={
                        photo.composition?.captureLocation
                          ? t('recording.editor.capturePin', {
                              defaultValue: 'Pin photo location',
                            })
                          : t('recording.editor.noCaptureLocation', {
                              defaultValue: 'No location saved with this photo',
                            })
                      }
                      accessibilityState={{
                        checked: !!options.showCapturePin,
                        disabled:
                          sharing || !photo.composition?.captureLocation,
                      }}
                      disabled={sharing || !photo.composition?.captureLocation}
                      onPress={() =>
                        setOptions((current) => ({
                          ...current,
                          showCapturePin: !current.showCapturePin,
                        }))
                      }
                    >
                      <LiquidGlassSurface
                        colorScheme="dark"
                        isInteractive
                        style={[
                          styles.tool,
                          {
                            opacity: photo.composition?.captureLocation
                              ? 1
                              : 0.4,
                          },
                        ]}
                      >
                        <Icon
                          name="photo-pin"
                          size={24}
                          color={options.showCapturePin ? '#FF9F0A' : 'white'}
                        />
                      </LiquidGlassSurface>
                    </Pressable>
                  </ToolRow>
                </>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  moreTools
                    ? t('recording.editor.fewerOptions', {
                        defaultValue: 'Fewer options',
                      })
                    : t('recording.editor.moreOptions', {
                        defaultValue: 'More options',
                      })
                }
                accessibilityState={{ expanded: moreTools }}
                onPressIn={fireSelectionHaptic}
                onPress={() => {
                  setTray(null);
                  setMoreTools((open) => !open);
                }}
              >
                <LiquidGlassSurface
                  colorScheme="dark"
                  isInteractive
                  style={styles.more}
                >
                  <Icon
                    name={moreTools ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="white"
                  />
                </LiquidGlassSurface>
              </Pressable>
            </ScrollView>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            disabled={sharing}
            onPressIn={fireSelectionHaptic}
            onPress={onClose}
            style={styles.close}
          >
            <LiquidGlassSurface
              colorScheme="dark"
              isInteractive
              style={styles.tool}
            >
              <Icon name="close" size={24} color="white" />
            </LiquidGlassSurface>
          </Pressable>
          {editable && tray === 'filters' && (
            <View style={styles.filterTray}>
              <PhotoFilterPreviews
                uri={recordingPhotoUri({
                  ...photo,
                  fileName: photo.originalFileName!,
                })}
                filters={filters}
                selected={options.filter}
                disabled={sharing}
                onSelect={(filter) => {
                  fireSelectionHaptic();
                  setOptions((current) => ({ ...current, filter }));
                }}
              />
            </View>
          )}
          {editable && tray === 'fonts' && (
            <View style={styles.filterTray}>
              <PhotoFontPreviews
                fonts={fonts}
                selected={options.font}
                disabled={sharing}
                onSelect={(font) => {
                  fireSelectionHaptic();
                  setOptions((current) => ({ ...current, font }));
                }}
              />
            </View>
          )}
        </View>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          onTouchStart={() => setTray(null)}
        >
          {failed && (
            <Pressable
              onPress={() => {
                setFailed(false);
                setRetry((value) => value + 1);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.error}>
                {t('recording.editor.previewFailed', {
                  defaultValue: 'Could not update the preview. Tap to retry.',
                })}
              </Text>
            </Pressable>
          )}
          <View style={styles.footerRow}>
            <Pressable
              accessibilityRole="button"
              disabled={sharing}
              onPress={() => void saveDraft()}
              style={[styles.footerButton, styles.discard]}
            >
              <Text style={styles.buttonText}>
                {t('recording.editor.saveDraft', {
                  defaultValue: 'Save as draft',
                })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={rendering || sharing || failed || gesturing}
              onPress={() => void share()}
              style={[
                styles.footerButton,
                styles.share,
                { opacity: rendering || sharing || failed ? 0.45 : 1 },
              ]}
            >
              {sharing || (rendering && !failed) ? (
                <ActivityIndicator size="small" color="black" />
              ) : (
                <Icon name="share" size={20} color="black" />
              )}
              <Text style={[styles.buttonText, { color: 'black' }]}>
                {rendering && !failed && !sharing
                  ? t('recording.editor.adjusting', {
                      defaultValue: 'Adjusting',
                    })
                  : t('common.share', { defaultValue: 'Share' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, width: '100%', overflow: 'hidden', borderRadius: 24 },
  tools: { position: 'absolute', right: 0, top: 4, bottom: 0 },
  // Leave room inside the scroll viewport for the glass press/hold expansion.
  // The padding preserves the buttons' original position over the photo.
  toolsContent: { gap: 12, padding: 12, alignItems: 'flex-end' },
  // Level with the first sidebar tool (tools top 4 + content padding 12).
  close: { position: 'absolute', left: 12, top: 16 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  toolLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  more: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tool: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTray: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  footer: { paddingTop: 16, paddingHorizontal: 20, gap: 12 },
  footerRow: { flexDirection: 'row', gap: 12 },
  footerButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 28,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discard: { backgroundColor: '#282828' },
  share: { backgroundColor: '#FFF' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  error: { color: '#FF9F9F', textAlign: 'center', padding: 8 },
});
