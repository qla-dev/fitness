import { formatLocalizedNumber } from '../../localization';
import type { RecordedPoint } from '../../services/recording/types';

export function recordingClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const remainder = total % 60;
  const part = (n: number) =>
    formatLocalizedNumber(n, { minimumIntegerDigits: 2, useGrouping: false });
  return hours
    ? `${part(hours)}:${part(minutes)}:${part(remainder)}`
    : `${part(minutes)}:${part(remainder)}`;
}

export function routeSegments(points: RecordedPoint[]) {
  const segments: RecordedPoint[][] = [];
  for (const point of points) {
    const last = segments[segments.length - 1];
    if (!last || last[0].segment !== point.segment) segments.push([point]);
    else last.push(point);
  }
  return segments;
}
