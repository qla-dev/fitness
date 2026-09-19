import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Iron: a horseshoe magnet, its poles in `accentColor`.

 * The one glyph here that is not a food. Every food that says "iron" is a red
 * drop or a red cut of meat, and this set already spends a droplet on fat and
 * a fish on protein.
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
const IronIcon: React.FC<Props> = ({
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
        d="M 91.346 444.084 L 91.346 232.745 A 164.948 164.948 0 0 1 421.241 232.745 L 421.241 444.084 L 312.994 444.084 L 312.994 232.745 A 56.701 56.701 0 0 0 199.592 232.745 L 199.592 444.084 Z"
        stroke={color}
      />
      <Path d="M 91.346 397.692 L 199.592 397.692" stroke={accentColor} />
      <Path d="M 312.994 397.692 L 421.241 397.692" stroke={accentColor} />
    </G>
  </Svg>
);

export default IronIcon;
