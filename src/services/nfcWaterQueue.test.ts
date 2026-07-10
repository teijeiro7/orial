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
      expect(mockedDefaultPreference.set).toHaveBeenCalledWith('hydration_nfc_queue', '[]');
      expect(result).toEqual({ addedMl: 750 });
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
