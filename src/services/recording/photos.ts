import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import {
  ImageFormat,
  PaintStyle,
  Skia,
  matchFont,
} from '@shopify/react-native-skia';
import {
  photoEditorLayout,
  photoFilterMatrices,
  type PhotoEditorOptions,
} from './photoEditor';
import type { PhotoComposition, RecordingPhoto } from './types';
import { drawPhotoBranding } from './photoBranding';

const directory = () => new Directory(Paths.document, 'workout-photos');
const validName = (name: string) => /^[a-f0-9-]+\.jpg$/i.test(name);
export const recordingPhotoUri = (photo: RecordingPhoto) =>
  new File(directory(), photo.fileName).uri;

async function renderRecordingPhoto(
  uri: string,
  composition: PhotoComposition,
  options?: PhotoEditorOptions
): Promise<Uint8Array> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Camera image could not be decoded');
  const width = 1080;
  const layout = options ? photoEditorLayout(composition, options) : undefined;
  const height =
    layout?.height ??
    Math.round((width * composition.height) / composition.width);
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    image.dispose();
    throw new Error('Photo surface unavailable');
  }
  try {
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    if (options && options.filter !== 'original') {
      const filter = Skia.ColorFilter.MakeMatrix(
        photoFilterMatrices[options.filter]
      );
      paint.setColorFilter(filter);
      filter.dispose();
    }
    // Match the live camera's centered cover crop and viewport proportions.
    const scale = Math.max(width / image.width(), height / image.height());
    const sw = width / scale,
      sh = height / scale;
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(
        (image.width() - sw) / 2,
        (image.height() - sh) / 2,
        sw,
        sh
      ),
      Skia.XYWHRect(0, 0, width, height),
      paint
    );
    if (options && options.filter !== 'original') paint.setColorFilter(null);
    if (options && options.overlay !== 'none') {
      const color =
        options.overlay === 'light'
          ? 'rgba(255,255,255,0.25)'
          : options.overlay === 'dark'
            ? 'rgba(0,0,0,0.55)'
            : 'rgba(0,0,0,0.25)';
      paint.setColor(Skia.Color(color));
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }
    const ratio = layout ? 1 : width / composition.width;
    paint.setColor(Skia.Color(options?.textColor ?? 'white'));
    for (const metric of layout?.metrics ?? composition.metrics) {
      const font = matchFont({
        fontSize: metric.size * ratio,
        fontWeight: '400',
      });
      if ('maxWidth' in metric && typeof metric.maxWidth === 'number') {
        const measured = font.measureText(metric.text).width;
        if (measured > metric.maxWidth)
          font.setSize((metric.size * metric.maxWidth) / measured);
      }
      const metrics = font.getMetrics();
      const baseline =
        (metric.y + metric.size * 0.6) * ratio -
        (metrics.ascent + metrics.descent) / 2;
      canvas.drawText(metric.text, metric.x * ratio, baseline, paint, font);
    }
    const points = composition.route.filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );
    if (options && points.length > 1) {
      const latitude =
        points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
      const projected = points.map((p) => ({
        x: p.longitude * Math.cos((latitude * Math.PI) / 180),
        y: -p.latitude,
        segment: p.segment,
      }));
      const bounds = projected.reduce(
        (b, p) => ({
          minX: Math.min(b.minX, p.x),
          maxX: Math.max(b.maxX, p.x),
          minY: Math.min(b.minY, p.y),
          maxY: Math.max(b.maxY, p.y),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      );
      const { minX, maxX, minY, maxY } = bounds;
      const box = layout!.route;
      const fit = Math.min(
        box.width / Math.max(maxX - minX, 0.00001),
        box.height / Math.max(maxY - minY, 0.00001)
      );
      const path = Skia.Path.Make();
      projected.forEach((p, i) => {
        const x = box.x + (p.x - (minX + maxX) / 2) * fit;
        const y = box.y + (p.y - (minY + maxY) / 2) * fit;
        if (!i || p.segment !== projected[i - 1].segment) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      paint.setColor(Skia.Color(options.routeColor));
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(14);
      canvas.drawPath(path, paint);
    }
    await drawPhotoBranding(
      canvas,
      width,
      height,
      options?.textColor ?? '#FFFFFF'
    );
    surface.flush();
    const rendered = surface.makeImageSnapshot();
    try {
      return rendered.encodeToBytes(ImageFormat.JPEG, 90);
    } finally {
      rendered.dispose();
    }
  } finally {
    image.dispose();
    surface.dispose();
  }
}

export async function createRecordingPhoto(
  uri: string,
  composition: PhotoComposition
): Promise<RecordingPhoto> {
  // A photo only needs a small route silhouette, not another copy of every
  // recorded sensor sample. Preserve pause boundaries so gaps stay gaps.
  const stride = Math.max(1, Math.ceil(composition.route.length / 800));
  composition = {
    ...composition,
    route: composition.route
      .filter(
        (point, index, points) =>
          index % stride === 0 ||
          index === points.length - 1 ||
          point.segment !== points[index - 1]?.segment ||
          point.segment !== points[index + 1]?.segment
      )
      .map(({ latitude, longitude, segment }) => ({
        latitude,
        longitude,
        segment,
      })),
  };
  directory().create({ intermediates: true, idempotent: true });
  const photo: RecordingPhoto = {
    fileName: `${randomUUID()}.jpg`,
    originalFileName: `${randomUUID()}.jpg`,
    capturedAt: Date.now(),
    composition,
  };
  try {
    new File(uri).copy(new File(directory(), photo.originalFileName!));
    new File(directory(), photo.fileName).write(
      await renderRecordingPhoto(uri, composition)
    );
    return photo;
  } catch (error) {
    deleteRecordingPhoto(photo);
    throw error;
  }
}

export async function createPhotoPreview(
  photo: RecordingPhoto,
  options: PhotoEditorOptions
) {
  if (
    !photo.composition ||
    !photo.originalFileName ||
    !validName(photo.originalFileName)
  )
    return recordingPhotoUri(photo);
  const bytes = await renderRecordingPhoto(
    new File(directory(), photo.originalFileName).uri,
    photo.composition,
    options
  );
  const file = new File(Paths.cache, `${randomUUID()}.jpg`);
  file.write(bytes);
  return file.uri;
}

export function deleteRecordingPhoto(photo: RecordingPhoto) {
  for (const name of [photo.fileName, photo.originalFileName]) {
    if (!name || !validName(name)) continue;
    const file = new File(directory(), name);
    if (file.exists) file.delete();
  }
}
