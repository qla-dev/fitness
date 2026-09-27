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
import { photoMetricIcons } from '../../constants/photoMetricIcons';
import { photoTypeface } from './photoFonts';
import { drawPhotoMap, photoMapGeometry } from './photoMap';

const directory = () => new Directory(Paths.document, 'workout-photos');
const validName = (name: string) => /^[a-f0-9-]+\.jpg$/i.test(name);
export const recordingPhotoUri = (photo: RecordingPhoto) =>
  new File(directory(), photo.fileName).uri;

async function renderRecordingPhoto(
  uri: string,
  composition: PhotoComposition,
  options?: PhotoEditorOptions
): Promise<Uint8Array> {
  const typeface = await photoTypeface(options?.font ?? 'system');
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
    const points = composition.route.filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );
    const location = composition.captureLocation;
    const pin =
      options?.showCapturePin &&
      location &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
        ? location
        : undefined;
    const boundsPoints = location
      ? [...points, location].filter(
          (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        )
      : points;
    if (options && layout && boundsPoints.length > 0) {
      const geometry = photoMapGeometry(boundsPoints, layout.route);
      if (options.routeStyle === 'map')
        await drawPhotoMap(canvas, layout.route, geometry);
      if (points.length > 1) {
        const path = Skia.Path.Make();
        points.forEach((point, index) => {
          const { x, y } = geometry.point(point);
          if (!index || point.segment !== points[index - 1].segment)
            path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        paint.setColor(Skia.Color(options.routeColor));
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeWidth(options.layout === 'trail' ? 18 : 14);
        canvas.drawPath(path, paint);
        path.dispose();
      }
      if (pin) {
        const { x, y } = geometry.point(pin);
        const marker = Skia.Path.MakeFromSVGString(
          'M0 0 C-5 -10 -20 -21 -20 -34 A20 20 0 1 1 20 -34 C20 -21 5 -10 0 0 Z'
        );
        if (marker) {
          canvas.save();
          canvas.translate(x, y);
          paint.setStyle(PaintStyle.Fill);
          paint.setColor(Skia.Color(options.routeColor));
          canvas.drawPath(marker, paint);
          paint.setStyle(PaintStyle.Stroke);
          paint.setStrokeWidth(3);
          paint.setColor(Skia.Color('#FFFFFF'));
          canvas.drawPath(marker, paint);
          paint.setStyle(PaintStyle.Fill);
          canvas.drawCircle(0, -34, 7, paint);
          canvas.restore();
          marker.dispose();
        }
      }
      paint.setStyle(PaintStyle.Fill);
    }
    const ratio = layout ? 1 : width / composition.width;
    paint.setColor(Skia.Color(options?.textColor ?? 'white'));
    for (const metric of layout?.metrics ?? composition.metrics) {
      const font = typeface
        ? Skia.Font(typeface, metric.size * ratio)
        : matchFont({
            fontSize: metric.size * ratio,
            fontWeight: 'weight' in metric ? (metric.weight ?? '400') : '400',
          });
      if ('maxWidth' in metric && typeof metric.maxWidth === 'number') {
        const measured = font.measureText(metric.text).width;
        if (measured > metric.maxWidth)
          font.setSize((metric.size * metric.maxWidth) / measured);
      }
      const availableWidth =
        'maxWidth' in metric && typeof metric.maxWidth === 'number'
          ? metric.maxWidth
          : font.measureText(metric.text).width;
      const remainingWidth = Math.max(
        0,
        availableWidth - font.measureText(metric.text).width
      );
      const textX =
        metric.x * ratio +
        (options?.textAlign === 'right'
          ? remainingWidth
          : options?.textAlign === 'center'
            ? remainingWidth / 2
            : 0);
      const stacked = 'iconAbove' in metric && metric.iconAbove;
      const iconSize = 'iconSize' in metric ? metric.iconSize : 24 * ratio;
      if (metric.icon) {
        const path = Skia.Path.MakeFromSVGString(photoMetricIcons[metric.icon]);
        if (path) {
          const drawnIconSize = stacked ? iconSize : metric.size * ratio * 0.55;
          canvas.save();
          canvas.translate(
            stacked ? textX : textX - drawnIconSize - 12,
            metric.y * ratio + (stacked ? 0 : metric.size * ratio * 0.25)
          );
          canvas.scale(drawnIconSize / 24, drawnIconSize / 24);
          canvas.drawPath(path, paint);
          canvas.restore();
          path.dispose();
        }
      }
      const metrics = font.getMetrics();
      const baseline =
        (metric.y + metric.size * 0.6) * ratio -
        (metrics.ascent + metrics.descent) / 2 +
        (stacked && metric.icon ? iconSize : 0);
      canvas.drawText(metric.text, textX, baseline, paint, font);
      if ('unit' in metric && metric.unit) {
        const unitSize = 'unitSize' in metric ? metric.unitSize : 28 * ratio;
        const unitFont = typeface
          ? Skia.Font(typeface, unitSize)
          : matchFont({ fontSize: unitSize, fontWeight: '600' });
        canvas.drawText(
          ` ${metric.unit}`,
          textX + font.measureText(metric.text).width,
          baseline,
          paint,
          unitFont
        );
      }
      if ('label' in metric && metric.label) {
        const labelSize = (metric.labelSize ?? 12) * ratio;
        const labelFont = typeface
          ? Skia.Font(typeface, labelSize)
          : matchFont({ fontSize: labelSize, fontWeight: '400' });
        const labelMetrics = labelFont.getMetrics();
        const labelY =
          metric.y * ratio +
          (metric.icon ? iconSize : 0) +
          metric.size * ratio * 1.2;
        paint.setAlphaf(0.6);
        canvas.drawText(
          metric.label.toUpperCase(),
          textX,
          labelY +
            labelSize * 0.6 -
            (labelMetrics.ascent + labelMetrics.descent) / 2,
          paint,
          labelFont
        );
        paint.setAlphaf(1);
      }
    }
    await drawPhotoBranding(
      canvas,
      width,
      height,
      options?.textColor ?? '#FFFFFF',
      layout?.branding
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
