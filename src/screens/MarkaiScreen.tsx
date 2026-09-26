import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import { useScreenHeader } from '../hooks/useScreenHeader';
import {
  onlineRequest,
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
import type { RootStackScreenProps } from '../types/navigation';

type Mode = 'macros' | 'training' | 'free';
export default function MarkaiScreen({
  navigation,
}: RootStackScreenProps<'MarkAI'>) {
  const { t } = useTranslation();
  const session = useOnlineAccount((s) => s.session);
  const [mode, setMode] = useState<Mode>('macros');
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
  const header = useScreenHeader({
    title: t('markai.title', { defaultValue: 'MarkAI' }),
    left: { kind: 'back' },
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
    ).then(setLogged);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setConversation(null);
    setMessages([]);
    setError(null);
    if (!session) return;
    const load = async () => {
      const key = `@qla/markai/${session.user.id}/${mode}`;
      let id = await AsyncStorage.getItem(key);
      if (!id) {
        id = randomUUID();
        await AsyncStorage.setItem(key, id);
      }
      const history = await onlineRequest<MarkaiMessage[]>(
        `/markai/messages?conversation_id=${id}`
      );
      if (!cancelled) {
        setConversation(id);
        setMessages(history);
      }
    };
    void load().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [mode, session?.user.id]);
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
  const send = async () => {
    if (lock.current || !text.trim() || !conversation || !session) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const prompt = text.trim();
    try {
      const response = await onlineRequest<{
        id: string;
        reply: MarkaiReply;
        ai_coins: number;
      }>('/markai/messages', {
        id: randomUUID(),
        conversation_id: conversation,
        mode,
        prompt,
      });
      setMessages((items) => [
        ...items,
        { id: response.id, prompt, reply: response.reply },
      ]);
      setText('');
      await updateOnlineAccount({
        ...session.user,
        ai_coins: response.ai_coins,
      });
      if (response.reply.log_requested) await log(response.reply);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      {header}
      <View className="flex-row p-4 gap-2">
        {(['macros', 'training', 'free'] as Mode[]).map((value) => (
          <Pressable
            key={value}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === value }}
            onPress={() => setMode(value)}
            className={`flex-1 rounded-xl p-3 ${mode === value ? 'bg-accent-primary' : 'bg-surface'}`}
          >
            <Text
              className={
                mode === value
                  ? 'text-white text-center'
                  : 'text-text-primary text-center'
              }
            >
              {labels[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {!session ? (
        <View className="p-6 gap-4">
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
      ) : (
        <>
          <Text className="text-text-secondary px-4">
            {t('online.balance', {
              defaultValue: '{{amount}} AI coins',
              amount: session.user.ai_coins,
            })}
          </Text>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-text-secondary">
              {t('markai.hint', {
                defaultValue:
                  'Describe your food, ask about training, or start a conversation. Food estimates appear as cards you can log.',
              })}
            </Text>
            {messages.map((message) => (
              <View key={message.id} className="gap-3">
                <View className="bg-raised rounded-2xl p-4">
                  <Text className="text-text-primary">{message.prompt}</Text>
                </View>
                <Text className="text-text-primary">{message.reply.text}</Text>
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
          </ScrollView>
          <View className="p-4 gap-3 bg-surface">
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
            {error && (
              <Text accessibilityRole="alert" className="text-text-primary">
                {error}
              </Text>
            )}
            <TextInput
              multiline
              maxLength={6000}
              value={text}
              onChangeText={setText}
              accessibilityLabel={t('markai.message', {
                defaultValue: 'Message MarkAI',
              })}
              placeholder={t('markai.message', {
                defaultValue: 'Message MarkAI',
              })}
              className="text-text-primary border border-border-subtle rounded-xl p-3"
              style={{ maxHeight: 120 }}
            />
            <Button
              loading={busy}
              disabled={!text.trim() || !conversation || busy}
              onPress={() => void send()}
            >
              {t('markai.send', { defaultValue: 'Send' })}
            </Button>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
