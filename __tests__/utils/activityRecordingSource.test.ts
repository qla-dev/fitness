import {
  hasRoute,
  resolveRecordingSource,
} from '../../src/utils/activityRecordingSource';

const RECORDING = 'qla_recording';

const healthImport = (detail_data: unknown) => ({
  id: 'd1',
  provider_name: 'HealthKit',
  detail_type: 'health_import',
  detail_data,
});

const appRecording = (points: unknown[]) => ({
  id: 'd2',
  provider_name: 'qla.fit',
  detail_type: RECORDING,
  detail_data: { points },
});

/**
 * Where a session's numbers came from.
 *
 * Worth its own suite because the answer qualifies everything else on the
 * detail screen: a route from a watch on your wrist and one from a phone left
 * in a bag are not the same measurement, and the app can only say so if the
 * read layer forwarded the device — which for workouts it did not, until it
 * was added alongside the source bundle id.
 */
describe('resolveRecordingSource', () => {
  it('recognizes a standalone watch recording without device or heart-rate data', () => {
    expect(
      resolveRecordingSource(
        [
          healthImport({
            metadata: { QlaFitWatchOrigin: 'watch' },
            sourceName: 'qla.fit',
          }),
        ],
        RECORDING
      )
    ).toBe('watch');
    expect(
      resolveRecordingSource(
        [
          healthImport({
            metadata: { QlaFitWatchOrigin: 'phone' },
            sourceName: 'qla.fit',
          }),
        ],
        RECORDING
      )
    ).toBe('unknown');
  });
  it('reads Apple Watch off the imported record', () => {
    expect(
      resolveRecordingSource(
        [healthImport({ device: { model: 'Watch', name: 'Apple Watch' } })],
        RECORDING
      )
    ).toBe('watch');
  });

  it('reads a phone off the imported record', () => {
    expect(
      resolveRecordingSource(
        [healthImport({ device: { model: 'iPhone', name: 'iPhone' } })],
        RECORDING
      )
    ).toBe('phone');
  });

  it('prefers the app’s own recording over any device on the session', () => {
    // "app" is a different answer from "phone" on purpose: the user is being
    // told whether the track is qla.fit's own or something that arrived from
    // Apple Health, not which slab of glass it touched.
    expect(
      resolveRecordingSource(
        [appRecording([{}, {}]), healthImport({ device: { model: 'iPhone' } })],
        RECORDING
      )
    ).toBe('app');
  });

  it('falls back to the source app name only when it settles the question', () => {
    expect(
      resolveRecordingSource(
        [healthImport({ sourceName: 'Workout — Apple Watch' })],
        RECORDING
      )
    ).toBe('watch');
    expect(
      resolveRecordingSource(
        [healthImport({ sourceName: 'Strava' })],
        RECORDING
      )
    ).toBe('unknown');
  });

  it('says unknown rather than guessing', () => {
    expect(resolveRecordingSource(undefined, RECORDING)).toBe('unknown');
    expect(resolveRecordingSource([], RECORDING)).toBe('unknown');
    expect(resolveRecordingSource([healthImport({})], RECORDING)).toBe(
      'unknown'
    );
  });
});

describe('hasRoute', () => {
  it('finds a track on either an app recording or an imported workout', () => {
    expect(hasRoute([appRecording([{}, {}])], RECORDING)).toBe(true);
    expect(
      hasRoute([healthImport({ gps_points: [{}, {}, {}] })], RECORDING)
    ).toBe(true);
  });

  it('does not count a single point as a track', () => {
    // One fix is a location, not a route, and drawing it would be a dot.
    expect(hasRoute([appRecording([{}])], RECORDING)).toBe(false);
    expect(hasRoute([healthImport({ gps_points: [{}] })], RECORDING)).toBe(
      false
    );
  });

  it('is false when the session carries no details at all', () => {
    expect(hasRoute(undefined, RECORDING)).toBe(false);
    expect(hasRoute([healthImport({})], RECORDING)).toBe(false);
  });
});
