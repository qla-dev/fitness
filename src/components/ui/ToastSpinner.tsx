import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

/** One turn. Slow enough to read as "working", not as "hurry up". */
const DURATION_MS = 1100;

/**
 * The spinner that stands in for a toast's icon while a sync runs.
 *
 * It takes the icon tile's exact footprint — same box, same corner radius,
 * same fill — so the toast does not resize or jump when the run finishes and
 * the tick replaces it. Only what is inside the tile changes.
 *
 * An arc over a full track rather than a plain ring: the track holds the
 * circle still while the arc turns, which reads as progress rather than as a
 * shape wobbling. The rotation is a transform on the UI thread, so a busy JS
 * thread mid-sync — exactly when this is on screen — cannot make it stutter.
 */
export default function ToastSpinner({
  size = 39,
  color,
  backgroundColor,
}: {
  size?: number;
  color: string;
  backgroundColor: string;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // The ring is drawn inside the tile with room to breathe, matching the 20pt
  // icon the other variants put here.
  const ring = Math.round(size * 0.56);
  const stroke = 3;
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <Animated.View style={style}>
        <Svg width={ring} height={ring}>
          <Circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeOpacity={0.22}
            fill="none"
          />
          {/* Three-quarters of the way round, with a round cap so the leading
              edge reads as a head rather than a cut. */}
          <Circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.72} ${circumference}`}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
