import { useEffect } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import Button from '../components/ui/Button';
import Switch from '../components/ui/Switch';
import Icon from '../components/Icon';
import AppleSignInButton from '../components/AppleSignInButton';
import { useAppleSignIn } from '../hooks/useAppleSignIn';
import { getAppLocale } from '../localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import {
  loadSyncSettings,
  resolveSyncConflict,
  saveSyncSettings,
  syncOnline,
  useOnlineSync,
} from '../services/online/sync';
import {
  onlineAccountEntryLabel,
  signOutOnline,
  useOnlineAccount,
} from '../services/online/account';
import { queryClient } from '../hooks/queryClient';
import type { RootStackScreenProps } from '../types/navigation';

export default function OnlineSyncScreen({
  navigation,
}: RootStackScreenProps<'OnlineSync'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const state = useOnlineSync();
  const session = useOnlineAccount((s) => s.session);
  const apple = useAppleSignIn();
  const header = useScreenHeader({
    title: t('online.sync', { defaultValue: 'Online sync' }),
    left: { kind: 'back' },
  });
  const run = (operation: () => Promise<unknown>) => {
    void operation()
      .then(() => queryClient.invalidateQueries())
      .catch((error: unknown) =>
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          error instanceof Error ? error.message : String(error)
        )
      );
  };
  useEffect(() => {
    void loadSyncSettings().catch(() => undefined);
  }, []);
  const resolve = (choice: 'device' | 'online') =>
    Alert.alert(
      t('online.conflict', { defaultValue: 'Resolve sync conflict' }),
      t('online.conflictHint', {
        defaultValue:
          'Choose which version to keep. This replaces conflicting data with the selected version.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.continue', { defaultValue: 'Continue' }),
          onPress: () => run(() => resolveSyncConflict(choice)),
        },
      ]
    );
  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: nativeHeader ? 0 : insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!session ? (
          // Signed out there is nothing to schedule: the options would only
          // describe a sync that cannot run.
          <View className="gap-3">
            {apple.available ? (
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
            )}
            {apple.error && (
              <Text accessibilityRole="alert" className="text-text-primary">
                {apple.error}
              </Text>
            )}
          </View>
        ) : (
          <>
            <SettingsRowGroup>
              <SettingsRow
                title={t('online.automatic', {
                  defaultValue: 'Automatic sync',
                })}
                subtitle={t('online.offlineHint', {
                  defaultValue: 'Your diary always works offline.',
                })}
                rightAccessory={
                  <Switch
                    accessibilityLabel={t('online.automatic', {
                      defaultValue: 'Automatic sync',
                    })}
                    value={state.enabled}
                    onValueChange={(enabled) =>
                      run(() => saveSyncSettings({ enabled }))
                    }
                  />
                }
              />
              {[15, 30, 60, 240].map((minutes) => (
                <SettingsRow
                  key={minutes}
                  title={t('online.interval', {
                    defaultValue: 'Every {{minutes}} minutes',
                    minutes,
                  })}
                  onPress={() =>
                    run(() => saveSyncSettings({ intervalMinutes: minutes }))
                  }
                  rightAccessory={
                    // Null, not undefined: a choice row takes no chevron.
                    state.intervalMinutes === minutes ? (
                      <Icon name="checkmark" size={18} />
                    ) : null
                  }
                />
              ))}
            </SettingsRowGroup>
            <Text className="text-text-secondary">
              {t('online.scheduleHint', {
                defaultValue:
                  'Sync runs while the app is open and when you return. Background timing is managed by your phone and may be delayed.',
              })}
            </Text>
            <Text className="text-text-secondary">
              {state.lastSynced
                ? t('online.lastSync', {
                    defaultValue: 'Last synced: {{time}}',
                    time: new Date(state.lastSynced).toLocaleString(
                      getAppLocale()
                    ),
                  })
                : t('online.notSynced', { defaultValue: 'Not synced yet' })}
            </Text>
            {state.error && (
              <Text accessibilityRole="alert" className="text-text-primary">
                {state.error}
              </Text>
            )}
            <Button
              disabled={state.busy}
              loading={state.busy}
              onPress={() => run(syncOnline)}
            >
              {t('online.syncNow', { defaultValue: 'Sync now' })}
            </Button>
            {state.conflict && (
              <View className="gap-3">
                <Button
                  variant="secondary"
                  disabled={state.busy}
                  onPress={() => resolve('device')}
                >
                  {t('online.keepDevice', {
                    defaultValue: 'Keep this device’s version',
                  })}
                </Button>
                <Button
                  variant="secondary"
                  disabled={state.busy}
                  onPress={() => resolve('online')}
                >
                  {t('online.keepOnline', {
                    defaultValue: 'Use the online version',
                  })}
                </Button>
              </View>
            )}
            <Button
              variant="ghost"
              disabled={state.busy}
              onPress={() => run(signOutOnline)}
            >
              {t('online.signOut', { defaultValue: 'Sign out' })}
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}
