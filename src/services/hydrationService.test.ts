import { hydrationService } from './hydrationService';
import { db } from './database';
import { writeHydrationBaseline } from './nfcWaterQueue';

jest.mock('./database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
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

  const mockSelectResolvesTo = (rows: unknown[]) => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
      }),
    } as any);
  };

  const mockUpdateResolves = () => {
    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    mockedDb.update.mockReturnValue({ set: setMock } as any);
    return { setMock, whereMock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectResolvesTo([existingRecord]);
    mockUpdateResolves();
  });

  it('calls writeHydrationBaseline with the date and the post-update total (record.consumedLiters + liters)', async () => {
    mockedWriteHydrationBaseline.mockResolvedValue(undefined);

    await hydrationService.addWater(DATE, 0.5, 'water');

    expect(mockedWriteHydrationBaseline).toHaveBeenCalledTimes(1);
    expect(mockedWriteHydrationBaseline).toHaveBeenCalledWith(DATE, 2.0);
  });

  it('calls writeHydrationBaseline after the DB update has been issued', async () => {
    const { setMock } = mockUpdateResolves();
    mockedWriteHydrationBaseline.mockResolvedValue(undefined);

    await hydrationService.addWater(DATE, 0.5, 'water');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ consumedLiters: 2.0 })
    );
    expect(mockedWriteHydrationBaseline).toHaveBeenCalledWith(DATE, 2.0);
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
