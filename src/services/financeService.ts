import { db } from './database';
import {
  financeAccounts,
  financeSubscriptions,
  financeOrders,
  financeWishlist,
  financeExpenses,
  financeIncome,
} from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import type {
  FinanceAccount,
  FinanceSubscription,
  FinanceOrder,
  FinanceWishlistItem,
  FinanceExpense,
  FinanceIncome,
  NewFinanceAccount,
  NewFinanceSubscription,
  NewFinanceOrder,
  NewFinanceWishlistItem,
  NewFinanceExpense,
  NewFinanceIncome,
} from '../../drizzle/schema';

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

  /** Days until next billing. Negative = overdue. */
  daysUntilBilling(sub: FinanceSubscription): number {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), sub.billingDay);
    let next = thisMonth;
    if (thisMonth <= today) {
      next = new Date(today.getFullYear(), today.getMonth() + 1, sub.billingDay);
    }
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
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      this.updateBalance(account.id, newBalance),
      db
        .update(financeSubscriptions)
        .set({ lastBilledDate: today })
        .where(eq(financeSubscriptions.id, sub.id)),
    ]);
  },

  // ── Orders ────────────────────────────────────────────────────────────────

  async getOrders(): Promise<FinanceOrder[]> {
    return db.select().from(financeOrders).orderBy(desc(financeOrders.orderDate));
  },

  async createOrder(input: {
    name: string;
    amount: number;
    currency?: string;
    accountId?: string;
    estimatedDeliveryDate?: string;
  }): Promise<FinanceOrder> {
    const today = new Date().toISOString().split('T')[0];
    const order: NewFinanceOrder = {
      id: generateUUID(),
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? 'EUR',
      accountId: input.accountId ?? null,
      orderDate: today,
      estimatedDeliveryDate: input.estimatedDeliveryDate ?? null,
      deliveredAt: null,
      status: 'pending',
      createdAt: new Date(),
    };
    await db.insert(financeOrders).values(order);

    // Deduct from account immediately
    if (input.accountId) {
      const [account] = await db
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, input.accountId));
      if (account) await this.updateBalance(account.id, account.balanceAmount - input.amount);
    }

    return order as FinanceOrder;
  },

  async markDelivered(id: string): Promise<void> {
    await db
      .update(financeOrders)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(eq(financeOrders.id, id));
  },

  async deleteOrder(id: string): Promise<void> {
    await db.delete(financeOrders).where(eq(financeOrders.id, id));
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

  /** % of net worth this item represents */
  wishlistPercentage(itemPrice: number, netWorth: number): number {
    if (netWorth <= 0) return 0;
    return Math.round((itemPrice / netWorth) * 1000) / 10; // 1 decimal
  },

  // ── Expenses ──────────────────────────────────────────────────────────────

  async getExpenses(month?: string): Promise<FinanceExpense[]> {
    const all = await db.select().from(financeExpenses).orderBy(desc(financeExpenses.date));
    if (!month) return all;
    return all.filter((e) => e.date.startsWith(month));
  },

  async createExpense(input: {
    description: string;
    amount: number;
    currency?: string;
    category?: string;
    date?: string;
    accountId?: string;
    notes?: string;
  }): Promise<FinanceExpense> {
    const today = new Date().toISOString().split('T')[0];
    const expense: NewFinanceExpense = {
      id: generateUUID(),
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? 'EUR',
      category: input.category ?? 'other',
      date: input.date ?? today,
      accountId: input.accountId ?? null,
      notes: input.notes ?? null,
      createdAt: new Date(),
    };
    await db.insert(financeExpenses).values(expense);

    if (input.accountId) {
      const [account] = await db
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, input.accountId));
      if (account) await this.updateBalance(account.id, account.balanceAmount - input.amount);
    }

    return expense as FinanceExpense;
  },

  async deleteExpense(id: string): Promise<void> {
    await db.delete(financeExpenses).where(eq(financeExpenses.id, id));
  },

  getMonthlyExpenseTotal(expenses: FinanceExpense[]): number {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  },

  getExpensesByCategory(expenses: FinanceExpense[]): Record<string, number> {
    return expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  },

  // ── Income ────────────────────────────────────────────────────────────────

  async getIncome(month?: string): Promise<FinanceIncome[]> {
    const all = await db.select().from(financeIncome).orderBy(desc(financeIncome.date));
    if (!month) return all;
    return all.filter((e) => e.date.startsWith(month));
  },

  async createIncome(input: {
    description: string;
    amount: number;
    currency?: string;
    category?: string;
    date?: string;
    accountId?: string;
    notes?: string;
  }): Promise<FinanceIncome> {
    const today = new Date().toISOString().split('T')[0];
    const entry: NewFinanceIncome = {
      id: generateUUID(),
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? 'EUR',
      category: input.category ?? 'other',
      date: input.date ?? today,
      accountId: input.accountId ?? null,
      notes: input.notes ?? null,
      createdAt: new Date(),
    };
    await db.insert(financeIncome).values(entry);

    if (input.accountId) {
      const [account] = await db
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, input.accountId));
      if (account) await this.updateBalance(account.id, account.balanceAmount + input.amount);
    }

    return entry as FinanceIncome;
  },

  async deleteIncome(id: string): Promise<void> {
    await db.delete(financeIncome).where(eq(financeIncome.id, id));
  },

  getIncomeByCategory(income: FinanceIncome[]): Record<string, number> {
    return income.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  },
};
