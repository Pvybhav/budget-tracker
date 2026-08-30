import type { Expense } from "../db/db";
import * as backend from "./backendSync";

export async function addExpense(data: Expense) {
  return backend.createExpense(data);
}

export async function updateExpense(id: number, data: Partial<Expense>) {
  return backend.updateExpense(id, data);
}

export async function deleteExpense(id: number) {
  return backend.deleteExpense(id);
}
