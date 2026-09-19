import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Vitamin C: a citrus slice, the segment walls in `accentColor`.
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
const VitaminCIcon: React.FC<Props> = ({
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
        d="M 256.165 68.117 C 360.145 68.117 444.214 152.186 444.214 256.165 C 444.214 360.145 360.145 444.214 256.165 444.214 C 152.186 444.214 68.117 360.145 68.117 256.165 C 68.117 152.186 152.186 68.117 256.165 68.117 Z"
        stroke={color}
      />
      <Path
        d="M 256.165 116.788 C 333.597 116.788 395.542 178.734 395.542 256.165 C 395.542 333.597 333.597 395.542 256.165 395.542 C 178.734 395.542 116.788 333.597 116.788 256.165 C 116.788 178.734 178.734 116.788 256.165 116.788 Z"
        stroke={color}
      />
      <Path d="M 256.165 256.165 L 256.165 125.638" stroke={accentColor} />
      <Path d="M 256.165 256.165 L 368.994 190.901" stroke={accentColor} />
      <Path d="M 256.165 256.165 L 368.994 321.429" stroke={accentColor} />
      <Path d="M 256.165 256.165 L 256.165 386.693" stroke={accentColor} />
      <Path d="M 256.165 256.165 L 143.336 321.429" stroke={accentColor} />
      <Path d="M 256.165 256.165 L 143.336 190.901" stroke={accentColor} />
    </G>
  </Svg>
);

export default VitaminCIcon;
