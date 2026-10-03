import {
  _resetLogDatabaseForTesting,
  insertLogs,
  readLogs,
} from '../../src/services/logDatabase';
import type { LogEntry } from '../../src/services/LogService';

beforeEach(() => _resetLogDatabaseForTesting());

const entry = (n: number): LogEntry => ({
  timestamp: new Date(Date.UTC(2026, 9, 3, 0, 0, n)).toISOString(),
  status: 'INFO',
  message: `entry ${n}`,
  details: [String(n)],
});

it('keeps order and the newest rows across a multi-statement import', async () => {
  // Newest first, as the buffer holds them; more than one INSERT's worth.
  const entries = Array.from({ length: 450 }, (_, i) => entry(449 - i));
  await insertLogs(entries, 300);

  const rows = await readLogs(['INFO'], 0, 1000);
  expect(rows).toHaveLength(300);
  expect(rows[0].message).toBe('entry 449');
  expect(rows[299].message).toBe('entry 150');
  expect(rows[0].details).toEqual(['449']);
});
