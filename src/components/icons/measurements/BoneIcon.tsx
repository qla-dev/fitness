import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A bone, drawn as one continuous outline.
 *
 * The ends are the real thing: each is two lobes that overlap, so the boundary
 * runs out around one, dips into a notch where they cross, and back out around
 * the other. Drawing them as four separate circles with a shaft between — the
 * first attempt — left seams through every end and read as anything but a
 * bone.
 *
 * The geometry is exact rather than eyeballed: every lobe is r=66, the pairs
 * are 120 apart so they genuinely intersect, and the arc endpoints are where
 * those circles cut the shaft's edges. That is what keeps both ends identical.
 */
const BoneIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M177,226 L335,226 A66,66 0 1 1 422,256 A66,66 0 1 1 335,286 L177,286 A66,66 0 1 1 90,256 A66,66 0 1 1 177,226 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Marrow: density is what bone mass actually measures. */}
    <Line
      x1="206"
      y1="256"
      x2="306"
      y2="256"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default BoneIcon;
