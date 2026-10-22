import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import { withAlpha } from '../../utils/colors';
import { getAppLocale } from '../../localization';
import { fireSelectionHaptic } from '../../services/haptics';

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
/** The next midnight UTC, when the backend's free-message day starts. */
function nextUtcMidnight(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

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
  // The free allowance renews at the server's day boundary, midnight UTC
  // (fitness.markai_free_daily), shown here on the user's own clock: just
  // after local midnight it can still be hours away.
  const renewsAt = nextUtcMidnight(new Date());
  const time = renewsAt.toLocaleTimeString(getAppLocale(), {
    hour: 'numeric',
    minute: '2-digit',
  });
  const when =
    renewsAt.toDateString() === new Date().toDateString()
      ? t('markaiLimit.renewsToday', {
          defaultValue: 'today at {{time}}',
          time,
        })
      : t('markaiLimit.renewsTomorrow', {
          defaultValue: 'tomorrow at {{time}}',
          time,
        });
  const body =
    kind === 'free'
      ? t('markaiLimit.freeBody', {
          defaultValue:
            'The free plan includes 10 MarkAI messages a day. They come back {{when}}, or buy credits to keep chatting now.',
          when,
        })
      : kind === 'credits'
        ? t('markaiLimit.creditsBody', {
            defaultValue:
              'Your MarkAI credits are used up. Buy more to keep chatting, or wait for 10 free messages {{when}}.',
            when,
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
        onPress={() => {
          fireSelectionHaptic();
          onSeeUsage();
        }}
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
