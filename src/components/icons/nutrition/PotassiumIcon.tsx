import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Potassium: a banana.

 * The crescent carries real width on purpose. Drawn with a 60-unit gap the two
 * 24-wide strokes closed most of it up and it read as a tick; the hole has to
 * survive both strokes.
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
const PotassiumIcon: React.FC<Props> = ({
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
        d="M 123.335 109.597 C 77.88 332.92 178.672 453.475 382.232 443.593 C 401.995 441.617 405.948 415.925 390.137 406.043 C 271.559 390.233 235.985 303.275 245.867 123.431 C 247.843 101.692 129.264 89.834 123.335 109.597 Z"
        stroke={color}
      />
      <Path d="M 186.577 97.739 L 180.648 68.094" stroke={accentColor} />
    </G>
  </Svg>
);

export default PotassiumIcon;
