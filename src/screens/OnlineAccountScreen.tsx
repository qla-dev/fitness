import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import PromptScreen from '../components/ui/PromptScreen';
import AppleSignInButton from '../components/AppleSignInButton';
import Icon, { type IconName } from '../components/Icon';
import { useOnlineAccount } from '../services/online/account';
import { useAppleSignIn } from '../hooks/useAppleSignIn';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * The phone handing its diary to the account, in the same visual language as
 * the watch connection sheet: a signal travelling between two devices and a
 * halo on the receiving end.
 */
function AccountIllustration() {
  const [accent, amber] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-amber',
  ]) as string[];
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = reducedMotion
      ? 0
      : withRepeat(withTiming(1, { duration: 1600 }), -1, false);
    return () => cancelAnimation(pulse);
  }, [reducedMotion, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));
  const signal = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.7,
    transform: [{ translateX: pulse.value * 44 - 22 }],
  }));
  const sparkle = useAnimatedStyle(() => ({
    opacity: 0.6 + 0.4 * Math.sin(pulse.value * Math.PI),
    transform: [{ scale: 0.9 + 0.2 * Math.sin(pulse.value * Math.PI) }],
  }));
  return (
    <View
      className="flex-row items-center justify-center gap-6 py-4"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="device-phone" size={64} color={accent} />
      <View style={{ width: 48, alignItems: 'center' }}>
        <Animated.View
          style={[
            {
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: accent,
            },
            signal,
          ]}
        />
      </View>
      <View
        style={{
          width: 92,
          height: 92,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 88,
              height: 88,
              borderRadius: 44,
              borderWidth: 2,
              borderColor: accent,
            },
            halo,
          ]}
        />
        <Icon name="cloud" size={64} color={accent} />
        <Animated.View
          style={[{ position: 'absolute', top: 2, right: 2 }, sparkle]}
        >
          <Icon name="sparkles" size={24} color={amber} />
        </Animated.View>
      </View>
    </View>
  );
}

function Benefit({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <View className="flex-row gap-3">
      <View
        className="bg-surface rounded-xl items-center justify-center"
        style={{ width: 40, height: 40 }}
      >
        <Icon name={icon} size={20} color={accent} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary text-base font-semibold">
          {title}
        </Text>
        <Text className="text-text-secondary text-sm mt-0.5">{body}</Text>
      </View>
    </View>
  );
}

export default function OnlineAccountScreen({
  navigation,
}: RootStackScreenProps<'OnlineAccount'>) {
  const { t } = useTranslation();
  const session = useOnlineAccount((s) => s.session);
  const dismissed = useRef(false);
  const finish = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Tabs', { screen: 'Dashboard' });
  }, [navigation]);
  const { available, busy, error, signIn } = useAppleSignIn(finish);
  useEffect(() => {
    if (session) finish();
  }, [session, finish]);
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
      <View className="gap-6">
        <AccountIllustration />
        <View className="gap-4">
          <Benefit
            icon="sparkles"
            title={t('online.benefitCoinsTitle', {
              defaultValue: '100 free AI coins',
            })}
            body={t('online.benefitCoinsBody', {
              defaultValue:
                'Each MarkAI reply costs one coin: estimate a meal from a photo, plan a session or just ask. Logging a food card MarkAI suggests is free.',
            })}
          />
          <Benefit
            icon="sync"
            title={t('online.benefitSyncTitle', {
              defaultValue: 'Your diary follows you',
            })}
            body={t('online.benefitSyncBody', {
              defaultValue:
                'Food, workouts and progress sync to your account, so a new phone picks up where the old one stopped.',
            })}
          />
          <Benefit
            icon="shield-checkmark"
            title={t('online.benefitPrivateTitle', {
              defaultValue: 'Private, offline first',
            })}
            body={t('online.benefitPrivateBody', {
              defaultValue:
                'Apple can hide your email, and the diary keeps working without a connection. Sync settings appear once you sign in.',
            })}
          />
        </View>
        {available ? (
          <AppleSignInButton disabled={busy} onPress={() => void signIn()} />
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
