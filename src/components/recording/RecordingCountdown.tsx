import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import Icon, { type IconName } from '../Icon';
import { fireSelectionHaptic } from '../../services/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 240;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/**
 * How long the count runs. Exported because the watch is told to count the
 * same three seconds — two numbers would drift apart the first time one of
 * them was tuned.
 */
export const COUNTDOWN_SECONDS = 3;
const SECONDS = COUNTDOWN_SECONDS;

/**
 * The three-second lead-in before a recording starts.
 *
 * A session that began the instant the card was tapped started with the phone
 * still in your hand and the first seconds already logged. The count gives you
 * time to put it away, and the ring makes the wait readable at arm's length.
 *
 * Forced dark, like the recorder behind it: this is a full-screen takeover
 * where a light sheet in bright sun would be the wrong instinct.
 */
export default function RecordingCountdown({
  color,
  icon,
  label,
  onDone,
}: {
  /** The sport's own colour — the ring and the glyph both take it. */
  color: string;
  icon: IconName;
  label: string;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(SECONDS);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: SECONDS * 1000,
      easing: Easing.linear,
    });
    fireSelectionHaptic();
    const timer = setInterval(() => {
      setRemaining((value) => {
        const next = value - 1;
        if (next > 0) fireSelectionHaptic();
        return next;
      });
    }, 1000);
    const done = setTimeout(onDone, SECONDS * 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(done);
    };
    // Runs once: the count is fixed and restarting it would extend the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{ backgroundColor: '#000' }}
    >
      <View
        className="items-center justify-center rounded-full mb-8"
        style={{ width: 64, height: 64, backgroundColor: `${color}26` }}
      >
        <Icon name={icon} size={32} color={color} />
      </View>

      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* The track is the same colour at low alpha, so the ring reads as
              one object draining rather than two arcs. */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text style={{ color: '#FFF', fontSize: 96, fontWeight: '300' }}>
            {Math.max(remaining, 1)}
          </Text>
        </View>
      </View>

      <Text
        className="text-center mt-10 px-8"
        style={{ color: '#FFF', fontSize: 28, fontWeight: '600' }}
      >
        {label}
      </Text>
    </View>
  );
}
