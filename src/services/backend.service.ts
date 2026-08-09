import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type {
  Card,
  Category,
  Expense,
  Loan,
  Payment,
  SavingsGoal,
} from '../db/db';

export async function fetchCards() {
  return apiGet<Card[]>('/cards');
}

export async function createCard(data: Omit<Card, 'id'>) {
  return apiPost<Card>('/cards', data);
}

export async function updateCard(id: number, data: Partial<Card>) {
  return apiPut<Card>(`/cards/${id}`, data);
}

export async function deleteCard(id: number) {
  return apiDelete<{ success: boolean }>(`/cards/${id}`);
}

export async function fetchCategories() {
  return apiGet<Category[]>('/categories');
}

export async function createCategory(data: Omit<Category, 'id'>) {
  return apiPost<Category>('/categories', data);
}

export async function updateCategory(id: number, data: Partial<Category>) {
  return apiPut<Category>(`/categories/${id}`, data);
}

export async function deleteCategory(id: number) {
  return apiDelete<{ success: boolean }>(`/categories/${id}`);
}

export async function fetchExpenses() {
  return apiGet<Expense[]>('/expenses');
}

export async function createExpense(data: Expense) {
  return apiPost<Expense>('/expenses', data);
}

export async function updateExpense(id: number, data: Partial<Expense>) {
  return apiPut<Expense>(`/expenses/${id}`, data);
}

export async function deleteExpense(id: number) {
  return apiDelete<{ success: boolean }>(`/expenses/${id}`);
}

export async function fetchPayments() {
  return apiGet<Payment[]>('/payments');
}

export async function createPayment(data: Payment) {
  return apiPost<Payment>('/payments', data);
}

export async function updatePayment(id: number, data: Partial<Payment>) {
  return apiPut<Payment>(`/payments/${id}`, data);
}

export async function deletePayment(id: number) {
  return apiDelete<{ success: boolean }>(`/payments/${id}`);
}

export async function fetchLoans() {
  return apiGet<Loan[]>('/loans');
}

export async function createLoan(data: Loan) {
  return apiPost<Loan>('/loans', data);
}

export async function updateLoan(id: number, data: Partial<Loan>) {
  return apiPut<Loan>(`/loans/${id}`, data);
}

export async function deleteLoan(id: number) {
  return apiDelete<{ success: boolean }>(`/loans/${id}`);
}

export async function fetchSavingsGoals() {
  return apiGet<SavingsGoal[]>('/savings-goals');
}

export async function createSavingsGoal(data: SavingsGoal) {
  return apiPost<SavingsGoal>('/savings-goals', data);
}

export async function updateSavingsGoal(id: number, data: Partial<SavingsGoal>) {
  return apiPut<SavingsGoal>(`/savings-goals/${id}`, data);
}

export async function deleteSavingsGoal(id: number) {
  return apiDelete<{ success: boolean }>(`/savings-goals/${id}`);
}
