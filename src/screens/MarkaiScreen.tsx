import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import CustomModal, { type CustomModalRef } from '../components/CustomModal';
import MarkaiComposer from '../components/markai/MarkaiComposer';
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
import FooterCTA from '../components/ui/FooterCTA';
import AppleSignInButton from '../components/AppleSignInButton';
import { useAppleSignIn } from '../hooks/useAppleSignIn';
import { useScreenHeader } from '../hooks/useScreenHeader';
import {
  onlineRequest,
  OnlineError,
  updateOnlineAccount,
  useOnlineAccount,
  onlineAccountEntryLabel,
} from '../services/online/account';
import {
  markaiFoodToFoodInfo,
  prepareMarkaiImage,
  type MarkaiMessage,
  type MarkaiReply,
} from '../services/online/markai';
import { getTodayDate } from '../utils/dateUtils';
import { pickImageFromCamera, pickImagesFromLibrary } from '../utils/pickImage';
import type { RootStackParamList } from '../types/navigation';

type Mode = 'macros' | 'training' | 'free';
type Attachment = { uri: string; data: string };
type Thread = {
  conversation_id: string;
  mode: Mode;
  title: string;
  updated_at: string;
  message_count: number;
};
export default function MarkaiScreen() {
  const accountId = useOnlineAccount((s) => s.session?.user.id);
  // The provider ties the chat's scroll view to the composer, so iOS 26 draws
  // its native scroll edge effect under the composer the way it does under
  // the header and the tab bar.
  return (
    <ScrollEdgeEffectProvider>
      <MarkaiContent key={accountId ?? 'offline'} />
    </ScrollEdgeEffectProvider>
  );
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
  // The message on its way, kept for a retry. A photo-only message has an
  // empty prompt, so this is an object rather than the prompt string.
  const [pending, setPending] = useState<{
    prompt: string;
    image: Attachment | null;
  } | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [barHeight, setBarHeight] = useState(110);
  const apple = useAppleSignIn();
  const historySheet = useRef<CustomModalRef>(null);
  const optionsSheet = useRef<CustomModalRef>(null);
  const scroller =
    useRef<React.ElementRef<typeof KeyboardChatScrollView>>(null);
  const edgeEffectRef = useScrollEdgeEffectRef();
  const scrollRef = useCallback(
    (node: React.ElementRef<typeof KeyboardChatScrollView> | null) => {
      scroller.current = node;
      edgeEffectRef?.(node);
    },
    [edgeEffectRef]
  );
  const atBottom = useRef(true);
  const viewport = useRef(0);
  const loadVersion = useRef(0);
  const [conversation, setConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<MarkaiMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pendingRequest = useRef<{
    prompt: string;
    image: string | null;
    mode: Mode;
    conversation: string;
    id: string;
  } | null>(null);
  const header = useScreenHeader({
    variant: 'transparent',
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
    setAttachment(null);
    setError(null);
    setPending(null);
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
      setAttachment(null);
      setPending(null);
      pendingRequest.current = null;
      atBottom.current = true;
    } catch (e: unknown) {
      if (version === loadVersion.current) setError(String(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  const reviewFood = (reply: MarkaiReply) => {
    if (!reply.food) return;
    Keyboard.dismiss();
    navigation.navigate('FoodEntryAdd', {
      item: markaiFoodToFoodInfo(reply.food_id, reply.food),
      date: getTodayDate(),
    });
  };
  const attach = async (source: 'camera' | 'library') => {
    if (attaching || busy) return;
    setAttaching(true);
    setError(null);
    try {
      let uri: string | undefined;
      if (source === 'camera') {
        const result = await pickImageFromCamera();
        if (result.status === 'denied') {
          Alert.alert(
            t('progressPhotos.cameraPermission', {
              defaultValue: 'Camera permission is required',
            })
          );
          return;
        }
        if (result.status === 'ok') uri = result.image.uri;
      } else uri = (await pickImagesFromLibrary(1))[0]?.uri;
      if (uri) setAttachment(await prepareMarkaiImage(uri));
    } catch {
      setError(
        t('markai.photoFailed', {
          defaultValue: 'Could not attach that photo. Please try another one.',
        })
      );
    } finally {
      setAttaching(false);
    }
  };
  const send = async (value = text, image = attachment) => {
    if (
      lock.current ||
      loading ||
      (!value.trim() && !image) ||
      !conversation ||
      !session
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const prompt = value.trim();
    setPending({ prompt, image });
    setText('');
    setAttachment(null);
    atBottom.current = true;
    if (
      !pendingRequest.current ||
      pendingRequest.current.prompt !== prompt ||
      pendingRequest.current.image !== (image?.data ?? null) ||
      pendingRequest.current.mode !== mode ||
      pendingRequest.current.conversation !== conversation
    ) {
      pendingRequest.current = {
        prompt,
        image: image?.data ?? null,
        mode,
        conversation,
        id: randomUUID(),
      };
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
        ...(prompt ? { prompt } : null),
        ...(image ? { image: image.data } : null),
      });
      delivered = true;
      setMessages((items) => [
        ...items,
        {
          id: response.id,
          prompt,
          reply: response.reply,
          has_image: !!image,
          imageUri: image?.uri,
        },
      ]);
      setPending(null);
      pendingRequest.current = null;
      await updateOnlineAccount({
        ...session.user,
        ai_coins: response.ai_coins,
      });
      await AsyncStorage.setItem(
        '@qla/markai/' + accountId + '/active',
        JSON.stringify({ id: conversation, mode })
      );
    } catch (e: unknown) {
      if (e instanceof OnlineError && e.status === 503)
        pendingRequest.current = null;
      if (!delivered) setPending({ prompt, image });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const empty = !messages.length && !pending && !loading;
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: nativeHeader ? 0 : insets.top }}
    >
      {header}
      {empty ? (
        // Nothing to scroll: a plain view, centred and lifted slightly above
        // the middle, instead of a scroll view that rubber-bands over nothing.
        <View
          style={{
            flex: 1,
            paddingHorizontal: 20,
            justifyContent: 'center',
            paddingBottom: session ? barHeight + insets.bottom : 0,
            transform: [{ translateY: -36 }],
          }}
        >
          <MarkaiEmptyState
            disabled={busy || loading || !session}
            onSelect={(prompt, nextMode) => {
              setMode(nextMode);
              setText(prompt);
            }}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              className="text-text-primary text-center mt-6"
            >
              {error}
            </Text>
          ) : null}
        </View>
      ) : (
        <KeyboardChatScrollView
          ref={scrollRef}
          keyboardLiftBehavior="whenAtEnd"
          offset={insets.bottom}
          onLayout={(event) => {
            viewport.current = event.nativeEvent.layout.height;
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
          contentContainerStyle={{
            flexGrow: 1,
            padding: 20,
            gap: 16,
            paddingBottom: session ? barHeight + insets.bottom + 12 : 20,
          }}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent: e }) => {
            atBottom.current =
              e.contentOffset.y >=
              e.contentSize.height - e.layoutMeasurement.height - 100;
          }}
          onContentSizeChange={(_width, height) => {
            if (
              (messages.length || pending) &&
              atBottom.current &&
              viewport.current > 0 &&
              height > viewport.current
            )
              scroller.current?.scrollToEnd({ animated: false });
          }}
        >
          {loading ? <ActivityIndicator /> : null}
          {messages.map((message) => (
            <View key={message.id} style={{ gap: 14 }}>
              <MarkaiUserMessage
                text={message.prompt}
                imageUri={message.imageUri}
                hasImage={message.has_image}
              />
              <Text
                selectable
                className="text-text-primary"
                style={{ alignSelf: 'stretch', fontSize: 18, lineHeight: 27 }}
              >
                {message.reply.text}
              </Text>
              {message.reply.food && (
                <View className="bg-surface rounded-2xl p-4 gap-3">
                  <View className="flex-row items-center gap-2">
                    <Icon name="food" size={24} />
                    <Text className="text-text-primary text-lg font-semibold">
                      {message.reply.food.name}
                    </Text>
                  </View>
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
                  <Button
                    disabled={busy}
                    onPress={() => reviewFood(message.reply)}
                  >
                    {t('markai.log', { defaultValue: 'Log food' })}
                  </Button>
                </View>
              )}
            </View>
          ))}
          {pending ? (
            <MarkaiUserMessage
              text={pending.prompt}
              imageUri={pending.image?.uri}
              pending={busy}
              failed={!busy}
              onRetry={() => void send(pending.prompt, pending.image)}
            />
          ) : null}
          {pending && busy ? <MarkaiThinking skill={labels[mode]} /> : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-text-primary">
              {error}
            </Text>
          ) : null}
        </KeyboardChatScrollView>
      )}
      {!session ? (
        // Signed out, the sign-in is the screen's one action: pinned in the
        // app's footer slot with its small print, the chips above it.
        <FooterCTA
          sticky={false}
          note={t('markai.register', {
            defaultValue:
              'Sign in to get 100 AI coins. Each AI reply costs 1 coin; logging a food card is free.',
          })}
          action={
            apple.available ? (
              <AppleSignInButton
                variant="signIn"
                disabled={apple.busy}
                onPress={() => void apple.signIn()}
              />
            ) : (
              <Button onPress={() => navigation.navigate('OnlineAccount')}>
                {onlineAccountEntryLabel(t)}
              </Button>
            )
          }
        />
      ) : null}
      {session ? (
        <MarkaiComposer
          value={text}
          onChangeText={setText}
          onSend={() => void send()}
          onOptions={() => optionsSheet.current?.present()}
          onAttach={(source) => void attach(source)}
          attachment={attachment?.uri}
          attaching={attaching}
          onRemoveAttachment={() => setAttachment(null)}
          modeLabel={labels[mode]}
          busy={busy}
          disabled={loading || !conversation || Boolean(pending && !busy)}
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
                  {thread.title || t('markai.photo', { defaultValue: 'Photo' })}
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
