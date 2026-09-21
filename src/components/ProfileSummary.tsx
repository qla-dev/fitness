import MyLibrarySection from './MyLibrarySection';
import ProfileStats from './ProfileStats';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import { fetchProfile } from '../services/api/profileApi';
import { profileQueryKey } from '../hooks/queryKeys';
import { isLocalDataMode } from '../services/dataMode';
import { fireSelectionHaptic } from '../services/haptics';
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
  const [textSecondary, accent] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as [string, string];

  const editable = isLocalDataMode();
  // The row is the person, so an empty profile asks for a name rather than
  // labelling itself "Profile" — a heading the screen already carries. The
  // prompt is not a name, so it seeds no initials: the avatar falls back to a
  // glyph instead of standing for a word the user never typed.
  const fullName = profile?.full_name?.trim() ?? '';
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const openPremium = () => {
    fireSelectionHaptic();
    navigation.navigate('ProfilePremium');
  };

  return (
    <>
      <View className="bg-surface rounded-2xl overflow-hidden mb-5">
        <Pressable
          accessibilityRole={editable ? 'button' : undefined}
          disabled={!editable}
          onPress={() => {
            fireSelectionHaptic();
            navigation.navigate('ProfileEdit', { field: 'name' });
          }}
          className="flex-row items-center px-4"
          style={{ minHeight: 96, gap: 14 }}
        >
          <View
            className="bg-raised rounded-full items-center justify-center"
            style={{ width: 62, height: 62 }}
          >
            {initials ? (
              <Text className="text-accent-primary text-xl font-bold">
                {initials}
              </Text>
            ) : (
              <Icon name="person" size={26} color={textSecondary} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className={`text-xl font-bold ${
                fullName ? 'text-text-primary' : 'text-text-secondary'
              }`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {fullName ||
                t('profile.namePrompt', { defaultValue: 'Enter your name' })}
            </Text>
            {/* Only what the person wrote. The old fallback described the
                screen ("Your health, goals, and preferences"), which said
                nothing about them and pushed the name off centre. */}
            {profile?.bio ? (
              <Text
                className="text-text-secondary text-sm mt-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {profile.bio}
              </Text>
            ) : null}
          </View>
          {editable && (
            <Icon name="chevron-forward" size={12} color={textSecondary} />
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
          <Icon name="chevron-forward" size={12} color={textSecondary} />
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
          <Icon name="chevron-forward" size={12} color={textSecondary} />
        </Pressable>
      </View>

      <ProfileStats enabled={enabled} />

      <MyLibrarySection enabled={enabled} />

      {/* Appearance is an app setting, not a personal one: it lives under App
          Settings with language and notifications, so this group holds only
          what belongs to the person. */}
      {editable && (
        <SettingsRowGroup
          title={t('profile.personal', { defaultValue: 'Personal' })}
        >
          <SettingsRow
            icon="trophy"
            title={t('profile.goals', { defaultValue: 'Goals' })}
            subtitle={t('profile.goalsSubtitle', {
              defaultValue: 'Nutrition, hydration, and daily activity targets',
            })}
            onPress={() => navigation.navigate('ProfileGoals')}
          />
        </SettingsRowGroup>
      )}
    </>
  );
}
