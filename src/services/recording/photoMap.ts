import { Directory, File, Paths } from 'expo-file-system';
import {
  ClipOp,
  Skia,
  matchFont,
  type SkCanvas,
} from '@shopify/react-native-skia';

type Point = { latitude: number; longitude: number };
type Box = { x: number; y: number; width: number; height: number };

/** One projection for tiles, route and pin, including routes crossing the date line. */
export function photoMapGeometry(points: Point[], box: Box) {
  const reference = (points[0].longitude + 180) / 360;
  const project = (point: Point) => {
    let x = (point.longitude + 180) / 360;
    x -= Math.round(x - reference);
    const latitude =
      (Math.max(-85.0511, Math.min(85.0511, point.latitude)) * Math.PI) / 180;
    return {
      x,
      y:
        (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) /
        2,
    };
  };
  const projected = points.map(project);
  const xs = projected.map((p) => p.x),
    ys = projected.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(
    (box.width * 0.84) / Math.max(maxX - minX, 0.00001),
    (box.height * 0.84) / Math.max(maxY - minY, 0.00001)
  );
  const centerX = (minX + maxX) / 2,
    centerY = (minY + maxY) / 2;
  const transform = (x: number, y: number) => ({
    x: box.x + (x - centerX) * scale,
    y: box.y + (y - centerY) * scale,
  });
  return {
    scale,
    centerX,
    centerY,
    transform,
    point: (p: Point) => {
      const q = project(p);
      return transform(q.x, q.y);
    },
  };
}

const pendingTiles = new Map<string, Promise<string>>();
async function tileUri(z: number, x: number, y: number): Promise<string> {
  const key = `${z}-${x}-${y}`;
  const pending = pendingTiles.get(key);
  if (pending) return pending;
  const download = (async () => {
    const directory = new Directory(Paths.cache, 'photo-map-tiles');
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `${key}.png`);
    // Only fetch the current user-selected preview; reuse tiles for at least seven days.
    if (file.exists && Date.now() - (file.modificationTime ?? 0) < 7 * 86400000)
      return file.uri;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(
        `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'qla.fit/1.0 (https://qla.fit)',
            Accept: 'image/png',
          },
        }
      );
      if (!response.ok) throw new Error('Map unavailable');
      file.write(new Uint8Array(await response.arrayBuffer()));
      return file.uri;
    } finally {
      clearTimeout(timeout);
    }
  })();
  pendingTiles.set(key, download);
  try {
    return await download;
  } finally {
    pendingTiles.delete(key);
  }
}

/** Render only the visible map rectangle, faded over the photo. Fail rather than export a blank map. */
export async function drawPhotoMap(
  canvas: SkCanvas,
  box: Box,
  geometry: ReturnType<typeof photoMapGeometry>
) {
  // Keep the preview to a small, bounded set of tiles even for a full-height layout.
  const zoom = Math.max(
    0,
    Math.min(
      18,
      Math.floor(
        Math.log2((geometry.scale / Math.max(box.width, box.height)) * 2)
      )
    )
  );
  const count = 2 ** zoom;
  const left = box.x - box.width / 2,
    top = box.y - box.height / 2;
  const minX = Math.floor(
    (geometry.centerX - box.width / 2 / geometry.scale) * count
  );
  const maxX = Math.floor(
    (geometry.centerX + box.width / 2 / geometry.scale) * count
  );
  const minY = Math.max(
    0,
    Math.floor((geometry.centerY - box.height / 2 / geometry.scale) * count)
  );
  const maxY = Math.min(
    count - 1,
    Math.floor((geometry.centerY + box.height / 2 / geometry.scale) * count)
  );
  const paint = Skia.Paint();
  paint.setAlphaf(0.38);
  canvas.save();
  canvas.clipRect(
    Skia.XYWHRect(left, top, box.width, box.height),
    ClipOp.Intersect,
    true
  );
  try {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const uri = await tileUri(zoom, ((x % count) + count) % count, y);
        const data = await Skia.Data.fromURI(uri);
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!image) throw new Error('Map image unavailable');
        try {
          const position = geometry.transform(x / count, y / count);
          canvas.drawImageRect(
            image,
            Skia.XYWHRect(0, 0, image.width(), image.height()),
            Skia.XYWHRect(
              position.x,
              position.y,
              geometry.scale / count,
              geometry.scale / count
            ),
            paint
          );
        } finally {
          image.dispose();
        }
      }
    }
    paint.setAlphaf(1);
    paint.setColor(Skia.Color('rgba(0,0,0,0.8)'));
    canvas.drawRect(
      Skia.XYWHRect(left, top + box.height - 25, box.width, 25),
      paint
    );
    paint.setColor(Skia.Color('#FFFFFF'));
    const font = matchFont({ fontSize: 16 });
    canvas.drawText(
      '© OpenStreetMap contributors',
      left + 8,
      top + box.height - 7,
      paint,
      font
    );
    font.dispose();
  } finally {
    canvas.restore();
    paint.dispose();
  }
}
