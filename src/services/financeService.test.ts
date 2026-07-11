import {
  financeService,
  getOnePercentRule,
  buildSubscriptionAlertMessage,
  shouldNotifyWishlistAffordable,
} from './financeService';
import { notificationService } from './notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FinanceAccount, FinanceSubscription, FinanceWishlistItem } from '../../drizzle/schema';

// `financeService` imports `./database`, which opens a real (native) SQLite
// connection at module load time via expo-sqlite. That native module isn't
// available under Jest, so it's mocked here — every test below drives
// financeService through jest.spyOn on its own public methods instead of
// hitting the database directly.
jest.mock('./database', () => ({
  db: {},
}));

jest.mock('./notificationService', () => ({
  notificationService: {
    scheduleSubscriptionAlert: jest.fn().mockResolvedValue('id'),
    scheduleWishlistAffordable: jest.fn().mockResolvedValue('id'),
  },
}));

afterEach(async () => {
  // Restore any jest.spyOn(financeService, ...) overrides so tests don't leak
  // mocked behavior into unrelated describe blocks, reset call counts on the
  // notificationService mock functions, and wipe the AsyncStorage mock so the
  // "already notified" wishlist watermark doesn't leak across tests.
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

function makeAccount(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  return {
    id: 'acc-1',
    name: 'Test account',
    type: 'bank',
    balanceAmount: 1000,
    currency: 'EUR',
    icon: '💳',
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeSubscription(overrides: Partial<FinanceSubscription> = {}): FinanceSubscription {
  return {
    id: 'sub-1',
    name: 'Spotify',
    amount: 9.99,
    currency: 'EUR',
    billingDay: 1,
    billingCycle: 'monthly',
    accountId: null,
    category: 'streaming',
    isActive: true,
    autoDeduct: false,
    lastBilledDate: null,
    createdAt: new Date(),
    modifiedAt: 0,
    ...overrides,
  };
}

function makeWishlistItem(overrides: Partial<FinanceWishlistItem> = {}): FinanceWishlistItem {
  return {
    id: 'wish-1',
    name: 'AirPods Pro',
    price: 249,
    currency: 'EUR',
    url: null,
    notes: null,
    priority: 0,
    createdAt: new Date(),
    modifiedAt: 0,
    ...overrides,
  };
}

describe('getOnePercentRule', () => {
  it('marks a purchase under 1% of net worth as within budget with a check-mark message', () => {
    const result = getOnePercentRule(12450, 80);

    expect(result.percentage).toBeCloseTo(0.64, 2);
    expect(result.isWithinBudget).toBe(true);
    expect(result.message).toBe('✅ Es solo el 0.64% de tu patrimonio');
  });

  it('marks a purchase over 1% of net worth as NOT within budget with a warning message', () => {
    const result = getOnePercentRule(12450, 500);

    expect(result.percentage).toBeCloseTo(4.0161, 4);
    expect(result.isWithinBudget).toBe(false);
    expect(result.message).toBe('⚠️ Esto es el 4.02% de tu patrimonio. ¿Seguro?');
  });

  it('treats exactly 1% as NOT within budget (boundary is exclusive)', () => {
    const result = getOnePercentRule(1000, 10); // exactly 1%

    expect(result.percentage).toBe(1);
    expect(result.isWithinBudget).toBe(false);
  });

  it('treats a hair under 1% as within budget', () => {
    const result = getOnePercentRule(1000, 9.99);

    expect(result.percentage).toBeCloseTo(0.999, 5);
    expect(result.isWithinBudget).toBe(true);
  });

  it('treats a hair over 1% as NOT within budget', () => {
    const result = getOnePercentRule(1000, 10.01);

    expect(result.percentage).toBeCloseTo(1.001, 5);
    expect(result.isWithinBudget).toBe(false);
  });

  it('handles zero net worth without dividing by zero (NaN/Infinity in the message)', () => {
    const result = getOnePercentRule(0, 50);

    expect(result.isWithinBudget).toBe(false);
    expect(Number.isNaN(result.percentage)).toBe(false);
    expect(result.message).not.toContain('NaN');
    expect(result.message).not.toContain('Infinity');
  });

  it('handles negative net worth the same way as zero net worth', () => {
    const result = getOnePercentRule(-500, 50);

    expect(result.isWithinBudget).toBe(false);
    expect(result.message).not.toContain('NaN');
    expect(result.message).not.toContain('Infinity');
  });

  it('treats a free purchase (amount 0) against positive net worth as within budget', () => {
    const result = getOnePercentRule(1000, 0);

    expect(result.percentage).toBe(0);
    expect(result.isWithinBudget).toBe(true);
  });

  it('formats the percentage to 2 decimal places in the message', () => {
    const result = getOnePercentRule(3000, 100);

    expect(result.percentage).toBeCloseTo(3.3333, 4);
    expect(result.message).toContain('3.33%');
  });
});

describe('buildSubscriptionAlertMessage', () => {
  it('formats a EUR subscription due in the future', () => {
    expect(buildSubscriptionAlertMessage('Spotify', 9.99, 'EUR', 3)).toBe('Spotify cobra en 3 días (9.99€)');
  });

  it('uses singular "día" when exactly 1 day away', () => {
    expect(buildSubscriptionAlertMessage('iCloud+', 2.99, 'EUR', 1)).toBe('iCloud+ cobra en 1 día (2.99€)');
  });

  it('says "hoy" when billing is due today (0 days)', () => {
    expect(buildSubscriptionAlertMessage('Netflix', 12.99, 'EUR', 0)).toBe('Netflix cobra hoy (12.99€)');
  });

  it('says "hoy" for overdue (negative days) subscriptions', () => {
    expect(buildSubscriptionAlertMessage('Netflix', 12.99, 'EUR', -2)).toBe('Netflix cobra hoy (12.99€)');
  });

  it('appends the currency code for non-EUR currencies', () => {
    expect(buildSubscriptionAlertMessage('Spotify', 9.99, 'USD', 3)).toBe('Spotify cobra en 3 días (9.99 USD)');
  });
});

describe('shouldNotifyWishlistAffordable', () => {
  it('notifies when an item just became affordable and was not notified before', () => {
    expect(shouldNotifyWishlistAffordable(false, true)).toBe(true);
  });

  it('does not re-notify if the item was already notified', () => {
    expect(shouldNotifyWishlistAffordable(true, true)).toBe(false);
  });

  it('does not notify while the item is still not affordable', () => {
    expect(shouldNotifyWishlistAffordable(false, false)).toBe(false);
  });
});

describe('financeService.getNetWorth', () => {
  it('sums balances by account type and computes the grand total', async () => {
    jest.spyOn(financeService, 'getAccounts').mockResolvedValue([
      makeAccount({ id: 'a1', type: 'bank', balanceAmount: 3200 }),
      makeAccount({ id: 'a2', type: 'stocks', balanceAmount: 8500 }),
      makeAccount({ id: 'a3', type: 'crypto', balanceAmount: 750 }),
    ]);

    const result = await financeService.getNetWorth();

    expect(result).toEqual({ total: 12450, accounts: 3200, crypto: 750, stocks: 8500 });
  });

  it('returns zeroes for an empty account list', async () => {
    jest.spyOn(financeService, 'getAccounts').mockResolvedValue([]);

    const result = await financeService.getNetWorth();

    expect(result).toEqual({ total: 0, accounts: 0, crypto: 0, stocks: 0 });
  });
});

describe('financeService.evaluatePurchase', () => {
  it('delegates to getOnePercentRule using the current net worth total', async () => {
    jest.spyOn(financeService, 'getNetWorth').mockResolvedValue({
      total: 12450,
      accounts: 3200,
      crypto: 750,
      stocks: 8500,
    });

    const result = await financeService.evaluatePurchase(80);

    expect(result).toEqual(getOnePercentRule(12450, 80));
  });
});

describe('financeService.getUpcomingSubscriptions', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 1)); // 2026-01-01
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes only active subscriptions billing within the window', async () => {
    jest.spyOn(financeService, 'getSubscriptions').mockResolvedValue([
      makeSubscription({ id: 'due-soon', billingDay: 4 }), // 3 days away
      makeSubscription({ id: 'due-later', billingDay: 20 }), // 19 days away
      makeSubscription({ id: 'inactive', billingDay: 4, isActive: false }),
    ]);

    const upcoming = await financeService.getUpcomingSubscriptions(5);

    expect(upcoming.map((s) => s.id)).toEqual(['due-soon']);
  });
});

