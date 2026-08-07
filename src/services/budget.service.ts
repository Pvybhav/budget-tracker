export type BudgetMode = 'monthly' | 'yearly';

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
