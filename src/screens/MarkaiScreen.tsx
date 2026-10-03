import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
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
import MarkaiTypewriterText from '../components/markai/MarkaiTypewriterText';
import MarkaiGoalCard from '../components/markai/MarkaiGoalCard';
import CustomModal, { type CustomModalRef } from '../components/CustomModal';
import MarkaiComposer from '../components/markai/MarkaiComposer';
import Icon from '../components/Icon';
import MarkaiEmptyState from '../components/markai/MarkaiEmptyState';
import MarkaiThinking from '../components/markai/MarkaiThinking';
import MarkaiUserMessage from '../components/markai/MarkaiUserMessage';
import MarkaiNutrition from '../components/markai/MarkaiNutrition';
import { useCSSVariable } from 'uniwind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import Button from '../components/ui/Button';
import FooterCTA from '../components/ui/FooterCTA';
import AppleSignInButton from '../components/AppleSignInButton';
import { useAppleSignIn } from '../hooks/useAppleSignIn';
import {
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
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
  type MarkaiMode,
  type GoalProposal,
  type MarkaiReply,
  type MarkaiTask,
} from '../services/online/markai';
import { offerSetupAnswer } from '../services/setupWizardSession';
import { fireSelectionHaptic } from '../services/haptics';
import {
  saveMarkaiPhoto,
  withSavedMarkaiPhotos,
} from '../services/online/markaiImages';
import { getTodayDate } from '../utils/dateUtils';
import { pickImageFromCamera, pickImagesFromLibrary } from '../utils/pickImage';
import type { RootStackParamList } from '../types/navigation';

