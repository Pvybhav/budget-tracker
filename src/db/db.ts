export type AccountType =
  "credit" | "debit" | "bank" | "meal" | "wallet" | "cash" | "gift" | "other";
export interface Card {
  id?: number;
  title: string;
  type?: AccountType;
  billingDate?: number;
  paymentDate?: number;
  totalLimit: number;
  amc?: number;
  waiveOffLimit?: number;
  linkedCardIds?: number[];
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
}
export interface Transfer {
  id?: number;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  note?: string;
}
export interface Category {
  id?: number;
  title: string;
  description?: string;
  budgetAmount?: number;
  budgetMode?: "monthly" | "quarterly" | "yearly";
  enableCarryover?: boolean;
  maxCarryoverLimit?: number;
  customBudgetStartDay?: number;
}
export interface Expense {
  id?: number;
  cardId: number;
  categoryId?: number;
  details?: string;
  tags?: string[];
  amount: number;
  date: string;
  reconciled?: boolean;
  isEmi?: boolean;
  emiMonths?: number;
  emiInterestRate?: number;
  emiProcessingFee?: number;
  emiGst?: number;
  recurringFrequency?: "monthly" | "weekly" | "yearly";
  recurringInterval?: number;
  recurringEndDate?: string;
  recurringTemplateId?: number;
  isRecurringInstance?: boolean;
}
export interface Payment {
  id?: number;
  cardId: number;
  amount: number;
  date: string;
}
export type BillType =
  "mobile" | "internet" | "postpaid" | "electricity" | "water" | "gas" | "other";
export interface Bill {
  id?: number;
  name: string;
  type: BillType;
  provider?: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  note?: string;
  isSubscription?: boolean;
  subscriptionFrequency?: "monthly" | "quarterly" | "yearly";
}
export type IncomeCategory =
  "salary" | "freelance" | "business" | "interest" | "dividend" | "refund" | "gift" | "other";
export interface Income {
  id?: number;
  source: string;
  category?: IncomeCategory;
  accountId?: number;
  amount: number;
  date: string;
  note?: string;
  recurringFrequency?: "monthly" | "weekly" | "yearly";
  recurringInterval?: number;
  recurringEndDate?: string;
  recurringTemplateId?: number;
  isRecurringInstance?: boolean;
}
export interface Loan {
  id?: number;
  lender: string;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  startDate: string;
  note?: string;
  createdAt: string;
  repayments?: LoanRepayment[];
}
export interface LoanRepayment {
  paymentNumber: number;
  paid: boolean;
  paidDate?: string;
  note?: string;
}
export type InsuranceType = "health" | "life" | "term" | "vehicle" | "home" | "other";
export type PremiumFrequency = "monthly" | "quarterly" | "half-yearly" | "yearly";
export interface InsurancePremiumPayment {
  id?: number;
  date: string;
  amount: number;
  note?: string;
}
export interface InsurancePolicy {
  id?: number;
  policyName: string;
  type: InsuranceType;
  provider: string;
  policyNumber?: string;
  sumAssured: number;
  premiumAmount: number;
  premiumFrequency: PremiumFrequency;
  startDate: string;
  endDate?: string;
  note?: string;
  createdAt: string;
  premiumPayments?: InsurancePremiumPayment[];
}
export interface SavingsGoal {
  id?: number;
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  createdAt: string;
  note?: string;
}
export interface RewardPointsEntry {
  id?: number;
  cardId: number;
  type: "earned" | "redeemed" | "expired";
  points: number;
  valuePerPoint?: number;
  date: string;
  expiryDate?: string;
  note?: string;
}
export type BudgetRuleType = "category" | "card";
export type BudgetRulePeriod = "monthly" | "quarterly" | "yearly";
export interface BudgetRule {
  id?: number;
  type: BudgetRuleType;
  targetId: number;
  thresholdAmount: number;
  period: BudgetRulePeriod;
  enabled: boolean;
  note?: string;
  createdAt: string;
}
export interface AutoCategorizeRule {
  id?: number;
  keyword: string;
  categoryId: number;
  enabled: boolean;
  createdAt: string;
}
export type InvestmentType = "equity" | "mutual-fund" | "etf" | "bond" | "other";
export interface Investment {
  id?: number;
  name: string;
  platform: string;
  type: InvestmentType;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  purchaseDate: string;
  note?: string;
}
export type InvestmentTransactionType = "buy" | "sell" | "dividend" | "fee";
export interface InvestmentTransaction {
  id?: number;
  investmentId: number;
  type: InvestmentTransactionType;
  quantity?: number;
  amount: number;
  date: string;
  note?: string;
}
export interface NetWorthSnapshot {
  id?: number;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}
