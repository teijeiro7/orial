import { gymCoachService } from './gymCoachService';
import { gymService } from './gymService';
import type { GymExercise, GymSet } from '../../drizzle/schema';

jest.mock('./gymService', () => ({
  gymService: {
    getSetsForSession: jest.fn(),
    getExerciseById: jest.fn(),
    getExercisesBySwapGroup: jest.fn(),
    updateExercise: jest.fn(),
  },
}));

const mockGym = gymService as jest.Mocked<typeof gymService>;

function exercise(overrides: Partial<GymExercise> = {}): GymExercise {
  return {
    id: 'ex-1',
    routineId: 'r-1',
    name: 'Press Banca',
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    currentWeightKg: 35,
    incrementKg: 2.5,
    orderIndex: 0,
    swapGroup: null,
    oneRmEstimated: null,
    lastSwappedAt: null,
    createdAt: new Date(),
    modifiedAt: 0,
    ...overrides,
  };
}

function set(exerciseId: string, setNumber: number, reps: number, weightKg: number): GymSet {
  return {
    id: `s-${exerciseId}-${setNumber}`,
    sessionId: 'sess-1',
    exerciseId,
    setNumber,
    reps,
    weightKg,
    createdAt: new Date(),
    modifiedAt: 0,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('processCompletedSession — auto-increment', () => {
  it('raises weight by incrementKg when all target sets hit the max reps', async () => {
    mockGym.getSetsForSession.mockResolvedValue([
      set('ex-1', 1, 12, 35),
      set('ex-1', 2, 12, 35),
      set('ex-1', 3, 13, 35),
    ]);
    mockGym.getExerciseById.mockResolvedValue(exercise());

    const results = await gymCoachService.processCompletedSession('sess-1');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      exerciseId: 'ex-1',
      exerciseName: 'Press Banca',
      oldWeight: 35,
      newWeight: 37.5,
    });
    expect(results[0].reason).toContain('37.5kg');
    expect(mockGym.updateExercise).toHaveBeenCalledWith(
      'ex-1',
      expect.objectContaining({ currentWeightKg: 37.5 }),
    );
  });

  it('does NOT raise weight when a set falls short of the max reps', async () => {
    mockGym.getSetsForSession.mockResolvedValue([
      set('ex-1', 1, 12, 35),
      set('ex-1', 2, 9, 35),
      set('ex-1', 3, 12, 35),
    ]);
    mockGym.getExerciseById.mockResolvedValue(exercise());

    const results = await gymCoachService.processCompletedSession('sess-1');

    expect(results).toHaveLength(0);
    // Still refreshes the estimated 1RM, but never the weight.
    const patch = mockGym.updateExercise.mock.calls[0]?.[1] ?? {};
    expect(patch).not.toHaveProperty('currentWeightKg');
    expect(patch).toHaveProperty('oneRmEstimated');
  });

  it('skips exercises that no longer exist', async () => {
    mockGym.getSetsForSession.mockResolvedValue([set('ghost', 1, 12, 35)]);
    mockGym.getExerciseById.mockResolvedValue(null);

    const results = await gymCoachService.processCompletedSession('sess-1');

    expect(results).toHaveLength(0);
    expect(mockGym.updateExercise).not.toHaveBeenCalled();
  });
});

describe('getSwapAlternatives — intensity equivalence', () => {
  it('matches the brief worked example: Press Banca 60kg → Mancuernas 24kg', async () => {
    const banca = exercise({
      id: 'banca',
      name: 'Press Banca',
      currentWeightKg: 60,
      oneRmEstimated: 80,
      swapGroup: 'chest-press',
    });
    const mancuernas = exercise({
      id: 'mancuernas',
      name: 'Press Mancuernas',
      currentWeightKg: 20,
      oneRmEstimated: 32,
      swapGroup: 'chest-press',
    });
    mockGym.getExerciseById.mockResolvedValue(banca);
    mockGym.getExercisesBySwapGroup.mockResolvedValue([banca, mancuernas]);

    const alternatives = await gymCoachService.getSwapAlternatives('banca');

    expect(alternatives).toHaveLength(1);
    expect(alternatives[0]).toMatchObject({
      exerciseId: 'mancuernas',
      name: 'Press Mancuernas',
      equivalentWeightKg: 24,
    });
  });

  it('returns nothing when the exercise has no swap group', async () => {
    mockGym.getExerciseById.mockResolvedValue(exercise({ swapGroup: null }));
    expect(await gymCoachService.getSwapAlternatives('ex-1')).toEqual([]);
  });
});
