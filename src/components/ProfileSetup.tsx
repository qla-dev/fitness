import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import SettingsRow from './SettingsRow';
import { useProfileSetup } from '../hooks/useProfileSetup';
import type { RootStackParamList } from '../types/navigation';

/**
 * Profile screen entry point to the personal setup wizard. Opening it on its
 * own at app start is StartUpProtocol's job.
 *
 * A row rather than a button: it opens a screen like everything else on the
 * Profile screen does, and a button sitting among rows read as an action of a
 * different kind.
 */
export default function ProfileSetup({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setup = useProfileSetup(enabled);
  const [pressed, setPressed] = useState(false);
  const [accent] = useCSSVariable(['--color-accent-primary']) as string[];

  return (
    <>
      <SettingsRow
        icon="profile"
        iconColor={accent}
        title={t('setup.edit', { defaultValue: 'Personal setup & goals' })}
        subtitle={t('setup.editSubtitle', {
          defaultValue: 'Your details, activity level and daily targets',
        })}
        onPress={() => {
          setPressed(true);
          setup.openWizard(() => navigation.navigate('SetupWizard'));
        }}
      />
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
