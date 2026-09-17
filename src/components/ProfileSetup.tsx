import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import { useProfileSetup } from '../hooks/useProfileSetup';
import type { RootStackParamList } from '../types/navigation';

/**
 * Profile screen entry point to the personal setup wizard. Opening it on its
 * own at app start is StartUpProtocol's job.
 */
export default function ProfileSetup({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setup = useProfileSetup(enabled);
  const [pressed, setPressed] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onPress={() => {
          setPressed(true);
          setup.openWizard(() => navigation.navigate('SetupWizard'));
        }}
      >
        {t('setup.edit', { defaultValue: 'Personal setup & goals' })}
      </Button>
      {pressed && setup.isError && (
        <Button variant="secondary" onPress={setup.retry}>
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      )}
    </>
  );
}
