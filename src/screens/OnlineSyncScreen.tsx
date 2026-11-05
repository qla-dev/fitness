import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';
import { useTranslation } from 'react-i18next';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import Button from '../components/ui/Button';
import FooterCTA from '../components/ui/FooterCTA';
import Switch from '../components/ui/Switch';
import Icon from '../components/Icon';
import AppleSignInButton from '../components/AppleSignInButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useAppleSignIn';
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

/**
 * The page scrolls under a glass footer that floats over its end, as a
 * top-aligned PromptScreen does; the provider ties the two together so iOS 26
 * draws its scroll edge effect under the footer instead of a filled bar.
 */
export default function OnlineSyncScreen(
  props: RootStackScreenProps<'OnlineSync'>
) {
  return (
    <ScrollEdgeEffectProvider>
      <OnlineSyncContent {...props} />
    </ScrollEdgeEffectProvider>
  );
}

function OnlineSyncContent({ navigation }: RootStackScreenProps<'OnlineSync'>) {
  const { t } = useTranslation();
  const edgeEffectRef = useScrollEdgeEffectRef();
  const [footerHeight, setFooterHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const state = useOnlineSync();
  const session = useOnlineAccount((s) => s.session);
  const apple = useAppleSignIn();
  const google = useGoogleSignIn();
  // Transparent, like every screen on NativeHeaderScrollView: an opaque bar
  // already starts the page below itself, and the scroll view's own header
  // padding then left a second bar's height of empty space at the top.
  const header = useScreenHeader({
    variant: 'transparent',
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
      // The footer pads itself clear of the home indicator.
      style={{ paddingTop: nativeHeader ? 0 : insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        ref={edgeEffectRef}
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: Math.max(footerHeight, insets.bottom) + 16,
        }}
      >
        {!session ? (
          // Signed out there is nothing to schedule: the options would only
          // describe a sync that cannot run.
          <View className="gap-3">
            {/* The sign-in buttons are in the footer below. */}
            {!apple.available && !google.available && (
              <Button onPress={() => navigation.navigate('OnlineAccount')}>
                {onlineAccountEntryLabel(t)}
              </Button>
            )}
            {(apple.error ?? google.error) && (
              <Text accessibilityRole="alert" className="text-text-primary">
                {apple.error ?? google.error}
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
            {/* A conflict is explained here in the app's language; the sync
                service's own message for it is English-only. */}
            {state.conflict ? (
              <Text accessibilityRole="alert" className="text-text-primary">
                {t('online.conflictBody', {
                  defaultValue:
                    'This device and your account have different versions of some entries. Choose which one to keep below.',
                })}
              </Text>
            ) : state.error ? (
              <Text accessibilityRole="alert" className="text-text-primary">
                {state.error}
              </Text>
            ) : null}
            <Button
              variant="ghost"
              disabled={state.busy}
              onPress={() => run(signOutOnline)}
            >
              {t('online.signOut', { defaultValue: 'Sign out' })}
            </Button>
          </>
        )}
      </NativeHeaderScrollView>
      {/* Every action that changes the sync sits in the footer, as on the
          other sheets: signed out, the sign-in buttons; signed in, Sync now,
          with the two ways out of a conflict stacked above it. */}
      {!session ? (
        apple.available || google.available ? (
          <FooterCTA
            glass
            absolute
            edgeEffect
            onHeightChange={setFooterHeight}
            above={
              <>
                {apple.available && (
                  <AppleSignInButton
                    variant="signIn"
                    disabled={apple.busy || google.busy}
                    busy={apple.busy}
                    onPress={() => void apple.signIn()}
                  />
                )}
                {google.available && (
                  <GoogleSignInButton
                    variant="signIn"
                    disabled={apple.busy || google.busy}
                    busy={google.busy}
                    onPress={() => void google.signIn()}
                  />
                )}
              </>
            }
          />
        ) : (
          <View style={{ height: insets.bottom }} />
        )
      ) : (
        <FooterCTA
          glass
          absolute
          edgeEffect
          onHeightChange={setFooterHeight}
          label={t('online.syncNow', { defaultValue: 'Sync now' })}
          onPress={() => run(syncOnline)}
          disabled={state.busy}
          loading={state.busy}
          above={
            state.conflict ? (
              <>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={state.busy}
                  onPress={() => resolve('device')}
                >
                  {t('online.keepDevice', {
                    defaultValue: 'Keep this device’s version',
                  })}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={state.busy}
                  onPress={() => resolve('online')}
                >
                  {t('online.keepOnline', {
                    defaultValue: 'Use the online version',
                  })}
                </Button>
              </>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
