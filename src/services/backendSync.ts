import type {
  AutoCategorizeRule,
  Bill,
  BudgetRule,
  Card,
  Category,
  Expense,
  Income,
  InsurancePolicy,
  Investment,
  Loan,
  Payment,
  RewardPointsEntry,
  SavingsGoal,
  Transfer,
  NetWorthSnapshot,
  InvestmentTransaction,
} from "../db/db";
import * as backend from "./backend.service";
import { dispatchBackendRefresh } from "./backendEvents";
import { showNetworkToast } from "./network.service";

function toastSuccess(message: string) {
  showNetworkToast(message, "success");
}

export async function createCard(data: Omit<Card, "id">) {
  const card = await backend.createCard(data);
  dispatchBackendRefresh();
  toastSuccess("Card created successfully");
  return card;
}
export async function updateCard(id: number, data: Partial<Card>) {
  const card = await backend.updateCard(id, data);
  dispatchBackendRefresh();
  toastSuccess("Card updated successfully");
  return card;
}
export async function deleteCard(id: number) {
  const result = await backend.deleteCard(id);
  dispatchBackendRefresh();
  toastSuccess("Card deleted successfully");
  return result;
}
export async function createCategory(data: Omit<Category, "id">) {
  const category = await backend.createCategory(data);
  dispatchBackendRefresh();
  toastSuccess("Category created successfully");
  return category;
}
export async function updateCategory(id: number, data: Partial<Category>) {
  const category = await backend.updateCategory(id, data);
  dispatchBackendRefresh();
  toastSuccess("Category updated successfully");
  return category;
}
export async function deleteCategory(id: number) {
  const result = await backend.deleteCategory(id);
  dispatchBackendRefresh();
  toastSuccess("Category deleted successfully");
  return result;
}
export async function createExpense(data: Omit<Expense, "id">) {
  const expense = await backend.createExpense(data);
  dispatchBackendRefresh();
  toastSuccess("Expense saved successfully");
  return expense;
}
export async function updateExpense(id: number, data: Partial<Expense>) {
  const expense = await backend.updateExpense(id, data);
  dispatchBackendRefresh();
  toastSuccess("Expense updated successfully");
  return expense;
}
export async function deleteExpense(id: number) {
  const result = await backend.deleteExpense(id);
  dispatchBackendRefresh();
  toastSuccess("Expense deleted successfully");
  return result;
}
export async function createPayment(data: Omit<Payment, "id">) {
  const payment = await backend.createPayment(data);
  dispatchBackendRefresh();
  toastSuccess("Payment recorded successfully");
  return payment;
}
export async function updatePayment(id: number, data: Partial<Payment>) {
  const payment = await backend.updatePayment(id, data);
  dispatchBackendRefresh();
  toastSuccess("Payment updated successfully");
  return payment;
}
export async function deletePayment(id: number) {
  const result = await backend.deletePayment(id);
  dispatchBackendRefresh();
  toastSuccess("Payment deleted successfully");
  return result;
}
export async function createTransfer(data: Omit<Transfer, "id">) {
  const transfer = await backend.createTransfer(data);
  dispatchBackendRefresh();
  toastSuccess("Transfer recorded successfully");
  return transfer;
}
export async function deleteTransfer(id: number) {
  const result = await backend.deleteTransfer(id);
  dispatchBackendRefresh();
  toastSuccess("Transfer deleted successfully");
  return result;
}
export async function createNetWorthSnapshot(data: Omit<NetWorthSnapshot, "id" | "netWorth">) {
  const snapshot = await backend.createNetWorthSnapshot(data);
  dispatchBackendRefresh();
  toastSuccess("Net-worth snapshot saved successfully");
  return snapshot;
}
export async function createBill(data: Omit<Bill, "id">) {
  const bill = await backend.createBill(data);
  dispatchBackendRefresh();
  toastSuccess("Bill added successfully");
  return bill;
}
export async function updateBill(id: number, data: Partial<Bill>) {
  const bill = await backend.updateBill(id, data);
  dispatchBackendRefresh();
  toastSuccess("Bill updated successfully");
  return bill;
}
export async function deleteBill(id: number) {
  const result = await backend.deleteBill(id);
  dispatchBackendRefresh();
  toastSuccess("Bill deleted successfully");
  return result;
}
export async function createLoan(data: Omit<Loan, "id">) {
  const loan = await backend.createLoan(data);
  dispatchBackendRefresh();
  toastSuccess("Loan created successfully");
  return loan;
}
export async function updateLoan(id: number, data: Partial<Loan>) {
  const loan = await backend.updateLoan(id, data);
  dispatchBackendRefresh();
  toastSuccess("Loan updated successfully");
  return loan;
}
export async function deleteLoan(id: number) {
  const result = await backend.deleteLoan(id);
  dispatchBackendRefresh();
  toastSuccess("Loan deleted successfully");
  return result;
}
export async function createSavingsGoal(data: Omit<SavingsGoal, "id">) {
  const goal = await backend.createSavingsGoal(data);
  dispatchBackendRefresh();
  toastSuccess("Savings goal created successfully");
  return goal;
}
export async function updateSavingsGoal(id: number, data: Partial<SavingsGoal>) {
  const goal = await backend.updateSavingsGoal(id, data);
  dispatchBackendRefresh();
  toastSuccess("Savings goal updated successfully");
  return goal;
}
export async function deleteSavingsGoal(id: number) {
  const result = await backend.deleteSavingsGoal(id);
  dispatchBackendRefresh();
  toastSuccess("Savings goal deleted successfully");
  return result;
}
export async function createIncome(data: Omit<Income, "id">) {
  const income = await backend.createIncome(data);
  dispatchBackendRefresh();
  toastSuccess("Income recorded successfully");
  return income;
}
export async function updateIncome(id: number, data: Partial<Income>) {
  const income = await backend.updateIncome(id, data);
  dispatchBackendRefresh();
  toastSuccess("Income updated successfully");
  return income;
}
export async function deleteIncome(id: number) {
  const result = await backend.deleteIncome(id);
  dispatchBackendRefresh();
  toastSuccess("Income deleted successfully");
  return result;
}
export async function createRewardPoints(data: Omit<RewardPointsEntry, "id">) {
  const entry = await backend.createRewardPoints(data);
  dispatchBackendRefresh();
  toastSuccess("Reward points entry saved successfully");
  return entry;
}
export async function updateRewardPoints(id: number, data: Partial<RewardPointsEntry>) {
  const entry = await backend.updateRewardPoints(id, data);
  dispatchBackendRefresh();
  toastSuccess("Reward points entry updated successfully");
  return entry;
}
export async function deleteRewardPoints(id: number) {
  const result = await backend.deleteRewardPoints(id);
  dispatchBackendRefresh();
  toastSuccess("Reward points entry deleted successfully");
  return result;
}
export async function createInsurancePolicy(data: Omit<InsurancePolicy, "id">) {
  const policy = await backend.createInsurancePolicy(data);
  dispatchBackendRefresh();
  toastSuccess("Insurance policy created successfully");
  return policy;
}
export async function updateInsurancePolicy(id: number, data: Partial<InsurancePolicy>) {
  const policy = await backend.updateInsurancePolicy(id, data);
  dispatchBackendRefresh();
  toastSuccess("Insurance policy updated successfully");
  return policy;
}
export async function deleteInsurancePolicy(id: number) {
  const result = await backend.deleteInsurancePolicy(id);
  dispatchBackendRefresh();
  toastSuccess("Insurance policy deleted successfully");
  return result;
}
export async function createInvestment(data: Omit<Investment, "id">) {
  const investment = await backend.createInvestment(data);
  dispatchBackendRefresh();
  toastSuccess("Investment added successfully");
  return investment;
}
export async function updateInvestment(id: number, data: Partial<Investment>) {
  const investment = await backend.updateInvestment(id, data);
  dispatchBackendRefresh();
  toastSuccess("Investment updated successfully");
  return investment;
}
export async function deleteInvestment(id: number) {
  const result = await backend.deleteInvestment(id);
  dispatchBackendRefresh();
  toastSuccess("Investment deleted successfully");
  return result;
}
export async function createInvestmentTransaction(data: Omit<InvestmentTransaction, "id">) {
  const transaction = await backend.createInvestmentTransaction(data);
  dispatchBackendRefresh();
  toastSuccess("Investment transaction saved successfully");
  return transaction;
}
export async function deleteInvestmentTransaction(id: number) {
  const result = await backend.deleteInvestmentTransaction(id);
  dispatchBackendRefresh();
  toastSuccess("Investment transaction deleted successfully");
  return result;
}
export async function createBudgetRule(data: Omit<BudgetRule, "id">) {
  const rule = await backend.createBudgetRule(data);
  dispatchBackendRefresh();
  toastSuccess("Budget rule created successfully");
  return rule;
}
export async function updateBudgetRule(id: number, data: Partial<BudgetRule>) {
  const rule = await backend.updateBudgetRule(id, data);
  dispatchBackendRefresh();
  toastSuccess("Budget rule updated successfully");
  return rule;
}
export async function deleteBudgetRule(id: number) {
  const result = await backend.deleteBudgetRule(id);
  dispatchBackendRefresh();
  toastSuccess("Budget rule deleted successfully");
  return result;
}
export async function createAutoCategorizeRule(data: Omit<AutoCategorizeRule, "id">) {
  const rule = await backend.createAutoCategorizeRule(data);
  dispatchBackendRefresh();
  toastSuccess("Auto-categorize rule created successfully");
  return rule;
}
export async function updateAutoCategorizeRule(id: number, data: Partial<AutoCategorizeRule>) {
  const rule = await backend.updateAutoCategorizeRule(id, data);
  dispatchBackendRefresh();
  toastSuccess("Auto-categorize rule updated successfully");
  return rule;
}
export async function deleteAutoCategorizeRule(id: number) {
  const result = await backend.deleteAutoCategorizeRule(id);
  dispatchBackendRefresh();
  toastSuccess("Auto-categorize rule deleted successfully");
  return result;
}
