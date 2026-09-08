import {
  installProgramAsPresets,
  parseProgramReps,
} from '../../src/services/programToPresets';
import { fetchExercisesPage } from '../../src/services/api/exerciseApi';
import {
  importExercise,
  searchExternalExercises,
} from '../../src/services/api/externalExerciseSearchApi';
import { createWorkoutPreset } from '../../src/services/api/workoutPresetsApi';
import type { ExerciseProgram } from '../../src/types/exerciseProgram';
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));

jest.mock('../../src/services/api/exerciseApi', () => ({
  fetchExercisesPage: jest.fn(),
}));
jest.mock('../../src/services/api/externalExerciseSearchApi', () => ({
  searchExternalExercises: jest.fn(),
  importExercise: jest.fn(),
}));
jest.mock('../../src/services/api/workoutPresetsApi', () => ({
  createWorkoutPreset: jest.fn(),
}));

const mockFetchPage = fetchExercisesPage as jest.Mock;
const mockSearchExternal = searchExternalExercises as jest.Mock;
const mockImport = importExercise as jest.Mock;
const mockCreate = createWorkoutPreset as jest.Mock;

const program = {
  id: 'p1',
  name: 'Test Program',
  tagline: 'A tagline',
  coach: 'Coach',
  category: 'glutes',
  level: 'intermediate',
  weeks: 4,
  daysPerWeek: 2,
  minutesPerSession: 40,
  rating: 4.5,
  ratingCount: 10,
  accentVar: '--color-cat-pink',
  icon: 'exercise-weights',
  summary: 'Summary',
  highlights: ['One'],
  sessions: [
    {
      day: 1,
      name: 'Day One',
      focus: 'Hips',
      minutes: 40,
      exercises: [
        { name: 'Barbell Hip Thrust', sets: 3, reps: '8-10', restSec: 120 },
        { name: 'Unknown Movement', sets: 2, reps: 'AMRAP', restSec: 60 },
      ],
    },
  ],
  nutrition: {
    headline: 'Eat',
    calories: '+250 kcal',
    proteinPerKg: 1.8,
    carbs: '4 g/kg',
    fat: '1 g/kg',
    tips: ['Tip'],
  },
} as unknown as ExerciseProgram;

const emptyPage = {
  exercises: [],
  pagination: { page: 1, pageSize: 10, totalCount: 0, hasMore: false },
};

describe('parseProgramReps', () => {
  it('takes the lower bound of a range and ignores non-numeric prescriptions', () => {
    expect(parseProgramReps('8-10')).toBe(8);
    expect(parseProgramReps('12')).toBe(12);
    expect(parseProgramReps('10 each leg')).toBe(10);
    // A hold or an open-ended set has no rep count to store.
    expect(parseProgramReps('AMRAP')).toBeNull();
    expect(parseProgramReps('45 s')).toBe(45);
  });
});

describe('installProgramAsPresets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one preset per session and skips movements nothing matches', async () => {
    mockFetchPage.mockImplementation(
      ({ searchTerm }: { searchTerm: string }) =>
        searchTerm === 'Barbell Hip Thrust'
          ? Promise.resolve({
              exercises: [{ id: 'ex-1', name: 'Barbell Hip Thrust' }],
              pagination: {
                page: 1,
                pageSize: 10,
                totalCount: 1,
                hasMore: false,
              },
            })
          : Promise.resolve(emptyPage)
    );
    mockSearchExternal.mockResolvedValue({ items: [] });
    mockCreate.mockResolvedValue({ id: 1 });

    const result = await installProgramAsPresets(program, {
      id: 'prov-1',
      provider_type: 'wger',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.name).toBe('Test Program · Day One');
    // Only the movement that resolved is in the preset.
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0].exercise_id).toBe('ex-1');
    // Three sets, each carrying the program's rep target and rest.
    expect(payload.exercises[0].sets).toHaveLength(3);
    expect(payload.exercises[0].sets[0]).toMatchObject({
      set_number: 1,
      reps: 8,
      rest_time: 120,
    });
    expect(result).toMatchObject({
      presetsCreated: 1,
      exercisesAdded: 1,
      skipped: ['Unknown Movement'],
    });
  });

  it('imports from the provider when the library has no match', async () => {
    mockFetchPage.mockResolvedValue(emptyPage);
    mockSearchExternal.mockResolvedValue({
      items: [{ id: 'w1', name: 'Barbell Hip Thrust', source: 'wger' }],
    });
    mockImport.mockResolvedValue({ id: 'imported-1' });
    mockCreate.mockResolvedValue({ id: 1 });

    await installProgramAsPresets(program, {
      id: 'prov-1',
      provider_type: 'wger',
    });

    expect(mockImport).toHaveBeenCalledWith('wger', 'w1');
    expect(mockCreate.mock.calls[0][0].exercises[0].exercise_id).toBe(
      'imported-1'
    );
  });

  it('creates nothing when no movement resolves', async () => {
    mockFetchPage.mockResolvedValue(emptyPage);
    mockSearchExternal.mockResolvedValue({ items: [] });

    const result = await installProgramAsPresets(program, null);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.presetsCreated).toBe(0);
    expect(result.skipped).toHaveLength(2);
  });
});
