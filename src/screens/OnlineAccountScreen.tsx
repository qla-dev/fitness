import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/ui/Button';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import {
  SIGN_IN_SEEN_KEY,
  signInWithApple,
  useOnlineAccount,
} from '../services/online/account';
import { syncOnline, useOnlineSync } from '../services/online/sync';
import { queryClient } from '../hooks/queryClient';
import type { RootStackScreenProps } from '../types/navigation';

export default function OnlineAccountScreen({
  navigation,
}: RootStackScreenProps<'OnlineAccount'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const session = useOnlineAccount((s) => s.session);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const header = useScreenHeader({
    title: t('online.account', { defaultValue: 'Your account' }),
    left: navigation.canGoBack() ? { kind: 'back' } : undefined,
  });
  useEffect(() => {
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  const finish = async () => {
    await AsyncStorage.setItem(SIGN_IN_SEEN_KEY, 'true');
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Tabs', { screen: 'Dashboard' });
  };
  const signIn = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      setReward(await signInWithApple());
      if (useOnlineSync.getState().enabled) await syncOnline();
      await queryClient.invalidateQueries();
    } catch (failure: unknown) {
      if (!(
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 'ERR_REQUEST_CANCELED'
      ))
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: nativeHeader ? 0 : insets.top,
      }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View className="bg-surface rounded-3xl p-6 gap-5">
          <Text className="text-text-primary text-3xl font-bold">
            {t('online.welcome', { defaultValue: 'Make it yours' })}
          </Text>
          <Text className="text-text-secondary text-base">
            {session
              ? reward
                ? t('online.reward', {
                    defaultValue:
                      'Your account is ready. 100 AI coins are yours to use with MarkAI.',
                  })
                : t('online.signedIn', {
                    defaultValue:
                      'You are signed in. Your account keeps your synced data ready for your next device.',
                  })
              : t('online.invite', {
                  defaultValue:
                    'Create your free account to get 100 AI coins for MarkAI and keep your synced diary when you change phones.',
                })}
          </Text>
          {session ? (
            <Text className="text-accent-primary text-xl font-semibold">
              {t('online.balance', {
                defaultValue: '{{amount}} AI coins',
                amount: session.user.ai_coins,
              })}
            </Text>
          ) : available && Platform.OS === 'ios' ? (
            <View pointerEvents={busy ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={{ height: 50, width: '100%' }}
                onPress={() => void signIn()}
              />
            </View>
          ) : (
            <Text className="text-text-secondary">
              {t('online.appleOnly', {
                defaultValue:
                  'Apple sign-in is available on supported Apple devices. You can keep using the app offline.',
              })}
            </Text>
          )}
          {busy && <ActivityIndicator />}
          {error && (
            <Text accessibilityRole="alert" className="text-text-primary">
              {error}
            </Text>
          )}
          <Button
            variant={session ? 'primary' : 'ghost'}
            disabled={busy}
            onPress={() =>
              void finish().catch((e: unknown) => setError(String(e)))
            }
          >
            {session
              ? t('common.continue', { defaultValue: 'Continue' })
              : t('online.skip', { defaultValue: 'Continue offline' })}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
