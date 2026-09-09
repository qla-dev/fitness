import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import RouteMap from '../components/RouteMap';
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

  return (
    <View className="flex-1 bg-background">
      {/* The map fills the screen and the header sits over it, so the route is
          never boxed into a panel. It is absolutely positioned rather than a
          flex child for that reason. */}
      <View className="flex-1">
        <RouteMap />
      </View>
      <View
        className="absolute left-0 right-0 top-0"
        style={{ paddingTop: usesNativeHeader ? 0 : insets.top }}
        pointerEvents="box-none"
      >
        {header}
      </View>
    </View>
  );
}
