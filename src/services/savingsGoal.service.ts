import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export interface SavingsGoal {
  id?: number;
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  createdAt: string;
  note?: string;
}

export interface SavingsGoalSummary {
  progressPercent: number;
  remainingAmount: number;
  daysLeft: number;
  requiredPerDay: number;
  avgDailySavings: number;
  etaDays: number;
  etaLabel: string;
  estimatedCompletionDate?: string;
  status: 'Completed' | 'On track' | 'Behind' | 'Overdue';
}

function normalizeDate(value: string | Date) {
  const dateValue = value instanceof Date ? value : parseISO(value);
  const normalized = new Date(dateValue);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getSavingsGoalSummary(goal: SavingsGoal): SavingsGoalSummary {
  const targetAmount = Number(goal.targetAmount) || 0;
  const currentAmount = Number(goal.currentAmount) || 0;
  const today = normalizeDate(new Date());
  const targetDate = normalizeDate(goal.targetDate);
  const createdAt = normalizeDate(goal.createdAt || goal.targetDate);

  const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  const daysLeft = Math.max(0, differenceInCalendarDays(targetDate, today));
  const daysElapsed = Math.max(1, differenceInCalendarDays(today, createdAt));
  const avgDailySavings = currentAmount > 0 ? currentAmount / daysElapsed : 0;
  const requiredPerDay = daysLeft > 0 ? remainingAmount / daysLeft : 0;

  let status: SavingsGoalSummary['status'] = 'On track';
  if (currentAmount >= targetAmount) {
    status = 'Completed';
  } else if (daysLeft <= 0 && remainingAmount > 0) {
    status = 'Overdue';
  } else if (avgDailySavings > 0 && requiredPerDay > avgDailySavings) {
    status = 'Behind';
  }

  const etaDays = avgDailySavings > 0 && remainingAmount > 0
    ? Math.max(1, Math.ceil(remainingAmount / avgDailySavings))
    : daysLeft;

  let etaLabel = 'Target date';
  if (status === 'Completed') {
    etaLabel = 'Completed';
  } else if (remainingAmount === 0) {
    etaLabel = 'Done';
  } else if (daysLeft === 0) {
    etaLabel = 'Past target date';
  } else if (avgDailySavings > 0) {
    etaLabel = `~${etaDays} day${etaDays === 1 ? '' : 's'}`;
  } else {
    etaLabel = `₹${requiredPerDay.toFixed(2)}/day`;
  }

  const estimatedCompletionDate = remainingAmount > 0 && avgDailySavings > 0
    ? format(addDays(today, etaDays), 'MMM d, yyyy')
    : undefined;

  return {
    progressPercent,
    remainingAmount,
    daysLeft,
    requiredPerDay,
    avgDailySavings,
    etaDays,
    etaLabel,
    estimatedCompletionDate,
    status,
  };
}
