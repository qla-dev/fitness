import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The app's mark, set the one way it is allowed to be set — the counterpart to
 * {@link AppWordmark}, which owns the name. Every surface that shows the logo
 * renders this rather than reaching for an asset directly, so the mark cannot
 * drift the way the retired SparkyFitness artwork did: it outlived the rebrand
 * on About and Onboarding purely because those screens each held their own
 * `require`.
 *
 * `assets/images/logo.png` is the two figures on the brand's black ground.
 * The splash paints the same black as its own background and displays
 * the same image, so the launch screen and this mark are the same
 * artwork rather than two files that have to be kept in step.
 *
 * The ground is black rather than themed, because the mark is drawn for black
 * — the white figure disappears on a light surface. The rounded clip is the
 * platform's own icon radius (iOS's superellipse is ~22.4% of the side), which
 * is what makes the square read as an app mark instead of a pasted-in square.
 */
/** The mark's ground, shared by the splash and the Android adaptive icon. */
export const BRAND_GROUND = '#000000';
/**
 * The accent figure's colour. The artwork arrived in an unrelated cyan; the
 * asset is generated with this instead so the mark's second figure is the same
 * blue the app accents everything else with (`--color-accent-primary` on bare
 * `:root`). Change the token and this asset has to be regenerated with it.
 */
export const BRAND_ACCENT = '#5087F7';

const ICON_CORNER_RATIO = 0.2237;

const AppLogo: React.FC<{
  /** Side length in points. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ size = 80, style }) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: size * ICON_CORNER_RATIO,
        overflow: 'hidden',
        backgroundColor: BRAND_GROUND,
      },
      style,
    ]}
  >
    <Image
      source={require('../../assets/images/logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  </View>
);

export default AppLogo;
