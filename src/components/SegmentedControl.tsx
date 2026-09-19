import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import LiquidGlassSurface from './LiquidGlassSurface';
import { canUseLiquidGlass } from '../utils/liquidGlass';
import { withAlpha } from '../utils/colors';
import type { Segment } from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  /**
   * Names the control for screen readers. Required by the native iOS picker
   * and accepted here so callers write one set of props for both platforms.
   */
  label?: string;
};

/** Track padding, and so the inset of the pill inside it. */
const TRACK_PADDING = 4;

/**
 * How the pill travels. Tuned to the system's own: it arrives quickly and
 * settles without bouncing past, because a selector that wobbles reads as a
 * toy rather than as a control.
 */
const TRAVEL = { damping: 20, stiffness: 220, mass: 0.6 } as const;

/**
 * The app's one segmented control, everywhere it appears.
 *
 * The selection is a single pill that slides between segments rather than a
 * highlight that switches off one and on another. That distinction is the
 * whole character of the control: on iOS 26 the pill is Liquid Glass, and
 * glass that jumps between positions looks like two different objects, while
 * glass that travels reads as one piece of material moving under your finger —
 * which is what the system's own range pickers do.
 *
 * Off iOS 26 the same pill slides, drawn as a plain raised capsule.
 * `LiquidGlassSurface` handles that fallback, so there is one layout and one
 * animation rather than two of each to keep in step.
 */
const SegmentedControl = <T extends string>({
  segments,
  activeKey,
  onSelect,
  label,
}: SegmentedControlProps<T>) => {
  const glass = canUseLiquidGlass();
  const chromeBorder = useCSSVariable('--color-chrome-border') as string;
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.key === activeKey)
  );
  const segmentWidth =
    segments.length > 0
      ? (trackWidth - TRACK_PADDING * 2) / segments.length
      : 0;

  // Driven from an effect rather than assigned during render: a shared value
  // written while rendering is read back on the UI thread before the commit
  // lands, and the pill takes a frame at the old position on the way.
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withSpring(activeIndex * segmentWidth, TRAVEL);
  }, [activeIndex, segmentWidth, offset]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      accessibilityLabel={label}
      className="flex-row bg-raised dark:bg-surface"
      style={{ borderRadius: 999, padding: TRACK_PADDING }}
      onLayout={onTrackLayout}
    >
      {/* Measured before it can be placed, so it stays off screen for the
          first frame rather than flashing at the left edge. */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: TRACK_PADDING,
              top: TRACK_PADDING,
              bottom: TRACK_PADDING,
              width: segmentWidth,
            },
            pillStyle,
          ]}
        >
          {glass ? (
            <LiquidGlassSurface
              isInteractive
              style={{
                flex: 1,
                borderRadius: 999,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: withAlpha(chromeBorder, 0.45),
                overflow: 'hidden',
              }}
            />
          ) : (
            // The pill the control has always had, rather than
            // LiquidGlassSurface's own chrome-coloured fallback, which is the
            // wrong tone against this track.
            <View
              className="flex-1 bg-surface dark:bg-background"
              style={{ borderRadius: 999 }}
            />
          )}
        </Animated.View>
      ) : null}

      {segments.map((segment) => {
        const selected = activeKey === segment.key;
        return (
          <TouchableOpacity
            key={segment.key}
            onPress={() => onSelect(segment.key)}
            className="flex-1 py-2 items-center"
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              className={`text-sm font-medium ${
                selected ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {segment.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SegmentedControl;
