import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSetup, updateSetup } from '../../src/services/personalSetup';

jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));

describe('personal setup storage', () => {
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
});
