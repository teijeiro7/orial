import { hydrationService } from './hydrationService';
import { db, expoDb } from './database';
import { writeHydrationBaseline } from './nfcWaterQueue';

jest.mock('./database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
  expoDb: {
    runAsync: jest.fn(),
  },
}));

jest.mock('./nfcWaterQueue', () => ({
  writeHydrationBaseline: jest.fn(),
}));

jest.mock('./hydrationProfileService', () => ({
  hydrationProfileService: {
    getDynamicBaseTarget: jest.fn().mockResolvedValue(3.0),
  },
}));

const mockedDb = db as jest.Mocked<typeof db>;
const mockedExpoDb = expoDb as jest.Mocked<typeof expoDb>;
const mockedWriteHydrationBaseline = writeHydrationBaseline as jest.Mock;

describe('hydrationService.addWater', () => {
  const DATE = '2026-07-10';

  const existingRecord = {
    date: DATE,
    targetLiters: 3.0,
    consumedLiters: 1.5,
    effectiveLiters: 1.5,
    sodiumMg: 0,
    extraLitersFromSodium: 0,
    updatedAt: new Date(),
  };

  // addWater does an atomic UPDATE via expoDb.runAsync, then re-reads the row
  // to report the post-update total — it never computes the new total in JS.
  const updatedRecord = {
    ...existingRecord,
    consumedLiters: 2.0,
    effectiveLiters: 2.0,
  };

  /** First select() call (ensure row exists) resolves `first`, every call after resolves `rest`. */
  const mockSelectSequence = (first: unknown[], rest: unknown[]) => {
    let callCount = 0;
    mockedDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockImplementation(() => Promise.resolve(callCount++ === 0 ? first : rest)),
        }),
      }),
    }) as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectSequence([existingRecord], [updatedRecord]);
    mockedExpoDb.runAsync.mockResolvedValue(undefined as any);
  });

  it('calls writeHydrationBaseline with the date and the post-update total read back from the DB', async () => {
    mockedWriteHydrationBaseline.mockResolvedValue(undefined);

    await hydrationService.addWater(DATE, 0.5, 'water');

    expect(mockedWriteHydrationBaseline).toHaveBeenCalledTimes(1);
    expect(mockedWriteHydrationBaseline).toHaveBeenCalledWith(DATE, 2.0);
  });

  it('issues an atomic increment via expoDb.runAsync before calling writeHydrationBaseline', async () => {
    mockedWriteHydrationBaseline.mockResolvedValue(undefined);

    await hydrationService.addWater(DATE, 0.5, 'water');

    expect(mockedExpoDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('consumed_liters = consumed_liters +'),
      [0.5, 0.5, expect.any(Number), DATE],
    );
    const runOrder = mockedExpoDb.runAsync.mock.invocationCallOrder[0];
    const baselineOrder = mockedWriteHydrationBaseline.mock.invocationCallOrder[0];
    expect(runOrder).toBeLessThan(baselineOrder);
  });

  it('does not let a rejected writeHydrationBaseline propagate out of addWater', async () => {
    mockedWriteHydrationBaseline.mockRejectedValueOnce(new Error('native module unavailable'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(hydrationService.addWater(DATE, 0.5, 'water')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('hydrationService.getProgress', () => {
  const DATE = '2026-07-10';

  const existingRecord = {
    date: DATE,
    targetLiters: 3.0,
    consumedLiters: 1.5,
    effectiveLiters: 1.2,
    sodiumMg: 0,
    extraLitersFromSodium: 0,
    updatedAt: new Date(),
  };

  const mockSelectResolvesTo = (rows: unknown[]) => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
      }),
    } as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectResolvesTo([existingRecord]);
  });

  it('returns consumedLiters alongside the existing current/target/percentage fields', async () => {
    const progress = await hydrationService.getProgress(DATE);

    expect(progress).toEqual({
      current: 1.2,
      target: 3.0,
      percentage: 40,
      consumedLiters: 1.5,
    });
  });
});
