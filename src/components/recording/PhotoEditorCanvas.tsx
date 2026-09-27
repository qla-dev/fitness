import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  identityPhotoTransform,
  movePhotoTransform,
  photoEditorLayout,
  photoLocalPoint,
  type PhotoEditorOptions,
  type PhotoTransform,
} from '../../services/recording/photoEditor';
import type { PhotoComposition } from '../../services/recording/types';

type Touch = { id: number; x: number; y: number };
function pose(touches: Touch[]) {
  'worklet';
  const ordered = [...touches].sort((a, b) => a.id - b.id);
  const a = ordered[0],
    b = ordered[1];
  return b
    ? {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      }
    : { x: a.x, y: a.y, distance: 0, angle: 0 };
}

/** The same full-canvas transforms are applied by the Skia export renderer. */
export default function PhotoEditorCanvas({
  layers,
  composition,
  options,
  width,
  height,
  disabled,
  onCommit,
  onBusy,
}: {
  layers: { background: string; stats: string; route: string };
  composition: PhotoComposition;
  options: PhotoEditorOptions;
  width: number;
  height: number;
  disabled: boolean;
  onCommit: (stats: PhotoTransform, route: PhotoTransform) => void;
  onBusy: (busy: boolean) => void;
}) {
  const stats = useSharedValue(
    options.statsTransform ?? identityPhotoTransform
  );
  const route = useSharedValue(
    options.routeTransform ?? identityPhotoTransform
  );
  const selected = useSharedValue<'stats' | 'route' | null>(null);
  const previous = useSharedValue({ x: 0, y: 0, distance: 0, angle: 0 });
  const layout = photoEditorLayout(composition, options);
  const ratio = width / layout.width;
  const hasRoute =
    (options.showRoute !== false && composition.route.length > 1) ||
    Boolean(options.showCapturePin && composition.captureLocation);
  const boxes = layout.metrics.map((metric) => {
    // Keep the unused part of an alignment cell available for grabbing the route.
    const inkWidth = Math.min(
      metric.maxWidth,
      Math.max(
        metric.text.length * metric.size * 0.65 +
          (metric.unit?.length ?? 0) * metric.unitSize * 0.65,
        (metric.label?.length ?? 0) * metric.labelSize * 0.65,
        metric.icon ? metric.iconSize : 0
      )
    );
    const offset =
      options.textAlign === 'right'
        ? metric.maxWidth - inkWidth
        : options.textAlign === 'center'
          ? (metric.maxWidth - inkWidth) / 2
          : 0;
    return {
      x: (metric.x + offset) * ratio,
      y: metric.y * ratio,
      width: inkWidth * ratio,
      height:
        (metric.size * 1.3 +
          (metric.icon ? metric.iconSize : 0) +
          ('labelSize' in metric ? metric.labelSize * 1.3 : 0)) *
        ratio,
    };
  });
  const brandWidth = layout.branding.fontSize * 5.5 * ratio;
  boxes.push({
    x:
      options.textAlign === 'right'
        ? width - brandWidth
        : options.textAlign === 'center'
          ? (width - brandWidth) / 2
          : 0,
    y: layout.branding.top * ratio,
    width: brandWidth,
    height: layout.branding.fontSize * 1.5 * ratio,
  });
  const routeBox = {
    x: (layout.route.x - layout.route.width / 2) * ratio,
    y: (layout.route.y - layout.route.height / 2) * ratio,
    width: layout.route.width * ratio,
    height: layout.route.height * ratio,
  };
  const gesture = Gesture.Manual()
    .enabled(!disabled)
    .onTouchesDown((event, manager) => {
      if (!event.allTouches.length) return;
      const next = pose(event.allTouches);
      if (selected.value === null) {
        const point = photoLocalPoint(
          next.x,
          next.y,
          stats.value,
          width,
          height
        );
        const routePoint = photoLocalPoint(
          next.x,
          next.y,
          route.value,
          width,
          height
        );
        if (
          boxes.some(
            (box) =>
              point.x >= box.x - 12 &&
              point.x <= box.x + box.width + 12 &&
              point.y >= box.y - 12 &&
              point.y <= box.y + box.height + 12
          )
        )
          selected.value = 'stats';
        else if (
          hasRoute &&
          routePoint.x >= routeBox.x &&
          routePoint.x <= routeBox.x + routeBox.width &&
          routePoint.y >= routeBox.y &&
          routePoint.y <= routeBox.y + routeBox.height
        )
          selected.value = 'route';
        else {
          manager.fail();
          return;
        }
        manager.activate();
        runOnJS(onBusy)(true);
      }
      previous.value = next;
    })
    .onTouchesMove((event) => {
      if (!selected.value || !event.allTouches.length) return;
      const next = pose(event.allTouches);
      const value = selected.value === 'stats' ? stats : route;
      value.value = movePhotoTransform(
        value.value,
        previous.value,
        next,
        width,
        height
      );
      previous.value = next;
    })
    .onTouchesUp((event, manager) => {
      const remaining = event.allTouches.filter(
        (touch) => !event.changedTouches.some((ended) => ended.id === touch.id)
      );
      if (remaining.length) previous.value = pose(remaining);
      else manager.end();
    })
    .onTouchesCancelled((_event, manager) => manager.fail())
    .onFinalize(() => {
      if (selected.value) {
        runOnJS(onCommit)(stats.value, route.value);
        runOnJS(onBusy)(false);
      }
      selected.value = null;
    });
  const statsStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: stats.value.x * width },
      { translateY: stats.value.y * height },
      { rotate: `${stats.value.rotation}rad` },
      { scale: stats.value.scale },
    ],
  }));
  const routeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: route.value.x * width },
      { translateY: route.value.y * height },
      { rotate: `${route.value.rotation}rad` },
      { scale: route.value.scale },
    ],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={StyleSheet.absoluteFill}
        testID="photo-editor-canvas"
      >
        <Image
          source={{ uri: layers.background }}
          style={StyleSheet.absoluteFill}
          resizeMode="stretch"
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, routeStyle]}
        >
          <Image
            source={{ uri: layers.route }}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
          />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, statsStyle]}
        >
          <Image
            source={{ uri: layers.stats }}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
