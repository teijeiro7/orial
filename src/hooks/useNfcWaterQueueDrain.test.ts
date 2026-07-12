import { createDrainHandler } from './useNfcWaterQueueDrain';
import { drainNfcWaterQueue } from '../services/nfcWaterQueue';

jest.mock('../services/nfcWaterQueue', () => ({
  drainNfcWaterQueue: jest.fn(),
}));

const mockedDrainNfcWaterQueue = drainNfcWaterQueue as jest.Mock;

describe('createDrainHandler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invokes drainNfcWaterQueue when called', () => {
    mockedDrainNfcWaterQueue.mockResolvedValue({ addedMl: 0 });

    const handler = createDrainHandler();
    handler();

    expect(mockedDrainNfcWaterQueue).toHaveBeenCalledTimes(1);
  });

  it('fires the onDrained callback once the drain resolves', async () => {
    mockedDrainNfcWaterQueue.mockResolvedValue({ addedMl: 550 });
    const onDrained = jest.fn();

    const handler = createDrainHandler(onDrained);
    handler();

    // Flush the microtask queue so the .then() callback runs.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('does not call onDrained and does not let the rejection propagate when the drain fails', async () => {
    mockedDrainNfcWaterQueue.mockRejectedValue(new Error('native module unavailable'));
    const onDrained = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const handler = createDrainHandler(onDrained);
    expect(() => handler()).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDrained).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('works with no onDrained callback provided, even on success', async () => {
    mockedDrainNfcWaterQueue.mockResolvedValue({ addedMl: 0 });

    const handler = createDrainHandler();
    handler();

    // No callback was provided; resolving must not throw.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedDrainNfcWaterQueue).toHaveBeenCalledTimes(1);
  });
});
