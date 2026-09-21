import type { TFunction } from 'i18next';
import type { ExerciseSessionResponse } from '@workspace/shared';
import { resolveActivityKind } from '../services/shared/writebackActivityTypes';

/**
 * One extra block the activity detail screen renders under the standard stats.
 *
 * Declared as data rather than branched on inside the detail screen: that
 * screen is already ~900 lines of editing state, and adding "if football" to it
 * would grow a second axis through all of it. A block names its kind and hands
 * over only the numbers; the screen owns how each kind draws.
 */
export type ActivityExtraBlock =
  | {
      kind: 'metrics';
      titleKey: string;
      defaultTitle: string;
      items: { label: string; value: string }[];
    }
  | {
      kind: 'heatmap';
      titleKey: string;
      defaultTitle: string;
      /** Row-major occupancy grid, 0..1, drawn over a pitch. */
      grid: number[][];
    }
  | {
      kind: 'shooting';
      titleKey: string;
      defaultTitle: string;
      made: number;
      attempted: number;
      /** Per-zone split; `zone` is already localized by the builder. */
      zones: { zone: string; made: number; attempted: number }[];
    };

/**
 * Placeholder figures, clearly marked.
 *
 * Neither football nor basketball carries per-sport telemetry yet — no provider
 * the app reads records shot attempts or pitch occupancy — so these blocks
 * exist to settle the SHAPE of the extension point while the real sources are
 * worked out. They are deterministic rather than random so a screenshot is
 * reproducible, and every builder below is a pure function of the session, so
 * swapping in real data means changing only the builder.
 */
const PLACEHOLDER = true;

/** Deterministic 0..1 value from a seed, so the grid is stable per session. */
const pseudo = (seed: number, index: number): number => {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return Math.abs(x - Math.floor(x));
};

const seedOf = (session: ExerciseSessionResponse): number => {
  let hash = 0;
  const id = String(session.id ?? '');
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
};

const buildHeatmap = (session: ExerciseSessionResponse): ActivityExtraBlock => {
  const seed = seedOf(session);
  const rows = 6;
  const cols = 9;
  const grid: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < cols; c += 1) {
      // Weighted toward the middle third, which is where a field player spends
      // most of a match — a flat random grid reads as noise, not a heatmap.
      const centreBias = 1 - Math.abs(c - (cols - 1) / 2) / ((cols - 1) / 2);
      row.push(Math.min(1, pseudo(seed, r * cols + c) * 0.6 + centreBias * 0.5));
    }
    grid.push(row);
  }
  return {
    kind: 'heatmap',
    titleKey: 'activityExtras.heatmap',
    defaultTitle: 'Position heatmap',
    grid,
  };
};

const buildSprints = (
  session: ExerciseSessionResponse,
  t: TFunction
): ActivityExtraBlock => {
  const seed = seedOf(session);
  const sprints = 8 + Math.round(pseudo(seed, 1) * 12);
  const topSpeed = 22 + pseudo(seed, 2) * 8;
  const avgSpeed = 6 + pseudo(seed, 3) * 3;
  const distanceM = Math.round(120 + pseudo(seed, 4) * 400);
  return {
    kind: 'metrics',
    titleKey: 'activityExtras.sprints',
    defaultTitle: 'Sprints & speed',
    items: [
      {
        label: t('activityExtras.sprintCount', { defaultValue: 'Sprints' }),
        value: String(sprints),
      },
      {
        label: t('activityExtras.topSpeed', { defaultValue: 'Top speed' }),
        value: `${topSpeed.toFixed(1)} km/h`,
      },
      {
        label: t('activityExtras.avgSpeed', { defaultValue: 'Average speed' }),
        value: `${avgSpeed.toFixed(1)} km/h`,
      },
      {
        label: t('activityExtras.sprintDistance', {
          defaultValue: 'Sprint distance',
        }),
        value: `${distanceM} m`,
      },
    ],
  };
};

const buildShooting = (
  session: ExerciseSessionResponse,
  t: TFunction
): ActivityExtraBlock => {
  const seed = seedOf(session);
  const zone = (index: number, label: string, cap: number) => {
    const attempted = 2 + Math.round(pseudo(seed, index) * cap);
    const made = Math.round(attempted * (0.3 + pseudo(seed, index + 20) * 0.45));
    return { zone: label, made, attempted };
  };
  const zones = [
    zone(5, t('activityExtras.zonePaint', { defaultValue: 'Paint' }), 10),
    zone(6, t('activityExtras.zoneMid', { defaultValue: 'Mid-range' }), 8),
    zone(7, t('activityExtras.zoneThree', { defaultValue: 'Three' }), 9),
    zone(8, t('activityExtras.zoneFree', { defaultValue: 'Free throws' }), 6),
  ];
  return {
    kind: 'shooting',
    titleKey: 'activityExtras.shooting',
    defaultTitle: 'Shooting',
    made: zones.reduce((sum, z) => sum + z.made, 0),
    attempted: zones.reduce((sum, z) => sum + z.attempted, 0),
    zones,
  };
};

/**
 * The extra blocks a session earns, by what kind of activity it was.
 *
 * Keyed off the same `resolveActivityKind` writeback uses, so "Nogomet na
 * otvorenom", "Football" and "soccer" all land on the same content instead of
 * each needing its own entry here.
 */
export const activityExtras = (
  session: ExerciseSessionResponse,
  t: TFunction,
  name: string,
  category?: string | null
): ActivityExtraBlock[] => {
  if (!PLACEHOLDER) return [];
  const kind = resolveActivityKind(name, category);
  switch (kind) {
    case 'other':
      // Football and basketball are not in the writeback vocabulary, which only
      // carries kinds both health stores model. Fall through to a name match so
      // this file does not have to wait on that list growing.
      break;
    default:
      return [];
  }
  const normalized = name.trim().toLowerCase();
  if (
    normalized.includes('football') ||
    normalized.includes('soccer') ||
    normalized.includes('nogomet')
  ) {
    return [buildHeatmap(session), buildSprints(session, t)];
  }
  if (
    normalized.includes('basketball') ||
    normalized.includes('košarka') ||
    normalized.includes('kosarka')
  ) {
    return [buildShooting(session, t)];
  }
  return [];
};
