import { apiGet, apiPost, apiPut, apiDelete } from "./api";
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
export async function fetchCards() {
  return apiGet<Card[]>("/cards");
}
export async function createCard(data: Omit<Card, "id">) {
  return apiPost<Card>("/cards", data);
}
export async function updateCard(id: number, data: Partial<Card>) {
  return apiPut<Card>(`/cards/${id}`, data);
}
export async function deleteCard(id: number) {
  return apiDelete<{ success: boolean }>(`/cards/${id}`);
}
export async function fetchCategories() {
  return apiGet<Category[]>("/categories");
}
export async function createCategory(data: Omit<Category, "id">) {
  return apiPost<Category>("/categories", data);
}
export async function updateCategory(id: number, data: Partial<Category>) {
  return apiPut<Category>(`/categories/${id}`, data);
}
export async function deleteCategory(id: number) {
  return apiDelete<{ success: boolean }>(`/categories/${id}`);
}
export async function fetchExpenses() {
  return apiGet<Expense[]>("/expenses");
}
export async function createExpense(data: Expense) {
  return apiPost<Expense>("/expenses", data);
}
export async function updateExpense(id: number, data: Partial<Expense>) {
  return apiPut<Expense>(`/expenses/${id}`, data);
}
export async function deleteExpense(id: number) {
  return apiDelete<{ success: boolean }>(`/expenses/${id}`);
}
export async function fetchPayments() {
  return apiGet<Payment[]>("/payments");
}
export async function createPayment(data: Payment) {
  return apiPost<Payment>("/payments", data);
}
export async function updatePayment(id: number, data: Partial<Payment>) {
  return apiPut<Payment>(`/payments/${id}`, data);
}
export async function deletePayment(id: number) {
  return apiDelete<{ success: boolean }>(`/payments/${id}`);
}
export async function fetchTransfers() {
  return apiGet<Transfer[]>("/transfers");
}
export async function createTransfer(data: Omit<Transfer, "id">) {
  return apiPost<Transfer>("/transfers", data);
}
export async function deleteTransfer(id: number) {
  return apiDelete<{ success: boolean }>(`/transfers/${id}`);
}
export async function fetchNetWorthSnapshots() {
  return apiGet<NetWorthSnapshot[]>("/net-worth-snapshots");
}
export async function createNetWorthSnapshot(data: Omit<NetWorthSnapshot, "id" | "netWorth">) {
  return apiPost<NetWorthSnapshot>("/net-worth-snapshots", data);
}
export async function fetchBills() {
  return apiGet<Bill[]>("/bills");
}
export async function createBill(data: Omit<Bill, "id">) {
  return apiPost<Bill>("/bills", data);
}
export async function updateBill(id: number, data: Partial<Bill>) {
  return apiPut<Bill>(`/bills/${id}`, data);
}
export async function deleteBill(id: number) {
  return apiDelete<{ success: boolean }>(`/bills/${id}`);
}
export async function fetchLoans() {
  return apiGet<Loan[]>("/loans");
}
export async function createLoan(data: Loan) {
  return apiPost<Loan>("/loans", data);
}
export async function updateLoan(id: number, data: Partial<Loan>) {
  return apiPut<Loan>(`/loans/${id}`, data);
}
export async function deleteLoan(id: number) {
  return apiDelete<{ success: boolean }>(`/loans/${id}`);
}
export async function fetchSavingsGoals() {
  return apiGet<SavingsGoal[]>("/savings-goals");
}
export async function createSavingsGoal(data: SavingsGoal) {
  return apiPost<SavingsGoal>("/savings-goals", data);
}
export async function updateSavingsGoal(id: number, data: Partial<SavingsGoal>) {
  return apiPut<SavingsGoal>(`/savings-goals/${id}`, data);
}
export async function deleteSavingsGoal(id: number) {
  return apiDelete<{ success: boolean }>(`/savings-goals/${id}`);
}
export async function fetchIncomes() {
  return apiGet<Income[]>("/income");
}
export async function createIncome(data: Omit<Income, "id">) {
  return apiPost<Income>("/income", data);
}
export async function updateIncome(id: number, data: Partial<Income>) {
  return apiPut<Income>(`/income/${id}`, data);
}
export async function deleteIncome(id: number) {
  return apiDelete<{ success: boolean }>(`/income/${id}`);
}
export async function fetchRewardPoints(cardId?: number) {
  return apiGet<RewardPointsEntry[]>(cardId ? `/reward-points?cardId=${cardId}` : "/reward-points");
}
export async function createRewardPoints(data: Omit<RewardPointsEntry, "id">) {
  return apiPost<RewardPointsEntry>("/reward-points", data);
}
export async function updateRewardPoints(id: number, data: Partial<RewardPointsEntry>) {
  return apiPut<RewardPointsEntry>(`/reward-points/${id}`, data);
}
export async function deleteRewardPoints(id: number) {
  return apiDelete<{ success: boolean }>(`/reward-points/${id}`);
}
export async function fetchInsurancePolicies() {
  return apiGet<InsurancePolicy[]>("/insurance");
}
export async function createInsurancePolicy(data: Omit<InsurancePolicy, "id">) {
  return apiPost<InsurancePolicy>("/insurance", data);
}
export async function updateInsurancePolicy(id: number, data: Partial<InsurancePolicy>) {
  return apiPut<InsurancePolicy>(`/insurance/${id}`, data);
}
export async function deleteInsurancePolicy(id: number) {
  return apiDelete<{ success: boolean }>(`/insurance/${id}`);
}
export async function fetchInvestments() {
  return apiGet<Investment[]>("/investments");
}
export async function createInvestment(data: Omit<Investment, "id">) {
  return apiPost<Investment>("/investments", data);
}
export async function updateInvestment(id: number, data: Partial<Investment>) {
  return apiPut<Investment>(`/investments/${id}`, data);
}
export async function fetchInvestmentTransactions() {
  return apiGet<InvestmentTransaction[]>("/investment-transactions");
}
export async function createInvestmentTransaction(data: Omit<InvestmentTransaction, "id">) {
  return apiPost<InvestmentTransaction>("/investment-transactions", data);
}
export async function deleteInvestmentTransaction(id: number) {
  return apiDelete<{ success: boolean }>(`/investment-transactions/${id}`);
}
export async function deleteInvestment(id: number) {
  return apiDelete<{ success: boolean }>(`/investments/${id}`);
}
export async function fetchBudgetRules() {
  return apiGet<BudgetRule[]>("/budget-rules");
}
export async function createBudgetRule(data: Omit<BudgetRule, "id">) {
  return apiPost<BudgetRule>("/budget-rules", data);
}
export async function updateBudgetRule(id: number, data: Partial<BudgetRule>) {
  return apiPut<BudgetRule>(`/budget-rules/${id}`, data);
}
export async function deleteBudgetRule(id: number) {
  return apiDelete<{ success: boolean }>(`/budget-rules/${id}`);
}
export async function fetchAutoCategorizeRules() {
  return apiGet<AutoCategorizeRule[]>("/auto-categorize-rules");
}
export async function createAutoCategorizeRule(data: Omit<AutoCategorizeRule, "id">) {
  return apiPost<AutoCategorizeRule>("/auto-categorize-rules", data);
}
export async function updateAutoCategorizeRule(id: number, data: Partial<AutoCategorizeRule>) {
  return apiPut<AutoCategorizeRule>(`/auto-categorize-rules/${id}`, data);
}
export async function deleteAutoCategorizeRule(id: number) {
  return apiDelete<{ success: boolean }>(`/auto-categorize-rules/${id}`);
}
