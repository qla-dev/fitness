import {
  defaultPhotoEditorOptions,
  photoEditorLayout,
  type PhotoLayout,
} from '../../../src/services/recording/photoEditor';
import type { PhotoComposition } from '../../../src/services/recording/types';
import { liveMetricLayout } from '../../../src/services/recording/liveMetricLayout';

it('clones the live HUD geometry and stacked icons in the default share layout', () => {
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
    expect(metric.x).toBeCloseTo(metrics[index].x * scale);
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
      expect(result.branding.centerX).toBe(
        result.width * (layout === 'compact' ? 0.28 : 0.5)
      );
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
      expect(
        brandBottom <= routeTop || result.branding.top >= routeBottom
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
