import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import SettingsRow from './SettingsRow';
import { useProfileSetup } from '../hooks/useProfileSetup';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackParamList } from '../types/navigation';

/**
 * Profile screen entry point to the personal setup wizard. Opening it on its
 * own at app start is StartUpProtocol's job.
 *
 * A row inside the identity card rather than one below it: the wizard sets the
 * person's own details and targets, so it belongs with their name and their
 * clients, in the place the notification upsell used to take.
 */
export default function ProfileSetup({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setup = useProfileSetup(enabled);
  const [pressed, setPressed] = useState(false);
  const [accent, textSecondary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-secondary',
  ]) as [string, string];

  return (
    <>
      <View className="h-px bg-border-subtle" style={{ marginLeft: 84 }} />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          fireSelectionHaptic();
          setPressed(true);
          setup.openWizard(() => navigation.navigate('SetupWizard'));
        }}
        className="flex-row items-center px-4"
        style={{ minHeight: 66, gap: 14 }}
      >
        {/* The same leading slot the rows above use. Without it this row's
            text started at the card's edge while the divider over it was
            already indented to the icon column, so the row read as broken
            rather than as the third member of the card. */}
        <View
          className="items-center justify-center"
          style={{ width: 62, height: 30 }}
        >
          <View
            className="rounded-full items-center justify-center"
            style={{ width: 30, height: 30, backgroundColor: accent }}
          >
            <Icon name="goal-target" size={16} color="#FFFFFF" />
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-text-primary text-base font-semibold">
            {t('setup.edit', { defaultValue: 'Personal setup & goals' })}
          </Text>
          <Text
            className="text-text-secondary text-sm mt-0.5"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t('setup.editSubtitle', {
              defaultValue: 'Your details, activity level and daily targets',
            })}
          </Text>
        </View>
        <Icon name="chevron-forward" size={12} color={textSecondary} />
      </Pressable>

      {pressed && setup.isError && (
        <SettingsRow
          icon="sync"
          iconColor={accent}
          title={t('common.retry', { defaultValue: 'Retry' })}
          onPress={setup.retry}
        />
      )}
    </>
  );
}
