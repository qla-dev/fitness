import {
  defaultPhotoEditorOptions,
  photoEditorLayout,
  type PhotoLayout,
  identityPhotoTransform,
  movePhotoTransform,
  photoLocalPoint,
} from '../../../src/services/recording/photoEditor';
import type { PhotoComposition } from '../../../src/services/recording/types';
import { liveMetricLayout } from '../../../src/services/recording/liveMetricLayout';

it('keeps the live HUD sizing and stacked icons with full-width alignment boxes', () => {
  const metrics = liveMetricLayout(
    [
      { text: '12.5', unit: 'km' },
      { text: '5:30', label: 'Pace' },
      { text: '640', label: 'kcal' },
      { text: '145', label: 'bpm' },
    ],
    60
  );
  const result = photoEditorLayout(
    { width: 390, height: 844, top: 60, route: [], metrics },
    defaultPhotoEditorOptions
  );
  const scale = 1080 / 390;
  expect(metrics[0].y).toBe(60);
  result.metrics.forEach((metric, index) => {
    expect(metric.x).toBe(result.branding.inset);
    expect(metric.maxWidth).toBe(1080 - result.branding.inset * 2);
    expect(metric.y).toBeCloseTo(metrics[index].y * scale);
    expect(metric.size).toBeCloseTo(metrics[index].size * scale);
    expect(metric).toMatchObject({
      iconAbove: true,
      text: metrics[index].text,
    });
  });
});

const composition: PhotoComposition = {
  width: 390,
  height: 844,
  top: 60,
  route: [],
  metrics: ['12.5 km', '5:30 / km', '640 kcal', '145 bpm', '01:08:45'].map(
    (text) => ({ text, x: 24, y: 60, size: 48 })
  ),
};

it.each<PhotoLayout>([
  'classic',
  'summit',
  'hero',
  'poster',
  'compact',
  'trail',
])(
  '%s preserves the value, unit and label when changing layout or alignment',
  (layout) => {
    const metric = {
      text: '12.5',
      unit: 'km',
      label: 'Distance',
      x: 24,
      y: 60,
      size: 48,
    };
    for (const textAlign of ['left', 'center', 'right'] as const) {
      const result = photoEditorLayout(
        { ...composition, metrics: [metric] },
        { ...defaultPhotoEditorOptions, layout, textAlign }
      );
      expect(result.metrics[0]).toMatchObject({
        text: '12.5',
        unit: 'km',
        label: 'Distance',
      });
    }
  }
);

it.each<PhotoLayout>(['classic', 'summit', 'hero', 'poster', 'compact'])(
  '%s keeps all readings and the route within the export',
  (layout) => {
    for (const aspectRatio of [9 / 16, 390 / 650, 1]) {
      const result = photoEditorLayout(composition, {
        ...defaultPhotoEditorOptions,
        layout,
        aspectRatio,
      });
      expect(result.width / result.height).toBeCloseTo(aspectRatio, 2);
      const brandBottom = result.branding.top + result.branding.fontSize * 1.4;
      expect(result.branding.centerX).toBe(result.width / 2);
      expect(result.branding.top).toBeGreaterThan(0);
      expect(brandBottom).toBeLessThan(result.height);
      for (const metric of result.metrics) {
        expect(
          brandBottom <= metric.y ||
            result.branding.top >= metric.y + metric.size
        ).toBe(true);
      }
      const routeTop = result.route.y - result.route.height / 2;
      const routeBottom = result.route.y + result.route.height / 2;
      const brandRight = result.branding.inset + result.branding.fontSize * 5.5;
      expect(
        brandBottom <= routeTop ||
          result.branding.top >= routeBottom ||
          brandRight <= result.route.x - result.route.width / 2
      ).toBe(true);
      expect(result.metrics.map((metric) => metric.text)).toEqual(
        composition.metrics.map((metric) => metric.text)
      );
      for (const metric of result.metrics) {
        expect(metric.x).toBeGreaterThanOrEqual(0);
        expect(metric.x + metric.maxWidth).toBeLessThanOrEqual(result.width);
        expect(metric.y + metric.size).toBeLessThanOrEqual(result.height);
      }
      expect(result.route.x - result.route.width / 2).toBeGreaterThanOrEqual(0);
      expect(result.route.y + result.route.height / 2).toBeLessThanOrEqual(
        result.height
      );
    }
  }
);

