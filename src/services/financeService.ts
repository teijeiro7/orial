import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './database';
import {
  financeAccounts,
  financeSubscriptions,
  financeWishlist,
} from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { notificationService } from './notificationService';
import { todayDateString, dateString } from '../utils/date';
import type {
  FinanceAccount,
  FinanceSubscription,
  FinanceWishlistItem,
  NewFinanceAccount,
  NewFinanceSubscription,
  NewFinanceWishlistItem,
} from '../../drizzle/schema';

/** Result of evaluating a purchase against the 1% rule. */
export interface OnePercentRuleResult {
  percentage: number;
  isWithinBudget: boolean;
  message: string;
}

/** Net worth broken down by the categories the Finance UI cares about. */
export interface NetWorthSummary {
  total: number;
  accounts: number;
  crypto: number;
  stocks: number;
}

/** A subscription billing alert with a human-readable countdown message. */
export interface SubscriptionAlert {
  subscriptionId: string;
  name: string;
  amount: number;
  currency: string;
  daysUntilBilling: number;
  message: string;
}

/** A wishlist item annotated with how much of net worth it represents. */
export interface WishlistProgressItem extends FinanceWishlistItem {
  percentage: number;
  isWithinBudget: boolean;
}

const WISHLIST_NOTIFIED_KEY = 'finance:wishlist:notifiedAffordable';
const SUBSCRIPTION_NOTIFIED_KEY = 'finance:subscription:notifiedBilling';
const DEFAULT_SUBSCRIPTION_ALERT_WINDOW_DAYS = 14;
const SUBSCRIPTION_NOTIFY_THRESHOLD_DAYS = 5;

/**
 * The 1% rule: a purchase costing less than 1% of net worth is considered
 * an acceptable impulsive buy; at or above 1% it's worth thinking twice.
 *
 * Pure function — no I/O — so it stays trivially unit-testable.
 */
export function getOnePercentRule(netWorth: number, purchaseAmount: number): OnePercentRuleResult {
  if (netWorth <= 0) {
    return {
      percentage: Infinity,
      isWithinBudget: false,
      message: '⚠️ Your net worth is 0€ or negative — any purchase is worth thinking twice about.',
    };
  }
  const percentage = (purchaseAmount / netWorth) * 100;
  const isWithinBudget = percentage < 1;
  const message = isWithinBudget
    ? `✅ That's only ${percentage.toFixed(2)}% of your net worth`
    : `⚠️ That's ${percentage.toFixed(2)}% of your net worth. Sure?`;
  return { percentage, isWithinBudget, message };
}

/** "Spotify cobra en 3 días (9.99€)" style countdown message. */
export function buildSubscriptionAlertMessage(
  name: string,
  amount: number,
  currency: string,
  daysUntilBilling: number
): string {
  const when = daysUntilBilling <= 0 ? 'hoy' : `en ${daysUntilBilling} día${daysUntilBilling === 1 ? '' : 's'}`;
  return `${name} cobra ${when} (${amount.toFixed(2)}${currency === 'EUR' ? '€' : ` ${currency}`})`;
}

/**
 * Decides whether a wishlist item that has just become affordable (within
 * the 1% rule) should trigger a notification — only the first time it
 * crosses the threshold, not on every check.
 */
export function shouldNotifyWishlistAffordable(alreadyNotified: boolean, isWithinBudget: boolean): boolean {
  return isWithinBudget && !alreadyNotified;
}

