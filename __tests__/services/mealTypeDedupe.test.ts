import { dedupeMealTypes } from '../../src/services/local/mealTypeDedupe';

const type = (id: string, name: string, created_at: string) => ({
  id,
  name,
  created_at,
  sort_order: 0,
  is_visible: true,
});

describe('dedupeMealTypes', () => {
  it('keeps the oldest of each name and repoints everything at it', () => {
    const tables = {
      mealTypes: [
        type('local-b', 'Breakfast', '2026-10-31T10:00:00Z'),
        type('remote-b', 'Breakfast', '2026-10-01T10:00:00Z'),
        type('local-l', 'Lunch', '2026-10-31T10:00:00Z'),
        type('remote-l', 'lunch ', '2026-10-01T10:00:00Z'),
        type('custom', 'Pre-workout', '2026-10-15T10:00:00Z'),
      ],
      entries: [
        { id: 'e1', meal_type_id: 'local-b' },
        { id: 'e2', meal_type_id: 'remote-l' },
        { id: 'e3', meal_type_id: 'custom' },
      ],
      mealPlans: [
        {
          id: 'p1',
          assignments: [{ id: 'a1', meal_type_id: 'local-l' }],
        },
      ],
    };

    expect(dedupeMealTypes(tables)).toBe(true);
    expect(tables.mealTypes.map((t) => t.id)).toEqual([
      'remote-b',
      'remote-l',
      'custom',
    ]);
    expect(tables.entries.map((e) => e.meal_type_id)).toEqual([
      'remote-b',
      'remote-l',
      'custom',
    ]);
    expect(tables.mealPlans[0].assignments[0].meal_type_id).toBe('remote-l');
  });

  it('leaves the tables untouched when every name is unique', () => {
    const entries = [{ id: 'e1', meal_type_id: 'b' }];
    const tables = {
      mealTypes: [
        type('b', 'Breakfast', '2026-10-01T10:00:00Z'),
        type('l', 'Lunch', '2026-10-01T10:00:00Z'),
      ],
      entries,
    };
    expect(dedupeMealTypes(tables)).toBe(false);
    expect(tables.entries).toBe(entries);
  });
});
