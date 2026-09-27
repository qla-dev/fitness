import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import CustomModal, { type CustomModalRef } from '../components/CustomModal';
import MarkaiComposer, {
  useChatKeyboardHeight,
} from '../components/markai/MarkaiComposer';
import Icon from '../components/Icon';
import MarkaiEmptyState from '../components/markai/MarkaiEmptyState';
import MarkaiThinking from '../components/markai/MarkaiThinking';
import MarkaiUserMessage from '../components/markai/MarkaiUserMessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import Button from '../components/ui/Button';
import { useScreenHeader } from '../hooks/useScreenHeader';
import {
  onlineRequest,
  OnlineError,
  updateOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';
import {
  logMarkaiFood,
  type MarkaiMessage,
  type MarkaiReply,
} from '../services/online/markai';
import { localApiFetch } from '../services/local/localApi';
import { localTransaction, table } from '../services/local/database';
import { queryClient } from '../hooks/queryClient';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackParamList } from '../types/navigation';

type Mode = 'macros' | 'training' | 'free';
type Thread = {
  conversation_id: string;
  mode: Mode;
  title: string;
  updated_at: string;
  message_count: number;
};
export default function MarkaiScreen() {
  const accountId = useOnlineAccount((s) => s.session?.user.id);
  return <MarkaiContent key={accountId ?? 'offline'} />;
}

