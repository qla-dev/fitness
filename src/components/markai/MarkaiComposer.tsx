import { useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable, useUniwind } from 'uniwind';
import { useTranslation } from 'react-i18next';
import { MenuView } from '@expo/ui/community/menu';
import { ScrollEdgeEffect } from '@bsky.app/expo-scroll-edge-effect';
import Icon from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';
import { fireSelectionHaptic, fireSendHaptic } from '../../services/haptics';
import { withAlpha } from '../../utils/colors';

function useChatKeyboard() {
  const height = useSharedValue(0);
  // 0 closed → 1 open, frame by frame with the keyboard's own animation.
  const progress = useSharedValue(0);
  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        height.value = Math.max(0, event.height);
        progress.value = event.progress;
      },
      onEnd: (event) => {
        'worklet';
        height.value = Math.max(0, event.height);
        progress.value = event.progress;
      },
    },
    []
  );
  return { height, progress };
}

/** Side inset of the composer with the keyboard down, and up. */
const COMPOSER_INSET_CLOSED = 12;
const COMPOSER_INSET_OPEN = 4;

// Adapted from ABC Doctor's MarkComposer; license: docs/licenses/abc-doctor-composer.txt.
// Full-width field, controls below, UI-thread keyboard lift.
export default function MarkaiComposer({
  value,
  onChangeText,
  onSend,
  onOptions,
  onAttach,
  attachment,
  attaching = false,
  onRemoveAttachment,
  modeLabel,
  busy,
  disabled,
  onHeight,
  notice,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onOptions: () => void;
  /** The same camera / library choice the progress photos offer. */
  onAttach: (source: 'camera' | 'library') => void;
  /** The attached photo's local uri, previewed above the field. */
  attachment?: string | null;
  attaching?: boolean;
  onRemoveAttachment: () => void;
  modeLabel: string;
  busy: boolean;
  disabled: boolean;
  onHeight: (height: number) => void;
  /** Shown above the field, e.g. the usage limit notice. */
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboard = useChatKeyboard();
  const input = useRef<TextInput>(null);
  const isDark = useUniwind().theme === 'dark';
  const [foreground, muted, accent, raised] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
    '--color-accent-primary',
    '--color-raised',
  ]) as string[];
  // The round controls' resting fill, as in Claude's composer: a wash of the
  // text colour, because `raised` matches the glass on both themes (white on
  // the pale light glass, and the dark tint itself on dark).
  const controlFill = withAlpha(foreground, isDark ? 0.12 : 0.06);
  const lift = useAnimatedStyle(() => ({
    bottom: Math.max(insets.bottom, keyboard.height.value),
  }));
  // The field widens toward the screen edges as the keyboard rises, riding the
  // keyboard's own progress so the two arrive together.
  const widen = useAnimatedStyle(() => ({
    marginHorizontal:
      COMPOSER_INSET_CLOSED +
      (COMPOSER_INSET_OPEN - COMPOSER_INSET_CLOSED) * keyboard.progress.value,
  }));
  const ready =
    (value.trim().length > 0 || !!attachment) &&
    !busy &&
    !disabled &&
    !attaching;
  const options = () => {
    input.current?.blur();
    Keyboard.dismiss();
    onOptions();
  };
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, right: 0 }, lift]}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
    >
      {/* Marks the composer as sitting over the chat's bottom edge, so iOS 26
          fades the messages under it (a plain View below iOS 26). It rides
          inside the lifted view, so the effect follows the keyboard. */}
      <ScrollEdgeEffect
        edge="bottom"
        effect="soft"
        style={{ paddingVertical: 8 }}
      >
        {/* Untinted glass reads as a pale grey slab on the true-black theme;
            a dark tint keeps it a surface instead of a highlight. */}
        <Animated.View style={widen}>
          {notice}
          <LiquidGlassSurface
            tintColor={isDark ? withAlpha(raised, 0.75) : undefined}
            style={{
              borderRadius: 26,
              overflow: 'hidden',
              paddingTop: 2,
              paddingBottom: 10,
            }}
          >
            {attachment || attaching ? (
              <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: raised,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {attachment ? (
                    <Image
                      source={{ uri: attachment }}
                      style={{ width: 64, height: 64 }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <ActivityIndicator color={foreground} />
                  )}
                </View>
                {attachment ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('markai.removePhoto', {
                      defaultValue: 'Remove photo',
                    })}
                    hitSlop={8}
                    disabled={busy}
                    onPress={onRemoveAttachment}
                    style={{
                      position: 'absolute',
                      left: 12 + 64 - 14,
                      top: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="close" size={12} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <TextInput
              ref={input}
              value={value}
              onChangeText={onChangeText}
              multiline
              maxLength={6000}
              accessibilityLabel={t('markai.message', {
                defaultValue: 'Message MarkAI',
              })}
              placeholder={t('markai.message', {
                defaultValue: 'Message MarkAI',
              })}
              placeholderTextColor={muted}
              style={{
                color: foreground,
                fontSize: 18,
                lineHeight: 25,
                paddingTop: 12,
                paddingBottom: 14,
                paddingHorizontal: 16,
                minHeight: 51,
                maxHeight: 144,
                textAlignVertical: 'top',
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 10,
              }}
            >
              <MenuView
                actions={[
                  {
                    id: 'camera',
                    title: t('progressPhotos.takePhoto', {
                      defaultValue: 'Take Photo',
                    }),
                    image: 'camera',
                    attributes: { disabled: busy || attaching },
                  },
                  {
                    id: 'library',
                    title: t('progressPhotos.chooseLibrary', {
                      defaultValue: 'Choose from Library',
                    }),
                    image: 'photo',
                    attributes: { disabled: busy || attaching },
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (
                    nativeEvent.event === 'camera' ||
                    nativeEvent.event === 'library'
                  )
                    onAttach(nativeEvent.event);
                }}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel={t('markai.addPhoto', {
                    defaultValue: 'Add photo',
                  })}
                  onTouchStart={() => {
                    fireSelectionHaptic();
                    input.current?.blur();
                    Keyboard.dismiss();
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: controlFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="add" size={22} color={foreground} />
                </View>
              </MenuView>
              <Pressable
                accessibilityRole="button"
                onPress={options}
                disabled={busy}
                style={{
                  flexShrink: 1,
                  // The same height as the round controls beside it, so all
                  // three sit on one line the same distance from the edge.
                  height: 36,
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  // An accent wash marks it as a control on both themes; plain
                  // raised vanished into the glass.
                  backgroundColor: withAlpha(accent, isDark ? 0.22 : 0.12),
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: accent,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {modeLabel}
                </Text>
              </Pressable>
              <View style={{ flex: 1, minWidth: 8 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('markai.send', { defaultValue: 'Send' })}
                accessibilityState={{ disabled: !ready }}
                disabled={!ready}
                onPress={() => {
                  fireSendHaptic();
                  onSend();
                  input.current?.focus();
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: ready ? accent : controlFill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color={foreground} />
                ) : (
                  <Icon
                    name="arrow-up"
                    size={20}
                    color={ready ? '#FFFFFF' : muted}
                  />
                )}
              </Pressable>
            </View>
          </LiquidGlassSurface>
        </Animated.View>
      </ScrollEdgeEffect>
    </Animated.View>
  );
}
