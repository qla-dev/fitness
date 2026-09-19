import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Cholesterol: a heart with a trace across it.
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
const CholesterolIcon: React.FC<Props> = ({
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
        d="M 256.419 444.321 C 102.362 337.84 61.582 247.218 61.582 179.251 C 61.582 111.284 113.689 68.239 177.125 68.239 C 215.639 68.239 242.826 86.363 256.419 113.55 C 270.013 86.363 297.199 68.239 335.714 68.239 C 399.149 68.239 451.257 111.284 451.257 179.251 C 451.257 247.218 410.477 337.84 256.419 444.321 Z"
        stroke={color}
      />
      <Path
        d="M 109.158 206.438 L 188.453 206.438 L 217.905 149.799 L 270.013 274.404 L 301.731 206.438 L 403.681 206.438"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default CholesterolIcon;
