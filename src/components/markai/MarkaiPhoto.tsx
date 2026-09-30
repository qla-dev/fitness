import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

const SIZE = 200;
const RING = 44;

/**
 * The photo inside a MarkAI bubble.
 *
 * Until the image has decoded, the bubble holds a shimmering tile with a
 * spinning ring, so the bubble has its final size from the first frame and
 * the photo fades in instead of popping. While the message is still being
 * analysed (`scanning`), a soft band sweeps down the photo.
 */
export default function MarkaiPhoto({
  uri,
  scanning = false,
}: {
  uri: string;
  scanning?: boolean;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const reveal = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (loaded) {
      cancelAnimation(spin);
      cancelAnimation(pulse);
      reveal.value = withTiming(1, { duration: 320 });
      return;
    }
    spin.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.linear }),
      -1
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [loaded, pulse, reveal, spin]);

  useEffect(() => {
    if (scanning && loaded) {
      sweep.value = 0;
      sweep.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(sweep);
      sweep.value = withTiming(0, { duration: 200 });
    }
  }, [scanning, loaded, sweep]);

  const placeholderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.6]) * (1 - reveal.value),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - reveal.value,
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const imageStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: interpolate(reveal.value, [0, 1], [0.96, 1]) }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: scanning ? 1 : 0,
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-60, SIZE]) }],
  }));

  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            inset: 0,
            backgroundColor: '#FFFFFF',
          },
          placeholderStyle,
        ]}
      />
      {!loaded ? (
        <Icon name="sparkles" size={18} color="#FFFFFF" />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: RING,
            height: RING,
            borderRadius: RING / 2,
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.25)',
            borderTopColor: '#FFFFFF',
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[{ position: 'absolute', inset: 0 }, imageStyle]}
      >
        <Image
          source={{ uri }}
          accessibilityLabel={t('markai.photo', { defaultValue: 'Photo' })}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          style={{ width: SIZE, height: SIZE }}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 60,
            backgroundColor: 'rgba(255,255,255,0.22)',
            borderBottomWidth: 2,
            borderBottomColor: 'rgba(255,255,255,0.8)',
          },
          sweepStyle,
        ]}
      />
    </View>
  );
}
