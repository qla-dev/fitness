import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView as ControllerKeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import Icon from '../components/Icon';
import LiquidGlassSurface from '../components/LiquidGlassSurface';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { fireSelectionHaptic } from '../services/haptics';
import { canUseLiquidGlass } from '../utils/liquidGlass';

// Same native small-header offset used by ChatScreen.
const IOS_SMALL_NATIVE_HEADER_HEIGHT = 44;
const KeyboardAvoidingView =
  Platform.OS === 'ios'
    ? NativeKeyboardAvoidingView
    : ControllerKeyboardAvoidingView;

/** Local chat preview on the existing Tracker detail route. */
export default function MacrosScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const usesGlass = canUseLiquidGlass();
  const [footerHeight, setFooterHeight] = useState(
    60 + Math.max(insets.bottom, 12)
  );
  const [accent, muted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as string[];
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const list = useRef<ScrollView>(null);
  const header = useScreenHeader({
    title: t('macros.title', { defaultValue: 'AI' }),
    left: { kind: 'back' },
  });
  const send = (value: string) => {
    const message = value.trim();
    if (!message) return;
    fireSelectionHaptic();
    setMessages((previous) => [...previous, message]);
    setDraft('');
  };
  const suggestions = [
    t('macros.proteinPrompt', { defaultValue: 'Help me with my protein goal' }),
    t('macros.metricsPrompt', { defaultValue: 'Explain my daily metrics' }),
  ];
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: usesNativeHeader ? 0 : insets.top }}
    >
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={
          usesNativeHeader ? insets.top + IOS_SMALL_NATIVE_HEADER_HEIGHT : 0
        }
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={list}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 20,
              gap: 20,
              paddingBottom: usesGlass ? footerHeight + 20 : 20,
            }}
            scrollIndicatorInsets={{ bottom: usesGlass ? footerHeight : 0 }}
            onContentSizeChange={() => {
              if (messages.length)
                list.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.length === 0 ? (
              <View className="flex-1 items-center justify-center gap-4">
                <Icon name="sparkles" size={36} color={accent} />
                <Text className="text-2xl font-semibold text-text-primary text-center">
                  {t('macros.welcome', {
                    defaultValue: 'Let’s talk about your goals',
                  })}
                </Text>
                <Text className="text-sm text-text-secondary text-center">
                  {t('macros.preview', {
                    defaultValue:
                      'Chat preview — AI replies are not connected yet.',
                  })}
                </Text>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => send(suggestion)}
                    className="bg-surface rounded-2xl px-4 py-3"
                  >
                    <Text className="text-sm text-text-primary">
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              messages.map((message, index) => (
                <View key={index} className="gap-4">
                  <View
                    className="self-end bg-surface rounded-2xl px-4 py-3"
                    style={{ maxWidth: '85%' }}
                  >
                    <Text className="text-base text-text-primary">
                      {message}
                    </Text>
                  </View>
                  <View className="flex-row gap-2 items-start">
                    <Icon name="sparkles" size={18} color={accent} />
                    <Text className="flex-1 text-base text-text-secondary">
                      {t('macros.demoReply', {
                        defaultValue:
                          'This is a demo reply. Once connected, AI will help you explore your nutrition goals and daily metrics.',
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <View
            className="flex-row items-center gap-2 px-4 pt-3"
            pointerEvents="box-none"
            onLayout={(event) =>
              setFooterHeight(event.nativeEvent.layout.height)
            }
            style={{
              paddingBottom: Math.max(insets.bottom, 12),
              ...(usesGlass
                ? ({
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'transparent',
                  } as const)
                : {}),
            }}
          >
            <LiquidGlassSurface
              glassEffectStyle="regular"
              isInteractive
              style={{ flex: 1, borderRadius: 24, overflow: 'hidden' }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('macros.placeholder', {
                  defaultValue: 'Ask about your metrics…',
                })}
                accessibilityLabel={t('macros.placeholder', {
                  defaultValue: 'Ask about your metrics…',
                })}
                placeholderTextColor={muted}
                className="px-4 text-base text-text-primary"
                style={{ height: 48 }}
                returnKeyType="send"
                onSubmitEditing={() => send(draft)}
              />
            </LiquidGlassSurface>
            <LiquidGlassSurface
              glassEffectStyle="regular"
              isInteractive
              style={{ borderRadius: 24, overflow: 'hidden' }}
            >
              <TouchableOpacity
                onPress={() => send(draft)}
                disabled={!draft.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('macros.send', {
                  defaultValue: 'Send message',
                })}
                accessibilityState={{ disabled: !draft.trim() }}
                className="items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  opacity: draft.trim() ? 1 : 0.4,
                }}
              >
                <Icon name="arrow-up" size={22} color={accent} />
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
