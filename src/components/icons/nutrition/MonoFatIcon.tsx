import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Monounsaturated fat: half an avocado, the stone in `accentColor`.
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
const MonoFatIcon: React.FC<Props> = ({
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
        d="M 256.249 68.313 C 305.465 68.313 334.547 122.003 339.021 177.93 C 386 211.487 408.371 278.599 408.371 323.341 C 408.371 394.928 341.258 444.144 256.249 444.144 C 171.24 444.144 104.127 394.928 104.127 323.341 C 104.127 278.599 126.498 211.487 173.477 177.93 C 177.951 122.003 207.033 68.313 256.249 68.313 Z"
        stroke={color}
      />
      <Path
        d="M 256.249 258.465 C 294.279 258.465 325.599 289.785 325.599 327.815 C 325.599 365.846 294.279 397.165 256.249 397.165 C 218.218 397.165 186.899 365.846 186.899 327.815 C 186.899 289.785 218.218 258.465 256.249 258.465 Z"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default MonoFatIcon;
