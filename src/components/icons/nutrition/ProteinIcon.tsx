import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Protein: a fish, turned 45° so it swims across the tile.

 * A flexed arm was drawn against a reference several times over and never held
 * at this size — the elbow notch that makes it an arm is the first thing to
 * close up, leaving a blob joined to a block. A fish is a bowtie tail and a
 * tapered body, and both survive being shrunk.
 *
 * Drawn as one outline rather than a triangle set on an oval: the tail and the
 * body have to share the pinch, or the tail reads as a bow sitting on a bulb.
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
const ProteinIcon: React.FC<Props> = ({
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
        d="M 354.156 68.082 L 444.271 158.198 L 326.189 186.164 C 338.619 245.206 333.958 315.123 296.668 361.734 C 248.503 419.222 153.727 451.85 69.826 442.527 C 60.504 358.627 93.132 263.85 150.619 215.685 C 197.231 178.396 267.148 173.735 326.189 186.164 Z"
        stroke={color}
      />
      <Path
        d="M 114.884 266.958 C 131.975 302.693 209.66 380.379 245.396 397.47"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default ProteinIcon;
