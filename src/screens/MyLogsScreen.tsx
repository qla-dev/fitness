import LibraryScreen from './LibraryScreen';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useTranslation } from 'react-i18next';
import type { RootStackScreenProps } from '../types/navigation';

export default function MyLogsScreen(props: RootStackScreenProps<'MyLogs'>) {
  const { t } = useTranslation();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const header = useScreenHeader({
    title: t('profile.library.myLogs', { defaultValue: 'My Logs' }),
    left: { kind: 'back' },
  });
  return (
    <LibraryScreen
      {...props}
      logsHeader={header}
      logsNativeHeader={usesNativeHeader}
    />
  );
}
