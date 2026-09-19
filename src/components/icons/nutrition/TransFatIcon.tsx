import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Trans fat: a droplet struck through.

 * Deliberately the fat droplet plus a bar rather than a shape of its own: the
 * point of the glyph is that this is the fat to avoid, and the relationship to
 * [`FatIcon`] is the message.
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
const TransFatIcon: React.FC<Props> = ({
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
        d="M 256.339 67.944 C 256.339 67.944 390.743 215.788 390.743 309.871 C 390.743 386.033 330.261 444.274 256.339 444.274 C 182.417 444.274 121.935 386.033 121.935 309.871 C 121.935 215.788 256.339 67.944 256.339 67.944 Z"
        stroke={color}
      />
      <Path d="M 146.576 421.874 L 366.102 155.306" stroke={accentColor} />
    </G>
  </Svg>
);

export default TransFatIcon;
