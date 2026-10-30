import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Icon from './Icon';
import { signOutOnline, useOnlineAccount } from '../services/online/account';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useAppleSignIn';
import { queryClient } from '../hooks/queryClient';
import { fireSelectionHaptic, fireSuccessHaptic } from '../services/haptics';

// The settings rows' tile, inset and gap (MenuItem / MenuItemIcon), so the
// row lines up with Email and Password under it.
const TILE = 39;
const GOOGLE_BORDER = '#747775';

type Provider = 'apple' | 'google';

/**
 * One sign-in method on the Account screen.
 *
 * Signed out, every method the phone offers is listed: its tile breathes and
 * the row signs in directly, and the badge pops in with a success tick when
 * it lands. Signed in, only the method in use is listed, with the email the
 * provider verified (or that Apple hides it) and a Connected badge; tapping
 * it signs out after a confirmation. An account belongs to one method, so
 * the other is not offered while signed in: signing in with it would open a
 * different account.
 */
export default function SignInMethodRow({ provider }: { provider: Provider }) {
  const { t } = useTranslation();
  const session = useOnlineAccount((s) => s.session);
  const apple = useAppleSignIn();
  const google = useGoogleSignIn();
  const method = provider === 'apple' ? apple : google;
  const [signingOut, setSigningOut] = useState(false);
  // Black on white in light mode, white on black in dark: Apple's two button
  // styles, taken from the theme so the tile never disappears into the page.
  const [secondary, success, successBg, ink, paper] = useCSSVariable([
    '--color-text-secondary',
    '--color-text-success',
    '--color-bg-success',
    '--color-text-primary',
    '--color-background',
  ]) as string[];
  // A session saved before the server named the provider was an Apple one.
  const signedInWith = session ? (session.user.sign_in?.provider ?? 'apple') : null;
  const connected = signedInWith === provider;
  const email = connected ? (session?.user.sign_in?.email ?? null) : null;
  const privateEmail = connected && !!session?.user.sign_in?.private_email;

  // The success tick belongs to the moment of connecting, not to opening the
  // screen already connected.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) fireSuccessHaptic();
    wasConnected.current = connected;
  }, [connected]);

  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value =
      connected || reducedMotion
        ? 0
        : withRepeat(withTiming(1, { duration: 1600 }), -1, false);
    return () => cancelAnimation(pulse);
  }, [connected, reducedMotion, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));

  if (signedInWith ? !connected : !method.available) return null;

  const name =
    provider === 'apple'
      ? t('account.apple', { defaultValue: 'Apple' })
      : t('account.google', { defaultValue: 'Google' });
  const subtitle = connected
    ? email
      ? privateEmail
        ? t('account.appleRelay', {
            defaultValue: '{{email}} · Hidden by Apple',
            email,
          })
        : email
      : t('account.signedIn', { defaultValue: 'Signed in' })
    : t('account.appleConnectHint', {
        defaultValue: 'Sync across phones · 100 free AI coins',
      });
  const busy = method.busy || signingOut;

  const signOut = () =>
    Alert.alert(
      t('account.signOutTitle', {
        defaultValue: 'Sign out of {{provider}}?',
        provider: name,
      }),
      t('account.signOutBody', {
        defaultValue:
          'Your diary stays on this phone. Sign in again to sync it and use your AI coins.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('online.signOut', { defaultValue: 'Sign out' }),
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void signOutOnline()
              .then(() => queryClient.invalidateQueries())
              .catch((error: unknown) =>
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  error instanceof Error ? error.message : String(error)
                )
              )
              .finally(() => setSigningOut(false));
          },
        },
      ]
    );

  const tileStyle =
    provider === 'apple'
      ? { backgroundColor: ink }
      : {
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: GOOGLE_BORDER,
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        connected
          ? t('account.providerConnected', {
              defaultValue: '{{provider}}, connected. {{detail}}',
              provider: name,
              detail: subtitle,
            })
          : t('account.providerConnect', {
              defaultValue: 'Connect {{provider}}',
              provider: name,
            })
      }
      accessibilityHint={
        connected
          ? t('account.signOutHint', { defaultValue: 'Signs you out' })
          : undefined
      }
      disabled={busy}
      onPress={() => {
        fireSelectionHaptic();
        if (connected) signOut();
        else void method.signIn();
      }}
      className="flex-row items-center"
      style={({ pressed }) => ({
        minHeight: 66,
        paddingLeft: 13,
        paddingRight: 16,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: TILE,
          height: TILE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!connected ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: TILE,
                height: TILE,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: ink,
              },
              halo,
            ]}
          />
        ) : null}
        <View
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            ...tileStyle,
          }}
        >
          <Icon
            name={provider === 'apple' ? 'apple-logo' : 'google-logo'}
            size={22}
            color={provider === 'apple' ? paper : '#1F1F1F'}
          />
        </View>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-base font-semibold text-text-primary">
          {connected
            ? name
            : t('account.providerConnect', {
                defaultValue: 'Connect {{provider}}',
                provider: name,
              })}
        </Text>
        <Text
          className="text-sm mt-0.5"
          style={{ color: secondary }}
          numberOfLines={1}
        >
          {method.error ?? subtitle}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator />
      ) : connected ? (
        <Animated.View
          entering={reducedMotion ? undefined : ZoomIn.springify()}
          className="flex-row items-center rounded-full px-2.5 py-1"
          style={{ backgroundColor: successBg, gap: 4 }}
        >
          <Icon name="checkmark" size={12} color={success} />
          <Text style={{ color: success, fontSize: 12, fontWeight: '700' }}>
            {t('account.connected', { defaultValue: 'Connected' })}
          </Text>
        </Animated.View>
      ) : (
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: ink }}
        >
          <Text style={{ color: paper, fontSize: 13, fontWeight: '700' }}>
            {t('account.connect', { defaultValue: 'Connect' })}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
