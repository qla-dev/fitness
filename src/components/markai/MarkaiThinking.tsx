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
import Icon, { type IconName } from '../Icon';

const ICON_SIZE = 18;

/**
 * The skill's mark at the head of the line, lit by the same travelling band
 * as the letters: a lit copy over a muted one, shown as the band passes the
 * start of the line.
 */
function SkillIcon({
  name,
  sweep,
  muted,
  foreground,
}: {
  name: IconName;
  sweep: SharedValue<number>;
  muted: string;
  foreground: string;
}) {
  const lit = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(sweep.value) / 0.3),
  }));
  return (
    <View
      style={{
        width: ICON_SIZE,
        height: 27,
        marginRight: 6,
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={ICON_SIZE} color={muted} />
      <Animated.View
        style={[{ position: 'absolute', top: (27 - ICON_SIZE) / 2 }, lit]}
      >
        <Icon name={name} size={ICON_SIZE} color={foreground} />
      </Animated.View>
    </View>
  );
}

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

export default function MarkaiThinking({
  skill,
  icon,
}: {
  skill: string;
  /**
   * The skill's mark, on the line for the whole wait — the brain for a free
   * chat, a calculator for a goal, and so on — rather than only while the
   * skill is named, as in ABC doctor's, whose look this follows.
   */
  icon: IconName;
}) {
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
        <SkillIcon
          name={icon}
          sweep={sweep}
          muted={muted}
          foreground={foreground}
        />
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
