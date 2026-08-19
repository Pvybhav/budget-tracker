export type AccountType = 'credit' | 'debit' | 'meal' | 'wallet' | 'other';

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
}

export interface Category {
  id?: number;
  title: string;
  description?: string;
  budgetAmount?: number;
  budgetMode?: 'monthly' | 'quarterly' | 'yearly';
}

export interface Expense {
  id?: number;
  cardId: number;
  categoryId?: number;
  details?: string;
  amount: number;
  date: string;
  // EMI fields
  isEmi?: boolean;
  emiMonths?: number;
  emiInterestRate?: number;    // annual % — 0 means No Cost EMI
  emiProcessingFee?: number;   // flat processing fee in ₹ (user-entered)
  emiGst?: number;             // flat GST amount in ₹ (user-entered, applied on processing fee / interest)
  // Recurring fields
  recurringFrequency?: 'monthly' | 'weekly' | 'yearly';
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

export interface SavingsGoal {
  id?: number;
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  createdAt: string;
  note?: string;
}

