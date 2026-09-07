import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from '../components/Icon';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from '../services/themeService';
import type { RootStackScreenProps } from '../types/navigation';

type ProfileThemeScreenProps = RootStackScreenProps<'ProfileTheme'>;

interface ThemeOption {
  value: ThemePreference;
  icon: IconName;
  title: string;
  description: string;
}

/**
 * Built per render with literal `t()` keys — the audit reads keys statically,
 * and a language switch while the screen is mounted re-labels the rows.
 */
function themeOptions(t: TFunction): ThemeOption[] {
  return [
    {
      value: 'System',
      icon: 'theme-system',
      title: t('settings.theme.system', { defaultValue: 'System' }),
      description: t('profile.themeSystemDescription', {
        defaultValue: 'Follow the device appearance setting',
      }),
      // The OS dark appearance resolves to the same palette as Dark below.
    },
    {
      value: 'Light',
      icon: 'theme-light',
      title: t('settings.theme.light', { defaultValue: 'Light' }),
      description: t('profile.themeLightDescription', {
        defaultValue: 'Always use the light appearance',
      }),
    },
    {
      value: 'Dark',
      icon: 'theme-dark',
      title: t('settings.theme.dark', { defaultValue: 'Dark' }),
      description: t('profile.themeDarkDescription', {
        defaultValue: 'A true-black dark appearance, easy on OLED screens',
      }),
    },
  ];
}

/**
 * The appearance choice as a list of rows rather than a picker sheet, so it
 * opens like every other row on the Profile tab.
 */
const ProfileThemeScreen: React.FC<ProfileThemeScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const theme = useThemePreference();
  const [accent] = useCSSVariable(['--color-accent-primary']) as [string];
  const options = themeOptions(t);

  const header = useScreenHeader({
    title: t('settings.theme.title', { defaultValue: 'Theme' }),
    left: { kind: 'back' },
  });

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
        <SettingsRowGroup>
          {options.map((option) => (
            <SettingsRow
              key={option.value}
              icon={option.icon}
              title={option.title}
              subtitle={option.description}
              rightAccessory={
                theme === option.value ? (
                  <Icon name="checkmark" size={20} color={accent} />
                ) : (
                  <View />
                )
              }
              onPress={() => {
                void setThemePreference(option.value);
                navigation.goBack();
              }}
            />
          ))}
        </SettingsRowGroup>
      </ScrollView>
    </View>
  );
};

export default ProfileThemeScreen;
