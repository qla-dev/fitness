import React from 'react';
import AppLogo from '../components/AppLogo';
import AppWordmark from '../components/AppWordmark';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from '../components/Icon';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import type { RootStackScreenProps } from '../types/navigation';

type AboutScreenProps = RootStackScreenProps<'About'>;

const PRIVACY_POLICY_URL = 'https://fit.qla.dev/#privacy';
const WEBSITE_URL = 'https://fit.qla.dev/';

/** A belief, set as a numbered line: what the app will and will not do. */
function Belief({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <View className="flex-row gap-3">
      <Text className="text-accent-primary text-base font-bold w-6">
        {String(index).padStart(2, '0')}
      </Text>
      <View className="flex-1">
        <Text className="text-text-primary text-base font-semibold">
          {title}
        </Text>
        <Text className="text-text-secondary text-sm leading-5 mt-0.5">
          {body}
        </Text>
      </View>
    </View>
  );
}

/** One thing the app does, as a tile in the two-column grid. */
function Feature({ icon, label }: { icon: IconName; label: string }) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <View
      className="bg-surface rounded-2xl p-4 gap-2"
      style={{ width: '48.5%' }}
    >
      <View
        className="bg-raised rounded-xl items-center justify-center"
        style={{ width: 36, height: 36 }}
      >
        <Icon name={icon} size={18} color={accent} />
      </View>
      <Text className="text-text-primary text-sm font-semibold">{label}</Text>
    </View>
  );
}

const AboutScreen: React.FC<AboutScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();
  const textMuted = useCSSVariable('--color-text-secondary') as string;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Silently ignore — user can copy URL from elsewhere if needed.
    });
  };

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('about.title', { defaultValue: 'About' }),
    left: { kind: 'back' },
  });

  const features: { icon: IconName; label: string }[] = [
    {
      icon: 'food',
      label: t('about.features.nutrition', {
        defaultValue: 'Food, macros and water',
      }),
    },
    {
      icon: 'exercise-weights',
      label: t('about.features.workouts', {
        defaultValue: 'Workouts and programs',
      }),
    },
    {
      icon: 'exercise-running',
      label: t('about.features.runs', {
        defaultValue: 'Runs and rides with GPS',
      }),
    },
    {
      icon: 'heart-rate',
      label: t('about.features.health', {
        defaultValue: 'Apple Health and Health Connect',
      }),
    },
    {
      icon: 'sparkles',
      label: t('about.features.markai', {
        defaultValue: 'MarkAI, your coach in chat',
      }),
    },
    {
      icon: 'wellness',
      label: t('about.features.cycle', {
        defaultValue: 'Cycle and pregnancy',
      }),
    },
    {
      icon: 'medication',
      label: t('about.features.medications', {
        defaultValue: 'Medications and reminders',
      }),
    },
    {
      icon: 'sync',
      label: t('about.features.sync', {
        defaultValue: 'Optional account sync',
      }),
    },
  ];

  const links = [
    {
      key: 'website',
      label: t('about.website', { defaultValue: 'Website' }),
      url: WEBSITE_URL,
    },
    {
      key: 'privacy',
      label: t('about.privacyPolicy', { defaultValue: 'Privacy Policy' }),
      url: PRIVACY_POLICY_URL,
    },
  ];

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
        <View className="bg-surface rounded-2xl px-5 py-7 items-center">
          <AppLogo size={88} style={{ marginBottom: 16 }} />
          <Text className="text-2xl font-bold text-text-primary">
            <AppWordmark />
          </Text>
          <Text className="text-text-secondary text-base text-center mt-2">
            {t('about.tagline', {
              defaultValue: 'Your diary, your phone, your pace.',
            })}
          </Text>
          <View className="bg-raised rounded-full px-3 py-1 mt-4">
            <Text className="text-text-secondary text-xs font-medium">
              {t('about.version', {
                defaultValue: 'Version {{version}} ({{build}})',
                version: Application.nativeApplicationVersion ?? '—',
                build: Application.nativeBuildVersion ?? '—',
              })}
            </Text>
          </View>
        </View>

        <View className="bg-surface rounded-2xl p-5 gap-5">
          <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            {t('about.beliefsTitle', { defaultValue: 'How we think' })}
          </Text>
          <Belief
            index={1}
            title={t('about.beliefFreeTitle', {
              defaultValue: 'Logging is free. Always.',
            })}
            body={t('about.beliefFreeBody', {
              defaultValue:
                'Food, workouts, runs, water, weight and health sync cost nothing, with no subscription and no paywall in front of the basics. Writing down what you did should never be the expensive part.',
            })}
          />
          <Belief
            index={2}
            title={t('about.beliefLocalTitle', {
              defaultValue: 'Your diary lives on your phone.',
            })}
            body={t('about.beliefLocalBody', {
              defaultValue:
                'Everything you log is stored on this device first and works offline. An account only adds sync, so a new phone picks up where the old one stopped.',
            })}
          />
          <Belief
            index={3}
            title={t('about.beliefAiTitle', {
              defaultValue: 'AI helps, it never nags.',
            })}
            body={t('about.beliefAiBody', {
              defaultValue:
                'MarkAI costs a coin only when it answers, and nothing it suggests is applied until you say so.',
            })}
          />
        </View>

        <View className="gap-3">
          <Text className="px-1 text-xs font-bold text-text-secondary uppercase tracking-wider">
            {t('about.featuresTitle', { defaultValue: "What's inside" })}
          </Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {features.map((feature) => (
              <Feature key={feature.icon} {...feature} />
            ))}
          </View>
        </View>

        <View className="bg-surface rounded-2xl">
          {links.map((link, index) => (
            <TouchableOpacity
              key={link.key}
              className={`p-4 flex-row items-center justify-between ${
                index < links.length - 1 ? 'border-b border-border-subtle' : ''
              }`}
              onPress={() => openUrl(link.url)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              accessibilityHint={t('about.openExternalLink', {
                defaultValue: 'Opens in your browser',
              })}
            >
              <Text className="text-base font-semibold text-text-primary">
                {link.label}
              </Text>
              <Icon name="chevron-forward" size={16} color={textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-text-secondary text-xs text-center mt-2">
          {t('about.madeBy', {
            defaultValue: 'Made with care by qla.dev · © {{year}}',
            year: new Date().getFullYear(),
          })}
        </Text>
      </ScrollView>
    </View>
  );
};

export default AboutScreen;
