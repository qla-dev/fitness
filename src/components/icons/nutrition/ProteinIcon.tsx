import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Protein: a fish, turned 45° so it swims across the tile.
 *
 * A flexed arm was drawn against a reference several times over and never held
 * at this size — the elbow notch that makes it an arm is the first thing to
 * close up, leaving a blob joined to a block. A fish is a bowtie tail and a
 * tapered body, and both survive being shrunk.
 *
 * Drawn as one outline rather than a triangle set on an oval: the tail and the
 * body have to share the pinch, or the tail reads as a bow sitting on a bulb.
 * The shoulders leaving that pinch stay narrow and the tangents into the nose
 * stay steep — rounder than this and it becomes a balloon.
 *
 * House rules for this set — a 512 box, 24-wide round-capped strokes, the
 * structure in `color` and the marking in `accentColor`.
 */
const ProteinIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    {/* Solved rather than eyeballed: every icon in this set puts its ink
        between y 56 and y 456, stroke included, so all three stand the same
        height in their columns. Re-measure if a path changes — these numbers
        answer this geometry, they are not a style. */}
    <G
      strokeWidth={24}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      transform="translate(271.5,240.5) rotate(45) scale(1.0921) translate(-256,-256)"
    >
      <Path
        d="M198 92 L314 92 L256 186 C302 216 344 264 350 318 C356 386 316 468 256 516 C196 468 156 386 162 318 C168 264 210 216 256 186 Z"
        stroke={color}
      />
      <Path d="M172 374 C206 386 306 386 340 374" stroke={accentColor} />
    </G>
  </Svg>
);

export default ProteinIcon;
