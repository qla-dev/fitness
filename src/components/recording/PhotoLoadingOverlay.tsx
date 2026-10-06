import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Feathered edges without a gradient library: concentric bands of light.
const BANDS = [
  { width: 220, opacity: 0.05 },
  { width: 140, opacity: 0.07 },
  { width: 70, opacity: 0.09 },
];

/**
 * Covers the editor stage until its first layers are drawn, so the photo
 * opens straight onto its layout instead of showing the stats move into it.
 */
export default function PhotoLoadingOverlay({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const travel = width + height;
  const sweep = useAnimatedStyle(() => ({
    transform: [
      { translateX: -travel / 2 + progress.value * travel * 1.5 },
      { rotate: '20deg' },
    ],
  }));
  return (
    <Animated.View
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID="photo-loading-overlay"
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        blurRadius={24}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.sweep,
            { top: -height / 2, height: height * 2, left: -width / 2 },
            sweep,
          ]}
        >
          {BANDS.map((band) => (
            <View
              key={band.width}
              style={[
                styles.band,
                {
                  width: band.width,
                  marginLeft: -band.width / 2,
                  backgroundColor: `rgba(255,255,255,${band.opacity})`,
                },
              ]}
            />
          ))}
        </Animated.View>
      )}
      <View style={styles.center}>
        <View style={styles.spinner}>
          <ActivityIndicator color="white" />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shade: { backgroundColor: 'rgba(0,0,0,0.35)' },
  sweep: { position: 'absolute', width: 0 },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
