import {
  distanceMeters,
  elapsedSeconds,
  RecordingGpsFilter,
  recordingCalories,
  recordingSplits,
  summarizeSensors,
  type GpsFix,
} from '../../../src/services/recording/metrics';
import type {
  RecordedPoint,
  RecordingSession,
  SensorReading,
} from '../../../src/services/recording/types';

const fix = (over: Partial<GpsFix> & Pick<GpsFix, 'timestamp'>): GpsFix => ({
  latitude: 45,
  longitude: 6,
  accuracy: 5,
  altitude: null,
  altitudeAccuracy: null,
  speed: null,
  ...over,
});

// Degrees of latitude per metre, for building fixtures that move a known distance.
const METRE_LAT = 1 / 111_320;

describe('distanceMeters', () => {
  it('measures a known separation', () => {
    expect(
      distanceMeters(
        { latitude: 45, longitude: 6 },
        { latitude: 45.001, longitude: 6 }
      )
    ).toBeCloseTo(111.2, 0);
  });

  it('measures across the antimeridian without circling the globe', () => {
    expect(
      distanceMeters(
        { latitude: 0, longitude: 179.999 },
        { latitude: 0, longitude: -179.999 }
      )
    ).toBeLessThan(500);
  });
});

describe('RecordingGpsFilter', () => {
  it('rejects a fix too imprecise to use', () => {
    const filter = new RecordingGpsFilter('run');
    expect(filter.process(fix({ timestamp: 1000, accuracy: 80 }))).toBeNull();
  });

  it('rejects a teleport faster than the sport allows', () => {
    const filter = new RecordingGpsFilter('run');
    expect(filter.process(fix({ timestamp: 1000 }))).not.toBeNull();
    // ~1 km in one second.
    expect(
      filter.process(fix({ timestamp: 2000, latitude: 45.009 }))
    ).toBeNull();
  });

  it('accepts for a ride what it rejects for a run', () => {
    // 20 m/s: over a runner's cap, ordinary on a bike.
    const move = { timestamp: 2000, latitude: 45 + METRE_LAT * 20 };
    const run = new RecordingGpsFilter('run');
    run.process(fix({ timestamp: 1000 }));
    expect(run.process(fix(move))).toBeNull();
    const ride = new RecordingGpsFilter('ride');
    ride.process(fix({ timestamp: 1000 }));
    expect(ride.process(fix(move))).not.toBeNull();
  });

  it('rejects a fix that does not advance the clock', () => {
    const filter = new RecordingGpsFilter('run');
    filter.process(fix({ timestamp: 2000 }));
    expect(filter.process(fix({ timestamp: 2000 }))).toBeNull();
    expect(filter.process(fix({ timestamp: 1000 }))).toBeNull();
  });

  it('credits no distance while standing still', () => {
    const filter = new RecordingGpsFilter('run');
    let total = 0;
    // Ten seconds of GPS drift within the accuracy radius, Doppler at rest.
    for (let i = 0; i < 10; i++) {
      const result = filter.process(
        fix({
          timestamp: 1000 + i * 1000,
          latitude: 45 + (i % 2 ? METRE_LAT * 2 : 0),
          speed: 0.1,
        })
      );
      total += result?.distance ?? 0;
    }
    expect(total).toBe(0);
  });

  it('credits distance once past the anchor threshold', () => {
    const filter = new RecordingGpsFilter('run');
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const result = filter.process(
        fix({
          timestamp: 1000 + i * 1000,
          latitude: 45 + METRE_LAT * 4 * i,
          speed: 4,
        })
      );
      total += result?.distance ?? 0;
    }
    // Nine 4 m steps, credited in whole anchor hops.
    expect(total).toBeGreaterThan(30);
    expect(total).toBeLessThanOrEqual(36);
  });

  it('does not bridge a signal gap into one long straight line', () => {
    const filter = new RecordingGpsFilter('ride');
    filter.process(fix({ timestamp: 1000, speed: 8 }));
    const after = filter.process(
      fix({ timestamp: 1000 + 120_000, latitude: 45.05, speed: 8 })
    );
    expect(after?.gap).toBe(true);
    expect(after?.distance).toBe(0);
  });

  it('ignores vertical noise below the hysteresis and credits a real climb', () => {
    const filter = new RecordingGpsFilter('ride');
    let gain = 0;
    const climb = (timestamp: number, altitude: number) => {
      gain +=
        filter.process(
          fix({ timestamp, altitude, altitudeAccuracy: 5, speed: 5 })
        )?.elevation ?? 0;
    };
    // Vertical noise smaller than the 5 m hysteresis band must not accumulate.
    // NOTE: this holds only below the band. An oscillation whose peak-to-peak
    // amplitude reaches 5 m ratchets instead - see the elevation finding.
    for (let i = 0; i < 12; i++) climb(1000 + i * 1000, 100 + (i % 2 ? 2 : -2));
    expect(gain).toBe(0);
    // A sustained 30 m climb.
    for (let i = 0; i < 12; i++) climb(20_000 + i * 1000, 100 + i * 3);
    expect(gain).toBeGreaterThan(20);
    expect(gain).toBeLessThanOrEqual(30);
  });

  it('ignores altitude the chip reports as unreliable', () => {
    const filter = new RecordingGpsFilter('ride');
    const result = filter.process(
      fix({ timestamp: 1000, altitude: 100, altitudeAccuracy: 40 })
    );
    expect(result?.altitude).toBeNull();
  });
});

