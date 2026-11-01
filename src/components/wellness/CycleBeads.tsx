import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useWellnessTokens } from './theme/wellnessTokens';
import { getPhaseColor } from '../../utils/cycleDisplayUtils';
import { withAlpha } from '../../utils/colors';

interface CycleBeadsProps {
  cycleDay: number | null;
  cycleLength: number;
  periodLength: number;
  fertileStartDay?: number | null;
  fertileEndDay?: number | null;
  ovulationDay?: number | null;
  /** The figure in the middle, e.g. "Day 3". */
  centerValue: string;
  /** A smaller line under it, e.g. "28-day cycle". */
  centerSub?: string;
  size?: number;
}

const FUTURE_COLOR = 'rgba(150, 150, 150, 0.22)';

/**
 * The cycle as a string of beads, one per day, worn round a wrist.
 *
 * The ring the hub draws is a measuring instrument; this is the Tracker's
 * glance at it, so it counts days the way people do — one at a time. Period
 * days are red, the estimated fertile window green, ovulation a larger bead.
 * Days already lived are solid and the ones ahead are faint, so the bracelet
 * also says how far through the cycle today is. Today wears a halo that
 * breathes, and the beads thread on in order when the card appears.
 */
const CycleBeads: React.FC<CycleBeadsProps> = ({
  cycleDay,
  cycleLength,
  periodLength,
  fertileStartDay,
  fertileEndDay,
  ovulationDay,
  centerValue,
  centerSub,
  size = 98,
}) => {
  const tokens = useWellnessTokens();
  const reducedMotion = useReducedMotion();
  const len = Math.max(cycleLength, periodLength + 1, 14);
  const center = size / 2;
  // Bead size follows the circumference so a 35-day cycle still leaves gaps.
  const spacing = (2 * Math.PI * (size / 2 - 8)) / len;
  const bead = Math.min(size * 0.035, spacing * 0.36);
  const radius = size / 2 - bead * 2.6 - 1;

  const beads = useMemo(() => {
    const out: {
      x: number;
      y: number;
      r: number;
      color: string;
      key: number;
      today: boolean;
    }[] = [];
    for (let day = 1; day <= len; day++) {
      const angle = -Math.PI / 2 + ((day - 1) / len) * 2 * Math.PI;
      const isPeriod = day <= periodLength;
      const isOvulation = ovulationDay === day;
      const isFertile =
        !!fertileStartDay &&
        !!fertileEndDay &&
        day >= fertileStartDay &&
        day <= fertileEndDay;
      const phaseColor = isPeriod
        ? getPhaseColor('menstrual', tokens)
        : isOvulation
          ? getPhaseColor('ovulation', tokens)
          : isFertile
            ? getPhaseColor('fertile', tokens)
            : null;
      const lived = cycleDay != null && day <= cycleDay;
      out.push({
        key: day,
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
        r: isOvulation ? bead * 1.55 : bead,
        // Phase days keep their colour ahead of today, only fainter, so the
        // next period and the fertile window can be seen coming.
        color: phaseColor
          ? lived
            ? phaseColor
            : withAlpha(phaseColor, 0.35)
          : lived
            ? tokens.phaseLuteal
            : FUTURE_COLOR,
        today: cycleDay === day,
      });
    }
    return out;
  }, [
    len,
    periodLength,
    ovulationDay,
    fertileStartDay,
    fertileEndDay,
    cycleDay,
    tokens,
    center,
    radius,
    bead,
  ]);

  const threaded = useSharedValue(reducedMotion ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      threaded.value = 1;
      return;
    }
    threaded.value = 0;
    threaded.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [reducedMotion, threaded, breath, cycleDay, len]);

  const today = beads.find((b) => b.today);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {today && (
          <Halo
            x={today.x}
            y={today.y}
            bead={bead}
            color={today.color}
            breath={breath}
          />
        )}
        {beads.map((b, i) => (
          <Bead
            key={b.key}
            index={i}
            count={beads.length}
            threaded={threaded}
            x={b.x}
            y={b.y}
            r={b.r}
            color={b.color}
          />
        ))}
        {today && (
          <Group>
            <Circle cx={today.x} cy={today.y} r={bead * 1.9} color="#FFFFFF" />
            <Circle
              cx={today.x}
              cy={today.y}
              r={bead * 1.25}
              color={today.color}
            />
          </Group>
        )}
      </Canvas>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          className="text-text-primary font-bold"
          style={{ fontSize: size >= 130 ? 26 : 16 }}
        >
          {centerValue}
        </Text>
        {centerSub ? (
          <Text className="text-text-secondary mt-0.5" style={{ fontSize: 11 }}>
            {centerSub}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

/** One bead, threaded on in turn as the card appears. */
const Bead: React.FC<{
  x: number;
  y: number;
  r: number;
  color: string;
  index: number;
  count: number;
  threaded: SharedValue<number>;
}> = ({ x, y, r, color, index, count, threaded }) => {
  const radius = useDerivedValue(() => {
    const start = (index / count) * 0.8;
    const t = Math.min(1, Math.max(0, (threaded.value - start) / 0.2));
    return r * t;
  });
  return <Circle cx={x} cy={y} r={radius} color={color} />;
};

/** Today's soft halo, slowly breathing. */
const Halo: React.FC<{
  x: number;
  y: number;
  bead: number;
  color: string;
  breath: SharedValue<number>;
}> = ({ x, y, bead, color, breath }) => {
  const radius = useDerivedValue(() => bead * (2.6 + breath.value * 1.1));
  const opacity = useDerivedValue(() => 0.35 - breath.value * 0.2);
  return <Circle cx={x} cy={y} r={radius} color={color} opacity={opacity} />;
};

export default CycleBeads;
