import { type Category, type Expense } from "../db/db";
import { getEffectiveMonthlyBudget } from "./budget.service";
import { convertCurrency, formatMoney } from "./currency.service";
export interface CategorySpendingAnalysis {
  categoryId?: string;
  categoryTitle?: string;
  monthlyAverageSpending: number;
  maxMonthlySpending: number;
  minMonthlySpending: number;
  standardDeviation: number;
  recommendedBudget: number;
  confidenceLevel: "low" | "medium" | "high";
  analysisMonths: number;
  frequentlyExceeded: boolean;
  trend: "increasing" | "decreasing" | "stable";
}
export interface BudgetRecommendation {
  categoryId?: string;
  categoryTitle?: string;
  currentBudget?: number;
  recommendedBudget: number;
  averageMonthlySpending: number;
  maxMonthlySpending: number;
  monthsAnalyzed: number;
  frequentlyExceeded: boolean;
  overBudgetMonths: number;
  trend: CategorySpendingAnalysis["trend"];
  reasoning: string;
  savingsOpportunity: number;
  riskLevel: "low" | "medium" | "high";
}
export function getMonthlySpendingByCategory(
  expenses: Expense[],
  categoryId: string,
  monthsToAnalyze: number = 6,
  currency: string = "INR",
): number[] {
  const now = new Date();
  const monthlyData: number[] = [];
  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const monthTotal = expenses
      .filter((exp) => {
        if (exp.categoryId !== categoryId) return false;
        const expDate = new Date(exp.date);
        return expDate >= monthStart && expDate <= monthEnd;
      })
      .reduce((sum, exp) => sum + convertCurrency(exp.amount, exp.currency, currency), 0);
    monthlyData.push(monthTotal);
  }
  return monthlyData;
}
export function calculateStatistics(values: number[]): {
  average: number;
  max: number;
  min: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { average: 0, max: 0, min: 0, stdDev: 0 };
  }
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { average, max, min, stdDev };
}
export function calculateTrend(values: number[]): "increasing" | "decreasing" | "stable" {
  if (values.length < 2) return "stable";
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const percentChange =
    firstHalfAvg === 0
      ? secondHalfAvg > 0
        ? 100
        : 0
      : ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  if (Math.abs(percentChange) < 5) return "stable";
  return percentChange > 0 ? "increasing" : "decreasing";
}
export function analyzeCategorySpending(
  category: Category,
  expenses: Expense[],
  monthsToAnalyze: number = 6,
  currency: string = "INR",
): CategorySpendingAnalysis {
  const monthlySpending = getMonthlySpendingByCategory(
    expenses,
    category.id!,
    monthsToAnalyze,
    currency,
  );
  const stats = calculateStatistics(monthlySpending);
  const trend = calculateTrend(monthlySpending);
  const frequentlyExceeded = category.budgetAmount
    ? monthlySpending.filter(
        (spending) =>
          spending > getEffectiveMonthlyBudget(category.budgetAmount!, category.budgetMode!),
      ).length >
      monthsToAnalyze / 2
    : false; // Confidence increases with more data and less variance
  let confidenceLevel: CategorySpendingAnalysis["confidenceLevel"] = "low";
  if (monthsToAnalyze >= 6 && stats.stdDev / (stats.average || 1) < 0.3) {
    confidenceLevel = "high";
  } else if (monthsToAnalyze >= 3 && stats.stdDev / (stats.average || 1) < 0.5) {
    confidenceLevel = "medium";
  }
  return {
    categoryId: category.id,
    categoryTitle: category.title,
    monthlyAverageSpending: stats.average,
    maxMonthlySpending: stats.max,
    minMonthlySpending: stats.min,
    standardDeviation: stats.stdDev,
    recommendedBudget: Math.ceil(stats.average * 1.15), // Add 15% buffer
    confidenceLevel,
    analysisMonths: monthsToAnalyze,
    frequentlyExceeded,
    trend,
  };
}
export function getSmartBudgetRecommendations(
  categories: Category[],
  expenses: Expense[],
  monthsToAnalyze: number = 6,
  currency: string = "INR",
): BudgetRecommendation[] {
  const analysisMonths = Math.min(6, Math.max(3, Math.floor(monthsToAnalyze)));
  return categories
    .map((category) => {
      const analysis = analyzeCategorySpending(category, expenses, analysisMonths, currency);
      if (analysis.monthlyAverageSpending === 0) {
        return null;
      }
      const currentBudget = category.budgetAmount
        ? getEffectiveMonthlyBudget(category.budgetAmount, category.budgetMode!)
        : undefined;
      const savingsOpportunity = currentBudget
        ? Math.max(0, currentBudget - analysis.recommendedBudget)
        : 0;
      const monthlySpending = getMonthlySpendingByCategory(
        expenses,
        category.id!,
        analysisMonths,
        currency,
      );
      const budgetForComparison = currentBudget ?? 0;
      const overBudgetMonths = currentBudget
        ? monthlySpending.filter((spending) => spending > budgetForComparison).length
        : 0;
      let reasoning = "";
      let riskLevel: BudgetRecommendation["riskLevel"] = "medium";
      if (!currentBudget) {
        reasoning = `No budget set. Based on ${analysis.analysisMonths} months of spending, recommend ${formatMoney(analysis.recommendedBudget, currency)}/month.`;
        riskLevel = "low";
      } else if (analysis.frequentlyExceeded) {
        reasoning = `Exceeded the current budget in ${overBudgetMonths} of the last ${analysis.analysisMonths} months. Recommend ${formatMoney(analysis.recommendedBudget, currency)}/month.`;
        riskLevel = "high";
      } else if (currentBudget < analysis.monthlyAverageSpending) {
        reasoning = `Current budget is below average spending. Recommend increasing to ${formatMoney(analysis.recommendedBudget, currency)}/month.`;
        riskLevel = "high";
      } else if (currentBudget > analysis.maxMonthlySpending * 1.3) {
        reasoning = `Budget is significantly higher than typical spending. Consider reducing to ${formatMoney(analysis.recommendedBudget, currency)}/month to save ${formatMoney(savingsOpportunity, currency)}/month.`;
        riskLevel = "low";
      } else {
        reasoning = `Budget aligns well with spending patterns. Maintain current budget or adjust to ${formatMoney(analysis.recommendedBudget, currency)}/month.`;
      }
      return {
        categoryId: category.id,
        categoryTitle: category.title,
        currentBudget,
        recommendedBudget: analysis.recommendedBudget,
        averageMonthlySpending: analysis.monthlyAverageSpending,
        maxMonthlySpending: analysis.maxMonthlySpending,
        monthsAnalyzed: analysis.analysisMonths,
        frequentlyExceeded: analysis.frequentlyExceeded,
        overBudgetMonths,
        trend: analysis.trend,
        reasoning,
        savingsOpportunity,
        riskLevel,
      };
    })
    .filter((rec) => rec !== null)
    .sort(
      (a, b) =>
        (b as BudgetRecommendation).savingsOpportunity -
        (a as BudgetRecommendation).savingsOpportunity,
    );
}
