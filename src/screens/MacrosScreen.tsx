import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusView from '../components/StatusView';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';

type MacrosScreenProps = RootStackScreenProps<'Macros'>;

/**
 * Every macro for the day, in one place.
 *
 * A shell for now: the route, the header and the way in from the Tracker
 * exist, and the content lands here next. Shipped empty on purpose rather than
 * as a dead link — the link is the part the Tracker's copy promises.
 */
const MacrosScreen: React.FC<MacrosScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();

  const header = useScreenHeader({
    title: t('macros.title', { defaultValue: 'Macros' }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <StatusView
        title={t('macros.empty', { defaultValue: 'Macros are coming here' })}
        subtitle={t('macros.emptyMessage', {
          defaultValue: 'Every macro for the day, in one place.',
        })}
      />
    </View>
  );
};

export default MacrosScreen;
