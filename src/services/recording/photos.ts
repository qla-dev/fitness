import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { ImageFormat, Skia, matchFont } from '@shopify/react-native-skia';
import type { RecordingPhoto } from './types';

const directory = () => new Directory(Paths.document, 'workout-photos');
export const recordingPhotoUri = (photo: RecordingPhoto) =>
  new File(directory(), photo.fileName).uri;

/** Render the captured frame and the metrics together into a durable image. */
export async function createRecordingPhoto(
  uri: string,
  lines: string[]
): Promise<RecordingPhoto> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Camera image could not be decoded');
  const width = Math.min(1080, image.width());
  const height = Math.round((image.height() * width) / image.width());
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Photo surface unavailable');
  try {
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, width, height),
      paint
    );
    const fontSize = Math.round(width * 0.045);
    const padding = Math.round(width * 0.05);
    const lineHeight = Math.round(fontSize * 1.5);
    paint.setColor(Skia.Color('rgba(0,0,0,0.55)'));
    canvas.drawRect(
      Skia.XYWHRect(0, 0, width, padding * 2 + lineHeight * lines.length),
      paint
    );
    paint.setColor(Skia.Color('white'));
    const font = matchFont({ fontSize });
    lines.forEach((line, i) =>
      canvas.drawText(
        line,
        padding,
        padding + fontSize + i * lineHeight,
        paint,
        font
      )
    );
    surface.flush();
    const rendered = surface.makeImageSnapshot();
    try {
      directory().create({ intermediates: true, idempotent: true });
      const photo = { fileName: `${randomUUID()}.jpg`, capturedAt: Date.now() };
      new File(directory(), photo.fileName).write(
        rendered.encodeToBytes(ImageFormat.JPEG, 90)
      );
      return photo;
    } finally {
      rendered.dispose();
    }
  } finally {
    image.dispose();
    surface.dispose();
  }
}

export function deleteRecordingPhoto(photo: RecordingPhoto) {
  // Only filenames minted by this feature may be deleted.
  if (!/^[a-f0-9-]+\.jpg$/i.test(photo.fileName)) return;
  const file = new File(directory(), photo.fileName);
  if (file.exists) file.delete();
}