describe('elapsedSeconds', () => {
  const session = {
    elapsed: 100,
    runningSince: null,
  } as unknown as RecordingSession;

  it('holds steady while paused', () => {
    expect(elapsedSeconds(session, 999_999)).toBe(100);
  });

  it('adds only the running segment', () => {
    expect(elapsedSeconds({ ...session, runningSince: 5_000 }, 15_000)).toBe(
      110
    );
  });

  it('never runs backwards on a clock that jumped', () => {
    expect(elapsedSeconds({ ...session, runningSince: 20_000 }, 10_000)).toBe(
      100
    );
  });
});

describe('recordingSplits', () => {
  it('interpolates each boundary between the surrounding samples', () => {
    const points = [
      { distance: 0, elapsed: 0 },
      { distance: 500, elapsed: 150 },
      { distance: 2000, elapsed: 600 },
    ] as RecordedPoint[];
    const splits = recordingSplits(points, 1000);
    expect(splits).toHaveLength(2);
    expect(splits[0].distance).toBe(1000);
    expect(splits[0].seconds).toBeCloseTo(300, 5);
    expect(splits[1].seconds).toBeCloseTo(300, 5);
  });

  it('emits every boundary a single long sample crosses', () => {
    const points = [
      { distance: 0, elapsed: 0 },
      { distance: 3000, elapsed: 900 },
    ] as RecordedPoint[];
    expect(recordingSplits(points, 1000).map((s) => s.distance)).toEqual([
      1000, 2000, 3000,
    ]);
  });
});

describe('summarizeSensors', () => {
  it('averages only the samples that carried a reading', () => {
    const samples = [
      { heartRate: 100, cadence: null },
      { heartRate: null, cadence: 80 },
      { heartRate: 140, cadence: 90 },
    ] as SensorReading[];
    expect(summarizeSensors(samples)).toEqual({
      avgHeartRate: 120,
      maxHeartRate: 140,
      avgCadence: 85,
    });
  });

  it('reports nothing rather than zero when no sensor was connected', () => {
    expect(summarizeSensors([])).toEqual({
      avgHeartRate: null,
      maxHeartRate: null,
      avgCadence: null,
    });
  });
});

describe('recordingCalories', () => {
  it('scales a run by body mass and distance', () => {
    expect(
      recordingCalories({ sport: 'run', weightKg: 70, distance: 10_000 }, 3600)
    ).toBe(700);
  });

  it('puts a ride in a higher MET band as it gets faster', () => {
    const slow = recordingCalories(
      { sport: 'ride', weightKg: 70, distance: 15_000 },
      3600
    );
    const fast = recordingCalories(
      { sport: 'ride', weightKg: 70, distance: 30_000 },
      3600
    );
    expect(fast).toBeGreaterThan(slow);
  });

  it('does not divide by a zero duration', () => {
    expect(
      recordingCalories({ sport: 'ride', weightKg: 70, distance: 0 }, 0)
    ).toBe(0);
  });
});
