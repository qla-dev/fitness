import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createProgramAccess,
  readProgramAccess,
  readProgramPresetAccess,
  saveProgramAccess,
} from '../../src/services/programAccess';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('adds the program duration and five extra calendar days', () => {
  const start = new Date(2026, 8, 8, 12);
  const access = createProgramAccess('program', 4, start);
  expect(new Date(access.expiresAt)).toEqual(new Date(2026, 9, 11, 12));
  expect(access.startedAt).toBe(start.toISOString());
});

test('keeps separate purchase dates and isolates server scopes', async () => {
  const first = createProgramAccess('program', 4, new Date(2026, 8, 8));
  const second = createProgramAccess('program', 4, new Date(2026, 8, 10));
  await saveProgramAccess('local', 1, first);
  await saveProgramAccess('local', 2, second);
  expect(await readProgramAccess('local', 1)).toEqual(first);
  expect(await readProgramAccess('local', 2)).toEqual(second);
  expect(await readProgramAccess('other-server', 1)).toBeNull();
});

test('finds the installed weekly presets of one program in its scope', async () => {
  const glutes = createProgramAccess('glutes', 4, new Date(2026, 8, 8));
  const core = createProgramAccess('core', 4, new Date(2026, 8, 8));
  await saveProgramAccess('local', 11, glutes);
  await saveProgramAccess('local', 12, glutes);
  await saveProgramAccess('local', 13, core);
  await saveProgramAccess('server', 14, glutes);
  const found = await readProgramPresetAccess('local', 'glutes');
  expect(found.map((entry) => entry.presetId).sort()).toEqual([11, 12]);
  expect(found[0].access).toEqual(glutes);
});
