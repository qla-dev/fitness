import type { PhotoComposition } from './types';

export type PhotoLayout =
  'classic' | 'summit' | 'hero' | 'poster' | 'compact' | 'trail';
export type PhotoFilter = 'original' | 'mono' | 'warm' | 'cool';
export type PhotoOverlay = 'none' | 'soft' | 'dark' | 'light' | 'black';
export type PhotoFont = 'system' | 'anton' | 'bebas' | 'rajdhani' | 'oswald';
export type PhotoTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};
export const identityPhotoTransform: PhotoTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};
export interface PhotoEditorOptions {
  statsTransform?: PhotoTransform;
  routeTransform?: PhotoTransform;
  showRoute?: boolean;
  mapPosition?: 'top' | 'bottom';
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

type TouchPose = { x: number; y: number; distance: number; angle: number };
/** Apply a gesture around its moving focal point, in stage coordinates. */
export function movePhotoTransform(
  current: PhotoTransform,
  from: TouchPose,
  to: TouchPose,
  width: number,
  height: number
): PhotoTransform {
  'worklet';
  const scale = Math.max(
    0.2,
    Math.min(
      5,
      current.scale *
        (from.distance > 0 && to.distance > 0 ? to.distance / from.distance : 1)
    )
  );
  const factor = scale / current.scale;
  const rotation =
    from.distance > 0 && to.distance > 0 ? to.angle - from.angle : 0;
  const dx = width / 2 + current.x * width - from.x;
  const dy = height / 2 + current.y * height - from.y;
  return {
    x:
      (to.x +
        factor * (dx * Math.cos(rotation) - dy * Math.sin(rotation)) -
        width / 2) /
      width,
    y:
      (to.y +
        factor * (dx * Math.sin(rotation) + dy * Math.cos(rotation)) -
        height / 2) /
      height,
    scale,
    rotation: current.rotation + rotation,
  };
}

export function photoLocalPoint(
  x: number,
  y: number,
  transform: PhotoTransform,
  width: number,
  height: number
) {
  'worklet';
  const dx = x - width / 2 - transform.x * width;
  const dy = y - height / 2 - transform.y * height;
  const cos = Math.cos(transform.rotation),
    sin = Math.sin(transform.rotation);
  return {
    x: width / 2 + (dx * cos + dy * sin) / transform.scale,
    y: height / 2 + (-dx * sin + dy * cos) / transform.scale,
  };
}

/** Positions are in export pixels; the preview displays that exact export. */
export function photoEditorLayout(
  composition: PhotoComposition,
  options: PhotoEditorOptions
) {
  const width = 1080;
  const height = Math.round(width / options.aspectRatio);
  const sourceMetrics = composition.metrics.map((metric, index) =>
    options.layout === 'classic' && !metric.iconAbove
      ? {
          ...metric,
          x: 24,
          y: composition.top + [0, 82, 194, 298, 402][index],
          size: [48, 40, 34, 34, 28][index],
          iconAbove: true,
        }
      : metric
  );
  const metrics = sourceMetrics.map((metric, index) => {
    if (options.layout === 'classic') {
      const bottom = Math.max(
        ...sourceMetrics.map(
          (item) =>
            item.y +
            (item.icon ? 24 : 0) +
            item.size * 1.2 +
            (item.label ? (item.labelSize ?? 12) * 1.2 : 0)
        )
      );
      const scale = Math.min(
        width / composition.width,
        (height * 0.9) / bottom
      );
      return {
        ...metric,
        x: 0,
        y: metric.y * scale,
        size: metric.size * scale,
        labelSize: (metric.labelSize ?? 12) * scale,
        iconSize: 24 * scale,
        unitSize: 28 * scale,
        maxWidth: width,
      };
    }
    let x = 0,
      y = 0.065 + index * 0.1,
      size = index === 0 ? 0.115 : 0.085;
    let maxWidth = 1;
    if (options.layout === 'trail') {
      x = (index % 3) / 3;
      y = 0.15 + Math.floor(index / 3) * 0.065;
      size = 0.032;
      maxWidth = 1 / 3;
    } else if (options.layout === 'compact') {
      x = 0;
      y = 0.08 + index * 0.06;
      size = 0.045;
      maxWidth = 1;
    } else if (options.layout === 'summit') {
      x = (index % 2) * 0.5;
      y = 0.065 + Math.floor(index / 2) * 0.09;
      size = 0.064;
      maxWidth = 0.5;
    } else if (options.layout === 'hero') {
      x = index === 0 ? 0 : ((index - 1) % 2) * 0.5;
      y = index === 0 ? 0.07 : 0.78 + Math.floor((index - 1) / 2) * 0.085;
      size = index === 0 ? 0.14 : 0.065;
      maxWidth = index === 0 ? 1 : 0.5;
    } else if (options.layout === 'poster') {
      x = index === 0 ? 0 : ((index - 1) % 2) * 0.5;
      y = index === 0 ? 0.69 : 0.81 + Math.floor((index - 1) / 2) * 0.075;
      size = index === 0 ? 0.13 : 0.062;
      maxWidth = index === 0 ? 1 : 0.5;
    }
    const rowSize = Math.min(
      size * width,
      height *
        (options.layout === 'compact'
          ? 0.035
          : options.layout === 'trail'
            ? 0.028
            : options.layout === 'summit'
              ? 0.04
              : index === 0
                ? 0.11
                : 0.032)
    );
    return {
      ...metric,
      iconAbove: true,
      iconSize: rowSize * 0.5,
      unitSize: rowSize * 0.58,
      labelSize: rowSize * 0.25,
      icon:
        options.layout === 'compact' || options.layout === 'trail'
          ? undefined
          : metric.icon,
      x: x * width,
      y: y * height,
      size: rowSize,
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
    map: {
      x: width / 2,
      y: height * (options.mapPosition === 'top' ? 0.25 : 0.75),
      width,
      height: height * 0.5,
    },
    // Place the centered wordmark in each composition's negative space.
    branding: {
      centerX: width / 2,
      align: options.textAlign ?? 'left',
      top:
        height *
        {
          classic: 0.94,
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
      x: options.routeStyle === 'map' ? width / 2 : route.x * width,
      y:
        options.routeStyle === 'map'
          ? height * (options.mapPosition === 'top' ? 0.25 : 0.75)
          : route.y * height,
      width: options.routeStyle === 'map' ? width : route.width * width,
      height:
        options.routeStyle === 'map' ? height * 0.5 : route.height * height,
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
