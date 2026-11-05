import { Keyboard, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import { withAlpha } from '../../utils/colors';
import { fireSelectionHaptic } from '../../services/haptics';

/**
 * Asks, once, whether MarkAI may read the user's data: a card pinned above
 * the composer in the same place and shape as the usage notice. Until the
 * answer is Allow, MarkAI sees only the chat; after it, each message carries
 * a summary of the on-device diary and Health data (markaiContext.ts).
 */
export default function MarkaiDataNotice({
  onAllow,
  onDecline,
}: {
  onAllow: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [accent, foreground] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as string[];
  return (
    <View
      className="bg-raised rounded-3xl"
      style={{ padding: 14, gap: 12, marginBottom: 8 }}
      // A tap on the card's text puts the keyboard away; its buttons still
      // take their own taps first.
      onStartShouldSetResponder={() => true}
      onResponderRelease={() => Keyboard.dismiss()}
    >
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            backgroundColor: withAlpha(accent, 0.14),
          }}
        >
          <Icon name="sparkles" size={16} color={accent} />
        </View>
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-text-primary text-sm font-bold">
            {t('markaiData.title', {
              defaultValue: 'Let MarkAI see your data?',
            })}
          </Text>
          <Text className="text-text-secondary text-xs">
            {t('markaiData.body', {
              defaultValue:
                'MarkAI can read a summary of your last 14 days (food, activity, workouts, sleep and weight) to answer about you and tailor workouts. It is sent with each message.',
            })}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-end" style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            fireSelectionHaptic();
            onDecline();
          }}
          hitSlop={6}
          className="rounded-full"
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: withAlpha(foreground, 0.08),
          }}
        >
          <Text className="text-text-primary text-xs font-bold">
            {t('markaiData.decline', { defaultValue: 'Not now' })}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            fireSelectionHaptic();
            onAllow();
          }}
          hitSlop={6}
          className="rounded-full"
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: withAlpha(accent, 0.14),
          }}
        >
          <Text className="text-accent-primary text-xs font-bold">
            {t('markaiData.allow', { defaultValue: 'Allow' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
