import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A flexed arm: the bicep domed high over the upper arm, and the forearm
 * turning up at the elbow.
 *
 * The deep notch between the two is load-bearing. A shallow one lets the dome
 * flow into the forearm and the whole outline reads as a drumstick — with a
 * single 14-wide stroke and no fill, the silhouette is all there is to say
 * where the muscle ends and the limb begins.
 */
const MuscleIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M100,346 C100,318 104,310 112,304 C128,222 158,178 206,176 C262,174 290,248 298,332 C308,312 316,304 326,302 L326,186 C326,152 340,128 362,128 C386,128 404,152 404,186 L404,352 C404,374 388,390 366,390 L138,390 C114,390 100,370 100,346 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M152,292 C170,228 218,204 262,226"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export default MuscleIcon;
