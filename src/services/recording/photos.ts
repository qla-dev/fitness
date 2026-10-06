import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import {
  ImageFormat,
  PaintStyle,
  Skia,
  matchFont,
  type SkCanvas,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import {
  photoEditorLayout,
  photoFilterMatrices,
  type PhotoEditorOptions,
  type PhotoTransform,
} from './photoEditor';
import type { PhotoComposition, RecordingPhoto } from './types';
import { drawPhotoBranding } from './photoBranding';
import { removePhotoDraft } from './photoDrafts';
import { photoMetricIcons } from '../../constants/photoMetricIcons';
import { photoTypeface } from './photoFonts';
import { drawPhotoMap, photoMapGeometry } from './photoMap';

const directory = () => new Directory(Paths.document, 'workout-photos');
const validName = (name: string) => /^[a-f0-9-]+\.jpg$/i.test(name);
type PhotoLayer = 'background' | 'stats' | 'route';

function transformLayer(
  canvas: SkCanvas,
  width: number,
  height: number,
  transform?: PhotoTransform
) {
  if (!transform) return;
  canvas.translate(
    width / 2 + transform.x * width,
    height / 2 + transform.y * height
  );
  canvas.rotate((transform.rotation * 180) / Math.PI, 0, 0);
  canvas.scale(transform.scale, transform.scale);
  canvas.translate(-width / 2, -height / 2);
}
export const recordingPhotoUri = (photo: RecordingPhoto) =>
  new File(directory(), photo.fileName).uri;

function photoCanvasSize(
  composition: PhotoComposition,
  options?: PhotoEditorOptions
) {
  const width = 1080;
  const layout = options ? photoEditorLayout(composition, options) : undefined;
  const height =
    layout?.height ??
    Math.round((width * composition.height) / composition.width);
  return { width, height, layout };
}

async function drawRecordingPhoto(
  canvas: SkCanvas,
  image: SkImage | null,
  composition: PhotoComposition,
  options?: PhotoEditorOptions,
  layer?: PhotoLayer
) {
  const typeface = await photoTypeface(options?.font ?? 'system');
  const { width, height, layout } = photoCanvasSize(composition, options);
  const paint = Skia.Paint();
  if (image && (!layer || layer === 'background')) {
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
        options.overlay === 'black'
          ? '#000000'
          : options.overlay === 'light'
            ? 'rgba(255,255,255,0.25)'
            : options.overlay === 'dark'
              ? 'rgba(0,0,0,0.55)'
              : 'rgba(0,0,0,0.25)';
      paint.setColor(Skia.Color(color));
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    }
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
    if (options.routeStyle === 'map' && (!layer || layer === 'background'))
      await drawPhotoMap(
        canvas,
        layout.map,
        photoMapGeometry(boundsPoints, layout.map),
        options.mapPosition ?? 'bottom'
      );
    if (!layer || layer === 'route') {
      canvas.save();
      transformLayer(
        canvas,
        width,
        height,
        layer ? undefined : options.routeTransform
      );
      const geometry = photoMapGeometry(boundsPoints, layout.route);
      if (points.length > 1 && options.showRoute !== false) {
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
      canvas.restore();
    }
  }
  if (!layer || layer === 'stats') {
    canvas.save();
    transformLayer(
      canvas,
      width,
      height,
      layer ? undefined : options?.statsTransform
    );
    const ratio = layout ? 1 : width / composition.width;
    paint.setColor(Skia.Color(options?.textColor ?? 'white'));
    for (const metric of layout?.metrics ?? composition.metrics) {
      const font = typeface
        ? Skia.Font(typeface, metric.size * ratio)
        : matchFont({
            fontSize: metric.size * ratio,
            fontWeight: 'weight' in metric ? (metric.weight ?? '400') : '400',
          });
      const unit = 'unit' in metric ? metric.unit : undefined;
      const unitSize =
        'unitSize' in metric && typeof metric.unitSize === 'number'
          ? metric.unitSize
          : 28 * ratio;
      const unitFont = unit
        ? typeface
          ? Skia.Font(typeface, unitSize)
          : matchFont({ fontSize: unitSize, fontWeight: '600' })
        : undefined;
      // Every unit sits one space (in the smaller unit font) after its
      // number; a rate unit ("/ km") also closes up to read "/km".
      const unitText = unit ? ` ${unit.replace(/^\s*\/\s*/, '/')}` : '';
      if ('maxWidth' in metric && typeof metric.maxWidth === 'number') {
        const measured =
          font.measureText(metric.text).width +
          (unitFont?.measureText(unitText).width ?? 0);
        if (measured > metric.maxWidth) {
          const fit = metric.maxWidth / measured;
          font.setSize(metric.size * ratio * fit);
          unitFont?.setSize(unitSize * fit);
        }
      }
      const availableWidth =
        'maxWidth' in metric && typeof metric.maxWidth === 'number'
          ? metric.maxWidth
          : font.measureText(metric.text).width;
      const alignedX = (itemWidth: number) =>
        metric.x * ratio +
        (options?.textAlign === 'right'
          ? availableWidth - itemWidth
          : options?.textAlign === 'center'
            ? (availableWidth - itemWidth) / 2
            : 0);
      const textX = alignedX(
        font.measureText(metric.text).width +
          (unitFont?.measureText(unitText).width ?? 0)
      );
      const stacked = 'iconAbove' in metric && metric.iconAbove;
      const iconSize =
        'iconSize' in metric && typeof metric.iconSize === 'number'
          ? metric.iconSize
          : 24 * ratio;
      if (metric.icon) {
        const path = Skia.Path.MakeFromSVGString(photoMetricIcons[metric.icon]);
        if (path) {
          const drawnIconSize = stacked ? iconSize : metric.size * ratio * 0.55;
          canvas.save();
          canvas.translate(
            stacked ? alignedX(drawnIconSize) : textX - drawnIconSize - 12,
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
      if (unitFont) {
        canvas.drawText(
          unitText,
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
          alignedX(labelFont.measureText(metric.label.toUpperCase()).width),
          labelY +
            labelSize * 0.6 -
            (labelMetrics.ascent + labelMetrics.descent) / 2,
          paint,
          labelFont
        );
        paint.setAlphaf(1);
        labelFont.dispose();
      }
      unitFont?.dispose();
      font.dispose();
    }
    await drawPhotoBranding(
      canvas,
      width,
      height,
      options?.textColor ?? '#FFFFFF',
      layout?.branding
    );
    canvas.restore();
  }
}

async function renderRecordingPhoto(
  uri: string,
  composition: PhotoComposition,
  options?: PhotoEditorOptions,
  layer?: PhotoLayer
): Promise<Uint8Array> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Camera image could not be decoded');
  const { width, height } = photoCanvasSize(composition, options);
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    image.dispose();
    throw new Error('Photo surface unavailable');
  }
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    await drawRecordingPhoto(canvas, image, composition, options, layer);
    surface.flush();
    const rendered = surface.makeImageSnapshot();
    try {
      return rendered.encodeToBytes(
        layer ? ImageFormat.PNG : ImageFormat.JPEG,
        90
      );
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
  options: PhotoEditorOptions,
  /** The shared file's name; other apps show it, so it should say what it is. */
  fileName?: string
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
  const file = new File(Paths.cache, fileName ?? `${randomUUID()}.jpg`);
  file.write(bytes);
  return file.uri;
}

/** Untransformed transparent layers let gestures animate without re-rendering JPEGs. */
export type PhotoEditorLayers = {
  background: string;
  route: SkPicture;
  stats: SkPicture;
};

/** Record a layer as vector commands so pinch zoom redraws text sharply. */
async function recordPhotoLayer(
  composition: PhotoComposition,
  options: PhotoEditorOptions,
  layer: 'route' | 'stats'
) {
  const { width, height } = photoCanvasSize(composition, options);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  await drawRecordingPhoto(canvas, null, composition, options, layer);
  return recorder.finishRecordingAsPicture();
}

export async function createPhotoEditorLayers(
  photo: RecordingPhoto,
  options: PhotoEditorOptions
): Promise<PhotoEditorLayers> {
  if (
    !photo.composition ||
    !photo.originalFileName ||
    !validName(photo.originalFileName)
  )
    throw new Error('This photo has no editable composition');
  const bytes = await renderRecordingPhoto(
    new File(directory(), photo.originalFileName).uri,
    photo.composition,
    options,
    'background'
  );
  const file = new File(Paths.cache, `${randomUUID()}.png`);
  file.write(bytes);
  try {
    return {
      background: file.uri,
      route: await recordPhotoLayer(photo.composition, options, 'route'),
      stats: await recordPhotoLayer(photo.composition, options, 'stats'),
    };
  } catch (error) {
    try {
      file.delete();
    } catch {
      /* Temporary cache only. */
    }
    throw error;
  }
}

export function deleteRecordingPhoto(photo: RecordingPhoto) {
  removePhotoDraft(photo);
  for (const name of [photo.fileName, photo.originalFileName]) {
    if (!name || !validName(name)) continue;
    const file = new File(directory(), name);
    if (file.exists) file.delete();
  }
}
