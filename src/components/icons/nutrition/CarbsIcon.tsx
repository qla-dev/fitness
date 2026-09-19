import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Carbohydrate: an ear of wheat — a stalk with three pairs of grains and the
 * topmost grain in `accentColor`.

 * Each grain is a lens whose edges bow the same distance either side of its
 * base-to-tip axis, so its width is a real fraction of its length; drawn as
 * two near-parallel curves they became slivers.
 *
 * They deliberately reach past the base of the pair above. Spaced so they only
 * met at a point, every join left a wedge of background showing through.
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
const CarbsIcon: React.FC<Props> = ({
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
      <Path d="M 256.218 444.054 L 256.218 181.067" stroke={color} />
      <Path
        d="M 256.218 402.962 C 246.972 327.97 211.017 294.069 134.998 292.015 C 144.243 367.007 180.198 400.908 256.218 402.962 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 402.962 C 332.238 400.908 368.193 367.007 377.439 292.015 C 301.419 294.069 265.464 327.97 256.218 402.962 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 314.615 C 250.054 240.65 216.154 206.75 141.161 203.668 C 147.325 277.633 181.226 311.533 256.218 314.615 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 314.615 C 331.21 311.533 365.111 277.633 371.275 203.668 C 296.282 206.75 262.382 240.65 256.218 314.615 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 226.268 C 254.164 153.33 222.317 120.457 149.38 115.321 C 151.434 188.258 183.28 221.132 256.218 226.268 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 226.268 C 329.156 221.132 361.002 188.258 363.056 115.321 C 290.119 120.457 258.273 153.33 256.218 226.268 Z"
        stroke={color}
      />
      <Path
        d="M 256.218 172.849 C 307.583 135.866 307.583 105.048 256.218 68.065 C 204.853 105.048 204.853 135.866 256.218 172.849 Z"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default CarbsIcon;
