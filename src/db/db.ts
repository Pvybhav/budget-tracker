export type AccountType =
  "credit" | "debit" | "bank" | "meal" | "wallet" | "cash" | "gift" | "other";
export type CardIconKey =
  "credit-card" | "wallet" | "bank" | "smartphone" | "cash" | "gift" | "building" | "package";
export interface Card {
  id?: string;
  title: string;
  type?: AccountType;
  icon?: CardIconKey;
  billingDate?: number;
  paymentDate?: number;
  totalLimit: number;
  amc?: number;
  waiveOffLimit?: number;
  linkedCardIds?: string[];
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currency?: string;
}
export interface Transfer {
  id?: string;
  fromAccountId: string;
  toAccountId?: string;
  destinationType?: "internal" | "external";
  externalName?: string;
  externalBankName?: string;
  externalAccountNumber?: string;
  externalIfscCode?: string;
  externalUpiId?: string;
  amount: number;
  date: string;
  note?: string;
  currency?: string;
}
export interface Beneficiary {
  id?: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  note?: string;
}
export interface Category {
  id?: string;
  title: string;
  description?: string;
  budgetAmount?: number;
  budgetMode?: "monthly" | "quarterly" | "yearly";
  enableCarryover?: boolean;
  maxCarryoverLimit?: number;
  customBudgetStartDay?: number;
}
export interface Expense {
  id?: string;
  cardId: string;
  categoryId?: string;
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
  recurringTemplateId?: string;
  isRecurringInstance?: boolean;
  currency?: string;
}
export interface Payment {
  id?: string;
  cardId: string;
  amount: number;
  date: string;
  currency?: string;
}
export type BillType =
  "mobile" | "internet" | "postpaid" | "electricity" | "water" | "gas" | "other";
export interface Bill {
  id?: string;
  name: string;
  type: BillType;
  provider?: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate?: string;
  paymentType?: "card" | "bank" | "cash" | "upi" | "other";
  paymentAccountId?: string;
  paymentReference?: string;
  note?: string;
  isSubscription?: boolean;
  subscriptionFrequency?: "monthly" | "quarterly" | "yearly";
  currency?: string;
}
export type IncomeCategory =
  "salary" | "freelance" | "business" | "interest" | "dividend" | "refund" | "gift" | "other";
export interface Income {
  id?: string;
  source: string;
  category?: IncomeCategory;
  accountId?: string;
  amount: number;
  date: string;
  note?: string;
  recurringFrequency?: "monthly" | "weekly" | "yearly";
  recurringInterval?: number;
  recurringEndDate?: string;
  recurringTemplateId?: string;
  isRecurringInstance?: boolean;
  currency?: string;
}
export interface Loan {
  id?: string;
  lender: string;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  startDate: string;
  note?: string;
  createdAt: string;
  repayments?: LoanRepayment[];
  currency?: string;
}
export interface LoanRepayment {
  id?: string;
  paymentNumber: number;
  paid: boolean;
  paidDate?: string;
  note?: string;
  paymentType?: "card" | "bank" | "cash" | "upi" | "other";
  paymentSource?: string;
  paymentReference?: string;
}
export type InsuranceType = "health" | "life" | "term" | "vehicle" | "home" | "other";
export type PremiumFrequency = "monthly" | "quarterly" | "half-yearly" | "yearly";
export type InsurancePaymentType = "card" | "cash" | "upi" | "bank" | "other";
export interface InsurancePremiumPayment {
  id?: string;
  date: string;
  amount: number;
  paymentType: InsurancePaymentType;
  paymentSource?: string;
  note?: string;
}
export interface InsurancePolicy {
  id?: string;
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
  currency?: string;
}
export interface SavingsGoal {
  id?: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  createdAt: string;
  note?: string;
  currency?: string;
}
export interface SavingsContribution {
  id?: string;
  goalId: string;
  amount: number;
  date: string;
  note?: string;
  recurringFrequency?: "weekly" | "monthly" | "yearly";
  recurringInterval?: number;
  recurringEndDate?: string;
  recurringTemplateId?: string;
  isRecurringInstance?: boolean;
  currency?: string;
}
export interface RewardPointsEntry {
  id?: string;
  cardId: string;
  type: "earned" | "redeemed" | "expired";
  points: number;
  valuePerPoint?: number;
  date: string;
  expiryDate?: string;
  note?: string;
  currency?: string;
}
export type BudgetRuleType = "category" | "card";
export type BudgetRulePeriod = "monthly" | "quarterly" | "yearly";
export interface BudgetRule {
  id?: string;
  type: BudgetRuleType;
  targetId: string;
  thresholdAmount: number;
  period: BudgetRulePeriod;
  enabled: boolean;
  note?: string;
  createdAt: string;
  currency?: string;
}
export interface AutoCategorizeRule {
  id?: string;
  keyword: string;
  categoryId: string;
  enabled: boolean;
  createdAt: string;
}
export type InvestmentType = "equity" | "mutual-fund" | "etf" | "bond" | "retirement" | "other";
export type InvestmentSubtype =
  "equity" | "debt" | "index" | "hybrid" | "solution-oriented" | "other" | "pf" | "vpf" | "nps";
export type FundClassification =
  "large-cap" | "mid-cap" | "small-cap" | "flexi-cap" | "multi-cap" | "other";
export interface Investment {
  id?: string;
  name: string;
  platform: string;
  type: InvestmentType;
  subtype?: InvestmentSubtype;
  classification?: FundClassification;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  purchaseDate: string;
  note?: string;
  currency?: string;
}
export type InvestmentTransactionType = "buy" | "sell" | "dividend" | "fee";
export interface InvestmentTransaction {
  id?: string;
  investmentId: string;
  type: InvestmentTransactionType;
  quantity?: number;
  amount: number;
  date: string;
  note?: string;
  currency?: string;
}
export interface NetWorthSnapshot {
  id?: string;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  currency?: string;
}
export type HouseholdMemberStatus = "pending" | "active";
export interface HouseholdMember {
  email: string;
  userId?: string;
  status: HouseholdMemberStatus;
  invitedAt?: string;
  joinedAt?: string;
}
export interface Household {
  id?: string;
  ownerUserId: string;
  members: HouseholdMember[];
}
export type HouseholdRole = "owner" | "member" | "none";
export interface HouseholdStatus {
  role: HouseholdRole;
  household: Household | null;
}