type Mode = MarkaiMode;
type Attachment = { uri: string; data: string };
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
  const headerOffset = useNativeHeaderOffset();
  const session = useOnlineAccount((s) => s.session);
  const accountId = session?.user.id;
  const [mode, setMode] = useState<Mode>('free');
  const [loading, setLoading] = useState(Boolean(accountId));
  const route = useRoute<RouteProp<RootStackParamList, 'MarkAI'>>();
  // A prompt handed over by another screen (a goal to work out), sent in a
  // fresh conversation once the chat is ready. Read before the saved
  // conversation loads, so opening with one never reopens the last chat.
  const pendingPreset = useRef(route.params?.preset ?? null);
  // Opened by the questionnaire: a proposed goal goes back to it.
  const returnToSetup = useRef(!!route.params?.preset?.returnToSetup);
  const accent = useCSSVariable('--color-accent-primary') as string;
  // The message on its way, kept for a retry. A photo-only message has an
  // empty prompt, so this is an object rather than the prompt string.
  const [pending, setPending] = useState<{
    prompt: string;
    label?: string;
    image: Attachment | null;
  } | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [barHeight, setBarHeight] = useState(110);
  // The composer at rest, before a photo or more lines grow it. The empty
  // state is centred above this, so attaching a photo does not lift it.
  const [restingBarHeight, setRestingBarHeight] = useState<number | null>(null);
  const measureBar = useCallback((height: number) => {
    setBarHeight(height);
    setRestingBarHeight((resting) =>
      resting === null ? height : Math.min(resting, height)
    );
  }, []);
  const apple = useAppleSignIn();
  const coinColor = useCSSVariable('--color-macro-fat') as string;
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
  // Follows the end of the chat until the user drags away from it. Only
  // drags decide: iOS scrolls the view itself while it settles the header
  // inset on the way in from another tab, and taking those events as the
  // user's left a conversation opened from the Tracker short of its end.
  const atBottom = useRef(true);
  const dragging = useRef(false);
  const viewport = useRef(0);
  const contentHeight = useRef(0);
  // The next pin glides instead of jumping: a message just sent, or the
  // reply that answers it, from wherever the chat was scrolled to.
  const animateNext = useRef(false);
  // The one reply being typed out: only a reply that just arrived, never
  // a conversation loaded from history.
  const [typingId, setTypingId] = useState<string | null>(null);
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
    task?: MarkaiTask;
    label?: string;
  } | null>(null);
  const header = useScreenHeader({
    variant: 'transparent',
    title: t('markai.title', { defaultValue: 'MarkAI' }),
    left: { kind: 'back' },
    // Each its own glass circle (`separated`): square symbols, so iOS 26
    // draws them round like the back button rather than one wide capsule.
    right: [
      {
        kind: 'icon',
        // Straight into a fresh conversation, without the history screen.
        sfSymbol: 'square.and.pencil',
        ionicon: 'create-outline',
        accessibilityLabel: t('markai.newChat', { defaultValue: 'New chat' }),
        onPress: () => newChat(),
        // An empty chat is already a new one.
        disabled: busy || loading || !session || (!messages.length && !pending),
        separated: true,
      },
      {
        kind: 'icon',
        sfSymbol: 'clock.arrow.circlepath',
        ionicon: 'time-outline',
        accessibilityLabel: t('markai.history', {
          defaultValue: 'Conversation history',
        }),
        onPress: () => openHistory(),
        disabled: busy || loading || !session,
        separated: true,
      },
    ],
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
      const id = pendingPreset.current
        ? null
        : (active?.id ??
          (await AsyncStorage.getItem('@qla/markai/' + accountId + '/macros')));
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
        setMessages(withSavedMarkaiPhotos(history));
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
  const openHistory = () => {
    Keyboard.dismiss();
    navigation.navigate('MarkaiHistory', {
      activeConversation: conversation ?? undefined,
    });
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
  };
  const selectThread = async (thread: { id: string; mode: Mode }) => {
    if (busy || loading) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const history = await onlineRequest<MarkaiMessage[]>(
        '/markai/messages?conversation_id=' + thread.id
      );
      if (version !== loadVersion.current) return;
      setMode(thread.mode);
      setConversation(thread.id);
      setMessages(withSavedMarkaiPhotos(history));
      await AsyncStorage.setItem(
        '@qla/markai/' + accountId + '/active',
        JSON.stringify({ id: thread.id, mode: thread.mode })
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
  // A choice made on the history screen arrives as params; act on it once and
  // clear it, so a re-render or a later visit does not replay it.
  const historyChoice = route.params;
  useEffect(() => {
    if (
      !historyChoice?.thread &&
      !historyChoice?.newChat &&
      !historyChoice?.preset
    )
      return;
    if (historyChoice.preset) {
      pendingPreset.current = historyChoice.preset;
      returnToSetup.current = !!historyChoice.preset.returnToSetup;
      // While the first load runs it opens a fresh conversation itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the params are navigation's state, not this component's.
      if (loading) setMode(historyChoice.preset.mode);
      else newChat(historyChoice.preset.mode);
    } else if (historyChoice.thread) void selectThread(historyChoice.thread);
    else newChat();
    navigation.setParams({
      thread: undefined,
      newChat: undefined,
      preset: undefined,
    });
    // Only a new choice should run this, not the handlers being recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyChoice]);
  // A proposed goal is never applied here. From the questionnaire it goes
  // back into the question for review; anywhere else it opens the goal,
  // filled in, for the user to apply.
  const applyGoal = (goal: GoalProposal) => {
    Keyboard.dismiss();
    fireSelectionHaptic();
    // The whole plan fills every question it answers; outside the
    // questionnaire the calorie goal opens with it, the one the others
    // follow from.
    const values: Record<string, number> =
      goal.key === 'macros' ? goal.values : { [goal.key]: goal.value };
    if (returnToSetup.current) {
      for (const [key, value] of Object.entries(values))
        offerSetupAnswer(key, String(Math.round(value)));
      navigation.goBack();
      return;
    }
    const key = goal.key === 'macros' ? 'calories' : goal.key;
    navigation.navigate('GoalEdit', {
      goalKey: key,
      prefill: Math.round(values[key]),
    });
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
  const send = async (
    value = text,
    image = attachment,
    task?: MarkaiTask,
    // What the chat shows when the app wrote the prompt for the user.
    label?: string,
    // A suggestion sets the mode and sends in one tap, before the state
    // update has landed.
    sendMode: Mode = mode
  ) => {
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
    setPending({ prompt, label, image });
    setText('');
    setAttachment(null);
    atBottom.current = true;
    animateNext.current = true;
    if (
      !pendingRequest.current ||
      pendingRequest.current.prompt !== prompt ||
      pendingRequest.current.image !== (image?.data ?? null) ||
      pendingRequest.current.mode !== sendMode ||
      pendingRequest.current.conversation !== conversation ||
      pendingRequest.current.task !== task
    ) {
      pendingRequest.current = {
        prompt,
        image: image?.data ?? null,
        mode: sendMode,
        conversation,
        id: randomUUID(),
        task,
        label,
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
        mode: sendMode,
        ...(prompt ? { prompt } : null),
        ...(label ? { label } : null),
        ...(image ? { image: image.data } : null),
        ...(task ? { task } : null),
      });
      delivered = true;
      animateNext.current = true;
      setTypingId(response.id);
      setMessages((items) => [
        ...items,
        {
          id: response.id,
          prompt,
          label,
          reply: response.reply,
          has_image: !!image,
          imageUri: image ? saveMarkaiPhoto(response.id, image.uri) : undefined,
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
        JSON.stringify({ id: conversation, mode: sendMode })
      );
    } catch (e: unknown) {
      if (e instanceof OnlineError && e.status === 503)
        pendingRequest.current = null;
      if (!delivered) setPending({ prompt, label, image });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  // The handed-over prompt goes out once there is a conversation to send
  // it in and an account to send it from.
  useEffect(() => {
    const preset = pendingPreset.current;
    if (!preset || loading || busy || !conversation || !session) return;
    pendingPreset.current = null;
    void send(preset.prompt, null, preset.task, preset.label);
    // send is recreated each render; these are the conditions it waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation, loading, busy, session]);
  const empty = !messages.length && !pending && !loading;
  // Keeps a followed chat on its last line, whichever of the content and the
  // viewport was measured last.
  const pinToEnd = () => {
    if (
      (messages.length || pending) &&
      atBottom.current &&
      viewport.current > 0 &&
      contentHeight.current > viewport.current
    ) {
      const animated = animateNext.current;
      animateNext.current = false;
      scroller.current?.scrollToEnd({ animated });
    }
  };
  const pinRef = useRef(pinToEnd);
  useEffect(() => {
    pinRef.current = pinToEnd;
  });
  // The push from another tab settles the header inset as it ends.
  useEffect(
    () => navigation.addListener('transitionEnd', () => pinRef.current()),
    [navigation]
  );
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: nativeHeader ? 0 : insets.top }}
    >
      {header}
      {empty ? (
        // Nothing to scroll: a plain view, centred between the header and the
        // composer, instead of a scroll view that rubber-bands over nothing.
        // The native header floats over this view, so its height is reserved
        // at the top as the composer's is at the bottom; leave either out and
        // the gaps above and below stop matching.
        <View
          style={{
            flex: 1,
            paddingHorizontal: 20,
            justifyContent: 'center',
            paddingTop: nativeHeader ? headerOffset : 0,
            paddingBottom: session
              ? (restingBarHeight ?? barHeight) + insets.bottom
              : 0,
          }}
        >
          <MarkaiEmptyState
            disabled={busy || loading || !session}
            onSelect={(prompt, nextMode) => {
              setMode(nextMode);
              void send(prompt, null, undefined, undefined, nextMode);
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
            pinToEnd();
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
          // No flexGrow: stretched to the frame, a short chat was always one
          // header inset taller than the screen, so it could be dragged up and
          // left sitting under the header. The empty state that needed the
          // stretch is drawn outside this scroll view now.
          contentContainerStyle={{
            padding: 20,
            gap: 16,
            paddingBottom: session ? barHeight + insets.bottom + 12 : 20,
          }}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onMomentumScrollEnd={() => {
            dragging.current = false;
          }}
          onScroll={({ nativeEvent: e }) => {
            if (!dragging.current) return;
            atBottom.current =
              e.contentOffset.y >=
              e.contentSize.height - e.layoutMeasurement.height - 100;
          }}
          onContentSizeChange={(_width, height) => {
            contentHeight.current = height;
            pinToEnd();
          }}
        >
          {loading ? <ActivityIndicator /> : null}
          {messages.map((message) => (
            <View key={message.id} style={{ gap: 14 }}>
              <MarkaiUserMessage
                text={message.label || message.prompt}
                imageUri={message.imageUri}
                hasImage={message.has_image}
              />
              {typingId === message.id ? (
                <MarkaiTypewriterText
                  text={message.reply.text}
                  style={{ alignSelf: 'stretch', fontSize: 18, lineHeight: 27 }}
                  onComplete={() =>
                    setTypingId((id) => (id === message.id ? null : id))
                  }
                />
              ) : (
                <Text
                  selectable
                  className="text-text-primary"
                  style={{ alignSelf: 'stretch', fontSize: 18, lineHeight: 27 }}
                >
                  {message.reply.text}
                </Text>
              )}
              {/* The food card follows the reply once it is typed out. */}
              {message.reply.food && typingId !== message.id && (
                <View className="bg-surface rounded-2xl p-4 gap-3">
                  <View className="flex-row items-center gap-2">
                    <Icon name="food" size={24} color={accent} />
                    <Text className="text-text-primary text-lg font-semibold">
                      {message.reply.food.name}
                    </Text>
                  </View>
                  <Text className="text-text-secondary">
                    {message.reply.food.serving}
                  </Text>
                  <MarkaiNutrition food={message.reply.food} />
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
              {message.reply.goal && typingId !== message.id && (
                <MarkaiGoalCard
                  goal={message.reply.goal}
                  disabled={busy}
                  onApply={() =>
                    message.reply.goal && applyGoal(message.reply.goal)
                  }
                />
              )}
            </View>
          ))}
          {pending ? (
            <MarkaiUserMessage
              text={pending.label || pending.prompt}
              imageUri={pending.image?.uri}
              pending={busy}
              failed={!busy}
              onRetry={() =>
                void send(
                  pending.prompt,
                  pending.image,
                  pendingRequest.current?.task,
                  pending.label,
                  pendingRequest.current?.mode
                )
              }
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
                busy={apple.busy}
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
          onHeight={measureBar}
        />
      ) : null}
      <CustomModal
        ref={optionsSheet}
        title={t('markai.options', { defaultValue: 'Chat options' })}
        headerRight={
          session ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('online.balance', {
                defaultValue: '{{amount}} AI coins',
                amount: session.user.ai_coins,
              })}
              hitSlop={8}
              onPress={() => {
                optionsSheet.current?.dismiss();
                navigation.navigate('CoinPackages');
              }}
              className="bg-raised rounded-full flex-row items-center"
              style={{ height: 36, paddingHorizontal: 12, gap: 6 }}
            >
              <Icon name="ai-coin" size={16} color={coinColor} />
              <Text className="text-text-primary font-semibold">
                {session.user.ai_coins}
              </Text>
            </Pressable>
          ) : null
        }
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
        </View>
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
