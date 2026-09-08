import MyLibrarySection from './MyLibrarySection';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import { fetchProfile } from '../services/api/profileApi';
import { profileQueryKey } from '../hooks/queryKeys';
import { isLocalDataMode } from '../services/dataMode';
import { useThemePreference } from '../services/themeService';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';
import Icon from './Icon';
import type { RootStackParamList } from '../types/navigation';

/**
 * The Profile card: identity first, then the rows that belong to the person
 * rather than to the app. My Clients and the notification packages sit inside
 * this same card — directly under the name, the way the account rows do on the
 * rest of the suite — instead of in a separate group further down the screen.
 */
export default function ProfileSummary({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: profile } = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled,
  });
  const theme = useThemePreference();
  const [textSecondary, accent] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as [string, string];

  const editable = isLocalDataMode();
  const name =
    profile?.full_name || t('profile.title', { defaultValue: 'Profile' });
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const themeLabel = {
    Light: t('settings.theme.light', { defaultValue: 'Light' }),
    Dark: t('settings.theme.dark', { defaultValue: 'Dark' }),
    System: t('settings.theme.system', { defaultValue: 'System' }),
  }[theme];

  const openPremium = () => navigation.navigate('ProfilePremium');

  return (
    <>
      <View className="bg-surface rounded-2xl overflow-hidden mb-5">
        <Pressable
          accessibilityRole={editable ? 'button' : undefined}
          disabled={!editable}
          onPress={() => navigation.navigate('ProfileEdit', { field: 'name' })}
          className="flex-row items-center px-4"
          style={{ minHeight: 96, gap: 14 }}
        >
          <View
            className="bg-raised rounded-full items-center justify-center"
            style={{ width: 62, height: 62 }}
          >
            <Text className="text-accent-primary text-xl font-bold">
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-text-primary text-xl font-bold"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {name}
            </Text>
            <Text
              className="text-text-secondary text-sm mt-1"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {profile?.bio ||
                t('profile.subtitle', {
                  defaultValue: 'Your health, goals, and preferences',
                })}
            </Text>
          </View>
          {editable && (
            <Icon name="chevron-forward" size={18} color={textSecondary} />
          )}
        </Pressable>

        <View className="h-px bg-border-subtle" style={{ marginLeft: 84 }} />

        <Pressable
          accessibilityRole="button"
          onPress={openPremium}
          className="flex-row items-center px-4"
          style={{ minHeight: 66, gap: 14 }}
        >
          <View
            className="items-center justify-center"
            style={{ width: 62, height: 30 }}
          >
            <View
              className="rounded-full items-center justify-center"
              style={{ width: 30, height: 30, backgroundColor: accent }}
            >
              <Icon name="people" size={16} color="#FFFFFF" />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-text-primary text-base font-semibold">
              {t('profile.clients', { defaultValue: 'My Clients' })}
            </Text>
            <Text
              className="text-text-secondary text-sm mt-0.5"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('profile.clientsSubtitle', {
                defaultValue: 'Manage your clients and their progress',
              })}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={textSecondary} />
        </Pressable>

        <View className="h-px bg-border-subtle" style={{ marginLeft: 84 }} />

        <Pressable
          accessibilityRole="button"
          onPress={openPremium}
          className="flex-row items-center px-4"
          style={{ minHeight: 64, gap: 14 }}
        >
          <View className="flex-1">
            <Text className="text-text-primary text-base font-semibold">
              {t('profile.purchase', {
                defaultValue: 'Additional Notifications',
              })}
            </Text>
            <Text
              className="text-text-secondary text-sm mt-0.5"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('profile.purchaseSubtitle', {
                defaultValue: 'Explore notification packages',
              })}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={textSecondary} />
        </Pressable>
      </View>

      <MyLibrarySection enabled={enabled} />

      <SettingsRowGroup
        title={t('profile.personal', { defaultValue: 'Personal' })}
      >
        {editable && (
          <SettingsRow
            icon="trophy"
            title={t('profile.goals', { defaultValue: 'Goals' })}
            subtitle={t('profile.goalsSubtitle', {
              defaultValue: 'Nutrition, hydration, and daily activity targets',
            })}
            onPress={() => navigation.navigate('ProfileGoals')}
          />
        )}
        <SettingsRow
          icon="app-settings"
          title={t('settings.theme.title', { defaultValue: 'Theme' })}
          subtitle={themeLabel}
          onPress={() => navigation.navigate('ProfileTheme')}
        />
      </SettingsRowGroup>
    </>
  );
}
