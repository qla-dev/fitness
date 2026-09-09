import type { ReactNode } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useAnimatedHeaderHeight } from '@react-navigation/native-stack';
import { useCSSVariable } from 'uniwind';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import Button from './ui/Button';

function NativeHeaderOffset({ children }: { children: ReactNode }) {
  const headerHeight = useAnimatedHeaderHeight();
  return (
    <Animated.View
      style={{
        transform: [{ translateY: Animated.multiply(headerHeight, -0.5) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The shared empty state: an icon in a rounded tile, a bold title, a muted
 * line of explanation, and an optional action under it.
 *
 * Ported verbatim from the same component in putni-nalozi — the sizes, radii,
 * gaps, weights and per-platform type sizes are its numbers, not new ones, so
 * the two apps read identically. Only the theme access differs: colors come
 * from this project's CSS variables rather than a ThemeProvider, and the
 * action uses this project's `Button`.
 *
 * It lays out its own block and nothing else. Centring is the caller's job —
 * wrap it in a `flex-1 justify-center` view to sit it in the middle of a
 * screen. Set includeHeaderHeight to lift the center by half the header height;
 * pass the measured custom header height when using a screen-owned header.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  includeHeaderHeight = false,
  headerHeight = 0,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
  includeHeaderHeight?: boolean;
  headerHeight?: number;
}) {
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [tileColor, textColor, mutedColor] = useCSSVariable([
    '--color-border',
    '--color-text-primary',
    '--color-text-muted',
  ]) as [string, string, string];

  const content = (
    <View style={{ gap: 22 }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: Platform.OS === 'android' ? 74 : 70,
            height: Platform.OS === 'android' ? 74 : 70,
            borderRadius: 23,
            backgroundColor: tileColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              color: textColor,
              textAlign: 'center',
              fontSize: Platform.OS === 'android' ? 21 : 19,
              fontWeight: '800',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: mutedColor,
              textAlign: 'center',
              fontSize: Platform.OS === 'android' ? 15 : 14,
              lineHeight: 20,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Button variant="primary" onPress={onAction}>
          {actionIcon}
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );

  if (!includeHeaderHeight) return content;
  if (usesNativeHeader) {
    return <NativeHeaderOffset>{content}</NativeHeaderOffset>;
  }
  return (
    <View style={{ transform: [{ translateY: -headerHeight / 2 }] }}>
      {content}
    </View>
  );
}

export default EmptyState;
