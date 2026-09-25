import {
  defaultPhotoEditorOptions,
  photoEditorLayout,
  type PhotoLayout,
} from '../../../src/services/recording/photoEditor';
import type { PhotoComposition } from '../../../src/services/recording/types';

const composition: PhotoComposition = {
  width: 390,
  height: 844,
  top: 60,
  route: [],
  metrics: ['12.5 km', '5:30 / km', '640 kcal', '145 bpm', '01:08:45'].map(
    (text) => ({ text, x: 24, y: 60, size: 48 })
  ),
};

it.each<PhotoLayout>(['classic', 'summit', 'hero', 'poster'])(
  '%s keeps all readings and the route within the export',
  (layout) => {
    for (const aspectRatio of [9 / 16, 390 / 650, 1]) {
      const result = photoEditorLayout(composition, {
        ...defaultPhotoEditorOptions,
        layout,
        aspectRatio,
      });
      expect(result.width / result.height).toBeCloseTo(aspectRatio, 2);
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
