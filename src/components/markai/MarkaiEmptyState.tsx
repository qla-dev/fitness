import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

export default function MarkaiEmptyState({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string, mode: 'macros' | 'training' | 'free') => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const choices = [
    {
      label: t('markai.log', { defaultValue: 'Log food' }),
      prompt: t('markai.logPrompt', { defaultValue: 'Help me log my meal: ' }),
      mode: 'macros' as const,
      icon: 'food' as const,
    },
    {
      label: t('macros.proteinPrompt', {
        defaultValue: 'Help me with my protein goal',
      }),
      prompt: t('macros.proteinPrompt', {
        defaultValue: 'Help me with my protein goal',
      }),
      mode: 'free' as const,
      icon: 'sparkles' as const,
    },
    {
      label: t('macros.metricsPrompt', {
        defaultValue: 'Explain my daily metrics',
      }),
      prompt: t('macros.metricsPrompt', {
        defaultValue: 'Explain my daily metrics',
      }),
      mode: 'free' as const,
      icon: 'sparkles' as const,
    },
    {
      label: t('markai.training', { defaultValue: 'Training help' }),
      prompt: t('markai.trainingPrompt', {
        defaultValue: 'Help me plan my next workout',
      }),
      mode: 'training' as const,
      icon: 'exercise' as const,
    },
  ];
  return (
    <Animated.View
      layout={LinearTransition.duration(240)}
      className="gap-3 py-6"
    >
      {choices.slice(0, expanded ? choices.length : 2).map((choice) => (
        <Animated.View key={choice.label} entering={FadeIn.duration(240)}>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            onPress={() => onSelect(choice.prompt, choice.mode)}
            className="bg-surface rounded-2xl px-4 py-4 flex-row items-center gap-3"
          >
            <Icon name={choice.icon} size={20} />
            <Text className="text-text-primary flex-1">{choice.label}</Text>
            <Icon name="arrow-up" size={16} />
          </Pressable>
        </Animated.View>
      ))}
      <View className="items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          className="flex-row items-center gap-2 px-4 py-3"
        >
          <Text className="text-text-secondary">
            {expanded
              ? t('markai.lessPrompts', { defaultValue: 'Fewer ideas' })
              : t('markai.morePrompts', { defaultValue: 'More ideas' })}
          </Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
