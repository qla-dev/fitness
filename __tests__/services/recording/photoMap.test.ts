import { photoMapGeometry } from '../../../src/services/recording/photoMap';

const box = { x: 540, y: 960, width: 900, height: 1200 };

it('uses identical coordinates for a photo pin and its route point', () => {
  const start = { latitude: 43, longitude: 18 };
  const snapped = { latitude: 43.01, longitude: 18.02 };
  const geometry = photoMapGeometry([start, snapped], box);
  expect(geometry.point({ ...snapped })).toEqual(geometry.point(snapped));
  for (const point of [start, snapped]) {
    const projected = geometry.point(point);
    expect(projected.x).toBeGreaterThan(box.x - box.width / 2);
    expect(projected.x).toBeLessThan(box.x + box.width / 2);
    expect(projected.y).toBeGreaterThan(box.y - box.height / 2);
    expect(projected.y).toBeLessThan(box.y + box.height / 2);
  }
});

it('keeps date-line crossings local instead of spanning the world', () => {
  const geometry = photoMapGeometry(
    [
      { latitude: 0, longitude: 179.99 },
      { latitude: 0, longitude: -179.99 },
    ],
    box
  );
  expect(geometry.scale).toBeGreaterThan(1000000);
});

it('centers a GPS-only capture with no recorded route', () => {
  const point = { latitude: 43, longitude: 18 };
  expect(photoMapGeometry([point], box).point(point)).toEqual({
    x: 540,
    y: 960,
  });
});
