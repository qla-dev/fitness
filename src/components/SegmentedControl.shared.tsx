import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Text,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';

import LiquidGlassSurface from './LiquidGlassSurface';
import {
  SEGMENTED_CONTROL_HEIGHT,
  type Segment,
  type SegmentedControlSize,
} from '../types/segmentedControl';

export type { Segment } from '../types/segmentedControl';

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  /**
   * Names the control for screen readers on both platforms.
   */
  label?: string;
  /** See `SegmentedControlSize`. Defaults to `regular`. */
  size?: SegmentedControlSize;
};

/**
 * Track padding, and so the inset of the pill inside it. The compact track is
 * shorter, so its pill needs a proportionally tighter inset or the fill ends
 * up a sliver inside a band of track.
 */
const TRACK_PADDING: Record<SegmentedControlSize, number> = {
  regular: 4,
  compact: 3,
};
const ACTIVE_FILL = '#E5E5EA';
const ACTIVE_TEXT = '#1C1C1E';

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
 * highlight that switches off one and on another. The
 * track uses Liquid Glass on supported devices, with a light-gray selection
 * pill that slides underneath the labels in both themes.
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
  size = 'regular',
}: SegmentedControlProps<T>) => {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackPadding = TRACK_PADDING[size];
  // Given rather than grown from the labels, so this control occupies the same
  // room on its first frame as on every frame after — see the note on
  // SEGMENTED_CONTROL_HEIGHT.
  const trackHeight = SEGMENTED_CONTROL_HEIGHT[size];

  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.key === activeKey)
  );
  const segmentWidth =
    segments.length > 0
      ? (trackWidth - trackPadding * 2) / segments.length
      : 0;

  // Driven from an effect rather than assigned during render: a shared value
  // written while rendering is read back on the UI thread before the commit
  // lands, and the pill takes a frame at the old position on the way.
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);
  const trackScale = useSharedValue(1);
  const dragging = useRef(false);
  const dragOffset = useRef(0);
  useEffect(() => {
    if (dragging.current) return;
    offset.set(
      reducedMotion
        ? activeIndex * segmentWidth
        : withSpring(activeIndex * segmentWidth, TRAVEL)
    );
  }, [activeIndex, segmentWidth, offset, reducedMotion]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { scale: scale.value }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trackScale.value }],
  }));
  const endHold = () => {
    trackScale.set(reducedMotion ? 1 : withSpring(1, TRAVEL));
    scale.set(reducedMotion ? 1 : withSpring(1, TRAVEL));
  };
  const release = (commit: boolean) => {
    endHold();
    dragging.current = false;
    const index =
      commit && segmentWidth > 0
        ? Math.max(
            0,
            Math.min(
              segments.length - 1,
              Math.round(dragOffset.current / segmentWidth)
            )
          )
        : activeIndex;
    offset.set(
      reducedMotion
        ? index * segmentWidth
        : withSpring(index * segmentWidth, TRAVEL)
    );
    if (commit && segments[index]) onSelect(segments[index].key);
  };
  // PanResponder stores these callbacks; refs are read only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const pan = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      segmentWidth > 0 &&
      Math.abs(gesture.dx) > 5 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => {
      dragging.current = true;
      dragOffset.current = activeIndex * segmentWidth;
      scale.set(reducedMotion ? 1 : withSpring(1.08, TRAVEL));
    },
    onPanResponderMove: (_, gesture) => {
      dragOffset.current = Math.max(
        0,
        Math.min(
          (segments.length - 1) * segmentWidth,
          activeIndex * segmentWidth + gesture.dx
        )
      );
      offset.set(dragOffset.current);
    },
    onPanResponderRelease: () => release(true),
    onPanResponderTerminate: () => release(false),
    onPanResponderTerminationRequest: () => false,
  });

  const onTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  return (
    <Animated.View
      {...pan.panHandlers}
      style={trackStyle}
      onTouchStart={() => {
        trackScale.set(reducedMotion ? 1 : withSpring(1.025, TRAVEL));
        scale.set(reducedMotion ? 1 : withSpring(1.08, TRAVEL));
      }}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
    >
      <LiquidGlassSurface
        accessibilityLabel={label}
        glassEffectStyle="regular"
        style={{
          flexDirection: 'row',
          borderRadius: 999,
          padding: trackPadding,
          height: trackHeight,
        }}
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
                left: trackPadding,
                top: trackPadding,
                bottom: trackPadding,
                width: segmentWidth,
              },
              pillStyle,
            ]}
          >
            <LiquidGlassSurface
              glassEffectStyle="regular"
              tintColor={ACTIVE_FILL}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
        ) : null}

        {segments.map((segment) => {
          const selected = activeKey === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              onPress={() => onSelect(segment.key)}
              onPressIn={() => {
                if (!reducedMotion) scale.set(withSpring(1.08, TRAVEL));
              }}
              onPressOut={() => {
                if (!dragging.current)
                  scale.set(reducedMotion ? 1 : withSpring(1, TRAVEL));
              }}
              className="flex-1 px-3 items-center justify-center"
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text
                className={`${size === 'compact' ? 'text-xs' : 'text-sm'} font-medium ${
                  selected ? '' : 'text-text-muted'
                }`}
                style={selected ? { color: ACTIVE_TEXT } : undefined}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </LiquidGlassSurface>
    </Animated.View>
  );
};

export default SegmentedControl;
