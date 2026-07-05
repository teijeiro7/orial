import { financeService } from '../financeService';
import type { ExpensePayload, DispatchResult } from './types';

export async function dispatchExpense(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as ExpensePayload;
  if (!data?.date || !data.description || typeof data.amount !== 'number') {
    return { ok: false, summary: 'Missing date, description or amount' };
  }

  const expense = await financeService.createExpense({
    description: data.description,
    amount: data.amount,
    currency: data.currency,
    category: data.category,
    date: data.date,
    accountId: data.accountId,
    notes: data.notes,
  });

  return {
    ok: true,
    summary: `Expense: ${data.amount}${data.currency ?? 'EUR'} on ${data.description}`,
    affectedEntityId: expense.id,
  };
}
