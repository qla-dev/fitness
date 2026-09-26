import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
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
import type { RecordingPhoto } from '../../services/recording/types';
import {
  createPhotoPreview,
  recordingPhotoUri,
} from '../../services/recording/photos';
import {
  defaultPhotoEditorOptions,
  type PhotoEditorOptions,
  type PhotoLayout,
  type PhotoFilter,
  type PhotoOverlay,
  type PhotoFont,
} from '../../services/recording/photoEditor';

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
}: {
  label: string;
  icon: IconName;
  actions: MenuAction[];
  onSelect: (id: string) => void;
}) {
  return (
    <MenuView
      actions={actions}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}
    >
      <View
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={label}
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

export default function WorkoutPhotoEditor({
  photo,
  onDiscard,
}: {
  photo: RecordingPhoto;
  onDiscard: () => void;
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
    uri: string;
    options: PhotoEditorOptions;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  const currentFile = useRef<string | null>(null);
  const rendering = preview?.options !== options;
  useEffect(() => {
    let cancelled = false;
    // Native color pickers can emit continuously while dragging the spectrum.
    const timer = setTimeout(() => {
      void createPhotoPreview(photo, options)
        .then((uri) => {
          if (cancelled) {
            removePreview(uri, original);
            return;
          }
          removePreview(currentFile.current, original);
          currentFile.current = uri;
          setPreview({ uri, options });
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
  }, [photo, options, original, retry]);
  useEffect(
    () => () => removePreview(currentFile.current, original),
    [original]
  );

  const share = async () => {
    if (!preview || rendering || shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error('Sharing unavailable');
      await Sharing.shareAsync(preview.uri, {
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
      image: 'map',
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
        if (!shareLock.current) onDiscard();
      }}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View
          testID="workout-photo-stage"
          style={styles.stage}
          onLayout={({ nativeEvent: { layout } }) => {
            if (layout.width > 0 && layout.height > 0) {
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
            source={{ uri: preview?.uri ?? original }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          {editable && (
            <View
              style={styles.tools}
              pointerEvents={sharing ? 'none' : 'auto'}
            >
              <EditorMenu
                label={t('recording.editor.layout', { defaultValue: 'Layout' })}
                icon="list"
                actions={actions(layouts, options.layout)}
                onSelect={(id) => {
                  const layout = layouts.find((item) => item.id === id)?.id;
                  if (layout) setOptions((current) => ({ ...current, layout }));
                }}
              />
              <EditorMenu
                label={t('recording.editor.font', {
                  defaultValue: 'Text font',
                })}
                icon="document-text"
                actions={actions(fonts, options.font)}
                onSelect={(id) => {
                  const font = fonts.find((item) => item.id === id)?.id;
                  if (font) setOptions((current) => ({ ...current, font }));
                }}
              />
              <LiquidGlassSurface colorScheme="dark" style={styles.tool}>
                <PhotoTextColor
                  value={options.textColor}
                  onChange={(textColor) =>
                    setOptions((current) => ({ ...current, textColor }))
                  }
                />
              </LiquidGlassSurface>
              <LiquidGlassSurface colorScheme="dark" style={styles.tool}>
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
              <EditorMenu
                label={t('recording.editor.overlay', {
                  defaultValue: 'Image overlay',
                })}
                icon="eye"
                actions={actions(overlays, options.overlay)}
                onSelect={(id) => {
                  const overlay = overlays.find((item) => item.id === id)?.id;
                  if (overlay)
                    setOptions((current) => ({ ...current, overlay }));
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('recording.editor.filter', {
                  defaultValue: 'Photo filter',
                })}
                accessibilityState={{
                  expanded: filtersOpen,
                  disabled: sharing,
                }}
                disabled={sharing}
                onPress={() => setFiltersOpen((open) => !open)}
              >
                <LiquidGlassSurface
                  colorScheme="dark"
                  isInteractive
                  style={styles.tool}
                >
                  <Icon name="sparkles" size={24} color="white" />
                </LiquidGlassSurface>
              </Pressable>
            </View>
          )}
          {editable && filtersOpen && (
            <View style={styles.filterTray}>
              <PhotoFilterPreviews
                uri={recordingPhotoUri({
                  ...photo,
                  fileName: photo.originalFileName!,
                })}
                filters={filters}
                selected={options.filter}
                disabled={sharing}
                onSelect={(filter) =>
                  setOptions((current) => ({ ...current, filter }))
                }
              />
            </View>
          )}
          {rendering && !failed && (
            <ActivityIndicator color="white" style={styles.loading} />
          )}
        </View>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
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
              onPress={onDiscard}
              style={[styles.footerButton, styles.discard]}
            >
              <Text style={styles.buttonText}>
                {t('recording.discard', { defaultValue: 'Discard' })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={rendering || sharing || failed}
              onPress={() => void share()}
              style={[
                styles.footerButton,
                styles.share,
                { opacity: rendering || sharing || failed ? 0.45 : 1 },
              ]}
            >
              {sharing ? (
                <ActivityIndicator color="black" />
              ) : (
                <Icon name="share" size={20} color="black" />
              )}
              <Text style={[styles.buttonText, { color: 'black' }]}>
                {t('common.share', { defaultValue: 'Share' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, width: '100%', overflow: 'hidden', borderRadius: 24 },
  tools: { position: 'absolute', right: 12, top: 16, gap: 12 },
  tool: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { position: 'absolute', left: 20, top: 20 },
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
