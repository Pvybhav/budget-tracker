export type BudgetMode = 'monthly' | 'yearly';

import { type Category, type Expense } from '../db/db';

export interface BudgetStatus {
  effectiveBudget: number;
  spent: number;
  remaining: number;
  progressPercent: number;
  progressClamped: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  statusLabel: 'On track' | 'Near limit' | 'Over budget';
}

export interface CategoryBudgetAlert {
  severity: 'warning' | 'danger';
  message: string;
  detail: string;
}

export function getEffectiveMonthlyBudget(amount: number, mode: BudgetMode): number {
  if (mode === 'monthly') return amount;
  return amount / 12;
}

export function getBudgetStatus(spent: number, budgetAmount: number, mode: BudgetMode): BudgetStatus {
  const effectiveBudget = getEffectiveMonthlyBudget(budgetAmount, mode);
  const remaining = effectiveBudget - spent;
  const progressPercent = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;
  const progressClamped = Math.min(100, Math.round(progressPercent));
  const isOverBudget = remaining < 0;
  const isNearLimit = !isOverBudget && progressClamped >= 80;

  let statusLabel: BudgetStatus['statusLabel'] = 'On track';
  if (isOverBudget) {
    statusLabel = 'Over budget';
  } else if (isNearLimit) {
    statusLabel = 'Near limit';
  }

  return {
    effectiveBudget,
    spent,
    remaining,
    progressPercent,
    progressClamped,
    isOverBudget,
    isNearLimit,
    statusLabel,
  };
}

export function getCategoryBudgetAlert(category: Category, expenses: Expense[]): CategoryBudgetAlert | null {
  if (!category.budgetAmount || !category.budgetMode) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthExpenses = expenses.filter((expense) => expense.categoryId === category.id);

  let spent = 0;
  for (const expense of monthExpenses) {
    const date = new Date(expense.date);
    const isCurrentMonth = date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
    if (!isCurrentMonth) continue;

    spent += expense.amount;
  }

  const status = getBudgetStatus(spent, category.budgetAmount, category.budgetMode);
  if (status.isOverBudget) {
    return {
      severity: 'danger',
      message: `Budget exceeded for ${category.title}`,
      detail: `₹${status.spent.toLocaleString('en-IN')} spent against ₹${status.effectiveBudget.toLocaleString('en-IN')} budget.`,
    };
  }

  if (status.isNearLimit) {
    return {
      severity: 'warning',
      message: `${category.title} is nearing its limit`,
      detail: `Only ₹${Math.max(0, status.remaining).toLocaleString('en-IN')} left this ${category.budgetMode === 'yearly' ? 'year' : 'month'}.`,
    };
  }

  return null;
}
