import { ScrollEdgeEffect } from '@bsky.app/expo-scroll-edge-effect';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useLiquidGlassActive } from '../../services/nativeTabBarPreference';
import { withAlpha } from '../../utils/colors';

/** Native scroll-edge material, with a soft page-colour fade on other platforms. */
export default function BottomEdgeEffect({
  children,
  extendBottom = 0,
  ...props
}: ViewProps & { extendBottom?: number }) {
  const glassActive = useLiquidGlassActive();
  const background = useCSSVariable('--color-background') as string;

  if (glassActive) {
    return (
      <ScrollEdgeEffect edge="bottom" effect="soft" {...props}>
        {children}
      </ScrollEdgeEffect>
    );
  }

  return (
    <View pointerEvents="box-none" {...props}>
      <View
        pointerEvents="none"
        accessible={false}
        style={[
          StyleSheet.absoluteFillObject,
          {
            top: -32,
            bottom: -extendBottom,
            experimental_backgroundImage: `linear-gradient(to bottom, ${withAlpha(background, 0)} 0%, ${withAlpha(background, 0.55)} 35%, ${withAlpha(background, 0.92)} 70%, ${background} 100%)`,
          },
        ]}
      />
      {children}
    </View>
  );
}
