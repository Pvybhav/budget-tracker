import { db, type Expense } from '../db/db';

export async function addExpense(data: Expense) {
  return await db.expenses.add(data);
}

export async function updateExpense(id: number, data: Partial<Expense>) {
  return await db.expenses.update(id, data);
}

export async function deleteExpense(id: number) {
  return await db.expenses.delete(id);
}
