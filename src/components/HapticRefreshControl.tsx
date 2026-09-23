import React, { useCallback } from 'react';
import {
  RefreshControl,
  type RefreshControlProps,
} from 'react-native';

import { fireRefreshHaptic } from '../services/haptics';

/**
 * `RefreshControl`, with the tap the gesture deserves.
 *
 * Pulling to refresh is the one gesture in the app that commits at a threshold
 * the user cannot see: the finger is still down, nothing has moved, and the
 * only signal that the pull took is the spinner appearing under a thumb that
 * is probably covering it. The haptic is that signal.
 *
 * It fires from `onRefresh`, which is the moment the pull commits — not when
 * the data lands. A screen that refreshes in 80ms and one that takes three
 * seconds should feel identical at the moment of the pull.
 *
 * A component rather than a line in each `onRefresh` because twelve screens
 * pull to refresh, and twelve copies is twelve places for one of them to be
 * forgotten or to buzz differently. The haptic respects the app's haptics
 * preference, like every other one.
 */
const HapticRefreshControl: React.FC<RefreshControlProps> = ({
  onRefresh,
  ...props
}) => {
  // The handler's return value is passed straight back. `onRefresh` is typed
  // `() => void`, but several screens return the promise of the refetch they
  // kick off and their tests await it; swallowing it here turned those into a
  // silent `undefined`.
  const handleRefresh = useCallback(() => {
    fireRefreshHaptic();
    return onRefresh?.();
  }, [onRefresh]);

  return <RefreshControl {...props} onRefresh={handleRefresh} />;
};

export default HapticRefreshControl;
