import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import { withAlpha } from '../../utils/colors';

/**
 * Why MarkAI cannot answer right now, pinned above the composer the way
 * Claude shows its usage limit: what ran out, what brings it back, and a way
 * to the usage screen.
 *
 * - `free`: today's free messages are gone and there were never credits.
 * - `credits`: paid credits ran out after the free ones.
 * - `task`: a priced task (a full macro plan) needs more credits than there
 *   are.
 */
export type MarkaiLimitKind = 'free' | 'credits' | 'task';

export default function MarkaiLimitNotice({
  kind,
  onSeeUsage,
}: {
  kind: MarkaiLimitKind;
  onSeeUsage: () => void;
}) {
  const { t } = useTranslation();
  const [accent, foreground] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as string[];
  const title =
    kind === 'free'
      ? t('markaiLimit.freeTitle', {
          defaultValue: "You've used today's free messages",
        })
      : kind === 'credits'
        ? t('markaiLimit.creditsTitle', {
            defaultValue: "You're out of credits",
          })
        : t('markaiLimit.taskTitle', {
            defaultValue: 'Not enough credits for this',
          });
  const body =
    kind === 'free'
      ? t('markaiLimit.freeBody', {
          defaultValue:
            'The free plan includes 10 MarkAI messages a day. They come back tomorrow, or buy credits to keep chatting now.',
        })
      : kind === 'credits'
        ? t('markaiLimit.creditsBody', {
            defaultValue:
              'Your MarkAI credits are used up. Buy more to keep chatting, or wait for tomorrow’s 10 free messages.',
          })
        : t('markaiLimit.taskBody', {
            defaultValue:
              'A full macro plan uses 10 credits. Buy more to run it.',
          });
  return (
    <View
      accessibilityRole="alert"
      className="bg-raised rounded-3xl flex-row items-center"
      style={{ padding: 14, gap: 12, marginBottom: 8 }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 32,
          height: 32,
          backgroundColor: withAlpha(accent, 0.14),
        }}
      >
        <Icon name="clock" size={16} color={accent} />
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className="text-text-primary text-sm font-bold">{title}</Text>
        <Text className="text-text-secondary text-xs">{body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onSeeUsage}
        hitSlop={6}
        className="rounded-full"
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: withAlpha(foreground, 0.08),
        }}
      >
        <Text className="text-text-primary text-xs font-bold">
          {t('markaiLimit.seeUsage', { defaultValue: 'See usage' })}
        </Text>
      </Pressable>
    </View>
  );
}
