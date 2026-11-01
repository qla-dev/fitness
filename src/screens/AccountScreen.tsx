import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import Icon from '../components/Icon';
import SignInMethodRow from '../components/SignInMethodRow';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
  type OnlineAccount,
} from '../services/online/account';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { accountPasswordQueryKey, profileQueryKey } from '../hooks/queryKeys';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { fetchProfile } from '../services/api/profileApi';
import { hasAccountPassword } from '../services/accountPassword';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { profileLinkLabel } from '../utils/profileLink';
import type { RootStackScreenProps } from '../types/navigation';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type AccountScreenProps = RootStackScreenProps<'Account'>;

/**
 * The account behind the profile, the way the system's own account page lays
 * it out: one list of what identifies you, each row drilling into its own
 * edit screen.
 *
 * The transparent header without a `nativeTitle`, so the bar keeps the
 * route's title from the first frame instead of fading one in on scroll —
 * this screen has no big title in its content to hand off from.
 */
const AccountScreen: React.FC<AccountScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [muted, iconColor] = useCSSVariable([
    '--color-text-muted',
    '--color-text-secondary',
  ]) as [string, string];

  const profile = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
  }).data;
  const hasPassword =
    useQuery({
      queryKey: accountPasswordQueryKey,
      queryFn: hasAccountPassword,
    }).data ?? false;

  const signedIn = useOnlineAccount((s) => !!s.session);
  const appleEmail = useOnlineAccount(
    (s) => s.session?.user.sign_in?.email ?? null
  );
  // Picks up the email the server saved at the last Apple sign-in.
  const accountId = useOnlineAccount((s) => s.session?.user.id);
  useEffect(() => {
    if (accountId)
      void onlineRequest<OnlineAccount>('/account')
        .then(updateOnlineAccount)
        .catch(() => undefined);
  }, [accountId]);

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('account.title', { defaultValue: 'Account' }),
    left: { kind: 'back' },
  });

  const notSet = t('account.notSet', { defaultValue: 'Not set' });
  // The value on the right, then the chevron. A row's `rightAccessory`
  // replaces the chevron, so this draws both, the way the system list does.
  const value = (text: string | null | undefined) => (
    <View className="flex-row items-center" style={{ gap: 8, maxWidth: 180 }}>
      <Text
        className="text-base text-text-secondary"
        style={text ? undefined : { color: muted }}
        numberOfLines={1}
      >
        {text || notSet}
      </Text>
      <Icon name="chevron-forward" size={12} color={iconColor} />
    </View>
  );

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <SettingsRowGroup>
          <SettingsRow
            icon="person"
            iconColor={iconColor}
            title={t('profile.name', { defaultValue: 'Name' })}
            rightAccessory={value(profile?.full_name)}
            onPress={() =>
              navigation.navigate('ProfileEdit', { field: 'name' })
            }
          />
          <SettingsRow
            icon="account-username"
            iconColor={iconColor}
            title={t('profile.username', { defaultValue: 'Username' })}
            subtitle={
              profile?.username ? profileLinkLabel(profile.username) : undefined
            }
            rightAccessory={profile?.username ? undefined : value(null)}
            onPress={() =>
              navigation.navigate('ProfileEdit', { field: 'username' })
            }
          />
        </SettingsRowGroup>
        <View style={{ height: 24 }} />
        <SettingsRowGroup
          title={t('account.signIn', { defaultValue: 'Sign-in methods' })}
        >
          <SignInMethodRow provider="apple" />
          <SignInMethodRow provider="google" />
          <SettingsRow
            icon="account-email"
            iconColor={iconColor}
            title={t('profile.email', { defaultValue: 'Email' })}
            // The profile's own email first; signed in and none typed, the
            // address Apple or Google verified.
            rightAccessory={value(profile?.email || appleEmail)}
            onPress={() =>
              navigation.navigate('ProfileEdit', { field: 'email' })
            }
          />
          <SettingsRow
            icon="lock-closed"
            iconColor={iconColor}
            title={t('profile.password', { defaultValue: 'Password' })}
            rightAccessory={value(
              hasPassword
                ? t('account.passwordSet', { defaultValue: 'Set' })
                : null
            )}
            onPress={() =>
              navigation.navigate('ProfileEdit', { field: 'password' })
            }
          />
        </SettingsRowGroup>
        <View style={{ height: 24 }} />
        <SettingsRowGroup title={t('account.sync', { defaultValue: 'Sync' })}>
          <SettingsRow
            icon="sync"
            iconColor={iconColor}
            title={t('online.sync', { defaultValue: 'Online sync' })}
            subtitle={t('account.syncSubtitle', {
              defaultValue: 'Your diary on every phone you sign in on',
            })}
            // Signed out there is nothing to sync yet, so this opens the
            // sign-in sheet instead of an empty sync screen.
            onPress={() =>
              navigation.navigate(signedIn ? 'OnlineSync' : 'OnlineAccount')
            }
          />
        </SettingsRowGroup>
      </NativeHeaderScrollView>
    </View>
  );
};

export default AccountScreen;
