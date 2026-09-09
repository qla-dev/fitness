export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
export const CSC_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
export const CSC_MEASUREMENT = '00002a5b-0000-1000-8000-00805f9b34fb';

function bytes(value: string): DataView | null {
  try {
    const decoded = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return new DataView(decoded.buffer);
  } catch {
    return null;
  }
}

export function parseHeartRate(value: string): number | null {
  const data = bytes(value);
  if (!data || data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  if (flags & 4 && !(flags & 2)) return null; // sensor reports no skin contact
  if (flags & 1 && data.byteLength < 3) return null;
  const hr = flags & 1 ? data.getUint16(1, true) : data.getUint8(1);
  return hr > 0 && hr <= 255 ? hr : null;
}

export interface CscCounters {
  wheel: number | null;
  wheelTime: number | null;
  crank: number | null;
  crankTime: number | null;
}
export function parseCsc(value: string): CscCounters | null {
  const data = bytes(value);
  if (!data || data.byteLength < 1) return null;
  const flags = data.getUint8(0);
  const size = 1 + (flags & 1 ? 6 : 0) + (flags & 2 ? 4 : 0);
  if (!(flags & 3) || data.byteLength < size) return null;
  let offset = 1;
  const out: CscCounters = {
    wheel: null,
    wheelTime: null,
    crank: null,
    crankTime: null,
  };
  if (flags & 1) {
    out.wheel = data.getUint32(offset, true);
    out.wheelTime = data.getUint16(offset + 4, true);
    offset += 6;
  }
  if (flags & 2) {
    out.crank = data.getUint16(offset, true);
    out.crankTime = data.getUint16(offset + 2, true);
  }
  return out;
}

const delta = (a: number, b: number, modulus: number) =>
  (a - b + modulus) % modulus;
export function cscDelta(
  previous: CscCounters,
  next: CscCounters,
  circumferenceMm: number
) {
  let speed: number | null = null,
    cadence: number | null = null,
    wheelDistance: number | null = null;
  if (
    next.wheel !== null &&
    previous.wheel !== null &&
    next.wheelTime !== null &&
    previous.wheelTime !== null
  ) {
    const revs = delta(next.wheel, previous.wheel, 2 ** 32);
    const dt = delta(next.wheelTime, previous.wheelTime, 65536) / 1024;
    const distance = (revs * circumferenceMm) / 1000;
    if (revs === 0) {
      speed = 0;
      wheelDistance = 0;
    } else if (dt > 0 && distance / dt <= 40) {
      speed = distance / dt;
      wheelDistance = distance;
    }
  }
  if (
    next.crank !== null &&
    previous.crank !== null &&
    next.crankTime !== null &&
    previous.crankTime !== null
  ) {
    const revs = delta(next.crank, previous.crank, 65536);
    const dt = delta(next.crankTime, previous.crankTime, 65536) / 1024;
    if (revs === 0) cadence = 0;
    else if (dt > 0 && (revs / dt) * 60 <= 250) cadence = (revs / dt) * 60;
  }
  return { speed, cadence, wheelDistance };
}
