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

/** Within ~4° of a quarter turn, hold the layer square like Instagram does. */
export function snapPhotoRotation(rotation: number) {
  'worklet';
  const quarter = Math.PI / 2;
  const nearest = Math.round(rotation / quarter) * quarter;
  return Math.abs(rotation - nearest) < 0.07 ? nearest : rotation;
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
  // Older saved photos carry readings without the stacked geometry, laid out
  // on a 1080-wide canvas. They get the live grid, in points of a phone-width
  // viewport scaled to that canvas, so their text is as large as any other.
  const legacy = composition.width / 390;
  // Layouts that set the lead as one row among equals (route story, stats
  // above route, compact) keep its icon and label so it lines up with the
  // rest; classic, hero and poster show it as the large number on its own.
  const gridLead =
    options.layout === 'trail' ||
    options.layout === 'summit' ||
    options.layout === 'compact';
  const sourceMetrics = composition.metrics
    .map((metric) =>
      metric.lead && !gridLead
        ? { ...metric, icon: undefined, label: undefined }
        : metric
    )
    .map((metric, index) =>
      options.layout === 'classic' && !metric.iconAbove
        ? {
            ...metric,
            x: 24 * legacy,
            y: composition.top + [0, 82, 194, 298, 402][index] * legacy,
            size: [48, 40, 34, 34, 28][index] * legacy,
            labelSize: 12 * legacy,
            iconAbove: true,
          }
        : metric
    );
  // Keep every layout's readings and wordmark off the photo's side edges.
  const inset = Math.round(width * 0.06);
  const contentWidth = width - inset * 2;
  const brandSize =
    width *
    (options.layout === 'poster'
      ? 0.05
      : options.layout === 'compact'
        ? 0.032
        : 0.04);
  // Proportional to the wordmark, so every layout keeps the same breathing room.
  const brandGap = brandSize * 1.6;
  const classicBottom = Math.max(
    ...sourceMetrics.map(
      (item) =>
        item.y +
        (item.icon ? 24 : 0) +
        item.size * 1.2 +
        (item.label ? (item.labelSize ?? 12) * 1.2 : 0)
    )
  );
  // Like a story editor, the header is the only safe area: the close button
  // sits over the top left (its bottom edge about a fifth of the width down),
  // and no layout starts above it. The tool buttons on the right may overlap.
  const headerBottom = Math.round(width * 0.2);
  // Classic stacks its wordmark under the last reading, so reserve that row.
  const classicTop = headerBottom;
  const classicFirst = Math.min(...sourceMetrics.map((item) => item.y));
  const classicScale = Math.min(
    width / composition.width,
    (height * 0.95 - classicTop - brandGap - brandSize * 1.4) /
      (classicBottom - classicFirst)
  );
  const classicShift = classicTop - classicFirst * classicScale;
  // The other layouts anchor a block of rows to the top of the photo (the
  // rows above the middle); that block starts right under the header, as
  // Classic does, taking the wordmark and route placed relative to it along.
  const firstTopRow = {
    trail: 0.15,
    compact: 0.08,
    summit: 0.065,
    hero: 0.07,
  }[options.layout as 'trail' | 'compact' | 'summit' | 'hero'];
  const topShift =
    firstTopRow === undefined ? 0 : headerBottom - firstTopRow * height;
  const placed = sourceMetrics.map((metric, index) => {
    if (options.layout === 'classic') {
      const scale = classicScale;
      const y = metric.y * scale + classicShift;
      return {
        ...metric,
        x: inset,
        y,
        size: metric.size * scale,
        labelSize: (metric.labelSize ?? 12) * scale,
        iconSize: 24 * scale,
        // In step with its own reading, as the other layouts do; a fixed size
        // made a small row's unit as large as its number.
        unitSize: metric.size * scale * 0.58,
        maxWidth: contentWidth,
      };
    }
    let x = 0,
      y = 0.065 + index * 0.1,
      size = index === 0 ? 0.115 : 0.085;
    let maxWidth = 1;
    if (options.layout === 'trail') {
      x = (index % 3) / 3;
      y = 0.15 + Math.floor(index / 3) * 0.1;
      size = 0.055;
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
            ? 0.045
            : options.layout === 'summit'
              ? 0.04
              : index === 0
                ? 0.11
                : 0.032)
    );
    const top = y * height + (y < 0.5 ? topShift : 0);
    return {
      ...metric,
      iconAbove: true,
      iconSize: rowSize * 0.5,
      unitSize: rowSize * 0.58,
      labelSize: rowSize * 0.25,
      x: inset + x * contentWidth,
      y: top,
      size: rowSize,
      maxWidth: maxWidth * contentWidth,
    };
  });
  // A grid row with empty cells (two readings in a three-column row) moves as
  // one with the text alignment, so centered text centers the row itself.
  const rowShift = (y: number) => {
    const row = placed.filter((metric) => metric.y === y);
    const used = row.reduce((total, metric) => total + metric.maxWidth, 0);
    const spare = contentWidth - used;
    if (options.layout === 'classic' || spare < 1) return 0;
    return options.textAlign === 'center'
      ? spare / 2
      : options.textAlign === 'right'
        ? spare
        : 0;
  };
  const metrics = placed.map((metric) => ({
    ...metric,
    x: metric.x + rowShift(metric.y),
  }));
  const route =
    options.layout === 'trail'
      ? { x: 0.5, y: 0.68, width: 0.9, height: 0.58 }
      : options.layout === 'classic' || options.layout === 'compact'
        ? {
            // Classic's route sits opposite its text: right of left-aligned
            // stats, under centered ones, left of right-aligned ones.
            x:
              options.layout === 'classic' && options.textAlign === 'center'
                ? 0.5
                : options.layout === 'classic' && options.textAlign === 'right'
                  ? 0.28
                  : 0.72,
            // Beside left or right text it is centered vertically; under
            // centered text it stays low, clear of the stats column.
            y:
              options.layout === 'classic' && options.textAlign !== 'center'
                ? 0.5
                : 0.76,
            width: 0.38,
            height: 0.3,
          }
        : options.layout === 'summit'
          ? { x: 0.55, y: 0.64, width: 0.72, height: 0.48 }
          : options.layout === 'hero'
            ? { x: 0.58, y: 0.46, width: 0.58, height: 0.4 }
            : { x: 0.57, y: 0.34, width: 0.68, height: 0.48 };
  // Story and poster keep the wordmark inside the stats block, so scaling
  // the stats layer up cannot push the logo out of the frame on its own.
  const metricsBottom = Math.max(
    ...metrics.map(
      (metric) =>
        metric.y +
        (metric.icon ? metric.iconSize : 0) +
        metric.size * 1.2 +
        (metric.label ? metric.labelSize * 1.2 : 0)
    )
  );
  const brandHeight = brandSize * 1.4;
  // Layouts that stack from the top hang the wordmark one gap under the last
  // reading, measured from what is drawn, so it sits the same distance away
  // however many readings there are. Hero and poster place it between blocks.
  const brandTop =
    options.layout === 'poster'
      ? (metrics[0]?.y ?? height * 0.69) - brandSize * 0.5 - brandHeight
      : options.layout === 'hero'
        ? height * 0.685
        : metricsBottom + brandGap;
  // Summit and hero hang their route under the top block, so it follows it.
  const routeShift =
    options.layout === 'summit' || options.layout === 'hero' ? topShift : 0;
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
      inset,
      align: options.textAlign ?? 'left',
      top: brandTop,
      fontSize: brandSize,
    },
    route: {
      x: options.routeStyle === 'map' ? width / 2 : route.x * width,
      y:
        options.routeStyle === 'map'
          ? height * (options.mapPosition === 'top' ? 0.25 : 0.75)
          : Math.min(
              route.y * height + routeShift,
              height * (1 - route.height / 2)
            ),
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

const slug = (value: string | undefined) =>
  (value ?? '')
    .normalize('NFKD')
    // Letters with strokes do not decompose, so name them before stripping.
    .replace(/[đĐ]/g, 'd')
    .replace(/[łŁ]/g, 'l')
    .replace(/[øØ]/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');

/**
 * The name a shared photo carries into other apps:
 * `qla.fit-<workout>-<first name>-<YYYY-MM-DD>-<HHmm>.jpg`. Parts that are
 * missing or have no Latin letters left after folding accents are skipped, so
 * the name never shows an empty `--` slot. The capture time keeps two shares
 * from the same day apart in a camera roll or a chat.
 */
export function photoShareFileName({
  workout,
  user,
  capturedAt,
}: {
  workout?: string;
  user?: string;
  capturedAt: number;
}) {
  const date = new Date(capturedAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
    : '';
  return (
    ['qla.fit', slug(workout), slug(user?.trim().split(/\s+/)[0]), stamp]
      .filter(Boolean)
      .join('-') + '.jpg'
  );
}
