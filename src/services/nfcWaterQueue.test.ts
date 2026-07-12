import { Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { hydrationService } from './hydrationService';
import { drainNfcWaterQueue } from './nfcWaterQueue';

jest.mock('react-native-default-preference', () => ({
  __esModule: true,
  default: {
    setName: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('./hydrationService', () => ({
  hydrationService: {
    addWater: jest.fn(),
  },
}));

const mockedDefaultPreference = DefaultPreference as jest.Mocked<typeof DefaultPreference>;
const mockedAddWater = hydrationService.addWater as jest.Mock;

describe('drainNfcWaterQueue', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Platform.OS = originalPlatformOS;
  });

  describe('on iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('returns addedMl: 0 and does not call addWater when the queue is empty', async () => {
      mockedDefaultPreference.get.mockResolvedValue(null);

      const result = await drainNfcWaterQueue();

      expect(result).toEqual({ addedMl: 0 });
      expect(mockedAddWater).not.toHaveBeenCalled();
      expect(mockedDefaultPreference.set).not.toHaveBeenCalled();
    });

    it('returns addedMl: 0 and does not call addWater when the queue is the empty array', async () => {
      mockedDefaultPreference.get.mockResolvedValue('[]');

      const result = await drainNfcWaterQueue();

      expect(result).toEqual({ addedMl: 0 });
      expect(mockedAddWater).not.toHaveBeenCalled();
    });

    it('drains a queue with 2 same-day entries, calling addWater with correct liters and clearing the queue', async () => {
      const queue = [
        { id: '1', date: '2026-07-10', ml: 250 },
        { id: '2', date: '2026-07-10', ml: 500 },
      ];
      mockedDefaultPreference.get.mockResolvedValue(JSON.stringify(queue));

      const result = await drainNfcWaterQueue();

      expect(mockedDefaultPreference.setName).toHaveBeenCalledWith('group.com.orial.app.widget');
      expect(mockedAddWater).toHaveBeenCalledTimes(2);
      expect(mockedAddWater).toHaveBeenNthCalledWith(1, '2026-07-10', 0.25, 'water');
      expect(mockedAddWater).toHaveBeenNthCalledWith(2, '2026-07-10', 0.5, 'water');

      // Per-entry persistence: the remaining queue is persisted after each successful
      // addWater call, not just once at the very end.
      expect(mockedDefaultPreference.set).toHaveBeenCalledTimes(2);
      expect(mockedDefaultPreference.set).toHaveBeenNthCalledWith(1, 'hydration_nfc_queue', JSON.stringify([queue[1]]));
      expect(mockedDefaultPreference.set).toHaveBeenNthCalledWith(2, 'hydration_nfc_queue', '[]');

      expect(result).toEqual({ addedMl: 750 });
    });

    it('shares a single in-flight drain across concurrent calls instead of double-processing', async () => {
      const queue = [{ id: '1', date: '2026-07-10', ml: 250 }];
      let resolveGet: (value: string) => void = () => {};
      const getPromise = new Promise<string>((resolve) => {
        resolveGet = resolve;
      });
      mockedDefaultPreference.get.mockReturnValue(getPromise as any);

      const call1 = drainNfcWaterQueue();
      const call2 = drainNfcWaterQueue();

      // Let both calls progress up to the point where they'd read the queue
      // (flush pending microtasks from the earlier `await`s in the function).
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Only the first call should have actually started reading the queue.
      expect(mockedDefaultPreference.get).toHaveBeenCalledTimes(1);
      expect(mockedDefaultPreference.setName).toHaveBeenCalledTimes(1);

      resolveGet(JSON.stringify(queue));
      const [result1, result2] = await Promise.all([call1, call2]);

      expect(mockedAddWater).toHaveBeenCalledTimes(1);
      expect(mockedDefaultPreference.set).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ addedMl: 250 });
      expect(result2).toEqual({ addedMl: 250 });

      // The guard must release once the shared drain settles, so a later,
      // non-overlapping call can still run a fresh drain.
      mockedDefaultPreference.get.mockResolvedValue('[]');
      const result3 = await drainNfcWaterQueue();
      expect(mockedDefaultPreference.get).toHaveBeenCalledTimes(2);
      expect(result3).toEqual({ addedMl: 0 });
    });

    it('persists partial progress when addWater rejects partway through, so a subsequent drain only reprocesses the remainder', async () => {
      const queue = [
        { id: '1', date: '2026-07-10', ml: 250 },
        { id: '2', date: '2026-07-10', ml: 500 },
      ];
      let currentQueueRaw = JSON.stringify(queue);
      mockedDefaultPreference.get.mockImplementation(() => Promise.resolve(currentQueueRaw));
      mockedDefaultPreference.set.mockImplementation((key: string, value: string) => {
        if (key === 'hydration_nfc_queue') currentQueueRaw = value;
        return Promise.resolve();
      });
      mockedAddWater
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('db unavailable'));

      await expect(drainNfcWaterQueue()).rejects.toThrow('db unavailable');

      // Entry 1 succeeded and was already removed from the persisted queue
      // before entry 2 failed.
      expect(currentQueueRaw).toBe(JSON.stringify([queue[1]]));
      expect(mockedAddWater).toHaveBeenCalledTimes(2);

      // A subsequent drain (guard released after the rejection) only reprocesses
      // the entry that never succeeded.
      mockedAddWater.mockResolvedValueOnce(undefined);
      const result = await drainNfcWaterQueue();

      expect(mockedAddWater).toHaveBeenCalledTimes(3);
      expect(mockedAddWater).toHaveBeenNthCalledWith(3, '2026-07-10', 0.5, 'water');
      expect(result).toEqual({ addedMl: 500 });
      expect(currentQueueRaw).toBe('[]');
    });
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('returns addedMl: 0 without touching DefaultPreference or addWater', async () => {
      const result = await drainNfcWaterQueue();

      expect(result).toEqual({ addedMl: 0 });
      expect(mockedDefaultPreference.setName).not.toHaveBeenCalled();
      expect(mockedDefaultPreference.get).not.toHaveBeenCalled();
      expect(mockedDefaultPreference.set).not.toHaveBeenCalled();
      expect(mockedAddWater).not.toHaveBeenCalled();
    });
  });
});
