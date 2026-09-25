import { isDayString } from '@workspace/shared';
import {
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';

/** The receipt and mutation commit together, so retrying a lost reply cannot add water twice. */
export function saveWatchMeasurement(db: LocalDatabase, body: LocalRecord) {
  const { entryId, kind, value, date } = body;
  if (
    typeof entryId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(entryId) ||
    typeof date !== 'string' ||
    !isDayString(date) ||
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    (kind !== 'water' && kind !== 'weight') ||
    value > (kind === 'water' ? 2000 : 300)
  ) {
    throw new Error('Invalid watch measurement');
  }
  const receipt = table(db, 'watchMeasurementReceipts').find(
    (row) => row.id === entryId
  );
  if (receipt) {
    if (
      receipt.kind !== kind ||
      receipt.value !== value ||
      receipt.date !== date
    )
      throw new Error('Watch entry identity reused');
    return receipt;
  }
  const name = kind === 'water' ? 'water' : 'measurements';
  const existing = table(db, name).find((row) => row.entry_date === date);
  saveRecord(
    db,
    name,
    {
      entry_date: date,
      ...(kind === 'water'
        ? { water_ml: Number(existing?.water_ml ?? 0) + value }
        : { weight: value }),
    },
    existing?.id
  );
  return saveRecord(db, 'watchMeasurementReceipts', {
    id: entryId,
    kind,
    value,
    date,
  });
}
