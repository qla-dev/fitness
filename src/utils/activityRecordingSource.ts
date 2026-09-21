import type { ActivityDetailResponse } from '@workspace/shared';

/**
 * Where a session's measurements were actually taken.
 *
 * `watch` and `phone` are worth telling apart because they are not the same
 * measurement: a watch is strapped to you and a phone may well have been in a
 * bag on the touchline, which is the difference between a route that is yours
 * and one that is the bench's. `app` is a session this app recorded itself,
 * `unknown` is one that never said.
 */
export type RecordingSource = 'watch' | 'phone' | 'app' | 'unknown';

/** Health-import detail rows carry the provider's raw record verbatim. */
const HEALTH_IMPORT = 'health_import';

interface RawDevice {
  name?: string;
  model?: string;
  manufacturer?: string;
}

/**
 * Classify a HealthKit device. Matched on `model` first — Apple sets it to the
 * bare product family ("Watch", "iPhone") while `name` is free text that a
 * third-party app can and does set to anything.
 */
const classifyDevice = (device: RawDevice | undefined): RecordingSource => {
  if (!device) return 'unknown';
  const haystack = `${device.model ?? ''} ${device.name ?? ''}`.toLowerCase();
  if (haystack.includes('watch')) return 'watch';
  if (haystack.includes('phone') || haystack.includes('ipad')) return 'phone';
  return 'unknown';
};

/**
 * The recording source for a session, from the details it was stored with.
 *
 * A session this app recorded is reported as `app` without inspecting any
 * device: it ran on this phone by definition, and saying "phone" would lose the
 * distinction the user cares about — whether the track is qla.fit's own or
 * something that arrived from Apple Health.
 */
export const resolveRecordingSource = (
  details: readonly ActivityDetailResponse[] | undefined,
  recordingDetailType: string
): RecordingSource => {
  if (!details || details.length === 0) return 'unknown';
  if (details.some((detail) => detail.detail_type === recordingDetailType)) {
    return 'app';
  }
  const imported = details.find(
    (detail) => detail.detail_type === HEALTH_IMPORT
  );
  if (!imported) return 'unknown';
  const raw = imported.detail_data as
    | { device?: RawDevice; sourceName?: string }
    | undefined;
  const fromDevice = classifyDevice(raw?.device);
  if (fromDevice !== 'unknown') return fromDevice;
  // No device on the record: some sources omit it entirely. The app name is a
  // weak second opinion, and only for the one case it actually settles.
  const sourceName = raw?.sourceName?.toLowerCase() ?? '';
  if (sourceName.includes('watch')) return 'watch';
  return 'unknown';
};

/** Whether a session carries a drawable track. */
export const hasRoute = (
  details: readonly ActivityDetailResponse[] | undefined,
  recordingDetailType: string
): boolean => {
  if (!details) return false;
  return details.some((detail) => {
    if (detail.detail_type === recordingDetailType) {
      const points = (detail.detail_data as { points?: unknown[] } | undefined)
        ?.points;
      return Array.isArray(points) && points.length > 1;
    }
    if (detail.detail_type === HEALTH_IMPORT) {
      const points = (
        detail.detail_data as { gps_points?: unknown[] } | undefined
      )?.gps_points;
      return Array.isArray(points) && points.length > 1;
    }
    return false;
  });
};
