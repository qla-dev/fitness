import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';

export default function RunOrRideScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const header = useScreenHeader({
    title: t('addSheet.runOrRide', { defaultValue: 'Run or Ride' }),
    left: { kind: 'back' },
  });

  // Placeholder until a map package is installed.
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        paddingTop: usesNativeHeader ? 0 : insets.top,
      }}
    >
      {header}
    </View>
  );
}
