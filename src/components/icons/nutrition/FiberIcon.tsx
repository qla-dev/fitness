import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Fibre: a leaf, its veins raking off the midrib toward the tip.

 * Veins drawn clear of the midrib read as an arrow rather than a leaf, so each
 * one starts on it.
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
const FiberIcon: React.FC<Props> = ({
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
        d="M 80.698 444.209 C 80.698 208.529 231.132 68.123 431.711 68.123 C 431.711 303.804 281.277 444.209 80.698 444.209 Z"
        stroke={color}
      />
      <Path d="M 113.292 411.615 L 396.61 120.775" stroke={color} />
      <Path d="M 183.494 341.412 L 271.248 379.021" stroke={accentColor} />
      <Path d="M 241.161 278.731 L 328.914 318.847" stroke={accentColor} />
      <Path d="M 301.335 216.05 L 376.552 253.659" stroke={accentColor} />
    </G>
  </Svg>
);

export default FiberIcon;
