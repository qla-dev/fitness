import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { useOnlineAccount } from '../services/online/account';
import { useAppleSignIn } from '../hooks/useAppleSignIn';
import { fireSelectionHaptic, fireSuccessHaptic } from '../services/haptics';

const TILE = 44;

/**
 * Sign in with Apple as a sign-in method on the Account screen.
 *
 * Connected, it shows the email Apple verified (or that it is a private relay
 * address) with a Connected badge. Not connected, the Apple tile breathes and
 * the row signs in directly; the badge pops in with a success tick when it
 * lands. The email comes from the server, which saves it on each sign-in, so
 * an account made before that shows a prompt to sign in once more for it.
 */
export default function AppleConnectionRow() {
  const { t } = useTranslation();
  const session = useOnlineAccount((s) => s.session);
  const apple = useAppleSignIn();
  // Black on white in light mode, white on black in dark: Apple's two button
  // styles, taken from the theme so the tile never disappears into the page.
  const [secondary, success, successBg, ink, paper] = useCSSVariable([
    '--color-text-secondary',
    '--color-text-success',
    '--color-bg-success',
    '--color-text-primary',
    '--color-background',
  ]) as string[];
  const connected = !!session;
  const email = session?.user.sign_in?.email ?? null;
  const privateEmail = session?.user.sign_in?.private_email ?? false;

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

  const subtitle = connected
    ? email
      ? privateEmail
        ? t('account.appleRelay', {
            defaultValue: '{{email}} · Hidden by Apple',
            email,
          })
        : email
      : t('account.appleEmailMissing', {
          defaultValue: 'Tap to sign in again and show your email',
        })
    : t('account.appleConnectHint', {
        defaultValue: 'Sync across phones · 100 free AI coins',
      });

  // Connected with an email there is nothing to do; otherwise the row signs
  // in (which also refreshes a missing email).
  const actionable = apple.available && !(connected && email);

  return (
    <Pressable
      accessibilityRole={actionable ? 'button' : undefined}
      accessibilityLabel={
        connected
          ? t('account.appleConnected', {
              defaultValue: 'Apple, connected. {{detail}}',
              detail: subtitle,
            })
          : t('account.appleConnect', { defaultValue: 'Connect Apple' })
      }
      disabled={!actionable || apple.busy}
      onPress={() => {
        fireSelectionHaptic();
        void apple.signIn();
      }}
      className="flex-row items-center px-4"
      style={({ pressed }) => ({
        minHeight: 66,
        gap: 14,
        opacity: pressed && actionable ? 0.7 : 1,
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
            backgroundColor: ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="apple-logo" size={22} color={paper} />
        </View>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-base font-semibold text-text-primary">
          {connected
            ? t('account.apple', { defaultValue: 'Apple' })
            : t('account.appleConnect', { defaultValue: 'Connect Apple' })}
        </Text>
        <Text
          className="text-sm mt-0.5"
          style={{ color: secondary }}
          numberOfLines={1}
        >
          {apple.error ?? subtitle}
        </Text>
      </View>
      {apple.busy ? (
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
      ) : apple.available ? (
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: ink }}
        >
          <Text style={{ color: paper, fontSize: 13, fontWeight: '700' }}>
            {t('account.connect', { defaultValue: 'Connect' })}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
