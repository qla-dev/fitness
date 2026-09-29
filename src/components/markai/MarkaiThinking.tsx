import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

// Doctor/Lena's opening, skill, and rotating wait phases, using the installed
// Reanimated renderer for a travelling highlight without extra native modules.
function Letter({
  letter,
  index,
  length,
  sweep,
  muted,
  foreground,
}: {
  letter: string;
  index: number;
  length: number;
  sweep: SharedValue<number>;
  muted: string;
  foreground: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(index / Math.max(1, length - 1) - sweep.value);
    return {
      color: interpolateColor(
        Math.max(0, 1 - distance / 0.3),
        [0, 1],
        [muted, foreground]
      ),
    };
  });
  return (
    <Animated.Text style={[{ fontSize: 18, lineHeight: 27 }, style]}>
      {letter}
    </Animated.Text>
  );
}

export default function MarkaiThinking({ skill }: { skill: string }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(0);
  const [muted, foreground] = useCSSVariable([
    '--color-text-muted',
    '--color-text-primary',
  ]) as string[];
  const sweep = useSharedValue(-0.3);
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1.3, { duration: 2400, easing: Easing.linear }),
      -1
    );
    return () => cancelAnimation(sweep);
  }, [sweep]);
  useEffect(() => {
    const timer = setTimeout(
      () => setPhase((value) => value + 1),
      phase === 0 ? 1500 : phase === 1 ? 5000 : 7000
    );
    return () => clearTimeout(timer);
  }, [phase]);
  const phrases = [
    t('markai.analysing', { defaultValue: 'MarkAI is analysing…' }),
    t('markai.reviewing', { defaultValue: 'MarkAI is reviewing…' }),
    t('markai.patience', { defaultValue: 'MarkAI is working on your answer…' }),
  ];
  const label =
    phase === 0
      ? t('markai.thinking', { defaultValue: 'MarkAI is thinking…' })
      : phase === 1
        ? t('markai.usingSkill', {
            defaultValue: 'MarkAI is using {{skill}}',
            skill,
          })
        : phrases[(phase - 2) % phrases.length];
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ paddingVertical: 4 }}
    >
      <Animated.View
        key={label}
        entering={FadeIn.duration(260)}
        style={{ flexDirection: 'row', flexWrap: 'wrap' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from(label).map((letter, index) => (
          <Letter
            key={index}
            letter={letter}
            index={index}
            length={Array.from(label).length}
            sweep={sweep}
            muted={muted}
            foreground={foreground}
          />
        ))}
      </Animated.View>
    </View>
  );
}
