import {
  changesSince,
  mergeResponse,
  type SyncTables,
} from '../../src/services/online/syncModel';
import { localApiFetch } from '../../src/services/local/localApi';
import { localTransaction, table } from '../../src/services/local/database';
import { logMarkaiFood } from '../../src/services/online/markai';

describe('online sync and MarkAI logging', () => {
  const remote: SyncTables = {
    foods: [
      {
        id: 'one',
        version: 2,
        data: { id: 'one', name: 'Rice' },
        deleted: false,
      },
    ],
  };
  it('detects deletions, edits and new records against the durable baseline', () => {
    expect(changesSince({ foods: [] }, remote)).toEqual([
      { collection: 'foods', id: 'one', base_version: 2, data: null },
    ]);
    expect(
      changesSince({ foods: [{ name: 'Rice', id: 'one' }] }, remote)
    ).toEqual([]);
    expect(
      changesSince({ foods: [{ id: 'one', name: 'Oats' }] }, remote)[0]
        .base_version
    ).toBe(2);
  });
  it('preserves changes made while a request was in flight', () => {
    const sent = { foods: [{ id: 'one', name: 'Old' }] };
    expect(
      mergeResponse(
        { foods: [{ id: 'one', name: 'Local edit' }] },
        sent,
        remote
      ).foods[0].name
    ).toBe('Local edit');
    expect(mergeResponse(sent, sent, remote).foods[0].name).toBe('Rice');
    expect(mergeResponse({ foods: [] }, sent, remote).foods).toEqual([]);
  });
  it('logs the same confirmed proposal only once', async () => {
    const meals = await localApiFetch<{ id: string }[]>({
      endpoint: '/api/meal-types',
    });
    const food = {
      name: 'Banana',
      serving: '1 medium',
      calories: 105,
      protein: 1,
      carbs: 27,
      fat: 0.4,
    };
    await Promise.all([
      logMarkaiFood('proposal-1', food, meals[0].id),
      logMarkaiFood('proposal-1', food, meals[0].id),
    ]);
    const rows = await localTransaction((db) => table(db, 'entries'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'proposal-1',
      food_name: 'Banana',
      calories: 105,
      quantity: 1,
    });
  });
});
