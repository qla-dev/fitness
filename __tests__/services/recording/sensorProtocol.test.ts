import {
  cscDelta,
  parseCsc,
  parseHeartRate,
  type CscCounters,
} from '../../../src/services/recording/sensorProtocol';

const frame = (...bytes: number[]) =>
  Buffer.from(Uint8Array.from(bytes)).toString('base64');

describe('parseHeartRate', () => {
  it('reads an 8-bit measurement', () => {
    expect(parseHeartRate(frame(0x00, 72))).toBe(72);
  });

  it('reads a 16-bit measurement little-endian', () => {
    expect(parseHeartRate(frame(0x01, 0xc8, 0x00))).toBe(200);
  });

  it('rejects a 16-bit reading outside any human range', () => {
    // 300 bpm decodes cleanly but is sensor noise, not a heart rate.
    expect(parseHeartRate(frame(0x01, 0x2c, 0x01))).toBeNull();
  });

  it('rejects a 16-bit frame truncated to one value byte', () => {
    // Reading data[1] alone would report 44 bpm from a 300 bpm frame.
    expect(parseHeartRate(frame(0x01, 0x2c))).toBeNull();
  });

  it('rejects a reading the strap reports as off-skin', () => {
    // Contact supported (bit 2) but not detected (bit 1).
    expect(parseHeartRate(frame(0x04, 60))).toBeNull();
  });

  it('keeps a reading when contact is supported and detected', () => {
    expect(parseHeartRate(frame(0x06, 60))).toBe(60);
  });

  it('rejects a zero reading rather than averaging it in', () => {
    expect(parseHeartRate(frame(0x00, 0))).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseHeartRate('not base64 @@@')).toBeNull();
    expect(parseHeartRate(frame(0x00))).toBeNull();
  });
});

describe('parseCsc', () => {
  it('decodes wheel-only data', () => {
    // flags=1, wheelRevs=2 (uint32 LE), wheelTime=1024 (uint16 LE)
    expect(parseCsc(frame(0x01, 2, 0, 0, 0, 0x00, 0x04))).toEqual({
      wheel: 2,
      wheelTime: 1024,
      crank: null,
      crankTime: null,
    });
  });

  it('decodes crank-only data at the right offset', () => {
    expect(parseCsc(frame(0x02, 5, 0, 0x00, 0x04))).toEqual({
      wheel: null,
      wheelTime: null,
      crank: 5,
      crankTime: 1024,
    });
  });

  it('decodes a combined frame', () => {
    const value = parseCsc(
      frame(0x03, 2, 0, 0, 0, 0x00, 0x04, 5, 0, 0x00, 0x08)
    );
    expect(value).toEqual({
      wheel: 2,
      wheelTime: 1024,
      crank: 5,
      crankTime: 2048,
    });
  });

  it('rejects a frame shorter than its own flags promise', () => {
    expect(parseCsc(frame(0x01, 2, 0, 0))).toBeNull();
    expect(parseCsc(frame(0x00))).toBeNull();
  });
});

describe('cscDelta', () => {
  const counters = (c: Partial<CscCounters>): CscCounters => ({
    wheel: null,
    wheelTime: null,
    crank: null,
    crankTime: null,
    ...c,
  });

  it('derives speed and distance from wheel revolutions', () => {
    // One revolution of a 2105 mm wheel in exactly one second.
    const result = cscDelta(
      counters({ wheel: 10, wheelTime: 0 }),
      counters({ wheel: 11, wheelTime: 1024 }),
      2105
    );
    expect(result.wheelDistance).toBeCloseTo(2.105, 3);
    expect(result.speed).toBeCloseTo(2.105, 3);
  });

  it('treats a wrapped wheel timestamp as elapsed time, not a rewind', () => {
    // uint16 in 1/1024 s wraps every 64 s; a naive subtraction goes negative.
    const result = cscDelta(
      counters({ wheel: 10, wheelTime: 65024 }),
      counters({ wheel: 11, wheelTime: 512 }),
      2105
    );
    expect(result.speed).toBeCloseTo(2.105, 3);
  });

  it('reports a standstill as zero rather than unknown', () => {
    const result = cscDelta(
      counters({ wheel: 10, wheelTime: 0, crank: 4, crankTime: 0 }),
      counters({ wheel: 10, wheelTime: 1024, crank: 4, crankTime: 1024 }),
      2105
    );
    expect(result.speed).toBe(0);
    expect(result.wheelDistance).toBe(0);
    expect(result.cadence).toBe(0);
  });

  it('drops an implausible speed instead of crediting the distance', () => {
    // 100 revolutions in one tick would read as ~215 m/s.
    const result = cscDelta(
      counters({ wheel: 10, wheelTime: 0 }),
      counters({ wheel: 110, wheelTime: 1024 }),
      2105
    );
    expect(result.speed).toBeNull();
    expect(result.wheelDistance).toBeNull();
  });

  it('derives cadence in rpm and rejects an implausible one', () => {
    expect(
      cscDelta(
        counters({ crank: 0, crankTime: 0 }),
        counters({ crank: 1, crankTime: 1024 }),
        2105
      ).cadence
    ).toBeCloseTo(60, 6);
    expect(
      cscDelta(
        counters({ crank: 0, crankTime: 0 }),
        counters({ crank: 10, crankTime: 1024 }),
        2105
      ).cadence
    ).toBeNull();
  });

  it('yields nothing when a counter is missing on either side', () => {
    expect(
      cscDelta(
        counters({ wheel: 10, wheelTime: 0 }),
        counters({ crank: 1, crankTime: 1024 }),
        2105
      )
    ).toEqual({ speed: null, cadence: null, wheelDistance: null });
  });
});
