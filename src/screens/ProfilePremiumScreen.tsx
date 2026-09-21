import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import Icon from '../components/Icon';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';

type ProfilePremiumScreenProps = RootStackScreenProps<'ProfilePremium'>;

/**
 * Preview of the paid tier. Both premium rows on the Profile card land here,
 * so the pitch lives in one pushed screen instead of a modal each row raises.
 */
const ProfilePremiumScreen: React.FC<ProfilePremiumScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const [accent] = useCSSVariable(['--color-accent-primary']) as [string];

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('profile.paywallTitle', { defaultValue: 'More with Premium' }),
    left: { kind: 'back' },
  });

  const features = [
    {
      icon: 'people' as const,
      title: t('profile.clients', { defaultValue: 'My Clients' }),
      subtitle: t('profile.clientsSubtitle', {
        defaultValue: 'Manage your clients and their progress',
      }),
    },
    {
      icon: 'notifications' as const,
      title: t('profile.purchase', {
        defaultValue: 'Additional Notifications',
      }),
      subtitle: t('profile.purchaseSubtitle', {
        defaultValue: 'Explore notification packages',
      }),
    },
  ];

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
        <View className="items-center py-6">
          <Icon name="sparkles" size={44} color={accent} />
          <Text className="text-text-primary text-2xl font-bold mt-4 text-center">
            {t('profile.paywallTitle', { defaultValue: 'More with Premium' })}
          </Text>
          <Text className="text-text-secondary text-base mt-2 text-center">
            {t('profile.paywallSubtitle', {
              defaultValue:
                'Client management and additional notifications, together in one place.',
            })}
          </Text>
        </View>
        <View className="bg-surface rounded-2xl overflow-hidden">
          {features.map((feature, index) => (
            <View key={feature.title}>
              {index > 0 && <View className="h-px bg-border-subtle" />}
              <View className="p-4 flex-row items-center">
                <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-raised">
                  <Icon name={feature.icon} size={22} color={accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary">
                    {feature.title}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-0.5">
                    {feature.subtitle}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <Text className="text-text-secondary text-sm mt-4 text-center">
          {t('profile.paywallPreview', {
            defaultValue:
              'Preview only. Plans and purchases are not available yet.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
};

export default ProfilePremiumScreen;
