import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Calcium: a glass of milk, the fill line in `accentColor`.
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
const CalciumIcon: React.FC<Props> = ({
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
        d="M 148.193 67.955 L 364.454 67.955 L 330.663 408.115 C 328.411 428.389 312.642 444.158 292.367 444.158 L 220.28 444.158 C 200.006 444.158 184.237 428.389 181.984 408.115 Z"
        stroke={color}
      />
      <Path d="M 168.468 185.096 L 344.18 185.096" stroke={accentColor} />
    </G>
  </Svg>
);

export default CalciumIcon;
