import { type Expense, type Category } from "../db/db";
export interface MonthlySpendingData {
  month: string;
  monthIndex: number;
  year: number;
  totalSpending: number;
  categoryBreakdown: Array<{ categoryId?: number; categoryTitle: string; amount: number }>;
}
export interface CategoryMonthComparison {
  categoryId?: number;
  categoryTitle?: string;
  currentMonthSpending: number;
  previousMonthSpending: number;
  averageSpending: number;
  percentChange: number;
  trend: "increased" | "decreased" | "stable";
  monthsAnalyzed: number;
}
export interface MonthlyTrendComparison {
  currentMonth: MonthlySpendingData;
  previousMonth: MonthlySpendingData;
  twoMonthsAgo: MonthlySpendingData;
  categoryComparisons: CategoryMonthComparison[];
  totalChangePercent: number;
  highestIncreaseCategory?: CategoryMonthComparison;
  highestDecreaseCategory?: CategoryMonthComparison;
}
export function getMonthlySpending(
  expenses: Expense[],
  year: number,
  monthIndex: number, // 0-11
  categories: Category[],
): MonthlySpendingData {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const monthExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    return expDate >= monthStart && expDate <= monthEnd;
  });
  const totalSpending = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const categoryBreakdown = categories
    .map((cat) => {
      const categoryTotal = monthExpenses
        .filter((exp) => exp.categoryId === cat.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return { categoryId: cat.id, categoryTitle: cat.title, amount: categoryTotal };
    })
    .filter((cb) => cb.amount > 0);
  const monthName = new Date(year, monthIndex).toLocaleString("default", {
    month: "short",
    year: "numeric",
  });
  return { month: monthName, monthIndex, year, totalSpending, categoryBreakdown };
}
export function compareMonthlyTrends(
  expenses: Expense[],
  categories: Category[],
  baseYear: number = new Date().getFullYear(),
  baseMonth: number = new Date().getMonth(), // 0-11
): MonthlyTrendComparison {
  const currentMonth = getMonthlySpending(expenses, baseYear, baseMonth, categories); // Previous month
  let prevYear = baseYear;
  let prevMonth = baseMonth - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const previousMonth = getMonthlySpending(expenses, prevYear, prevMonth, categories); // Two months ago
  let twoMonthsYear = prevYear;
  let twoMonthsMonth = prevMonth - 1;
  if (twoMonthsMonth < 0) {
    twoMonthsMonth = 11;
    twoMonthsYear -= 1;
  }
  const twoMonthsAgo = getMonthlySpending(expenses, twoMonthsYear, twoMonthsMonth, categories); // Calculate category comparisons
  const categoryComparisons = categories
    .map((cat) => {
      const currentSpending =
        currentMonth.categoryBreakdown.find((cb) => cb.categoryId === cat.id)?.amount ?? 0;
      const previousSpending =
        previousMonth.categoryBreakdown.find((cb) => cb.categoryId === cat.id)?.amount ?? 0;
      const twoMonthsSpending =
        twoMonthsAgo.categoryBreakdown.find((cb) => cb.categoryId === cat.id)?.amount ?? 0;
      if (currentSpending === 0 && previousSpending === 0 && twoMonthsSpending === 0) {
        return null;
      }
      const averageSpending = (currentSpending + previousSpending + twoMonthsSpending) / 3;
      const percentChange =
        previousSpending > 0 ? ((currentSpending - previousSpending) / previousSpending) * 100 : 0;
      let trend: CategoryMonthComparison["trend"] = "stable";
      if (Math.abs(percentChange) > 10) {
        trend = percentChange > 0 ? "increased" : "decreased";
      }
      return {
        categoryId: cat.id,
        categoryTitle: cat.title,
        currentMonthSpending: currentSpending,
        previousMonthSpending: previousSpending,
        averageSpending,
        percentChange,
        trend,
        monthsAnalyzed: 3,
      };
    })
    .filter((comp) => comp !== null) as CategoryMonthComparison[];
  const totalChangePercent =
    previousMonth.totalSpending > 0
      ? ((currentMonth.totalSpending - previousMonth.totalSpending) / previousMonth.totalSpending) *
        100
      : 0;
  const highestIncreaseCategory = categoryComparisons.reduce(
    (max: CategoryMonthComparison | undefined, cat) => {
      return cat.percentChange > (max?.percentChange ?? -Infinity) ? cat : max;
    },
    undefined,
  );
  const highestDecreaseCategory = categoryComparisons.reduce(
    (min: CategoryMonthComparison | undefined, cat) => {
      return cat.percentChange < (min?.percentChange ?? Infinity) ? cat : min;
    },
    undefined,
  );
  return {
    currentMonth,
    previousMonth,
    twoMonthsAgo,
    categoryComparisons,
    totalChangePercent,
    highestIncreaseCategory:
      highestIncreaseCategory && highestIncreaseCategory.percentChange > 0
        ? highestIncreaseCategory
        : undefined,
    highestDecreaseCategory:
      highestDecreaseCategory && highestDecreaseCategory.percentChange < 0
        ? highestDecreaseCategory
        : undefined,
  };
}
export function compareYearOverYear(
  expenses: Expense[],
  categories: Category[],
  currentYear: number,
  previousYear: number,
  monthIndex: number, // 0-11
) {
  const currentMonthData = getMonthlySpending(expenses, currentYear, monthIndex, categories);
  const previousYearData = getMonthlySpending(expenses, previousYear, monthIndex, categories);
  const percentChange =
    previousYearData.totalSpending > 0
      ? ((currentMonthData.totalSpending - previousYearData.totalSpending) /
          previousYearData.totalSpending) *
        100
      : 0;
  return {
    currentMonthData,
    previousYearData,
    percentChange,
    difference: currentMonthData.totalSpending - previousYearData.totalSpending,
  };
}
