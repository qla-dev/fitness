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
 *
 * Each grain is a lens whose edges bow the same distance either side of its
 * base-to-tip axis, so its width is a real fraction of its length; drawn as
 * two near-parallel curves they became slivers.
 *
 * They deliberately reach past the base of the pair above. Spaced so they only
 * met at a point, every join left a wedge of background showing through the
 * middle of the ear.
 *
 * House rules for this set — a 512 box, 24-wide round-capped strokes, the
 * structure in `color` and the highlight in `accentColor`.
 */
const CarbsIcon: React.FC<Props> = ({
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
      transform="translate(256,224.2) scale(1.0256) translate(-256,-256)"
    >
      <G stroke={color}>
        <Path d="M256 470 L256 214" />
        <Path d="M256 430 C247 357 212 324 138 322 C147 395 182 428 256 430 Z" />
        <Path d="M256 430 C330 428 365 395 374 322 C300 324 265 357 256 430 Z" />
        <Path d="M256 344 C250 272 217 239 144 236 C150 308 183 341 256 344 Z" />
        <Path d="M256 344 C329 341 362 308 368 236 C295 239 262 272 256 344 Z" />
        <Path d="M256 258 C254 187 223 155 152 150 C154 221 185 253 256 258 Z" />
        <Path d="M256 258 C327 253 358 221 360 150 C289 155 258 187 256 258 Z" />
      </G>
      <Path
        d="M256 206 C306 170 306 140 256 104 C206 140 206 170 256 206 Z"
        stroke={accentColor}
      />
    </G>
  </Svg>
);

export default CarbsIcon;
