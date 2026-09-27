import { Pressable, Text, View } from 'react-native';
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
    <View className="flex-1 items-center justify-center gap-4 py-6">
      <Icon name="sparkles" size={36} />
      {choices.map((choice) => (
        <Pressable
          key={choice.label}
          disabled={disabled}
          accessibilityRole="button"
          onPress={() => onSelect(choice.prompt, choice.mode)}
          className="bg-surface rounded-2xl px-4 py-3 flex-row items-center gap-3"
          style={{ maxWidth: '100%' }}
        >
          <Icon name={choice.icon} size={20} />
          <Text className="text-text-primary text-base flex-shrink">
            {choice.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