export const financeService = {
  // ── Accounts / Net Worth ──────────────────────────────────────────────────

  async getAccounts(): Promise<FinanceAccount[]> {
    return db.select().from(financeAccounts).orderBy(financeAccounts.type);
  },

  async createAccount(input: {
    name: string;
    type: string;
    balanceAmount: number;
    currency?: string;
    icon?: string;
  }): Promise<FinanceAccount> {
    const now = new Date();
    const account: NewFinanceAccount = {
      id: generateUUID(),
      name: input.name,
      type: input.type,
      balanceAmount: input.balanceAmount,
      currency: input.currency ?? 'EUR',
      icon: input.icon ?? '💳',
      updatedAt: now,
      createdAt: now,
    };
    await db.insert(financeAccounts).values(account);
    return account as FinanceAccount;
  },

  async updateBalance(id: string, balanceAmount: number): Promise<void> {
    await db
      .update(financeAccounts)
      .set({ balanceAmount, updatedAt: new Date() })
      .where(eq(financeAccounts.id, id));
  },

  async deleteAccount(id: string): Promise<void> {
    await db.delete(financeAccounts).where(eq(financeAccounts.id, id));
  },

  getTotalNetWorth(accounts: FinanceAccount[]): number {
    return accounts.reduce((sum, a) => sum + a.balanceAmount, 0);
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async getSubscriptions(): Promise<FinanceSubscription[]> {
    return db
      .select()
      .from(financeSubscriptions)
      .orderBy(financeSubscriptions.billingDay);
  },

  async createSubscription(input: {
    name: string;
    amount: number;
    currency?: string;
    billingDay: number;
    billingCycle?: string;
    accountId?: string;
    category?: string;
    autoDeduct?: boolean;
  }): Promise<FinanceSubscription> {
    const sub: NewFinanceSubscription = {
      id: generateUUID(),
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? 'EUR',
      billingDay: input.billingDay,
      billingCycle: input.billingCycle ?? 'monthly',
      accountId: input.accountId ?? null,
      category: input.category ?? 'other',
      isActive: true,
      autoDeduct: input.autoDeduct ?? false,
      lastBilledDate: null,
      createdAt: new Date(),
    };
    await db.insert(financeSubscriptions).values(sub);
    return sub as FinanceSubscription;
  },

  async deleteSubscription(id: string): Promise<void> {
    await db.delete(financeSubscriptions).where(eq(financeSubscriptions.id, id));
  },

  /** The next billing date for this subscription (today or in the future). */
  getNextBillingDate(sub: FinanceSubscription): Date {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), sub.billingDay);
    if (thisMonth <= today) {
      return new Date(today.getFullYear(), today.getMonth() + 1, sub.billingDay);
    }
    return thisMonth;
  },

  /** Days until next billing. Negative = overdue. */
  daysUntilBilling(sub: FinanceSubscription): number {
    const today = new Date();
    const next = this.getNextBillingDate(sub);
    return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  },

  /** Deduct subscription amount from linked account and mark billed. */
  async processAutoDeduct(sub: FinanceSubscription): Promise<void> {
    if (!sub.autoDeduct || !sub.accountId) return;
    const [account] = await db
      .select()
      .from(financeAccounts)
      .where(eq(financeAccounts.id, sub.accountId));
    if (!account) return;
    const newBalance = account.balanceAmount - sub.amount;
    const today = todayDateString();
    await Promise.all([
      this.updateBalance(account.id, newBalance),
      db
        .update(financeSubscriptions)
        .set({ lastBilledDate: today })
        .where(eq(financeSubscriptions.id, sub.id)),
    ]);
  },

  // ── Wishlist ──────────────────────────────────────────────────────────────

  async getWishlist(): Promise<FinanceWishlistItem[]> {
    return db
      .select()
      .from(financeWishlist)
      .orderBy(desc(financeWishlist.priority), financeWishlist.price);
  },

  async createWishlistItem(input: {
    name: string;
    price: number;
    currency?: string;
    url?: string;
    notes?: string;
    priority?: number;
  }): Promise<FinanceWishlistItem> {
    const item: NewFinanceWishlistItem = {
      id: generateUUID(),
      name: input.name,
      price: input.price,
      currency: input.currency ?? 'EUR',
      url: input.url ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? 0,
      createdAt: new Date(),
    };
    await db.insert(financeWishlist).values(item);
    return item as FinanceWishlistItem;
  },

  async deleteWishlistItem(id: string): Promise<void> {
    await db.delete(financeWishlist).where(eq(financeWishlist.id, id));
  },

  // ── 1% Rule & Alerts ─────────────────────────────────────────────────────

  /** Net worth broken down by account type for the 1% rule dashboard. */
  async getNetWorth(): Promise<NetWorthSummary> {
    const accounts = await this.getAccounts();
    const sumByType = (type: string) =>
      accounts.filter((a) => a.type === type).reduce((sum, a) => sum + a.balanceAmount, 0);
    return {
      total: this.getTotalNetWorth(accounts),
      accounts: sumByType('bank'),
      crypto: sumByType('crypto'),
      stocks: sumByType('stocks'),
    };
  },

  /** Evaluates a prospective purchase against current net worth using the 1% rule. */
  async evaluatePurchase(amount: number): Promise<OnePercentRuleResult> {
    const { total } = await this.getNetWorth();
    return getOnePercentRule(total, amount);
  },

  /** Active subscriptions billing within the next `daysAhead` days (overdue ones excluded). */
  async getUpcomingSubscriptions(daysAhead: number): Promise<FinanceSubscription[]> {
    const subscriptions = await this.getSubscriptions();
    return subscriptions.filter((s) => {
      if (!s.isActive) return false;
      const days = this.daysUntilBilling(s);
      return days >= 0 && days <= daysAhead;
    });
  },

  /** Upcoming subscription alerts with a ready-to-display countdown message. */
  async getSubscriptionAlert(
    daysAhead: number = DEFAULT_SUBSCRIPTION_ALERT_WINDOW_DAYS
  ): Promise<SubscriptionAlert[]> {
    const upcoming = await this.getUpcomingSubscriptions(daysAhead);
    return upcoming.map((s) => {
      const daysUntilBilling = this.daysUntilBilling(s);
      return {
        subscriptionId: s.id,
        name: s.name,
        amount: s.amount,
        currency: s.currency,
        daysUntilBilling,
        message: buildSubscriptionAlertMessage(s.name, s.amount, s.currency, daysUntilBilling),
      };
    });
  },

  /** Wishlist items annotated with % of net worth and 1%-rule affordability. */
  async getWishlistProgress(): Promise<WishlistProgressItem[]> {
    const [wishlist, { total }] = await Promise.all([this.getWishlist(), this.getNetWorth()]);
    return wishlist.map((item) => {
      const { percentage, isWithinBudget } = getOnePercentRule(total, item.price);
      return { ...item, percentage, isWithinBudget };
    });
  },

  /**
   * Schedules local notifications for subscriptions billing within
   * `thresholdDays` days. Persists a watermark per (subscription id + next
   * billing date) in AsyncStorage — the same pattern `checkWishlistAffordability`
   * uses below — so a given upcoming charge only notifies once no matter how
   * many times this runs during that billing window (e.g. once per cold
   * start), and it naturally re-arms once the billing date advances to the
   * next cycle (new date = new key).
   */
  async checkAndNotifySubscriptionAlerts(
    thresholdDays: number = SUBSCRIPTION_NOTIFY_THRESHOLD_DAYS
  ): Promise<void> {
    const upcoming = await this.getUpcomingSubscriptions(thresholdDays);
    if (upcoming.length === 0) return;

    const raw = await AsyncStorage.getItem(SUBSCRIPTION_NOTIFIED_KEY);
    const notified = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    let changed = false;

    for (const sub of upcoming) {
      const nextBillingDateISO = dateString(this.getNextBillingDate(sub));
      const notifyKey = `${sub.id}:${nextBillingDateISO}`;
      if (notified.has(notifyKey)) continue;

      await notificationService.scheduleSubscriptionAlert({
        subscriptionId: sub.id,
        name: sub.name,
        amount: sub.amount,
        currency: sub.currency,
        daysUntilBilling: this.daysUntilBilling(sub),
      });
      notified.add(notifyKey);
      changed = true;
    }

    if (changed) {
      await AsyncStorage.setItem(SUBSCRIPTION_NOTIFIED_KEY, JSON.stringify([...notified]));
    }
  },

  /**
   * Notifies when a wishlist item becomes affordable under the 1% rule
   * (e.g. net worth grew enough to cross the threshold). Persists which
   * items have already been notified in AsyncStorage so it only fires once
   * per crossing, and re-arms if the item later falls back out of budget.
   */
  async checkWishlistAffordability(): Promise<void> {
    const progress = await this.getWishlistProgress();
    const raw = await AsyncStorage.getItem(WISHLIST_NOTIFIED_KEY);
    const notified = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    let changed = false;

    for (const item of progress) {
      const alreadyNotified = notified.has(item.id);
      if (shouldNotifyWishlistAffordable(alreadyNotified, item.isWithinBudget)) {
        await notificationService.scheduleWishlistAffordable(item.name, item.percentage);
        notified.add(item.id);
        changed = true;
      } else if (!item.isWithinBudget && alreadyNotified) {
        notified.delete(item.id);
        changed = true;
      }
    }

    if (changed) {
      await AsyncStorage.setItem(WISHLIST_NOTIFIED_KEY, JSON.stringify([...notified]));
    }
  },

  /** Runs both alert checks — call once when the Finance screen loads. */
  async checkAlerts(): Promise<void> {
    await Promise.all([this.checkAndNotifySubscriptionAlerts(), this.checkWishlistAffordability()]);
  },
};
