import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Sodium: a salt shaker, its holes in `accentColor`.

 * The holes are zero-length strokes; the round cap is what draws them, so they
 * stay a fixed size however the rest of the glyph is scaled.
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
const SodiumIcon: React.FC<Props> = ({
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
        d="M 172.302 204.301 C 172.302 186.293 186.308 172.287 204.316 172.287 L 308.361 172.287 C 326.369 172.287 340.375 186.293 340.375 204.301 L 356.381 406.388 C 358.382 428.397 342.375 444.404 322.367 444.404 L 190.31 444.404 C 170.301 444.404 154.295 428.397 156.295 406.388 Z"
        stroke={color}
      />
      <Path
        d="M 194.312 172.287 C 194.312 108.259 222.324 68.242 256.338 68.242 C 290.353 68.242 318.365 108.259 318.365 172.287"
        stroke={color}
      />
      <Path d="M 224.325 120.265 L 224.325 120.265" stroke={accentColor} />
      <Path d="M 256.338 102.257 L 256.338 102.257" stroke={accentColor} />
      <Path d="M 288.352 120.265 L 288.352 120.265" stroke={accentColor} />
    </G>
  </Svg>
);

export default SodiumIcon;
