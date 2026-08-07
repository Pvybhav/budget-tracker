import Dexie, { type EntityTable } from 'dexie';

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
}

export interface Category {
  id?: number;
  title: string;
  description?: string;
  budgetAmount?: number;
  budgetMode?: 'monthly' | 'yearly';
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

export interface SavingsGoal {
  id?: number;
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  createdAt: string;
  note?: string;
}

const db = new Dexie('CreditWiselyDB') as Dexie & {
  cards: EntityTable<Card, 'id'>;
  categories: EntityTable<Category, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  payments: EntityTable<Payment, 'id'>;
  savingsGoals: EntityTable<SavingsGoal, 'id'>;
};

db.version(1).stores({
  cards: '++id, title, billingDate, paymentDate, totalLimit, currentBalance, amc, waiveOffLimit',
  expenses: '++id, cardId, date, amount',
  payments: '++id, cardId, date, amount',
});

db.version(2).stores({
  cards: '++id, title, billingDate, paymentDate, totalLimit, amc, waiveOffLimit',
});

db.version(3).stores({
  categories: '++id, title',
  expenses: '++id, cardId, categoryId, date, amount',
});

db.version(4).stores({
  expenses: '++id, cardId, categoryId, date, amount, isEmi',
});

db.version(5).stores({
  expenses: '++id, cardId, categoryId, date, amount, isEmi',
});

// Migrate legacy daily/weekly budget modes to monthly equivalents
db.version(6).stores({}).upgrade((tx) => {
  return tx.table('categories').toCollection().modify((category) => {
    if (category.budgetMode === 'daily') {
      category.budgetAmount = (category.budgetAmount ?? 0) * 30;
      category.budgetMode = 'monthly';
    } else if (category.budgetMode === 'weekly') {
      category.budgetAmount = (category.budgetAmount ?? 0) * 4;
      category.budgetMode = 'monthly';
    }
  });
});

db.version(7).stores({
  cards: '++id, title, type, billingDate, paymentDate, totalLimit, amc, waiveOffLimit',
}).upgrade((tx) => {
  return tx.table('cards').toCollection().modify((card) => {
    if (!card.type) {
      card.type = 'credit';
    }
  });
});

db.version(8).stores({
  savingsGoals: '++id, title, targetDate, targetAmount, currentAmount, createdAt',
});

db.version(9).stores({
  expenses: '++id, cardId, categoryId, date, amount, isEmi, recurringFrequency, recurringTemplateId',
});

export { db };
