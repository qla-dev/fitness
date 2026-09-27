import { useRef } from 'react';
import {
  ActivityIndicator,
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
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';

export function useChatKeyboardHeight() {
  const height = useSharedValue(0);
  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        height.value = Math.max(0, event.height);
      },
      onEnd: (event) => {
        'worklet';
        height.value = Math.max(0, event.height);
      },
    },
    []
  );
  return height;
}

// Adapted from ABC Doctor's MarkComposer; license: docs/licenses/abc-doctor-composer.txt.
// Full-width field, controls below, UI-thread keyboard lift.
export default function MarkaiComposer({
  value,
  onChangeText,
  onSend,
  onOptions,
  modeLabel,
  busy,
  disabled,
  onHeight,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onOptions: () => void;
  modeLabel: string;
  busy: boolean;
  disabled: boolean;
  onHeight: (height: number) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboard = useChatKeyboardHeight();
  const input = useRef<TextInput>(null);
  const [foreground, muted, accent, raised] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
    '--color-accent-primary',
    '--color-raised',
  ]) as string[];
  const lift = useAnimatedStyle(() => ({
    bottom: Math.max(insets.bottom, keyboard.value),
  }));
  const ready = value.trim().length > 0 && !busy && !disabled;
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
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <LiquidGlassSurface
          style={{
            borderRadius: 26,
            overflow: 'hidden',
            paddingTop: 2,
            paddingBottom: 8,
          }}
        >
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
              fontSize: 16,
              lineHeight: 21,
              paddingTop: 12,
              paddingBottom: 6,
              paddingHorizontal: 16,
              minHeight: 39,
              maxHeight: 144,
              textAlignVertical: 'top',
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('markai.options', {
                defaultValue: 'Chat options',
              })}
              onPress={options}
              disabled={busy}
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="add" size={22} color={foreground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={options}
              disabled={busy}
              style={{
                flexShrink: 1,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: raised,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: muted, fontSize: 11.5, fontWeight: '700' }}
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
                onSend();
                input.current?.focus();
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: ready ? accent : raised,
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
      </View>
    </Animated.View>
  );
}