it('puts the summit metrics above the centered route', () => {
  const result = photoEditorLayout(composition, {
    ...defaultPhotoEditorOptions,
    layout: 'summit',
  });
  const bottom = Math.max(
    ...result.metrics.map((metric) => metric.y + metric.size)
  );
  expect(bottom).toBeLessThan(result.route.y - result.route.height / 2);
});

it('stacks the classic wordmark directly under the last reading', () => {
  const result = photoEditorLayout(composition, defaultPhotoEditorOptions);
  const last = result.metrics[result.metrics.length - 1];
  const lastBottom = last.y + (last.icon ? last.iconSize : 0) + last.size * 1.2;
  expect(result.branding.top).toBeGreaterThan(lastBottom);
  expect(result.branding.top).toBeLessThan(
    lastBottom + result.branding.fontSize
  );
});

it.each(['classic', 'compact', 'summit'] as const)(
  '%s aligns across the photo width inside the side padding',
  (layout) => {
    for (const textAlign of ['left', 'center', 'right'] as const) {
      const result = photoEditorLayout(composition, {
        ...defaultPhotoEditorOptions,
        layout,
        textAlign,
      });
      expect(result.branding.inset).toBeGreaterThan(0);
      expect(result.metrics[0].x).toBe(result.branding.inset);
      expect(
        result.metrics[layout === 'summit' ? 1 : 0].x +
          result.metrics[layout === 'summit' ? 1 : 0].maxWidth
      ).toBe(result.width - result.branding.inset);
      expect(result.branding.align).toBe(textAlign);
    }
  }
);

it('places full-width maps at the top or bottom independently of route visibility', () => {
  for (const mapPosition of ['top', 'bottom'] as const) {
    const result = photoEditorLayout(composition, {
      ...defaultPhotoEditorOptions,
      routeStyle: 'map',
      mapPosition,
      showRoute: false,
    });
    expect(result.map.width).toBe(result.width);
    expect(result.map.x - result.map.width / 2).toBe(0);
    expect(result.map.y).toBe(
      result.height * (mapPosition === 'top' ? 0.25 : 0.75)
    );
  }
});

it('keeps a pinch focal point anchored while scaling and rotating', () => {
  const from = { x: 120, y: 200, distance: 100, angle: 0 };
  const to = { ...from, distance: 200, angle: Math.PI / 2 };
  const next = movePhotoTransform(identityPhotoTransform, from, to, 400, 800);
  const local = photoLocalPoint(from.x, from.y, next, 400, 800);
  expect(next.scale).toBe(2);
  expect(next.rotation).toBe(Math.PI / 2);
  expect(local.x).toBeCloseTo(from.x);
  expect(local.y).toBeCloseTo(from.y);
  expect(identityPhotoTransform).toEqual({ x: 0, y: 0, scale: 1, rotation: 0 });
});

it('supports panning and bounds pinch scaling without changing the other layer', () => {
  const start = { x: 50, y: 100, distance: 0, angle: 0 };
  const moved = movePhotoTransform(
    identityPhotoTransform,
    start,
    { ...start, x: 90, y: 180 },
    400,
    800
  );
  expect(moved).toEqual({ x: 0.1, y: 0.1, scale: 1, rotation: 0 });
  expect(
    movePhotoTransform(
      moved,
      { ...start, distance: 100 },
      { ...start, distance: 10000 },
      400,
      800
    ).scale
  ).toBe(5);
  expect(
    movePhotoTransform(
      moved,
      { ...start, distance: 100 },
      { ...start, distance: 1 },
      400,
      800
    ).scale
  ).toBe(0.2);
});

it.each(['trail', 'poster'] as const)(
  '%s keeps the wordmark beside its stats, clear of the edge and route',
  (layout) => {
    const result = photoEditorLayout(composition, {
      ...defaultPhotoEditorOptions,
      layout,
    });
    const brandBottom = result.branding.top + result.branding.fontSize * 1.4;
    const nearest = Math.min(
      ...result.metrics.map((metric) =>
        Math.min(
          Math.abs(metric.y - brandBottom),
          Math.abs(metric.y + metric.size * 1.2 - result.branding.top)
        )
      )
    );
    expect(result.branding.top).toBeGreaterThan(result.height * 0.1);
    expect(nearest).toBeLessThan(result.branding.fontSize * 1.5);
    const routeTop = result.route.y - result.route.height / 2;
    const routeBottom = result.route.y + result.route.height / 2;
    expect(brandBottom <= routeTop || result.branding.top >= routeBottom).toBe(
      true
    );
  }
);
