import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';

/**
 * MarkAI's mark before a conversation starts: the sparkles in the accent
 * colour, so they read on light and dark alike, breathing inside a halo
 * that keeps pulsing outwards — the same halo as the watch connection and
 * the flash overlay.
 */
function MarkaiMark() {
  const accent = useCSSVariable('--color-accent-primary') as string;
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1800 }), -1, false));
    breath.set(
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(breath);
    };
  }, [reducedMotion, pulse, breath]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));
  const glyph = useAnimatedStyle(() => ({
    opacity: 0.75 + breath.value * 0.25,
    transform: [
      { scale: 0.94 + breath.value * 0.1 },
      { rotate: `${(breath.value - 0.5) * 12}deg` },
    ],
  }));
  return (
    <View
      style={{
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 2,
            borderColor: accent,
          },
          halo,
        ]}
      />
      <View
        className="bg-surface"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={glyph}>
          <Icon name="sparkles" size={32} color={accent} />
        </Animated.View>
      </View>
    </View>
  );
}

export default function MarkaiEmptyState({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string, mode: 'macros' | 'training' | 'free') => void;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const choices = [
    {
      label: t('markai.log', { defaultValue: 'Log food' }),
      prompt: t('markai.logPrompt', { defaultValue: 'Help me log my meal' }),
      mode: 'macros' as const,
      icon: 'food' as const,
    },
    {
      label: t('markai.goalsChip', { defaultValue: 'Help with my goals' }),
      prompt: t('markai.goalsPrompt', {
        defaultValue:
          'Help me with my goals: how am I doing and what should I change?',
      }),
      mode: 'free' as const,
      icon: 'sparkles' as const,
    },
    {
      label: t('markai.macrosChip', { defaultValue: 'Calculate my macros' }),
      prompt: t('markai.allMacrosPrompt', {
        defaultValue:
          'Calculate my calories and macros for my goal. Ask me for anything you need.',
      }),
      mode: 'macros' as const,
      icon: 'calculator' as const,
    },
    {
      label: t('markai.trainingChip', { defaultValue: 'Activity ideas' }),
      prompt: t('markai.trainingPrompt', {
        defaultValue: 'Suggest how I could move today.',
      }),
      mode: 'training' as const,
      icon: 'exercise-walking' as const,
    },
    {
      label: t('markai.metricsChip', {
        defaultValue: 'Help with daily metrics',
      }),
      prompt: t('macros.metricsPrompt', {
        defaultValue: 'Help me understand my daily metrics.',
      }),
      mode: 'free' as const,
      icon: 'sparkles' as const,
    },
  ];
  return (
    <View className="items-center gap-6">
      <MarkaiMark />
      {/* Chips as wide as their labels, wrapping and centred. Each chip has
          a short label of its own, apart from the prompt it sends: the
          prompts read as sentences, and in longer languages sentence-length
          labels left every chip alone on its row instead of two to a row. */}
      <View className="flex-row flex-wrap justify-center self-stretch gap-2">
        {choices.map((choice) => (
          <Pressable
            key={choice.label}
            disabled={disabled}
            accessibilityRole="button"
            onPress={() => onSelect(choice.prompt, choice.mode)}
            className="bg-surface rounded-full px-3 py-2 flex-row items-center gap-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name={choice.icon} size={14} color={accent} />
            <Text
              className="text-text-primary text-xs font-medium"
              numberOfLines={1}
            >
              {choice.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
