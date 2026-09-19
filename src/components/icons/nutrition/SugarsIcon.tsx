import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Sugar: a cube, its lit top face in `accentColor`.
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
const SugarsIcon: React.FC<Props> = ({
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
        d="M 75.683 168.558 L 256.204 268.848 L 256.204 444.355 L 75.683 344.065 Z"
        stroke={color}
      />
      <Path
        d="M 436.726 168.558 L 436.726 344.065 L 256.204 444.355 L 256.204 268.848 Z"
        stroke={color}
      />
      <Path
        d="M 256.204 68.269 L 436.726 168.558 L 256.204 268.848 L 75.683 168.558 Z"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default SugarsIcon;
