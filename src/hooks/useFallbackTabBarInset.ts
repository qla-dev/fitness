import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PILL_GAP, PILL_HEIGHT } from '../components/CustomTabBar';

/** Scroll clearance for the floating fallback tabs; zero outside their navigator. */
export function useFallbackTabBarInset(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return tabBarHeight == null
    ? 0
    : PILL_HEIGHT + Math.max(insets.bottom, PILL_GAP);
}
