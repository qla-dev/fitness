import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { photoMetricIcons } from '../../constants/photoMetricIcons';

export default function MetricIcon({
  kind,
  pulse = false,
}: {
  kind: keyof typeof photoMetricIcons;
  pulse?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!pulse || reducedMotion) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 580,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 10 }}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d={photoMetricIcons[kind]} fill="white" />
      </Svg>
    </Animated.View>
  );
}
