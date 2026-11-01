import { Alert } from 'react-native';
import type { TFunction } from 'i18next';
import type { HeaderItem } from '../hooks/useScreenHeader';

/**
 * The settings button a tracked feature's screen carries beside its +: a
 * line about the feature, then one action. Stopping asks first, in the
 * system alert, because it takes the feature off the Tracker.
 */
export function trackingMenu({
  t,
  identifier,
  title,
  tracking,
  confirmTitle,
  confirmMessage,
  onStop,
  onStart,
}: {
  t: TFunction;
  identifier: string;
  title: string;
  /** Whether the feature is on the Tracker now. */
  tracking: boolean;
  confirmTitle: string;
  confirmMessage: string;
  onStop: () => void;
  /** Offered while tracking is off; omit where there is no way back here. */
  onStart?: () => void;
}): HeaderItem {
  const stopLabel = t('tracking.stop', { defaultValue: 'Stop tracking' });
  const action =
    tracking || !onStart
      ? {
          label: stopLabel,
          sfSymbol: 'minus.circle',
          icon: 'remove-circle' as const,
          destructive: true,
          onPress: () =>
            Alert.alert(confirmTitle, confirmMessage, [
              {
                text: t('common.cancel', { defaultValue: 'Cancel' }),
                style: 'cancel',
              },
              { text: stopLabel, style: 'destructive', onPress: onStop },
            ]),
        }
      : {
          label: t('tracking.start', { defaultValue: 'Start tracking' }),
          sfSymbol: 'plus.circle',
          icon: 'add-circle' as const,
          onPress: onStart,
        };
  return {
    kind: 'menu',
    sfSymbol: 'gearshape',
    ionicon: 'settings-outline',
    accessibilityLabel: t('tracking.settings', {
      defaultValue: 'Tracking settings',
    }),
    identifier,
    // Its own capsule: beside the +, a shared one reads as one control.
    separated: true,
    title,
    items: [action],
  };
}
