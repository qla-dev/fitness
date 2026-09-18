import { formatLocalizedNumber } from '../localization';

/** Below this, a count is written out in full. */
const COMPACT_FROM = 1000;

/**
 * A count for a space that cannot grow: full below a thousand, and `1.1k`
 * above it.
 *
 * The step tile prints a value and its goal side by side, so at five digits
 * each the pair either wrapped or shrank the type. Compacting only above a
 * thousand keeps the exact figure wherever it fits, which is every count that
 * is not a step count.
 *
 * One decimal, and a trailing `.0` is dropped: `1k`, not `1.0k`.
 */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return formatLocalizedNumber(0);
  const magnitude = Math.abs(value);
  if (magnitude < COMPACT_FROM)
    return formatLocalizedNumber(value, { maximumFractionDigits: 0 });

  const thousands = value / COMPACT_FROM;
  // Truncated rather than rounded: 1 999 reads as 1.9k, never as 2k, so the
  // number shown is never larger than the number recorded.
  const truncated = Math.trunc(thousands * 10) / 10;
  return `${formatLocalizedNumber(truncated, { maximumFractionDigits: 1 })}k`;
}