function MarkaiContent() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const session = useOnlineAccount((s) => s.session);
  const accountId = session?.user.id;
  const [mode, setMode] = useState<Mode>('free');
  const [loading, setLoading] = useState(Boolean(accountId));
  const [threads, setThreads] = useState<Thread[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [barHeight, setBarHeight] = useState(110);
  const historySheet = useRef<CustomModalRef>(null);
  const optionsSheet = useRef<CustomModalRef>(null);
  const scroller = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const loadVersion = useRef(0);
  const keyboard = useChatKeyboardHeight();
  const tail = useAnimatedStyle(() => ({
    height: Math.max(insets.bottom, keyboard.value) + barHeight,
  }));
  const [conversation, setConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<MarkaiMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meals, setMeals] = useState<{ id: string; name: string }[]>([]);
  const [mealId, setMealId] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [logged, setLogged] = useState<string[]>([]);
  const lock = useRef(false);
  const pendingRequest = useRef<{
    prompt: string;
    mode: Mode;
    conversation: string;
    id: string;
  } | null>(null);
  const header = useScreenHeader({
    title: t('markai.title', { defaultValue: 'MarkAI' }),
    left: { kind: 'back' },
    right: {
      kind: 'icon',
      sfSymbol: 'bubble.left.and.bubble.right',
      ionicon: 'chatbubbles-outline',
      accessibilityLabel: t('markai.history', {
        defaultValue: 'Conversation history',
      }),
      onPress: () => void openHistory(),
      disabled: busy || loading || !session,
    },
  });
  const labels: Record<Mode, string> = {
    macros: t('markai.macros', { defaultValue: 'Calculate macros' }),
    training: t('markai.training', { defaultValue: 'Training help' }),
    free: t('markai.free', { defaultValue: 'Free chat' }),
  };
  useEffect(() => {
    void localApiFetch<{ id: string; name: string }[]>({
      endpoint: '/api/meal-types',
    })
      .then((rows) => {
        setMeals(rows);
        setMealId(rows[0]?.id ?? '');
      })
      .catch((e: unknown) => setError(String(e)));
    void localTransaction((db) =>
      table(db, 'markaiReceipts').map((r) => String(r.id))
    )
      .then(setLogged)
      .catch((e: unknown) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    const load = async () => {
      const saved = await AsyncStorage.getItem(
        '@qla/markai/' + accountId + '/active'
      );
      const active: { id: string; mode: Mode } | null = saved
        ? JSON.parse(saved)
        : null;
      const id =
        active?.id ??
        (await AsyncStorage.getItem('@qla/markai/' + accountId + '/macros'));
      if (!alive) return;
      if (!id) {
        setConversation(randomUUID());
        return;
      }
      setLoading(true);
      const history = await onlineRequest<MarkaiMessage[]>(
        '/markai/messages?conversation_id=' + id
      );
      if (alive) {
        setConversation(id);
        setMode(active?.mode ?? 'macros');
        setMessages(history);
      }
    };
    void load()
      .catch((e: unknown) => {
        if (alive) {
          setError(String(e));
          setConversation(randomUUID());
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accountId]);
  const openHistory = async () => {
    Keyboard.dismiss();
    historySheet.current?.present();
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setThreads(await onlineRequest<Thread[]>('/markai/messages'));
    } catch (e: unknown) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryLoading(false);
    }
  };
  const newChat = (nextMode: Mode = 'free') => {
    if (busy || loading) return;
    loadVersion.current++;
    setMode(nextMode);
    const id = randomUUID();
    setConversation(id);
    if (accountId)
      void AsyncStorage.setItem(
        '@qla/markai/' + accountId + '/active',
        JSON.stringify({ id, mode: nextMode })
      ).catch((e: unknown) => setError(String(e)));
    setMessages([]);
    setText('');
    setError(null);
    setPendingPrompt(null);
    pendingRequest.current = null;
    atBottom.current = true;
    optionsSheet.current?.dismiss();
    historySheet.current?.dismiss();
  };
  const selectThread = async (thread: Thread) => {
    if (busy || loading) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    historySheet.current?.dismiss();
    try {
      const history = await onlineRequest<MarkaiMessage[]>(
        '/markai/messages?conversation_id=' + thread.conversation_id
      );
      if (version !== loadVersion.current) return;
      setMode(thread.mode);
      setConversation(thread.conversation_id);
      setMessages(history);
      await AsyncStorage.setItem(
        '@qla/markai/' + accountId + '/active',
        JSON.stringify({ id: thread.conversation_id, mode: thread.mode })
      );
      setText('');
      setPendingPrompt(null);
      pendingRequest.current = null;
      atBottom.current = true;
    } catch (e: unknown) {
      if (version === loadVersion.current) setError(String(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  const log = async (reply: MarkaiReply) => {
    if (!reply.food) return;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T12:00:00`))
    )
      throw new Error(
        t('markai.dateError', {
          defaultValue: 'Enter a valid date as YYYY-MM-DD.',
        })
      );
    await logMarkaiFood(reply.food_id, reply.food, mealId, date);
    setLogged((ids) => [...new Set([...ids, reply.food_id])]);
    await queryClient.invalidateQueries();
  };
  const send = async (value = text) => {
    if (lock.current || loading || !value.trim() || !conversation || !session)
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const prompt = value.trim();
    setPendingPrompt(prompt);
    setText('');
    atBottom.current = true;
    if (
      !pendingRequest.current ||
      pendingRequest.current.prompt !== prompt ||
      pendingRequest.current.mode !== mode ||
      pendingRequest.current.conversation !== conversation
    ) {
      pendingRequest.current = { prompt, mode, conversation, id: randomUUID() };
    }
    let delivered = false;
    try {
      const response = await onlineRequest<{
        id: string;
        reply: MarkaiReply;
        ai_coins: number;
      }>('/markai/messages', {
        id: pendingRequest.current.id,
        conversation_id: conversation,
        mode,
        prompt,
      });
      delivered = true;
      setMessages((items) => [
        ...items,
        { id: response.id, prompt, reply: response.reply },
      ]);
      setPendingPrompt(null);
      pendingRequest.current = null;
      await updateOnlineAccount({
        ...session.user,
        ai_coins: response.ai_coins,
      });
      await AsyncStorage.setItem(
        '@qla/markai/' + accountId + '/active',
        JSON.stringify({ id: conversation, mode })
      );
      if (response.reply.log_requested) await log(response.reply);
    } catch (e: unknown) {
      if (e instanceof OnlineError && e.status === 503)
        pendingRequest.current = null;
      if (!delivered) setPendingPrompt(prompt);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: nativeHeader ? 0 : insets.top }}
    >
      {header}
      <ScrollView
        ref={scroller}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent: e }) => {
          atBottom.current =
            e.contentOffset.y >=
            e.contentSize.height - e.layoutMeasurement.height - 100;
        }}
        onContentSizeChange={() => {
          if (atBottom.current)
            scroller.current?.scrollToEnd({ animated: true });
        }}
      >
        {loading ? <ActivityIndicator /> : null}
        {!messages.length && !pendingPrompt && !loading ? (
          <MarkaiEmptyState
            disabled={busy || loading}
            onSelect={(prompt, nextMode) => {
              setMode(nextMode);
              setText(prompt);
            }}
          />
        ) : null}
        {!session ? (
          <View className="gap-4">
            <Text className="text-text-secondary">
              {t('markai.register', {
                defaultValue:
                  'Sign in to get 100 AI coins. Each AI reply costs 1 coin; logging a food card is free.',
              })}
            </Text>
            <Button onPress={() => navigation.navigate('OnlineAccount')}>
              {t('online.signIn', { defaultValue: 'Sign in with Apple' })}
            </Button>
          </View>
        ) : null}
        {messages.map((message) => (
          <View key={message.id} style={{ gap: 14 }}>
            <MarkaiUserMessage text={message.prompt} />
            <Text
              selectable
              className="text-text-primary"
              style={{ alignSelf: 'stretch', fontSize: 15.5, lineHeight: 22 }}
            >
              {message.reply.text}
            </Text>
            {message.reply.food && (
              <View className="bg-surface rounded-2xl p-4 gap-3">
                <Text className="text-text-primary text-lg font-semibold">
                  {message.reply.food.name}
                </Text>
                <Text className="text-text-secondary">
                  {message.reply.food.serving}
                </Text>
                <Text className="text-text-primary">
                  {t('markai.nutrition', {
                    defaultValue:
                      '{{calories}} kcal · P {{protein}} g · C {{carbs}} g · F {{fat}} g',
                    ...message.reply.food,
                  })}
                </Text>
                <Text className="text-text-secondary">
                  {t('markai.estimate', {
                    defaultValue:
                      'Estimated nutrition for the whole serving. Check before logging.',
                  })}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {meals.map((meal) => (
                    <Pressable
                      key={meal.id}
                      onPress={() => setMealId(meal.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: mealId === meal.id }}
                    >
                      <Text
                        className={
                          mealId === meal.id
                            ? 'text-accent-primary font-semibold'
                            : 'text-text-secondary'
                        }
                      >
                        {meal.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  accessibilityLabel={t('markai.date', {
                    defaultValue: 'Food log date',
                  })}
                  className="text-text-primary border border-border-subtle rounded-xl px-3 py-2"
                />
                <Button
                  disabled={busy || logged.includes(message.reply.food_id)}
                  onPress={() => {
                    void log(message.reply).catch((e: unknown) =>
                      setError(String(e))
                    );
                  }}
                >
                  {logged.includes(message.reply.food_id)
                    ? t('markai.logged', {
                        defaultValue: 'Logged in your diary',
                      })
                    : t('markai.log', { defaultValue: 'Log food' })}
                </Button>
              </View>
            )}
          </View>
        ))}
        {pendingPrompt ? (
          <MarkaiUserMessage
            text={pendingPrompt}
            pending={busy}
            failed={!busy}
            onRetry={() => void send(pendingPrompt)}
          />
        ) : null}
        {pendingPrompt && busy ? <MarkaiThinking skill={labels[mode]} /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-text-primary">
            {error}
          </Text>
        ) : null}
        <Animated.View style={tail} />
      </ScrollView>
      {session ? (
        <MarkaiComposer
          value={text}
          onChangeText={setText}
          onSend={() => void send()}
          onOptions={() => optionsSheet.current?.present()}
          modeLabel={labels[mode]}
          busy={busy}
          disabled={loading || !conversation || Boolean(pendingPrompt && !busy)}
          onHeight={setBarHeight}
        />
      ) : null}
      <CustomModal
        ref={optionsSheet}
        title={t('markai.options', { defaultValue: 'Chat options' })}
      >
        <View className="px-4 gap-3">
          <Text className="text-text-secondary">
            {t('markai.chooseMode', {
              defaultValue: 'Start a new conversation',
            })}
          </Text>
          <ModeChoices
            labels={labels}
            disabled={busy || loading}
            onSelect={newChat}
          />
          <Text className="text-text-muted">
            {t('online.balance', {
              defaultValue: '{{amount}} AI coins',
              amount: session?.user.ai_coins ?? 0,
            })}
          </Text>
        </View>
      </CustomModal>
      <CustomModal
        ref={historySheet}
        fullHeight
        title={t('markai.history', { defaultValue: 'Conversation history' })}
      >
        <View className="px-4 pb-3">
          <Button disabled={busy || loading} onPress={() => newChat()}>
            {t('markai.newChat', { defaultValue: 'New chat' })}
          </Button>
        </View>
        {historyLoading ? <ActivityIndicator /> : null}
        {historyError ? (
          <View className="px-4 gap-3">
            <Text accessibilityRole="alert" className="text-text-primary">
              {historyError}
            </Text>
            <Button onPress={() => void openHistory()}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </View>
        ) : null}
        <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
          {!historyLoading && !historyError && !threads.length ? (
            <Text className="text-text-secondary">
              {t('markai.noHistory', {
                defaultValue: 'Your conversations will appear here.',
              })}
            </Text>
          ) : null}
          {threads.map((thread) => (
            <Pressable
              key={thread.conversation_id + thread.mode}
              accessibilityRole="button"
              disabled={busy || loading}
              onPress={() => void selectThread(thread)}
              className={
                conversation === thread.conversation_id ? 'bg-raised' : ''
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                borderRadius: 14,
                paddingHorizontal: 12,
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
                  style={{ fontSize: 14, fontWeight: '700' }}
                >
                  {thread.title}
                </Text>
                <Text
                  className="text-text-muted"
                  style={{ fontSize: 12, marginTop: 2 }}
                >
                  {labels[thread.mode]}
                </Text>
              </View>
            </Pressable>
          ))}
        </BottomSheetScrollView>
      </CustomModal>
    </View>
  );
}

function ModeChoices({
  labels,
  disabled,
  onSelect,
}: {
  labels: Record<Mode, string>;
  disabled: boolean;
  onSelect: (mode: Mode) => void;
}) {
  return (['macros', 'training', 'free'] as Mode[]).map((value) => (
    <Pressable
      key={value}
      disabled={disabled}
      accessibilityRole="button"
      onPress={() => onSelect(value)}
      className="bg-surface rounded-2xl px-4 py-3 flex-row items-center gap-3"
    >
      <Icon
        name={
          value === 'macros'
            ? 'food'
            : value === 'training'
              ? 'exercise'
              : 'sparkles'
        }
        size={20}
      />
      <Text className="text-text-primary flex-1" style={{ fontSize: 15 }}>
        {labels[value]}
      </Text>
      <Icon name="chevron-forward" size={16} />
    </Pressable>
  ));
}
