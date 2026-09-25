import { Skia } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import {
  createPhotoPreview,
  createRecordingPhoto,
  deleteRecordingPhoto,
} from '../../../src/services/recording/photos';
import { defaultPhotoEditorOptions } from '../../../src/services/recording/photoEditor';
import type { PhotoComposition } from '../../../src/services/recording/types';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'aaaa-bbbb') }));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'document', cache: 'cache' },
  Directory: jest.fn().mockImplementation(() => ({
    uri: 'document/workout-photos',
    create: jest.fn(),
  })),
  File: jest.fn().mockImplementation((base, name) => ({
    uri: name ? `${base.uri ?? base}/${name}` : base,
    exists: true,
    write: jest.fn(),
    copy: jest.fn(),
    delete: jest.fn(),
  })),
}));
jest.mock('@shopify/react-native-skia', () => {
  const canvas = {
    drawImageRect: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
    drawPath: jest.fn(),
  };
  return {
    ImageFormat: { JPEG: 1 },
    PaintStyle: { Stroke: 1 },
    matchFont: () => ({
      getMetrics: () => ({ ascent: -80, descent: 20 }),
      measureText: () => ({ width: 100 }),
      setSize: jest.fn(),
    }),
    Skia: {
      Data: { fromURI: jest.fn().mockResolvedValue({}) },
      Image: {
        MakeImageFromEncoded: () => ({
          width: () => 1200,
          height: () => 1600,
          dispose: jest.fn(),
        }),
      },
      Surface: {
        MakeOffscreen: jest.fn(() => ({
          getCanvas: () => canvas,
          flush: jest.fn(),
          dispose: jest.fn(),
          makeImageSnapshot: () => ({
            encodeToBytes: () => new Uint8Array([1]),
            dispose: jest.fn(),
          }),
        })),
      },
      ColorFilter: { MakeMatrix: jest.fn(() => ({ dispose: jest.fn() })) },
      Paint: () => ({
        setColorFilter: jest.fn(),
        setColor: jest.fn(),
        setStyle: jest.fn(),
        setStrokeWidth: jest.fn(),
      }),
      Color: (color: string) => color,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      Path: { Make: () => ({ moveTo: jest.fn(), lineTo: jest.fn() }) },
    },
  };
});

const composition: PhotoComposition = {
  width: 360,
  height: 720,
  top: 90,
  metrics: [{ text: '5 km', x: 24, y: 90, size: 48 }],
  route: [
    { latitude: 43, longitude: 18, segment: 0 },
    { latitude: 44, longitude: 19, segment: 0 },
  ],
};
beforeEach(() => jest.clearAllMocks());

it('exports the camera viewport crop and metric positions at the same scale', async () => {
  await createRecordingPhoto('camera.jpg', composition);
  expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(1080, 2160);
  const canvas = jest
    .mocked(Skia.Surface.MakeOffscreen)
    .mock.results[0].value.getCanvas();
  expect(canvas.drawImageRect).toHaveBeenCalledWith(
    expect.anything(),
    { x: 200, y: 0, width: 800, height: 1600 },
    { x: 0, y: 0, width: 1080, height: 2160 },
    expect.anything()
  );
  expect(canvas.drawText).toHaveBeenCalledWith(
    '5 km',
    72,
    expect.closeTo(386.4),
    expect.anything(),
    expect.anything()
  );
});

it('re-renders the original for styling and shares the resulting file, leaving legacy captures intact', async () => {
  const photo = {
    fileName: 'aaaa.jpg',
    originalFileName: 'bbbb.jpg',
    capturedAt: 0,
    composition,
  };
  expect(
    await createPhotoPreview(photo, {
      ...defaultPhotoEditorOptions,
      overlay: 'light',
      textColor: '#111111',
    })
  ).toBe('cache/aaaa-bbbb.jpg');
  expect(Skia.Data.fromURI).toHaveBeenCalledWith(
    'document/workout-photos/bbbb.jpg'
  );
  const canvas = jest
    .mocked(Skia.Surface.MakeOffscreen)
    .mock.results[0].value.getCanvas();
  expect(canvas.drawRect).toHaveBeenCalledTimes(1);
  expect(canvas.drawPath).toHaveBeenCalledTimes(1);
  jest.mocked(Skia.Data.fromURI).mockClear();
  expect(
    await createPhotoPreview(
      { fileName: 'aaaa.jpg', capturedAt: 0 },
      defaultPhotoEditorOptions
    )
  ).toBe('document/workout-photos/aaaa.jpg');
  expect(Skia.Data.fromURI).not.toHaveBeenCalled();
});

it('removes both durable images when a capture is discarded', () => {
  deleteRecordingPhoto({
    fileName: 'aaaa.jpg',
    originalFileName: 'bbbb.jpg',
    capturedAt: 0,
  });
  expect(jest.mocked(File).mock.results).toHaveLength(2);
  for (const result of jest.mocked(File).mock.results)
    expect(result.value.delete).toHaveBeenCalledTimes(1);
});

it('filters the image before drawing the overlay and metrics', async () => {
  await createPhotoPreview(
    {
      fileName: 'aaaa.jpg',
      originalFileName: 'bbbb.jpg',
      capturedAt: 0,
      composition,
    },
    { ...defaultPhotoEditorOptions, filter: 'mono' }
  );
  expect(Skia.ColorFilter.MakeMatrix).toHaveBeenCalledTimes(1);
  const canvas = jest
    .mocked(Skia.Surface.MakeOffscreen)
    .mock.results[0].value.getCanvas();
  expect(canvas.drawImageRect.mock.invocationCallOrder[0]).toBeLessThan(
    canvas.drawRect.mock.invocationCallOrder[0]
  );
  expect(canvas.drawRect.mock.invocationCallOrder[0]).toBeLessThan(
    canvas.drawText.mock.invocationCallOrder[0]
  );
});
