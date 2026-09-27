import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import PromptScreen from '../components/ui/PromptScreen';
import { signInWithApple, useOnlineAccount } from '../services/online/account';
import { syncOnline, useOnlineSync } from '../services/online/sync';
import { queryClient } from '../hooks/queryClient';
import { addLog } from '../services/LogService';
import type { RootStackScreenProps } from '../types/navigation';

export default function OnlineAccountScreen({
  navigation,
}: RootStackScreenProps<'OnlineAccount'>) {
  const { t } = useTranslation();
  const session = useOnlineAccount((s) => s.session);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const dismissed = useRef(false);
  useEffect(() => {
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  const finish = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Tabs', { screen: 'Dashboard' });
  }, [navigation]);
  useEffect(() => {
    if (session) finish();
  }, [session, finish]);
  const signIn = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
      finish();
      // Authentication is complete. Optional sync must not hold the sheet open.
      void (async () => {
        if (useOnlineSync.getState().enabled) await syncOnline();
        await queryClient.invalidateQueries();
      })().catch((failure: unknown) => {
        addLog('[OnlineAccount] Post-sign-in sync failed', 'WARNING', [
          String(failure),
        ]);
      });
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
  if (session) return null;
  return (
    <PromptScreen
      headerTitle={t('online.account', { defaultValue: 'Your account' })}
      title={t('online.welcome', { defaultValue: 'Make it yours' })}
      description={t('online.invite', {
        defaultValue:
          'Create your free account to get 100 AI coins for MarkAI and keep your synced diary when you change phones.',
      })}
      footerLabel={t('online.skip', { defaultValue: 'Continue offline' })}
      onFooterPress={finish}
      footerDisabled={busy}
      dismissDisabled={busy}
    >
      <View className="gap-5">
        {available && Platform.OS === 'ios' ? (
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
      </View>
    </PromptScreen>
  );
}