describe('financeService.getSubscriptionAlert', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 1)); // 2026-01-01
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps upcoming subscriptions to alerts with a countdown message', async () => {
    jest.spyOn(financeService, 'getSubscriptions').mockResolvedValue([
      makeSubscription({ id: 'spotify', name: 'Spotify', amount: 9.99, billingDay: 4 }),
    ]);

    const alerts = await financeService.getSubscriptionAlert(14);

    expect(alerts).toEqual([
      {
        subscriptionId: 'spotify',
        name: 'Spotify',
        amount: 9.99,
        currency: 'EUR',
        daysUntilBilling: 3,
        message: 'Spotify cobra en 3 días (9.99€)',
      },
    ]);
  });
});

describe('financeService.getWishlistProgress', () => {
  it('annotates each item with its % of net worth and 1%-rule affordability', async () => {
    jest.spyOn(financeService, 'getWishlist').mockResolvedValue([
      makeWishlistItem({ id: 'airpods', name: 'AirPods Pro', price: 249 }),
      makeWishlistItem({ id: 'books', name: 'Libros', price: 35 }),
    ]);
    jest.spyOn(financeService, 'getNetWorth').mockResolvedValue({
      total: 12450,
      accounts: 3200,
      crypto: 750,
      stocks: 8500,
    });

    const progress = await financeService.getWishlistProgress();

    expect(progress[0]).toMatchObject({ id: 'airpods', isWithinBudget: false });
    expect(progress[0].percentage).toBeCloseTo(2.0, 1);
    expect(progress[1]).toMatchObject({ id: 'books', isWithinBudget: true });
    expect(progress[1].percentage).toBeCloseTo(0.28, 2);
  });
});

