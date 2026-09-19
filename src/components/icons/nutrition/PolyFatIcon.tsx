import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Polyunsaturated fat: a peanut, the shell's seams in `accentColor`.

 * A striped seed was tried first and read as a surfboard — the stripes made a
 * V. The peanut's waist is what stops it reading as a plain oval.
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
const PolyFatIcon: React.FC<Props> = ({
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
        d="M 256.341 68.148 C 324.179 68.148 365.756 116.29 365.756 170.998 C 365.756 208.199 346.062 230.082 346.062 256.341 C 346.062 282.601 365.756 304.484 365.756 341.685 C 365.756 396.392 324.179 444.535 256.341 444.535 C 188.504 444.535 146.927 396.392 146.927 341.685 C 146.927 304.484 166.621 282.601 166.621 256.341 C 166.621 230.082 146.927 208.199 146.927 170.998 C 146.927 116.29 188.504 68.148 256.341 68.148 Z"
        stroke={color}
      />
      <Path
        d="M 186.316 179.751 C 230.082 199.446 282.601 199.446 326.367 179.751"
        stroke={accentColor}
      />
      <Path
        d="M 186.316 332.932 C 230.082 313.237 282.601 313.237 326.367 332.932"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default PolyFatIcon;
