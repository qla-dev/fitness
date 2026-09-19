import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Fat: a droplet, with the inner highlight an oil drop catches.
 *
 * House rules for this set — a 512 box, 24-wide round-capped strokes, the
 * structure in `color` and the highlight in `accentColor`.
 */
const FatIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    {/* Solved rather than eyeballed: every icon in this set puts its ink
        between y 56 and y 456, stroke included, so all three stand the same
        height in their columns. Re-measure if a path changes — these numbers
        answer this geometry, they are not a style. */}
    <G transform="translate(256,260.4) scale(1.1111) translate(-256,-256)">
      <Path
        d="M256 84 C256 84 376 216 376 300 C376 368 322 420 256 420 C190 420 136 368 136 300 C136 216 256 84 256 84 Z"
        stroke={color}
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M204 304 C204 272 224 244 252 232"
        stroke={accentColor}
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  </Svg>
);

export default FatIcon;