describe('financeService.checkAndNotifySubscriptionAlerts', () => {
  it('schedules a notification for each alert within the threshold window', async () => {
    jest.spyOn(financeService, 'getSubscriptionAlert').mockResolvedValue([
      {
        subscriptionId: 'spotify',
        name: 'Spotify',
        amount: 9.99,
        currency: 'EUR',
        daysUntilBilling: 3,
        message: 'Spotify cobra en 3 días (9.99€)',
      },
    ]);

    await financeService.checkAndNotifySubscriptionAlerts(5);

    expect(financeService.getSubscriptionAlert).toHaveBeenCalledWith(5);
    expect(notificationService.scheduleSubscriptionAlert).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'spotify' })
    );
  });

  it('does nothing when there are no alerts', async () => {
    jest.spyOn(financeService, 'getSubscriptionAlert').mockResolvedValue([]);

    await financeService.checkAndNotifySubscriptionAlerts(5);

    expect(notificationService.scheduleSubscriptionAlert).not.toHaveBeenCalled();
  });
});

describe('financeService.checkWishlistAffordability', () => {
  it('notifies once when an item newly crosses into affordable territory, then stays quiet on repeat checks', async () => {
    jest.spyOn(financeService, 'getWishlistProgress').mockResolvedValue([
      { ...makeWishlistItem({ id: 'books', name: 'Libros' }), percentage: 0.3, isWithinBudget: true },
    ]);

    await financeService.checkWishlistAffordability();
    await financeService.checkWishlistAffordability();

    expect(notificationService.scheduleWishlistAffordable).toHaveBeenCalledTimes(1);
    expect(notificationService.scheduleWishlistAffordable).toHaveBeenCalledWith('Libros', 0.3);
  });

  it('does not notify for items still out of budget', async () => {
    jest.spyOn(financeService, 'getWishlistProgress').mockResolvedValue([
      { ...makeWishlistItem({ id: 'ps5' }), percentage: 3.8, isWithinBudget: false },
    ]);

    await financeService.checkWishlistAffordability();

    expect(notificationService.scheduleWishlistAffordable).not.toHaveBeenCalled();
  });

  it('re-arms the item if it falls back out of budget after having been notified', async () => {
    const progressSpy = jest.spyOn(financeService, 'getWishlistProgress');

    progressSpy.mockResolvedValueOnce([
      { ...makeWishlistItem({ id: 'books', name: 'Libros' }), percentage: 0.3, isWithinBudget: true },
    ]);
    await financeService.checkWishlistAffordability();

    progressSpy.mockResolvedValueOnce([
      { ...makeWishlistItem({ id: 'books', name: 'Libros' }), percentage: 1.5, isWithinBudget: false },
    ]);
    await financeService.checkWishlistAffordability();

    progressSpy.mockResolvedValueOnce([
      { ...makeWishlistItem({ id: 'books', name: 'Libros' }), percentage: 0.4, isWithinBudget: true },
    ]);
    await financeService.checkWishlistAffordability();

    expect(notificationService.scheduleWishlistAffordable).toHaveBeenCalledTimes(2);
  });
});
