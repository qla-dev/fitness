import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import PromptScreen from '../components/ui/PromptScreen';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import ValueSkeleton from '../components/ValueSkeleton';
import { onlineRequest } from '../services/online/account';
import type { MarkaiMode, MarkaiThread } from '../services/online/markai';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * MarkAI's conversation history: a modal route on PromptScreen, like GoalEdit,
 * with New chat as the footer action. The choice travels back to the chat as
 * route params, since the chat owns loading a conversation.
 */
export default function MarkaiHistoryScreen({
  navigation,
  route,
}: RootStackScreenProps<'MarkaiHistory'>) {
  const { t } = useTranslation();
  const active = route.params?.activeConversation;
  const [threads, setThreads] = useState<MarkaiThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const labels: Record<MarkaiMode, string> = {
    macros: t('markai.macros', { defaultValue: 'Calculate macros' }),
    training: t('markai.training', { defaultValue: 'Moving help' }),
    free: t('markai.free', { defaultValue: 'Free chat' }),
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setThreads(await onlineRequest<MarkaiThread[]>('/markai/messages'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list on open.
    void load();
  }, [load]);

  return (
    <PromptScreen
      headerTitle={t('markai.title', { defaultValue: 'MarkAI' })}
      title={t('markai.history', { defaultValue: 'Conversation history' })}
      footerLabel={t('markai.newChat', { defaultValue: 'New chat' })}
      onFooterPress={() => navigation.popTo('MarkAI', { newChat: Date.now() })}
      topAligned
    >
      {error ? (
        <View className="gap-3">
          <Text accessibilityRole="alert" className="text-text-primary">
            {error}
          </Text>
          <Button onPress={() => void load()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </View>
      ) : null}
      <View style={{ marginHorizontal: -8, gap: 4 }}>
        {/* Rows in the thread row's own shape, so the list fills in place
            rather than a spinner giving way to it. */}
        {loading && !threads.length
          ? [0, 1, 2, 3, 4].map((index) => (
              <View
                key={index}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingHorizontal: 8,
                  paddingVertical: 11,
                }}
              >
                <ValueSkeleton width={34} height={34} radius={12} />
                <View style={{ flex: 1, gap: 6 }}>
                  <ValueSkeleton
                    width={`${70 - index * 8}%` as const}
                    height={16}
                  />
                  <ValueSkeleton width={96} height={13} />
                </View>
              </View>
            ))
          : null}
        {!loading && !error && !threads.length ? (
          <Text className="text-text-secondary px-2">
            {t('markai.noHistory', {
              defaultValue: 'Your conversations will appear here.',
            })}
          </Text>
        ) : null}
        {threads.map((thread) => (
          <Pressable
            key={thread.conversation_id + thread.mode}
            accessibilityRole="button"
            onPress={() => {
              fireSelectionHaptic();
              navigation.popTo('MarkAI', {
                thread: { id: thread.conversation_id, mode: thread.mode },
              });
            }}
            className={active === thread.conversation_id ? 'bg-surface' : ''}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              borderRadius: 14,
              paddingHorizontal: 8,
              paddingVertical: 11,
            }}
          >
            <View
              className="bg-surface"
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="history" size={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                className="text-text-primary"
                style={{ fontSize: 15, fontWeight: '700' }}
              >
                {thread.title || t('markai.photo', { defaultValue: 'Photo' })}
              </Text>
              <Text
                className="text-text-muted"
                style={{ fontSize: 13, marginTop: 2 }}
              >
                {labels[thread.mode]}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </PromptScreen>
  );
}
