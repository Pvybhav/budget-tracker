import type {
  Card,
  Category,
  Expense,
  Loan,
  Payment,
  SavingsGoal,
} from '../db/db';
import * as backend from './backend.service';
import { dispatchBackendRefresh } from './backendEvents';

export async function createCard(data: Omit<Card, 'id'>) {
  const card = await backend.createCard(data);
  dispatchBackendRefresh();
  return card;
}

export async function updateCard(id: number, data: Partial<Card>) {
  const card = await backend.updateCard(id, data);
  dispatchBackendRefresh();
  return card;
}

export async function deleteCard(id: number) {
  const result = await backend.deleteCard(id);
  dispatchBackendRefresh();
  return result;
}

export async function createCategory(data: Omit<Category, 'id'>) {
  const category = await backend.createCategory(data);
  dispatchBackendRefresh();
  return category;
}

export async function updateCategory(id: number, data: Partial<Category>) {
  const category = await backend.updateCategory(id, data);
  dispatchBackendRefresh();
  return category;
}

export async function deleteCategory(id: number) {
  const result = await backend.deleteCategory(id);
  dispatchBackendRefresh();
  return result;
}

export async function createExpense(data: Omit<Expense, 'id'>) {
  const expense = await backend.createExpense(data);
  dispatchBackendRefresh();
  return expense;
}

export async function updateExpense(id: number, data: Partial<Expense>) {
  const expense = await backend.updateExpense(id, data);
  dispatchBackendRefresh();
  return expense;
}

export async function deleteExpense(id: number) {
  const result = await backend.deleteExpense(id);
  dispatchBackendRefresh();
  return result;
}

export async function createPayment(data: Omit<Payment, 'id'>) {
  const payment = await backend.createPayment(data);
  dispatchBackendRefresh();
  return payment;
}

export async function updatePayment(id: number, data: Partial<Payment>) {
  const payment = await backend.updatePayment(id, data);
  dispatchBackendRefresh();
  return payment;
}

export async function deletePayment(id: number) {
  const result = await backend.deletePayment(id);
  dispatchBackendRefresh();
  return result;
}

export async function createLoan(data: Omit<Loan, 'id'>) {
  const loan = await backend.createLoan(data);
  dispatchBackendRefresh();
  return loan;
}

export async function updateLoan(id: number, data: Partial<Loan>) {
  const loan = await backend.updateLoan(id, data);
  dispatchBackendRefresh();
  return loan;
}

export async function deleteLoan(id: number) {
  const result = await backend.deleteLoan(id);
  dispatchBackendRefresh();
  return result;
}

export async function createSavingsGoal(data: Omit<SavingsGoal, 'id'>) {
  const goal = await backend.createSavingsGoal(data);
  dispatchBackendRefresh();
  return goal;
}

export async function updateSavingsGoal(id: number, data: Partial<SavingsGoal>) {
  const goal = await backend.updateSavingsGoal(id, data);
  dispatchBackendRefresh();
  return goal;
}

export async function deleteSavingsGoal(id: number) {
  const result = await backend.deleteSavingsGoal(id);
  dispatchBackendRefresh();
  return result;
}
