import { db } from './database';
import { notificationService } from './notificationService';
import { caffeineService } from './caffeineService';

jest.mock('./database', () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));

jest.mock('./notificationService', () => ({
  notificationService: {
    scheduleCaffeineSleepInterferenceAlert: jest.fn().mockResolvedValue('id'),
    scheduleCaffeineCheckInReminder: jest.fn().mockResolvedValue('id'),
    cancelCaffeineCheckInReminder: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedDb = db as unknown as { select: jest.Mock; insert: jest.Mock };
const mockedNotifications = notificationService as unknown as {
  scheduleCaffeineSleepInterferenceAlert: jest.Mock;
  scheduleCaffeineCheckInReminder: jest.Mock;
  cancelCaffeineCheckInReminder: jest.Mock;
};

/** Chainable, thenable mock mimicking the drizzle expo-sqlite select query builder. */
function makeSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const passthrough = jest.fn(() => builder);
  builder.from = passthrough;
  builder.where = passthrough;
  builder.orderBy = passthrough;
  builder.then = (resolve: (v: unknown) => unknown) => resolve(rows);
  return builder;
}

function row(caffeineMg: number, timestamp: Date) {
  return { id: 'x', source: 'coffee', caffeineMg, timestamp, notes: null, createdAt: timestamp, modifiedAt: 0 };
}

describe('caffeineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCaffeine', () => {
    it('inserts a row with the given source, mg, timestamp and defaults notes to null', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValue({ values });
      mockedDb.select.mockReturnValue(makeSelectBuilder([])); // no active doses -> no interference

      const timestamp = new Date(2026, 6, 11, 8, 0, 0);
      const now = new Date(2026, 6, 11, 8, 0, 0);
      await caffeineService.logCaffeine('coffee', 63, timestamp, undefined, now);

      expect(mockedDb.insert).toHaveBeenCalledTimes(1);
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'coffee', caffeineMg: 63, timestamp, notes: null }),
      );
    });

    it('persists optional notes when provided', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValue({ values });
      mockedDb.select.mockReturnValue(makeSelectBuilder([]));

      await caffeineService.logCaffeine('tea', 47, new Date(2026, 6, 11, 8, 0, 0), 'morning tea');

      expect(values).toHaveBeenCalledWith(expect.objectContaining({ notes: 'morning tea' }));
    });

    it('fires the sleep-interference alert for a big dose that stays above threshold at bedtime', async () => {
      mockedDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      const loggedAt = new Date(2026, 6, 11, 16, 0, 0); // 16:00, bedtime 23:00 is 7h later
      // 200mg * 0.5^(7/5) ≈ 75.8mg > 20mg threshold
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(200, loggedAt)]));

      await caffeineService.logCaffeine('energy_drink', 200, loggedAt, undefined, loggedAt);

      expect(mockedNotifications.scheduleCaffeineSleepInterferenceAlert).toHaveBeenCalledTimes(1);
    });

    it('does not fire the alert for a small dose that clears well before bedtime', async () => {
      mockedDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      const loggedAt = new Date(2026, 6, 11, 8, 0, 0); // 08:00, bedtime 23:00 is 15h later
      // 63mg * 0.5^3 ≈ 7.9mg < 20mg threshold
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(63, loggedAt)]));

      await caffeineService.logCaffeine('coffee', 63, loggedAt, undefined, loggedAt);

      expect(mockedNotifications.scheduleCaffeineSleepInterferenceAlert).not.toHaveBeenCalled();
    });

    it('does not fire the alert when bedtime has already passed by the time of the check', async () => {
      mockedDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      // A dose that WOULD interfere with today's 23:00 bedtime (200mg at 16:00)...
      const loggedAt = new Date(2026, 6, 11, 16, 0, 0);
      // ...but the check itself happens at 23:30, after bedtime has already passed.
      const now = new Date(2026, 6, 11, 23, 30, 0);
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(200, loggedAt)]));

      await caffeineService.logCaffeine('energy_drink', 200, loggedAt, undefined, now);

      expect(mockedNotifications.scheduleCaffeineSleepInterferenceAlert).not.toHaveBeenCalled();
    });
  });

  describe('getTodayLogs', () => {
    it('queries with a select/from/where/orderBy chain and returns the rows', async () => {
      const now = new Date(2026, 6, 11, 12, 0, 0);
      const rows = [row(63, now)];
      const builder = makeSelectBuilder(rows);
      mockedDb.select.mockReturnValue(builder);

      const result = await caffeineService.getTodayLogs(now);

      expect(mockedDb.select).toHaveBeenCalled();
      expect(builder.orderBy).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });
  });

  describe('getActiveCaffeine', () => {
    it('computes totalMg, peak, currentLevel and estimatedClearAt from active doses', async () => {
      const now = new Date(2026, 6, 11, 9, 30, 0);
      const dose1 = new Date(2026, 6, 11, 8, 0, 0); // 63mg
      const dose2 = new Date(2026, 6, 11, 9, 30, 0); // 95mg, same as "now"
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(63, dose1), row(95, dose2)]));

      const active = await caffeineService.getActiveCaffeine(now);

      expect(active.totalMg).toBe(158);
      expect(active.peakAt).toEqual(dose2); // combined level is highest right at the 2nd dose
      expect(active.peakMg).toBeGreaterThan(95);
      expect(active.currentLevel).toBeCloseTo(active.peakMg!, 6); // "now" IS the peak instant here
      expect(active.estimatedClearAt).toBeInstanceOf(Date);
      expect(active.estimatedClearAt!.getTime()).toBeGreaterThan(now.getTime());
    });

    it('returns zeroed-out values when there are no active doses', async () => {
      mockedDb.select.mockReturnValue(makeSelectBuilder([]));

      const active = await caffeineService.getActiveCaffeine(new Date(2026, 6, 11, 9, 0, 0));

      expect(active.totalMg).toBe(0);
      expect(active.peakAt).toBeNull();
      expect(active.currentLevel).toBe(0);
      expect(active.estimatedClearAt).toBeNull();
    });
  });

  describe('willInterfereWithSleep', () => {
    it('reports interference with a recommendation message when above threshold', async () => {
      const now = new Date(2026, 6, 11, 16, 0, 0);
      const bedtime = new Date(2026, 6, 11, 23, 0, 0);
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(200, now)]));

      const result = await caffeineService.willInterfereWithSleep(bedtime, now);

      expect(result.interfere).toBe(true);
      expect(result.hoursBeforeBed).toBeCloseTo(7, 6);
      expect(result.recommendation).toMatch(/mg/);
    });

    it('reports no interference below threshold', async () => {
      const now = new Date(2026, 6, 11, 8, 0, 0);
      const bedtime = new Date(2026, 6, 11, 23, 0, 0);
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(63, now)]));

      const result = await caffeineService.willInterfereWithSleep(bedtime, now);

      expect(result.interfere).toBe(false);
    });
  });

  describe('getDailyChart', () => {
    it('returns logs, a timeline, the running total and the peak', async () => {
      const date = new Date(2026, 6, 11, 15, 0, 0);
      const morningDose = new Date(2026, 6, 11, 8, 0, 0);
      const rows = [row(63, morningDose)];
      mockedDb.select.mockReturnValue(makeSelectBuilder(rows));

      const chart = await caffeineService.getDailyChart(date);

      expect(chart.logs).toEqual(rows);
      expect(chart.total).toBe(63);
      expect(chart.peak).toBeCloseTo(63, 6);
      expect(chart.timeline.length).toBeGreaterThan(0);
      // Timeline spans the whole local day.
      const firstPoint = new Date(chart.timeline[0].atMs);
      expect(firstPoint.getHours()).toBe(0);
    });
  });

  describe('evaluateDailyCheckInReminder', () => {
    it('schedules the check-in reminder when nothing was logged today', async () => {
      mockedDb.select.mockReturnValue(makeSelectBuilder([]));

      await caffeineService.evaluateDailyCheckInReminder(new Date(2026, 6, 11, 19, 0, 0));

      expect(mockedNotifications.scheduleCaffeineCheckInReminder).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.cancelCaffeineCheckInReminder).not.toHaveBeenCalled();
    });

    it('cancels the check-in reminder when caffeine was already logged today', async () => {
      const now = new Date(2026, 6, 11, 19, 0, 0);
      mockedDb.select.mockReturnValue(makeSelectBuilder([row(63, now)]));

      await caffeineService.evaluateDailyCheckInReminder(now);

      expect(mockedNotifications.cancelCaffeineCheckInReminder).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.scheduleCaffeineCheckInReminder).not.toHaveBeenCalled();
    });
  });
});
