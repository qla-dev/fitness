import { localApiFetch } from '../../../src/services/local/localApi';
import {
  buildMarkaiContext,
  MARKAI_CONTEXT_MAX,
} from '../../../src/services/online/markaiContext';

it('summarises the on-device diary for MarkAI, one line per day', async () => {
  await localApiFetch({
    endpoint: '/api/measurements/check-in',
    method: 'POST',
    body: { entry_date: '2026-11-01', weight: 100 },
  });
  const context = await buildMarkaiContext('2026-11-03');
  const lines = context.split('\n');

  expect(lines[0]).toBe('Today is 2026-11-03.');
  expect(context).toContain('weight 100 kg (2026-11-01)');
  expect(context).toContain('Daily goals:');
  // Fourteen days, oldest first, ending today.
  const days = lines.filter((line) => /^\d{4}-\d{2}-\d{2}:/.test(line));
  expect(days).toHaveLength(14);
  expect(days[0].startsWith('2026-10-21:')).toBe(true);
  expect(days[13].startsWith('2026-11-03:')).toBe(true);
  expect(context.length).toBeLessThanOrEqual(MARKAI_CONTEXT_MAX);
});
