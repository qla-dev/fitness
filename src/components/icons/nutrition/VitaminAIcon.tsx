import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Vitamin A: a carrot, its crown in `accentColor`.

 * The leaves splay outward. Curved inward they converged into a single blob
 * above the root.
 *
 * House rules for this set — a 512 box, a 24-wide round-capped stroke, the
 * structure in `color` and the marking in `accentColor`.
 *
 * The coordinates are normalised output, not hand-placed: every icon in the
 * set puts its ink between y 56 and y 456, stroke included, and is centred on
 * x 256, so all sixteen stand the same height in a row. The geometry is
 * transformed rather than wrapped in a `scale()` so the stroke stays 24 — a
 * scaled-up glyph would otherwise carry a heavier line than its neighbours.
 * Re-run the normaliser if a path changes; do not nudge these by hand.
 */
const VitaminAIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <G
      strokeWidth={24}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path
        d="M 153.26 219.137 C 153.26 199.44 170.768 184.121 190.464 184.121 L 321.774 184.121 C 341.47 184.121 358.978 199.44 358.978 219.137 L 291.135 424.855 C 282.381 451.117 229.857 451.117 221.103 424.855 Z"
        stroke={color}
      />
      <Path d="M 190.464 278.226 L 321.774 278.226" stroke={color} />
      <Path d="M 210.16 346.069 L 302.077 346.069" stroke={color} />
      <Path
        d="M 256.119 184.121 C 256.119 138.162 256.119 107.523 256.119 68.13"
        stroke={accentColor}
      />
      <Path
        d="M 207.972 186.309 C 183.898 144.728 164.202 118.466 137.94 94.392"
        stroke={accentColor}
      />
      <Path
        d="M 304.266 186.309 C 328.339 144.728 348.036 118.466 374.298 94.392"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default VitaminAIcon;
