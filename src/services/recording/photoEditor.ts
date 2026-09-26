import type { PhotoComposition } from './types';

export type PhotoLayout =
  'classic' | 'summit' | 'hero' | 'poster' | 'compact' | 'trail';
export type PhotoFilter = 'original' | 'mono' | 'warm' | 'cool';
export type PhotoOverlay = 'none' | 'soft' | 'dark' | 'light';
export type PhotoFont = 'system' | 'anton' | 'bebas' | 'rajdhani' | 'oswald';
export interface PhotoEditorOptions {
  routeStyle?: 'line' | 'map';
  showCapturePin?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  layout: PhotoLayout;
  textColor: string;
  font: PhotoFont;
  routeColor: string;
  overlay: PhotoOverlay;
  filter: PhotoFilter;
  aspectRatio: number;
}
export const defaultPhotoEditorOptions: PhotoEditorOptions = {
  textAlign: 'left',
  layout: 'classic',
  textColor: '#FFFFFF',
  font: 'system',
  routeColor: '#5088F7',
  overlay: 'soft',
  filter: 'original',
  aspectRatio: 9 / 16,
};

/** Positions are in export pixels; the preview displays that exact export. */
export function photoEditorLayout(
  composition: PhotoComposition,
  options: PhotoEditorOptions
) {
  const width = 1080;
  const height = Math.round(width / options.aspectRatio);
  const metrics = composition.metrics.map((metric, index) => {
    let x = 0.12,
      y = 0.065 + index * 0.1,
      size = index === 0 ? 0.115 : 0.085;
    let maxWidth = 0.83;
    if (options.layout === 'trail') {
      x = 0.38 + (index % 3) * 0.19;
      y = 0.15 + Math.floor(index / 3) * 0.065;
      size = 0.032;
      maxWidth = 0.17;
    } else if (options.layout === 'compact') {
      x = 0.08;
      y = 0.08 + index * 0.06;
      size = 0.045;
      maxWidth = 0.4;
    } else if (options.layout === 'summit') {
      x = 0.22 + (index % 2) * 0.39;
      y = 0.065 + Math.floor(index / 2) * 0.09;
      size = 0.064;
      maxWidth = 0.34;
    } else if (options.layout === 'hero') {
      x = index === 0 ? 0.22 : 0.08 + ((index - 1) % 2) * 0.48;
      y = index === 0 ? 0.07 : 0.78 + Math.floor((index - 1) / 2) * 0.085;
      size = index === 0 ? 0.14 : 0.065;
      maxWidth = index === 0 ? 0.73 : 0.4;
    } else if (options.layout === 'poster') {
      x = index === 0 ? 0.08 : 0.08 + ((index - 1) % 2) * 0.48;
      y = index === 0 ? 0.69 : 0.81 + Math.floor((index - 1) / 2) * 0.075;
      size = index === 0 ? 0.13 : 0.062;
      maxWidth = index === 0 ? 0.84 : 0.4;
    }
    return {
      text: metric.text,
      icon:
        options.layout === 'compact' || options.layout === 'trail'
          ? undefined
          : metric.icon,
      x: x * width,
      y: y * height,
      size: size * width,
      maxWidth: maxWidth * width,
    };
  });
  const route =
    options.layout === 'trail'
      ? { x: 0.5, y: 0.58, width: 0.9, height: 0.78 }
      : options.layout === 'classic' || options.layout === 'compact'
        ? { x: 0.72, y: 0.76, width: 0.38, height: 0.3 }
        : options.layout === 'summit'
          ? { x: 0.55, y: 0.64, width: 0.72, height: 0.48 }
          : options.layout === 'hero'
            ? { x: 0.58, y: 0.46, width: 0.58, height: 0.4 }
            : { x: 0.57, y: 0.35, width: 0.68, height: 0.5 };
  return {
    width,
    height,
    metrics,
    // Place the centered wordmark in each composition's negative space.
    branding: {
      centerX:
        width *
        (options.layout === 'compact'
          ? 0.28
          : options.layout === 'trail'
            ? 0.66
            : 0.5),
      top:
        height *
        {
          classic: 0.552,
          summit: 0.325,
          hero: 0.685,
          poster: 0.025,
          compact: 0.4,
          trail: 0.07,
        }[options.layout],
      fontSize:
        width *
        (options.layout === 'poster'
          ? 0.05
          : options.layout === 'compact'
            ? 0.032
            : 0.04),
    },
    route: {
      x: route.x * width,
      y: route.y * height,
      width: route.width * width,
      height: route.height * height,
    },
  };
}

export const photoFilterMatrices: Record<
  Exclude<PhotoFilter, 'original'>,
  number[]
> = {
  mono: [
    0.213, 0.715, 0.072, 0, 0, 0.213, 0.715, 0.072, 0, 0, 0.213, 0.715, 0.072,
    0, 0, 0, 0, 0, 1, 0,
  ],
  warm: [
    1.08, 0.04, 0, 0, 0.025, 0, 1.01, 0, 0, 0.01, 0, 0, 0.88, 0, 0, 0, 0, 0, 1,
    0,
  ],
  cool: [
    0.9, 0, 0, 0, 0, 0, 1.02, 0, 0, 0.01, 0, 0.04, 1.08, 0, 0.02, 0, 0, 0, 1, 0,
  ],
};
