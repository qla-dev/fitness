import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Saturated fat: a rasher of bacon, the marbling running down it.

 * A cheese wedge was the first attempt and is the wrong shape for this set: at
 * 300x244 it is far wider than tall, so matching its height to the others
 * would have stretched it to 496 wide. Bacon runs vertically.
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
const SaturatedFatIcon: React.FC<Props> = ({
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
        d="M 180.013 68.084 C 132.2 136.686 231.984 203.209 184.171 271.811 C 136.358 340.412 231.984 396.541 188.329 444.354 L 333.848 444.354 C 377.503 396.541 281.877 340.412 329.69 271.811 C 377.503 203.209 277.719 136.686 325.532 68.084 Z"
        stroke={color}
      />
      <Path
        d="M 254.852 105.503 C 213.275 167.868 300.586 230.234 259.009 292.599 C 229.906 336.255 269.404 381.989 256.931 409.014"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default SaturatedFatIcon;
