import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSetup, updateSetup } from '../../src/services/personalSetup';
import {
  localTransaction,
  saveRecord,
  table,
} from '../../src/services/local/database';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));

describe('personal setup storage', () => {
  it('reads a synced record with nulls and numbers instead of failing', async () => {
    await localTransaction(
      (db) => {
        saveRecord(db, 'personalSetup', {
          id: 'local',
          profile: { age: 30, weight: null, done: true, picks: ['a', 1, null] },
          profileDone: null,
          grocery: null,
          groceryDone: true,
        } as never);
        saveRecord(db, 'groceryLists', {
          id: 7,
          scope: 'local',
          position: 0,
          name: 'Shop',
          note: null,
          store: null,
          archived: null,
          createdAt: null,
          items: [{ id: 1, name: 'Eggs', quantity: null, checked: null, price: null }],
        } as never);
      },
      { method: 'PUT', endpoint: '/test' }
    );
    const state = await readSetup('local');
    expect(state.profile).toEqual({ age: '30', done: 'true', picks: ['a', '1'] });
    expect(state.profileDone).toBe(false);
    expect(state.grocery).toEqual({});
    expect(state.groceryDone).toBe(true);
    expect(state.lists[0]).toMatchObject({
      id: '7',
      note: '',
      store: '',
      archived: false,
      items: [{ id: '1', name: 'Eggs', quantity: '', checked: false }],
    });
    expect(state.lists[0].items[0].price).toBeUndefined();
  });

  it('remembers explicitly skipped questions after reloading', async () => {
    await updateSetup('local', (s) => ({
      ...s,
      profile: { age: '30', __skipped: ['weight', 'height'] },
    }));
    expect((await readSetup('local')).profile).toEqual({
      age: '30',
      __skipped: ['weight', 'height'],
    });
  });
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('serializes concurrent edits without losing either questionnaire', async () => {
    await Promise.all([
      updateSetup('local', (s) => ({
        ...s,
        profile: { age: '30' },
        profileDone: true,
      })),
      updateSetup('local', (s) => ({
        ...s,
        grocery: { appliances: ['oven'] },
        groceryDone: true,
      })),
    ]);
    expect(await readSetup('local')).toMatchObject({
      profile: { age: '30' },
      grocery: { appliances: ['oven'] },
      profileDone: true,
      groceryDone: true,
    });
  });

  it('isolates accounts and persists a skipped questionnaire', async () => {
    await updateSetup('one', (s) => ({ ...s, profileDone: true }));
    expect((await readSetup('one')).profileDone).toBe(true);
    expect((await readSetup('two')).profileDone).toBe(false);
  });

  it('keeps existing lists when preferences change', async () => {
    const list = {
      id: 'list-1',
      name: 'Weekend',
      note: 'Family',
      store: 'Market',
      archived: false,
      items: [{ id: 'item-1', name: 'Apples', quantity: '2', checked: true }],
      createdAt: '2026-09-10',
    };
    await updateSetup('local', (s) => ({ ...s, lists: [list] }));
    await updateSetup('local', (s) => ({ ...s, grocery: { budget: '50' } }));
    expect((await readSetup('local')).lists).toEqual([list]);
  });

  const list = (id: string, name = id) => ({
    id,
    name,
    note: '',
    store: '',
    archived: false,
    items: [],
    createdAt: '2026-11-01',
  });
  const rows = (name: string) =>
    localTransaction((db) => table(db, name).map((row) => ({ ...row })));

  it('keeps answers and lists in the synced tables, in order', async () => {
    await updateSetup('local', (s) => ({
      ...s,
      profileDone: true,
      lists: [list('b'), list('a')],
    }));
    expect(await rows('personalSetup')).toEqual([
      expect.objectContaining({ id: 'local', profileDone: true }),
    ]);
    expect((await rows('groceryLists')).map((r) => [r.id, r.position])).toEqual(
      [
        ['b', 0],
        ['a', 1],
      ]
    );
    expect((await readSetup('local')).lists.map((l) => l.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('deletes a removed list and leaves unchanged ones alone', async () => {
    await updateSetup('local', (s) => ({
      ...s,
      lists: [list('a'), list('b')],
    }));
    const before = (await rows('groceryLists')).find((r) => r.id === 'a');
    await updateSetup('local', (s) => ({ ...s, lists: [list('a')] }));
    const after = await rows('groceryLists');
    expect(after.map((r) => r.id)).toEqual(['a']);
    expect(after[0].updated_at).toBe(before?.updated_at);
  });

  it('moves the old AsyncStorage entry into the database once', async () => {
    await AsyncStorage.setItem(
      '@qla/personal-setup/v1/local',
      JSON.stringify({ profile: { age: '41' }, lists: [list('old')] })
    );
    const state = await readSetup('local');
    expect(state.profile).toEqual({ age: '41' });
    expect(state.lists.map((l) => l.id)).toEqual(['old']);
    expect(
      await AsyncStorage.getItem('@qla/personal-setup/v1/local')
    ).toBeNull();
    expect((await rows('groceryLists')).map((r) => r.id)).toEqual(['old']);
  });

  it('keeps lists another device synced when migrating', async () => {
    await updateSetup('local', (s) => ({
      ...s,
      profile: { age: '30' },
      lists: [list('synced')],
    }));
    await AsyncStorage.setItem(
      '@qla/personal-setup/v1/local',
      JSON.stringify({ profile: { age: '99' }, lists: [list('old')] })
    );
    const state = await readSetup('local');
    expect(state.profile).toEqual({ age: '30' });
    expect(state.lists.map((l) => l.id)).toEqual(['synced', 'old']);
  });
});
