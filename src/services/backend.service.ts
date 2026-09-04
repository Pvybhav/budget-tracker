import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import type {
  Beneficiary,
  AutoCategorizeRule,
  Bill,
  BudgetRule,
  Card,
  Category,
  Expense,
  Household,
  HouseholdStatus,
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
  SavingsContribution,
} from "../db/db";
export async function fetchCards() {
  return apiGet<Card[]>("/cards");
}
export async function createCard(data: Omit<Card, "id">) {
  return apiPost<Card>("/cards", data);
}
export async function updateCard(id: string, data: Partial<Card>) {
  return apiPut<Card>(`/cards/${id}`, data);
}
export async function deleteCard(id: string) {
  return apiDelete<{ success: boolean }>(`/cards/${id}`);
}
export async function fetchCategories() {
  return apiGet<Category[]>("/categories");
}
export async function createCategory(data: Omit<Category, "id">) {
  return apiPost<Category>("/categories", data);
}
export async function updateCategory(id: string, data: Partial<Category>) {
  return apiPut<Category>(`/categories/${id}`, data);
}
export async function deleteCategory(id: string) {
  return apiDelete<{ success: boolean }>(`/categories/${id}`);
}
export async function fetchExpenses() {
  return apiGet<Expense[]>("/expenses");
}
export async function createExpense(data: Expense) {
  return apiPost<Expense>("/expenses", data);
}
export async function updateExpense(id: string, data: Partial<Expense>) {
  return apiPut<Expense>(`/expenses/${id}`, data);
}
export async function deleteExpense(id: string) {
  return apiDelete<{ success: boolean }>(`/expenses/${id}`);
}
export async function fetchPayments() {
  return apiGet<Payment[]>("/payments");
}
export async function createPayment(data: Payment) {
  return apiPost<Payment>("/payments", data);
}
export async function updatePayment(id: string, data: Partial<Payment>) {
  return apiPut<Payment>(`/payments/${id}`, data);
}
export async function deletePayment(id: string) {
  return apiDelete<{ success: boolean }>(`/payments/${id}`);
}
export async function fetchTransfers() {
  return apiGet<Transfer[]>("/transfers");
}
export async function fetchBeneficiaries() {
  return apiGet<Beneficiary[]>("/beneficiaries");
}
export async function createBeneficiary(data: Omit<Beneficiary, "id">) {
  return apiPost<Beneficiary>("/beneficiaries", data);
}
export async function updateBeneficiary(id: string, data: Partial<Omit<Beneficiary, "id">>) {
  return apiPut<Beneficiary>(`/beneficiaries/${id}`, data);
}
export async function deleteBeneficiary(id: string) {
  return apiDelete<{ success: boolean }>(`/beneficiaries/${id}`);
}
export async function createTransfer(data: Omit<Transfer, "id">) {
  return apiPost<Transfer>("/transfers", data);
}
export async function deleteTransfer(id: string) {
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
export async function updateBill(id: string, data: Partial<Bill>) {
  return apiPut<Bill>(`/bills/${id}`, data);
}
export async function deleteBill(id: string) {
  return apiDelete<{ success: boolean }>(`/bills/${id}`);
}
export async function fetchLoans() {
  return apiGet<Loan[]>("/loans");
}
export async function createLoan(data: Loan) {
  return apiPost<Loan>("/loans", data);
}
export async function updateLoan(id: string, data: Partial<Loan>) {
  return apiPut<Loan>(`/loans/${id}`, data);
}
export async function deleteLoan(id: string) {
  return apiDelete<{ success: boolean }>(`/loans/${id}`);
}
export async function fetchSavingsGoals() {
  return apiGet<SavingsGoal[]>("/savings-goals");
}
export async function createSavingsGoal(data: SavingsGoal) {
  return apiPost<SavingsGoal>("/savings-goals", data);
}
export async function updateSavingsGoal(id: string, data: Partial<SavingsGoal>) {
  return apiPut<SavingsGoal>(`/savings-goals/${id}`, data);
}
export async function deleteSavingsGoal(id: string) {
  return apiDelete<{ success: boolean }>(`/savings-goals/${id}`);
}
export async function fetchSavingsContributions(goalId: string) {
  return apiGet<SavingsContribution[]>(`/savings-goals/${goalId}/contributions`);
}
export async function createSavingsContribution(
  goalId: string,
  data: Omit<SavingsContribution, "id" | "goalId">,
) {
  return apiPost<SavingsContribution>(`/savings-goals/${goalId}/contributions`, data);
}
export async function deleteSavingsContribution(goalId: string, id: string) {
  return apiDelete<{ success: boolean }>(`/savings-goals/${goalId}/contributions/${id}`);
}
export async function fetchIncomes() {
  return apiGet<Income[]>("/income");
}
export async function createIncome(data: Omit<Income, "id">) {
  return apiPost<Income>("/income", data);
}
export async function updateIncome(id: string, data: Partial<Income>) {
  return apiPut<Income>(`/income/${id}`, data);
}
export async function deleteIncome(id: string) {
  return apiDelete<{ success: boolean }>(`/income/${id}`);
}
export async function fetchRewardPoints(cardId?: string) {
  return apiGet<RewardPointsEntry[]>(cardId ? `/reward-points?cardId=${cardId}` : "/reward-points");
}
export async function createRewardPoints(data: Omit<RewardPointsEntry, "id">) {
  return apiPost<RewardPointsEntry>("/reward-points", data);
}
export async function updateRewardPoints(id: string, data: Partial<RewardPointsEntry>) {
  return apiPut<RewardPointsEntry>(`/reward-points/${id}`, data);
}
export async function deleteRewardPoints(id: string) {
  return apiDelete<{ success: boolean }>(`/reward-points/${id}`);
}
export async function fetchInsurancePolicies() {
  return apiGet<InsurancePolicy[]>("/insurance");
}
export async function createInsurancePolicy(data: Omit<InsurancePolicy, "id">) {
  return apiPost<InsurancePolicy>("/insurance", data);
}
export async function updateInsurancePolicy(id: string, data: Partial<InsurancePolicy>) {
  return apiPut<InsurancePolicy>(`/insurance/${id}`, data);
}
export async function deleteInsurancePolicy(id: string) {
  return apiDelete<{ success: boolean }>(`/insurance/${id}`);
}
export async function fetchInvestments() {
  return apiGet<Investment[]>("/investments");
}
export async function createInvestment(data: Omit<Investment, "id">) {
  return apiPost<Investment>("/investments", data);
}
export async function updateInvestment(id: string, data: Partial<Investment>) {
  return apiPut<Investment>(`/investments/${id}`, data);
}
export async function fetchInvestmentTransactions() {
  return apiGet<InvestmentTransaction[]>("/investment-transactions");
}
export async function createInvestmentTransaction(data: Omit<InvestmentTransaction, "id">) {
  return apiPost<InvestmentTransaction>("/investment-transactions", data);
}
export async function deleteInvestmentTransaction(id: string) {
  return apiDelete<{ success: boolean }>(`/investment-transactions/${id}`);
}
export async function deleteInvestment(id: string) {
  return apiDelete<{ success: boolean }>(`/investments/${id}`);
}
export async function fetchBudgetRules() {
  return apiGet<BudgetRule[]>("/budget-rules");
}
export async function createBudgetRule(data: Omit<BudgetRule, "id">) {
  return apiPost<BudgetRule>("/budget-rules", data);
}
export async function updateBudgetRule(id: string, data: Partial<BudgetRule>) {
  return apiPut<BudgetRule>(`/budget-rules/${id}`, data);
}
export async function deleteBudgetRule(id: string) {
  return apiDelete<{ success: boolean }>(`/budget-rules/${id}`);
}
export async function fetchAutoCategorizeRules() {
  return apiGet<AutoCategorizeRule[]>("/auto-categorize-rules");
}
export async function createAutoCategorizeRule(data: Omit<AutoCategorizeRule, "id">) {
  return apiPost<AutoCategorizeRule>("/auto-categorize-rules", data);
}
export async function updateAutoCategorizeRule(id: string, data: Partial<AutoCategorizeRule>) {
  return apiPut<AutoCategorizeRule>(`/auto-categorize-rules/${id}`, data);
}
export async function deleteAutoCategorizeRule(id: string) {
  return apiDelete<{ success: boolean }>(`/auto-categorize-rules/${id}`);
}
export async function fetchHousehold() {
  return apiGet<HouseholdStatus>("/household");
}
export async function inviteHouseholdMember(email: string) {
  return apiPost<{ email: string; inviteToken: string }>("/household/invite", { email });
}
export async function acceptHouseholdInvite(token: string) {
  return apiPost<{ success: boolean; household: Household }>("/household/accept", { token });
}
export async function removeHouseholdMember(email: string) {
  return apiDelete<{ success: boolean; household: Household }>(
    `/household/members/${encodeURIComponent(email)}`,
  );
}
export async function leaveHousehold() {
  return apiPost<{ success: boolean }>("/household/leave", {});
}
