import { type Category, type Expense } from "../db/db";
import { getEffectiveMonthlyBudget, type BudgetMode } from "./budget.service";
export interface DailySpendingPace {
  dailySpent: number;
  daysElapsed: number;
  daysRemaining: number;
  averageDaily: number;
}
export interface BudgetForecast {
  categoryId?: number;
  categoryTitle?: string;
  effectiveBudget: number;
  currentSpent: number;
  dailyPace: DailySpendingPace;
  projectedSpent: number;
  projectedRemaining: number;
  willExceed: boolean;
  exceedAmount: number;
  forecastPercentage: number;
  riskLevel: "safe" | "warning" | "danger";
  riskMessage: string;
}
export function getCurrentMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
export function getSpendingInCurrentPeriod(
  expenses: Expense[],
  categoryId?: number,
  mode: BudgetMode = "monthly",
): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let periodStart: Date;
  let periodEnd: Date;
  if (mode === "monthly") {
    periodStart = new Date(currentYear, currentMonth, 1);
    periodEnd = new Date(currentYear, currentMonth + 1, 0);
  } else if (mode === "quarterly") {
    const quarter = Math.floor(currentMonth / 3);
    periodStart = new Date(currentYear, quarter * 3, 1);
    periodEnd = new Date(currentYear, (quarter + 1) * 3, 0);
  } else {
    // yearly
    periodStart = new Date(currentYear, 0, 1);
    periodEnd = new Date(currentYear, 11, 31);
  }
  return expenses
    .filter((exp) => {
      if (categoryId && exp.categoryId !== categoryId) return false;
      const expDate = new Date(exp.date);
      return expDate >= periodStart && expDate <= periodEnd;
    })
    .reduce((sum, exp) => sum + exp.amount, 0);
}
export function calculateDailySpendingPace(
  spending: number,
  year: number,
  month: number,
  mode: BudgetMode = "monthly",
): DailySpendingPace {
  const now = new Date();
  let periodStart: Date;
  let totalDays: number;
  if (mode === "monthly") {
    periodStart = new Date(year, month, 1);
    totalDays = getCurrentMonthDays(year, month + 1);
  } else if (mode === "quarterly") {
    const quarter = Math.floor(month / 3);
    periodStart = new Date(year, quarter * 3, 1);
    const endDate = new Date(year, (quarter + 1) * 3, 0);
    totalDays = Math.floor((endDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } else {
    // yearly
    periodStart = new Date(year, 0, 1);
    totalDays = 365;
  }
  const today = now;
  const daysElapsed =
    Math.floor((today.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const averageDaily = daysElapsed > 0 ? spending / daysElapsed : 0;
  return {
    dailySpent: spending,
    daysElapsed: Math.max(1, daysElapsed),
    daysRemaining,
    averageDaily,
  };
}
export function forecastCategoryBudget(
  category: Category,
  expenses: Expense[],
): BudgetForecast | null {
  if (!category.budgetAmount || !category.budgetMode) {
    return null;
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const effectiveBudget = getEffectiveMonthlyBudget(category.budgetAmount, category.budgetMode);
  const currentSpent = getSpendingInCurrentPeriod(expenses, category.id, category.budgetMode);
  const dailyPace = calculateDailySpendingPace(
    currentSpent,
    currentYear,
    currentMonth,
    category.budgetMode,
  ); // Project end-of-month spending
  const periodDays =
    category.budgetMode === "monthly"
      ? getCurrentMonthDays(currentYear, currentMonth + 1)
      : category.budgetMode === "quarterly"
        ? Math.floor(
            (new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0).getTime() -
              new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1
        : 365;
  const projectedSpent = dailyPace.averageDaily * periodDays;
  const projectedRemaining = effectiveBudget - projectedSpent;
  const willExceed = projectedRemaining < 0;
  const exceedAmount = Math.max(0, -projectedRemaining);
  const forecastPercentage = (projectedSpent / effectiveBudget) * 100;
  let riskLevel: BudgetForecast["riskLevel"] = "safe";
  let riskMessage = "On track to stay within budget";
  if (forecastPercentage >= 100) {
    riskLevel = "danger";
    riskMessage = `Projected to exceed by ₹${exceedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (forecastPercentage >= 80) {
    riskLevel = "warning";
    riskMessage = `Approaching budget limit (${forecastPercentage.toFixed(0)}% projected)`;
  }
  return {
    categoryId: category.id,
    categoryTitle: category.title,
    effectiveBudget,
    currentSpent,
    dailyPace,
    projectedSpent,
    projectedRemaining,
    willExceed,
    exceedAmount,
    forecastPercentage,
    riskLevel,
    riskMessage,
  };
}
export function forecastAllCategoryBudgets(
  categories: Category[],
  expenses: Expense[],
): BudgetForecast[] {
  return categories
    .map((cat) => forecastCategoryBudget(cat, expenses))
    .filter((forecast): forecast is BudgetForecast => forecast !== null)
    .sort((a, b) => b.forecastPercentage - a.forecastPercentage);
}
export function getDangerousBudgets(forecasts: BudgetForecast[]): BudgetForecast[] {
  return forecasts.filter((f) => f.riskLevel === "danger" || f.riskLevel === "warning");
}
