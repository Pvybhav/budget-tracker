import type { AutoCategorizeRule, BudgetRule, Card, Category, Expense } from "../db/db";
import { getBudgetStatus } from "./budget.service";
export interface BudgetRuleAlert {
  severity: "warning" | "danger";
  message: string;
  detail: string;
}
function isInCurrentPeriod(dateStr: string, period: BudgetRule["period"]): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  if (period === "monthly") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (period === "quarterly") {
    return (
      date.getFullYear() === now.getFullYear() &&
      Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3)
    );
  }
  return date.getFullYear() === now.getFullYear();
}
export function evaluateBudgetRule(
  rule: BudgetRule,
  expenses: Expense[],
  target: Category | Card | undefined,
): BudgetRuleAlert | null {
  if (!rule.enabled || !target) return null;
  const relevantExpenses = expenses.filter((expense) => {
    if (rule.type === "category" && expense.categoryId !== rule.targetId) return false;
    if (rule.type === "card" && expense.cardId !== rule.targetId) return false;
    return isInCurrentPeriod(expense.date, rule.period);
  });
  const spent = relevantExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const status = getBudgetStatus(spent, rule.thresholdAmount);
  const targetName = target.title;
  if (status.isOverBudget) {
    return {
      severity: "danger",
      message: `${targetName} exceeded its ${rule.period} threshold`,
      detail: `₹${status.spent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent against ₹${status.effectiveBudget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} threshold.`,
    };
  }
  if (status.isNearLimit) {
    return {
      severity: "warning",
      message: `${targetName} is nearing its ${rule.period} threshold`,
      detail: `Only ₹${Math.max(0, status.remaining).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left before hitting the threshold.`,
    };
  }
  return null;
}
export function findAutoCategorizeMatch(
  details: string,
  rules: AutoCategorizeRule[],
): number | undefined {
  if (!details.trim()) return undefined;
  const lowerDetails = details.toLowerCase();
  const match = rules.find(
    (rule) =>
      rule.enabled && rule.keyword.trim() && lowerDetails.includes(rule.keyword.toLowerCase()),
  );
  return match?.categoryId;
}
